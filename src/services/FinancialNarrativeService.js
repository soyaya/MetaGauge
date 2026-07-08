/**
 * FinancialNarrativeService
 * Uses Gemini to write investor-grade narrative for all financial documents.
 *
 * Gemini writes — code calculates.
 * All numbers come from FinancialDocumentEngine output.
 * Gemini only writes the human-readable commentary.
 *
 * Outputs per call:
 *   - Executive Summary (2 paragraphs)
 *   - CFO Commentary per document (6 paragraphs)
 *   - Red Flags & Opportunities (bullet lists)
 *   - Investor Q&A Preparation (5–8 Q&A pairs)
 */

import { GoogleGenAI } from '@google/genai';

function getApiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

class FinancialNarrativeService {
  constructor() {
    this.keys = [];
    this.currentKeyIndex = 0;
    this.clients = {};
    this.initialized = false;
    this.enabled = false;
  }

  initialize() {
    if (this.initialized) return;
    this.keys = getApiKeys();
    this.enabled = this.keys.length > 0;
    this.initialized = true;
    if (!this.enabled) {
      console.warn('[FinancialNarrativeService] No GEMINI_API_KEY — narrative generation disabled');
    }
  }

  _getClient(idx) {
    const key = this.keys[idx % this.keys.length];
    if (!this.clients[key]) this.clients[key] = new GoogleGenAI({ apiKey: key });
    return this.clients[key];
  }

