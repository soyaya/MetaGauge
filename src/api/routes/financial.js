/**
 * Financial Intelligence API Routes
 * Handles: inputs, document generation, chat sessions, period management
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query } from '../database/postgres.js';
import {
  getProfile,
  saveProfileField,
  addFundingRound,
  getPeriodInputs,
  savePeriodField,
  getMissingFields,
  getAllInputs,
  getAvailablePeriods,
  isReadyToGenerate,
  parseFieldValue,
  ONE_TIME_FIELDS,
  MONTHLY_FIELDS,
  currentPeriod,
} from '../../services/FinancialProfileService.js';

// ── Helper: parse and persist a [[SAVE:field|value]] tag emitted by the AI ──
// This is the ONLY mechanism that turns a chat answer into a saved financial
// input — without it, the conversation collects nothing (see /chat below).

const SAVE_TAG_RE = /\[\[SAVE:([a-z_]+)\|([\s\S]+?)\]\]\s*$/i;

async function applySaveTag(rawResponse, userId, contractId, period) {
  const match = rawResponse.match(SAVE_TAG_RE);
  if (!match) return { text: rawResponse, saved: null };

  const [, field, rawValue] = match;
  const text = rawResponse.replace(SAVE_TAG_RE, '').trim();

  try {
    if (field === 'funding_round') {
      const round = JSON.parse(rawValue);
      if (!round.round || round.amount_usd == null) throw new Error('incomplete funding round');
      await addFundingRound(userId, contractId, round);
      return { text, saved: 'funding_round' };
    }

    const oneTimeDef = ONE_TIME_FIELDS.find(f => f.key === field);
    const monthlyDef = MONTHLY_FIELDS.find(f => f.key === field);
    const fieldDef = oneTimeDef || monthlyDef;
    if (!fieldDef) throw new Error(`unknown field in SAVE tag: ${field}`);

    const parsedValue = parseFieldValue(fieldDef, rawValue.trim());
    if (oneTimeDef) {
      await saveProfileField(userId, contractId, field, parsedValue);
    } else {
      await savePeriodField(userId, contractId, period, field, parsedValue);
    }
    return { text, saved: field };
  } catch (err) {
    // A malformed/invalid SAVE tag should never break the chat — just skip persisting
    // and let the AI re-ask on the next turn (the field will still show as missing).
    console.warn('[financial/chat] Failed to apply SAVE tag:', err.message);
    return { text, saved: null };
  }
}
import {
  getOrCreateSession,
  updateSession,
  saveMessage,
  getRecentMessages,
  buildGeminiContext,
  buildFinancialSystemPrompt,
  buildSummaryRefreshPrompt,
} from '../../services/FinancialChatSessionService.js';
import { buildAllDocuments } from '../../services/FinancialDocumentEngine.js';
import narrativeService from '../../services/FinancialNarrativeService.js';
import { generateFinancialPDF } from '../../services/FinancialPDFGenerator.js';
import { createReadStream, existsSync } from 'fs';
import ResearchAgent from '../../services/ResearchAgent.js';
import GrowthFingerprintEngine from '../../services/GrowthFingerprintEngine.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ── Helper: resolve contractId from address+chain ──────────────────────────

async function resolveContractId(userId, contractAddress, chain) {
  if (!contractAddress) return null;
  const result = await query(
    `SELECT id FROM contracts WHERE user_id = $1 AND LOWER(target_address) = $2 AND target_chain = $3 LIMIT 1`,
    [userId, contractAddress.toLowerCase(), chain || 'ethereum']
  );
  return result.rows[0]?.id || null;
}

// ── Helper: fetch on-chain metrics snapshot for document engine ────────────

async function fetchOnChainSnapshot(contractId) {
  if (!contractId) return {};
  try {
    const result = await query(
      `SELECT data FROM metrics WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [contractId]
    );
    const raw = result.rows[0]?.data || {};

    // Normalise field names to what FinancialDocumentEngine expects
    return {
      totalTransactions:  raw.totalTransactions  || raw.total_transactions  || 0,
      uniqueUsers:        raw.uniqueUsers         || raw.unique_users        || 0,
      newUsers:           raw.newUsers            || raw.new_users           || 0,
      activeUsers:        raw.activeUsers         || raw.active_users        || 0,
      dau:                raw.dau                 || 0,
      wau:                raw.wau                 || 0,
      mau:                raw.mau                 || 0,
      totalVolumeEth:     raw.totalVolumeEth      || raw.total_volume_eth    || 0,
      totalFeeEth:        raw.totalFeeEth         || raw.total_fee_eth       || 0,
      retentionRate:      raw.retentionRate       || raw.retention_rate      || 0,
      churnRate:          raw.churnRate           || raw.churn_rate          || 0,
      d1Retention:        raw.d1Retention         || 0,
      d7Retention:        raw.d7Retention         || 0,
      d30Retention:       raw.d30Retention        || 0,
      bounceRate:         raw.bounceRate          || raw.bounce_rate         || 0,
      activationRate:     raw.activationRate      || raw.activation_rate     || 0,
      txSuccessRate:      raw.txSuccessRate       || raw.tx_success_rate     || 0,
      averageGasCostUSD:  raw.averageGasCostUSD   || raw.avg_gas_cost_usd    || 0,
    };
  } catch {
    return {};
  }
}

// ── GET /api/financial/inputs ─────────────────────────────────────────────
// Returns all saved inputs for a user+contract

router.get('/inputs', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const period = req.query.period || currentPeriod();
    const inputs = await getAllInputs(req.user.id, contractId, period);
    res.json({ success: true, ...inputs });
  } catch (err) {
    console.error('[financial/inputs GET]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/financial/inputs/missing ────────────────────────────────────
// Returns fields still needed — drives the AI chat collector

router.get('/inputs/missing', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const missing = await getMissingFields(req.user.id, contractId);
    res.json({ success: true, ...missing });
  } catch (err) {
    console.error('[financial/inputs/missing]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/financial/inputs ────────────────────────────────────────────
// Save one or more input fields (profile or monthly)

router.post('/inputs', async (req, res) => {
  try {
    const { contractAddress, chain, field, value, period, fundingRound } = req.body;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    // Special case: funding round
    if (fundingRound) {
      await addFundingRound(req.user.id, contractId, fundingRound);
      return res.json({ success: true, saved: 'funding_round' });
    }

    // Determine if it's a one-time or monthly field
    const isOneTime = ONE_TIME_FIELDS.some(f => f.key === field);
    const isMonthly = MONTHLY_FIELDS.some(f => f.key === field);

    if (!isOneTime && !isMonthly) {
      return res.status(400).json({ error: `Unknown field: ${field}` });
    }

    // Find field definition and parse value
    const fieldDef = [...ONE_TIME_FIELDS, ...MONTHLY_FIELDS].find(f => f.key === field);
    const parsedValue = parseFieldValue(fieldDef, value);

    if (isOneTime) {
      await saveProfileField(req.user.id, contractId, field, parsedValue);
    } else {
      const targetPeriod = period || currentPeriod();
      await savePeriodField(req.user.id, contractId, targetPeriod, field, parsedValue);
    }

    res.json({ success: true, saved: field, value: parsedValue });
  } catch (err) {
    console.error('[financial/inputs POST]', err);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/financial/documents/generate ───────────────────────────────
// Trigger full document generation for a period

router.post('/documents/generate', async (req, res) => {
  try {
    const { contractAddress, chain, period } = req.body;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const targetPeriod = period || currentPeriod();

    // Check readiness
    const missing = await getMissingFields(req.user.id, contractId);
    if (!missing.complete) {
      return res.status(400).json({
        error: 'Missing required inputs',
        missing: {
          oneTime: missing.missingOneTime.map(f => f.key),
          monthly: missing.missingMonthly.map(f => f.key),
          fundingRounds: missing.missingFundingRounds,
        },
      });
    }

    // Gather all data
    const [inputs, onChain] = await Promise.all([
      getAllInputs(req.user.id, contractId, targetPeriod),
      fetchOnChainSnapshot(contractId),
    ]);
    inputs.period = targetPeriod;

    // Pull research context for Gemini narrative enrichment (if available)
    let researchContext = null;
    try {
      const contractInfo = await query(`SELECT target_address AS address, target_chain AS chain FROM contracts WHERE id=$1`, [contractId]);
      if (contractInfo.rows[0]) {
        researchContext = await ResearchAgent.getRAGContext(
          contractInfo.rows[0].address, contractInfo.rows[0].chain
        );
      }
    } catch { /* research context is optional */ }

    // Cumulative net profit from all earlier periods — the balance sheet needs
    // this so retained earnings reflects real profit history, not a plug.
    let priorRetainedEarnings = 0;
    try {
      const priorDocs = await query(
        `SELECT income_statement FROM financial_documents
         WHERE user_id=$1 AND contract_id=$2 AND period < $3`,
        [req.user.id, contractId, targetPeriod]
      );
      priorRetainedEarnings = priorDocs.rows.reduce(
        (sum, row) => sum + (typeof row.income_statement?.net_profit === 'number' ? row.income_statement.net_profit : 0),
        0
      );
    } catch { /* default to 0 — first period or lookup failure */ }

    // Calculate documents
    const documents = await buildAllDocuments(onChain, inputs, {}, null, { priorRetainedEarnings });

    // Generate Gemini narratives (with research context injected)
    const narratives = await narrativeService.generateAll(documents, inputs.profile, researchContext);

    // Merge narratives into documents
    const fullDocs = {
      ...documents,
      executive_summary: narratives.executive_summary,
      cfo_commentary:    narratives.cfo_commentary,
      red_flags:         narratives.red_flags,
      opportunities:     narratives.opportunities,
      investor_qa:       narratives.investor_qa,
    };

    // Save to DB
    await query(
      `INSERT INTO financial_documents
         (user_id, contract_id, period,
          income_statement, cash_flow_statement, balance_sheet,
          unit_economics, kpi_dashboard, forward_model,
          executive_summary, cfo_commentary, red_flags, investor_qa)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (user_id, contract_id, period)
       DO UPDATE SET
         income_statement    = EXCLUDED.income_statement,
         cash_flow_statement = EXCLUDED.cash_flow_statement,
         balance_sheet       = EXCLUDED.balance_sheet,
         unit_economics      = EXCLUDED.unit_economics,
         kpi_dashboard       = EXCLUDED.kpi_dashboard,
         forward_model       = EXCLUDED.forward_model,
         executive_summary   = EXCLUDED.executive_summary,
         cfo_commentary      = EXCLUDED.cfo_commentary,
         red_flags           = EXCLUDED.red_flags,
         investor_qa         = EXCLUDED.investor_qa,
         generated_at        = NOW()`,
      [
        req.user.id, contractId, targetPeriod,
        JSON.stringify(fullDocs.income_statement),
        JSON.stringify(fullDocs.cash_flow_statement),
        JSON.stringify(fullDocs.balance_sheet),
        JSON.stringify(fullDocs.unit_economics),
        JSON.stringify(fullDocs.kpi_dashboard),
        JSON.stringify(fullDocs.forward_model),
        fullDocs.executive_summary,
        JSON.stringify(fullDocs.cfo_commentary),
        JSON.stringify(fullDocs.red_flags),
        JSON.stringify(fullDocs.investor_qa),
      ]
    );

    // Update chat session mode to analysis
    const session = await getOrCreateSession(req.user.id, contractId);
    await updateSession(session.id, { mode: 'analysis' });

    // Trigger growth fingerprint computation async (don't block response)
    GrowthFingerprintEngine.computeAndSave(
      contractAddress, chain, onChain,
      [{ income_statement: fullDocs.income_statement, unit_economics: fullDocs.unit_economics, period: targetPeriod }]
    ).catch(e => console.warn('[Fingerprint] Auto-compute failed:', e.message));

    res.json({ success: true, period: targetPeriod, documents: fullDocs });
  } catch (err) {
    console.error('[financial/documents/generate]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/financial/documents/latest ──────────────────────────────────
// Get most recent generated documents

router.get('/documents/latest', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const result = await query(
      `SELECT * FROM financial_documents
       WHERE user_id = $1 AND contract_id = $2
       ORDER BY period DESC LIMIT 1`,
      [req.user.id, contractId]
    );

    if (result.rows.length === 0) return res.json({ success: true, documents: null });
    res.json({ success: true, documents: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/financial/documents/:period ─────────────────────────────────
// Get documents for a specific period

router.get('/documents/:period', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const result = await query(
      `SELECT * FROM financial_documents
       WHERE user_id = $1 AND contract_id = $2 AND period = $3`,
      [req.user.id, contractId, req.params.period]
    );

    if (result.rows.length === 0) return res.json({ success: true, documents: null });
    res.json({ success: true, documents: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/financial/periods ────────────────────────────────────────────
// Get all periods with saved inputs (for period selector)

router.get('/periods', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const periods = await getAvailablePeriods(req.user.id, contractId);
    res.json({ success: true, periods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/financial/chat ──────────────────────────────────────────────
// Financial AI chat — persistent context per user per contract

router.post('/chat', async (req, res) => {
  try {
    const { contractAddress, chain, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    // Get or create session
    const session = await getOrCreateSession(req.user.id, contractId);

    // Get contract name for context
    const contractResult = await query(
      `SELECT name, target_chain AS chain FROM contracts WHERE id = $1`, [contractId]
    );
    const contractMeta = contractResult.rows[0] || {};

    // Load current state
    const [missing, latestDocs, geminiCtx] = await Promise.all([
      getMissingFields(req.user.id, contractId),
      query(`SELECT * FROM financial_documents WHERE user_id=$1 AND contract_id=$2 ORDER BY period DESC LIMIT 1`,
        [req.user.id, contractId]),
      buildGeminiContext(session.id, session),
    ]);

    const documents = latestDocs.rows[0] || null;

    // Determine current mode
    let mode = missing.mode; // from profile service
    if (missing.complete && documents) mode = 'analysis';

    // Build system prompt
    const systemPrompt = buildFinancialSystemPrompt({
      mode,
      missingOneTime:     missing.missingOneTime,
      missingMonthly:     missing.missingMonthly,
      missingFundingRounds: missing.missingFundingRounds,
      period:             missing.period,
      profile:            missing.profile || {},
      documents:          documents,
      contextSummary:     geminiCtx.contextSummary,
      recentMessages:     geminiCtx.recentMessages,
      projectName:        contractMeta.name || contractAddress,
      chain:              contractMeta.chain || chain,
    });

    // Save user message
    await saveMessage(session.id, 'user', message);

    // Call Gemini
    narrativeService.initialize();
    let aiResponse = 'I need a Gemini API key to respond. Please configure GEMINI_API_KEY.';

    if (narrativeService.enabled) {
      const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nRespond as the financial AI:`;
      aiResponse = await narrativeService._generate(fullPrompt) || aiResponse;
    }

    // Parse and persist any [[SAVE:field|value]] tag the AI emitted — this is
    // what actually turns the conversation into saved financial_profiles /
    // financial_period_inputs rows. The tag is stripped before the user sees it.
    const { text: visibleResponse, saved: fieldCollected } =
      await applySaveTag(aiResponse, req.user.id, contractId, missing.period);
    aiResponse = visibleResponse;

    // Save AI response
    await saveMessage(session.id, 'assistant', aiResponse, fieldCollected);

    // Refresh context summary every 10 messages
    if (geminiCtx.shouldRefreshSummary && narrativeService.enabled) {
      const allMsgs = await getRecentMessages(session.id, 30);
      const summaryPrompt = buildSummaryRefreshPrompt(allMsgs, geminiCtx.contextSummary);
      const newSummary = await narrativeService._generate(summaryPrompt);
      if (newSummary) await updateSession(session.id, { contextSummary: newSummary });
    }

    // If a field was just saved, re-check completeness so the response (and the
    // frontend's auto-generate-documents trigger) reflect the new state, not
    // the stale pre-save snapshot.
    let finalMissing = missing;
    let finalMode = mode;
    if (fieldCollected) {
      finalMissing = await getMissingFields(req.user.id, contractId);
      finalMode = finalMissing.complete ? 'analysis' : finalMissing.mode;
    }

    // Update session mode
    await updateSession(session.id, { mode: finalMode });

    res.json({
      success: true,
      response: aiResponse,
      mode: finalMode,
      period:  finalMissing.period,
      complete: finalMissing.complete,
      missingCount: finalMissing.missingOneTime.length + finalMissing.missingMonthly.length,
    });
  } catch (err) {
    console.error('[financial/chat]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/financial/chat/history ──────────────────────────────────────
// Get chat message history for a contract

router.get('/chat/history', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const session = await getOrCreateSession(req.user.id, contractId);
    const messages = await getRecentMessages(session.id, 50);

    res.json({ success: true, messages, mode: session.financial_mode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/financial/export/pdf ────────────────────────────────────────
// Generate and stream a PDF for a given period

router.post('/export/pdf', async (req, res) => {
  try {
    const { contractAddress, chain, period } = req.body;
    const contractId = await resolveContractId(req.user.id, contractAddress, chain);
    if (!contractId) return res.status(404).json({ error: 'Contract not found' });

    const targetPeriod = period || currentPeriod();

    // Load saved documents
    const result = await query(
      `SELECT * FROM financial_documents WHERE user_id=$1 AND contract_id=$2 AND period=$3`,
      [req.user.id, contractId, targetPeriod]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No documents found for this period. Generate documents first.' });
    }

    const docRow = result.rows[0];

    // Get contract name
    const contractResult = await query(`SELECT name, target_address AS address, target_chain AS chain FROM contracts WHERE id=$1`, [contractId]);
    const contract = contractResult.rows[0] || {};

    // Reconstruct full docs object
    const docs = {
      period: docRow.period,
      income_statement:    docRow.income_statement,
      cash_flow_statement: docRow.cash_flow_statement,
      balance_sheet:       docRow.balance_sheet,
      unit_economics:      docRow.unit_economics,
      kpi_dashboard:       docRow.kpi_dashboard,
      forward_model:       docRow.forward_model,
      executive_summary:   docRow.executive_summary,
      cfo_commentary:      docRow.cfo_commentary,
      red_flags:           docRow.red_flags,
      opportunities:       [],  // stored inside red_flags JSON for older records
      investor_qa:         docRow.investor_qa,
    };

    const pdfPath = await generateFinancialPDF(docs, {
      projectName: contract.name || contractAddress,
      contractAddress: contract.address || contractAddress,
      chain: contract.chain || chain,
    });

    // Save PDF path to DB
    await query(
      `UPDATE financial_documents SET pdf_path=$1 WHERE user_id=$2 AND contract_id=$3 AND period=$4`,
      [pdfPath, req.user.id, contractId, targetPeriod]
    );

    // Stream PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="MetaGauge_${contract.name || 'Report'}_${targetPeriod}.pdf"`);
    createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error('[financial/export/pdf]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
