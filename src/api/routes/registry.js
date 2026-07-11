/**
 * Registry & Recommendations API
 *
 * POST /api/registry/opt-in           — opt a project into the Discover tab
 * POST /api/registry/opt-out          — remove a project from the Discover tab
 * GET  /api/registry/status           — get opt-in status for user's contract
 * GET  /api/registry/projects         — list all active featured projects
 * GET  /api/registry/projects/:addr/:chain — single project card
 * GET  /api/registry/recommendations  — top high-growth projects
 * POST /api/registry/recommendations/search — NL search
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query } from '../database/postgres.js';
import ProjectRegistryService from '../../services/ProjectRegistryService.js';
import RecommendationEngine from '../../services/RecommendationEngine.js';
import GrowthFingerprintEngine from '../../services/GrowthFingerprintEngine.js';
import { createPaystackCheckout } from './billing.js';
import { FEATURED_PRICING } from '../../config/pricing.js';

const router = Router();
router.use(authenticateToken);

// ── Helper: resolve contract ───────────────────────────────────────────────

async function resolveContract(userId, contractAddress, chain) {
  const result = await query(
    `SELECT id, name, target_address AS address, target_chain AS chain FROM contracts
     WHERE user_id=$1 AND LOWER(target_address)=$2 AND target_chain=$3 LIMIT 1`,
    [userId, contractAddress?.toLowerCase(), chain || 'ethereum']
  );
  return result.rows[0] || null;
}

// ── POST /api/registry/opt-in ──────────────────────────────────────────────

router.post('/opt-in', async (req, res) => {
  try {
    const {
      contractAddress, chain,
      displayName, category, stage,
      contactEmail, contactWebsite, documentsPublic,
    } = req.body;

    const contract = await resolveContract(req.user.id, contractAddress, chain);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    // Featuring is a paid upgrade — this endpoint only edits an *already-paid*
    // listing's details. First-time activation happens via /feature/checkout
    // + payment webhook (ProjectRegistryService.activateFeatured).
    const existing = await ProjectRegistryService.getRegistration(req.user.id, contract.id);
    if (!existing || !existing.is_active) {
      return res.status(402).json({
        error: 'Payment required',
        message: `Featuring a project costs $${FEATURED_PRICING.monthly}/month or $${FEATURED_PRICING.yearly}/year. Start checkout to activate.`,
      });
    }

    await ProjectRegistryService.optIn(
      req.user.id, contract.id,
      contractAddress, chain,
      { displayName: displayName || contract.name, category, stage, contactEmail, contactWebsite, documentsPublic }
    );

    // Trigger fingerprint computation if not already done
    try {
      const existingFingerprint = await GrowthFingerprintEngine.loadFingerprint(contractAddress, chain);
      if (!existingFingerprint) {
        // Pull on-chain data and trigger fingerprint async (don't block response)
        const metricsResult = await query(
          `SELECT data FROM metrics WHERE contract_id=$1 ORDER BY created_at DESC LIMIT 1`,
          [contract.id]
        );
        const onChain = metricsResult.rows[0]?.data || {};
        GrowthFingerprintEngine.computeAndSave(contractAddress, chain, onChain, []).catch(() => {});
      }
    } catch { /* non-fatal */ }

    res.json({ success: true, message: 'Project details updated' });
  } catch (err) {
    console.error('[registry/opt-in]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/registry/feature/checkout ────────────────────────────────────
// Start a paid checkout to feature (or renew) a project. On successful
// payment, the Paystack/Flutterwave webhook calls activateFeatured().

router.post('/feature/checkout', async (req, res) => {
  try {
    const { contractAddress, chain, plan } = req.body;
    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'plan must be "monthly" or "yearly"' });
    }

    const contract = await resolveContract(req.user.id, contractAddress, chain);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const amountUSD = FEATURED_PRICING[plan];
    const { url, reference } = await createPaystackCheckout({
      user: req.user,
      amountUSD,
      callbackPath: `/profile?featured=1&provider=paystack`,
      metadata: {
        purpose: 'feature_project',
        contractId: contract.id,
        contractAddress: contract.address,
        chain: contract.chain,
        plan,
      },
    });

    res.json({ success: true, url, reference, amountUSD, plan });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

// ── POST /api/registry/opt-out ─────────────────────────────────────────────

router.post('/opt-out', async (req, res) => {
  try {
    const { contractAddress, chain } = req.body;
    const contract = await resolveContract(req.user.id, contractAddress, chain);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    await ProjectRegistryService.optOut(req.user.id, contract.id);
    res.json({ success: true, message: 'Project removed from Discover tab' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/registry/status ───────────────────────────────────────────────

router.get('/status', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    const contract = await resolveContract(req.user.id, contractAddress, chain);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const reg = await ProjectRegistryService.getRegistration(req.user.id, contract.id);
    const fp  = await GrowthFingerprintEngine.loadFingerprint(contractAddress, chain);

    const paidUntil = reg?.paid_until ? new Date(reg.paid_until) : null;
    const daysRemaining = paidUntil ? Math.max(0, Math.ceil((paidUntil - Date.now()) / 86400000)) : null;

    res.json({
      success: true,
      registered: !!reg && reg.is_active,
      registration: reg || null,
      plan: reg?.plan || null,
      paidUntil: reg?.paid_until || null,
      daysRemaining,
      pricing: FEATURED_PRICING,
      fingerprint: fp ? {
        match_score:   fp.match_score,
        matched_comps: fp.matched_comps,
        stage:         fp.stage,
        cac_trend:     fp.cac_trend,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/registry/projects ─────────────────────────────────────────────

router.get('/projects', async (req, res) => {
  try {
    const { chain, category, stage, minScore, limit, offset } = req.query;
    const projects = await ProjectRegistryService.getRegistry({
      chain, category, stage,
      minMatchScore: parseInt(minScore || '0'),
      limit: parseInt(limit || '50'),
      offset: parseInt(offset || '0'),
    });
    res.json({ success: true, projects, count: projects.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/registry/projects/:addr/:chain ────────────────────────────────

router.get('/projects/:contractAddress/:chain', async (req, res) => {
  try {
    const { contractAddress, chain } = req.params;
    const card = await ProjectRegistryService.getProjectCard(contractAddress, chain, req.user.id);
    if (!card) return res.status(404).json({ error: 'Project not found or not featured' });
    res.json({ success: true, project: card });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/registry/recommendations ─────────────────────────────────────
// Top high-growth projects (match score >= 60) with AI briefs

router.get('/recommendations', async (req, res) => {
  try {
    const { chain, category, minScore } = req.query;
    const projects = await RecommendationEngine.findHighGrowthProjects({
      chain, category,
      minScore: parseInt(minScore || '60'),
      limit: 10,
    });

    // Generate AI briefs in parallel (with timeout protection)
    const withBriefs = await Promise.all(
      projects.map(async (p) => {
        try {
          const brief = await Promise.race([
            RecommendationEngine.generateInvestorBrief(p),
            new Promise(r => setTimeout(() => r(null), 8000)),
          ]);
          return { ...p, investor_brief: brief };
        } catch {
          return { ...p, investor_brief: null };
        }
      })
    );

    res.json({ success: true, recommendations: withBriefs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/registry/recommendations/search ──────────────────────────────

router.post('/recommendations/search', async (req, res) => {
  try {
    const { query: searchQuery } = req.body;
    if (!searchQuery?.trim()) return res.status(400).json({ error: 'query required' });

    const filters = RecommendationEngine.parseSearchQuery(searchQuery);
    const projects = await RecommendationEngine.findHighGrowthProjects({ ...filters, limit: 10 });

    const withBriefs = await Promise.all(
      projects.slice(0, 5).map(async (p) => {
        const brief = await Promise.race([
          RecommendationEngine.generateInvestorBrief(p),
          new Promise(r => setTimeout(() => r(null), 8000)),
        ]).catch(() => null);
        return { ...p, investor_brief: brief };
      })
    );

    res.json({
      success: true,
      parsed_filters: filters,
      results: withBriefs,
      count: withBriefs.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/registry/fingerprint/compute ─────────────────────────────────
// Manually trigger fingerprint computation for a contract

router.post('/fingerprint/compute', async (req, res) => {
  try {
    const { contractAddress, chain } = req.body;
    const contract = await resolveContract(req.user.id, contractAddress, chain);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const metricsResult = await query(
      `SELECT data FROM metrics WHERE contract_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [contract.id]
    );
    const onChain = metricsResult.rows[0]?.data || {};

    // Get financial documents for revenue acceleration
    const docsResult = await query(
      `SELECT income_statement, unit_economics, period
       FROM financial_documents WHERE contract_id=$1 ORDER BY period ASC`,
      [contract.id]
    );
    const financialData = docsResult.rows;

    const result = await GrowthFingerprintEngine.computeAndSave(
      contractAddress, chain, onChain, financialData
    );

    res.json({ success: true, fingerprint: result });
  } catch (err) {
    console.error('[registry/fingerprint/compute]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