  async _generate(prompt) {
    this.initialize();
    if (!this.enabled) return null;

    let lastErr;
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const idx = (this.currentKeyIndex + attempt) % this.keys.length;
      try {
        const result = await this._getClient(idx).models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
          contents: prompt,
        });
        this.currentKeyIndex = idx;
        return result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err) {
        lastErr = err;
        const msg = err?.message || '';
        const isKeyErr = msg.includes('403') || msg.includes('429') ||
          msg.includes('PERMISSION_DENIED') || msg.includes('quota') ||
          msg.includes('RESOURCE_EXHAUSTED') || msg.includes('SERVICE_DISABLED');
        if (isKeyErr) { console.warn(`[FinancialNarrativeService] Key ${idx + 1} failed, trying next...`); continue; }
        throw err;
      }
    }
    throw lastErr;
  }

  // ── Executive Summary ───────────────────────────────────────────────────

  async generateExecutiveSummary(documents, profile = {}, researchContext = null) {
    const { income_statement: pl, cash_flow_statement: cf,
            unit_economics: ue, kpi_dashboard: kpi } = documents;

    const researchSection = researchContext
      ? `\nSECTOR BENCHMARKS & MARKET CONTEXT:\n${researchContext}\n`
      : '';

    const prompt = `You are a senior CFO writing an executive summary for an investor data room.
Write exactly 2 paragraphs. Be specific — cite actual numbers from the data. Be direct, not promotional.

PROJECT: ${profile.project_stage || 'early-stage'} blockchain protocol
PERIOD: ${documents.period}
${researchSection}
KEY DATA:
- Total Revenue: $${pl?.revenue?.total_revenue ?? 0}
- Gross Margin: ${pl?.gross_margin_pct ?? 0}%
- Net Profit/Loss: $${pl?.net_profit ?? 0}
- Monthly Burn Rate: $${cf?.summary?.monthly_burn_rate ?? 0}
- Runway: ${cf?.summary?.runway_months ?? 'unknown'} months
- Total Users: ${kpi?.kpis?.users?.total ?? 0}
- DAU: ${kpi?.kpis?.users?.active_24h ?? 0}
- Retention Rate: ${kpi?.kpis?.engagement?.retention_rate ?? 0}%
- LTV:CAC Ratio: ${ue?.ratios?.ltv_cac_ratio ?? 'N/A'}
- LTV: $${ue?.lifetime_value?.ltv ?? 0}
- CAC: $${ue?.acquisition?.cac ?? 'N/A'}

Paragraph 1: Describe the financial position — revenue, profitability, burn, runway. Be factual.${researchContext ? ' Compare to sector benchmarks where relevant.' : ''}
Paragraph 2: Describe the user traction and unit economics quality. Assess whether the LTV:CAC ratio indicates a fundable business. Note the single most important risk and opportunity.

Do not use bullet points. Write in prose. Maximum 200 words total.`;

    return await this._generate(prompt) || this._fallbackSummary(documents);
  }

  _fallbackSummary(documents) {
    const pl = documents.income_statement;
    const cf = documents.cash_flow_statement;
    return `For the period ${documents.period}, the protocol generated $${pl?.revenue?.total_revenue ?? 0} in total revenue with a gross margin of ${pl?.gross_margin_pct ?? 0}%. The project is currently ${pl?.net_profit >= 0 ? 'profitable' : 'pre-profitability'} with a net ${pl?.net_profit >= 0 ? 'profit' : 'loss'} of $${Math.abs(pl?.net_profit ?? 0)}.

Current cash runway stands at ${cf?.summary?.runway_months ?? 'unknown'} months at the existing burn rate of $${cf?.summary?.monthly_burn_rate ?? 0}/month. Full AI narrative requires a Gemini API key.`;
  }

  // ── CFO Commentary (one paragraph per document) ─────────────────────────

  async generateCFOCommentary(documents) {
    const commentary = {};
    const docTypes = [
      { key: 'pl',  label: 'Income Statement (P&L)',    data: documents.income_statement },
      { key: 'cf',  label: 'Cash Flow Statement',       data: documents.cash_flow_statement },
      { key: 'bs',  label: 'Balance Sheet',             data: documents.balance_sheet },
      { key: 'ue',  label: 'Unit Economics',            data: documents.unit_economics },
      { key: 'kpi', label: 'KPI Dashboard',             data: documents.kpi_dashboard },
      { key: 'fm',  label: '12-Month Forward Model',    data: documents.forward_model },
    ];

    await Promise.all(docTypes.map(async ({ key, label, data }) => {
      if (!data) { commentary[key] = ''; return; }

      const prompt = `You are a CFO writing a one-paragraph commentary for the ${label} in an investor data room.
Be specific, cite numbers, and give your professional interpretation. Maximum 100 words.
Note what is strong, what needs attention, and one action the team should take.

DATA:
${JSON.stringify(data, null, 2)}

Write one paragraph only. No bullet points. No headings.`;

      commentary[key] = await this._generate(prompt) || `${label} data available. Gemini API key required for AI commentary.`;
    }));

    return commentary;
  }

  // ── Red Flags & Opportunities ───────────────────────────────────────────

  async generateRedFlagsAndOpportunities(documents, profile = {}) {
    const prompt = `You are a venture capital analyst reviewing financial documents for a blockchain protocol.
Identify real, specific issues and opportunities from the data.

DOCUMENTS SUMMARY:
- Revenue: $${documents.income_statement?.revenue?.total_revenue ?? 0}
- Net Profit: $${documents.income_statement?.net_profit ?? 0}
- Runway: ${documents.cash_flow_statement?.summary?.runway_months ?? 'unknown'} months
- Burn Rate: $${documents.cash_flow_statement?.summary?.monthly_burn_rate ?? 0}/month
- Retention: ${documents.kpi_dashboard?.kpis?.engagement?.retention_rate ?? 0}%
- LTV:CAC: ${documents.unit_economics?.ratios?.ltv_cac_ratio ?? 'N/A'}
- Total Users: ${documents.kpi_dashboard?.kpis?.users?.total ?? 0}
- Stage: ${profile.project_stage || 'unknown'}

Return a JSON object with exactly this structure:
{
  "red_flags": ["specific flag 1", "specific flag 2", ...],
  "opportunities": ["specific opportunity 1", "specific opportunity 2", ...]
}

Red flags: things that could kill the project or block fundraising (max 5).
Opportunities: actionable growth levers or fundraising angles (max 5).
Be specific — reference actual numbers from the data.
Return only valid JSON, no markdown.`;

    try {
      const raw = await this._generate(prompt);
      if (!raw) return { red_flags: [], opportunities: [] };
      const cleaned = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        red_flags: ['Unable to generate — Gemini API key required'],
        opportunities: ['Unable to generate — Gemini API key required'],
      };
    }
  }

  // ── Investor Q&A Preparation ────────────────────────────────────────────

  async generateInvestorQA(documents, profile = {}) {
    const prompt = `You are preparing a blockchain protocol founder for investor due diligence questions.
Based on the financial data below, generate the 6 most likely tough questions an investor will ask,
and write concise, honest, data-backed answers the founder should give.

FINANCIAL SNAPSHOT:
- Revenue: $${documents.income_statement?.revenue?.total_revenue ?? 0} (period: ${documents.period})
- Net Profit/Loss: $${documents.income_statement?.net_profit ?? 0}
- Runway: ${documents.cash_flow_statement?.summary?.runway_months ?? 'unknown'} months
- Burn: $${documents.cash_flow_statement?.summary?.monthly_burn_rate ?? 0}/month
- Users: ${documents.kpi_dashboard?.kpis?.users?.total ?? 0}
- Retention: ${documents.kpi_dashboard?.kpis?.engagement?.retention_rate ?? 0}%
- LTV:CAC: ${documents.unit_economics?.ratios?.ltv_cac_ratio ?? 'N/A'}
- Stage: ${profile.project_stage || 'unknown'}
- Revenue model: ${profile.revenue_model || 'unknown'}

Return a JSON array with exactly this structure:
[
  { "question": "...", "answer": "..." },
  ...
]

Questions should be the hardest ones a Series A investor would ask.
Answers should be honest, specific to the data, and 2–4 sentences.
Return only valid JSON, no markdown.`;

    try {
      const raw = await this._generate(prompt);
      if (!raw) return [];
      const cleaned = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return [{ question: 'Q&A generation requires Gemini API key', answer: '' }];
    }
  }

  // ── Full narrative generation (all in one) ──────────────────────────────

  async generateAll(documents, profile = {}, researchContext = null) {
    this.initialize();

    const [executiveSummary, cfoCommentary, redFlagsAndOps, investorQA] = await Promise.all([
      this.generateExecutiveSummary(documents, profile, researchContext),
      this.generateCFOCommentary(documents),
      this.generateRedFlagsAndOpportunities(documents, profile),
      this.generateInvestorQA(documents, profile),
    ]);

    return {
      executive_summary:   executiveSummary,
      cfo_commentary:      cfoCommentary,
      red_flags:           redFlagsAndOps.red_flags || [],
      opportunities:       redFlagsAndOps.opportunities || [],
      investor_qa:         investorQA,
    };
  }
}

export default new FinancialNarrativeService();
