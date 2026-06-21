/**
 * TractionNarrator
 * Generates investor/marketing content from real indexed metrics.
 * Calls Gemini directly (bypasses AgentService's component-JSON wrapper)
 * so each content type gets clean, parseable output.
 */
import { GoogleGenAI } from '@google/genai';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getApiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

async function callGemini(prompt) {
  const keys = getApiKeys();
  if (!keys.length) throw new Error('No Gemini API keys configured');
  let lastErr;
  for (const key of keys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const res = await ai.models.generateContent({
        model: MODEL,
        config: { generationConfig: { temperature: 0.4 } },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return res.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      const isKeyErr = /403|429|PERMISSION_DENIED|API_KEY|blocked|quota|RESOURCE_EXHAUSTED|disabled/i.test(msg);
      if (!isKeyErr) throw err;
    }
  }
  throw lastErr;
}

// ── Metric snapshot ──────────────────────────────────────────────────────────

async function fetchMetricSnapshot(userId) {
  try {
    const { AnalysisStorage } = await import('../api/database/index.js');
    const { buildFullReportFromAnalysis } = await import('../api/routes/onboarding.js');
    const { priceService } = await import('./PriceService.js');
    const all = await AnalysisStorage.findByUserId(userId);
    const latest = all
      .filter(a => a.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];
    if (!latest) return null;
    const txs      = latest.results?.target?.transactions || [];
    const metrics  = latest.results?.target?.metrics || {};
    const contract = latest.results?.target?.contract || {};
    const ethPrice = await priceService.getPrice('eth').catch(() => 2500);
    const fr = buildFullReportFromAnalysis(txs, metrics, { ...contract, _ethPriceUSD: ethPrice });
    return {
      fr,
      contractName: contract.name || contract.address || 'Smart Contract',
      contractAddress: contract.address || '',
      chain: contract.chain || 'ethereum',
      txCount: txs.length,
    };
  } catch { return null; }
}

function buildMetricBlock(snap) {
  if (!snap) return null;
  const { fr, contractName, chain, txCount } = snap;
  const ret  = fr.retentionMetrics   || {};
  const act  = fr.activationMetrics  || {};
  const gas  = fr.gasAnalysis        || {};
  const dm   = fr.defiMetrics        || {};
  const sum  = fr.summary            || {};
  const qual = fr.userQualityMetrics || {};
  const fmt  = (v, suffix = '') => (v != null && v !== 0) ? `${v}${suffix}` : '—';

  return `CONTRACT: ${contractName} (${chain})
Indexed transactions: ${txCount}

USER METRICS
  Total Unique Users   : ${fmt(sum.uniqueUsers)}
  Total Transactions   : ${fmt(sum.totalTransactions)}
  Daily Active (DAU)   : ${fmt(dm.dau)}
  Weekly Active (WAU)  : ${fmt(dm.wau)}
  Monthly Active (MAU) : ${fmt(dm.mau)}

RETENTION
  D1  (next-day)       : ${fmt(ret.d1Retention, '%')}
  D7  (week)           : ${fmt(ret.d7Retention, '%')}
  D30 (month)          : ${fmt(ret.d30Retention, '%')}
  Overall Retention    : ${fmt(ret.retentionRate, '%')}
  Churn Rate           : ${fmt(ret.churnRate, '%')}
  Resurrection Rate    : ${fmt(ret.resurrectionRate, '%')}

ACTIVATION & ENGAGEMENT
  Activation Rate      : ${fmt(act.activationRate, '%')}  (wallets with ≥2 txs)
  Bounce Rate          : ${fmt(dm.bounceRate, '%')}  (one-and-done wallets)
  Avg Time to Activation: ${act.avgTimeToActivation || '—'}
  Power User Rate      : ${fmt(qual.powerUserRate, '%')}
  Bot Activity         : ${fmt(qual.botPct, '%')}
  Protocol Stickiness  : ${fmt(dm.protocolStickiness, '%')}

FINANCIAL & GAS
  Token Supply Value   : ${dm.tvl != null ? '$' + Number(dm.tvl).toLocaleString() : '—'}
  Tx Success Rate      : ${fmt(sum.successRate, '%')}
  Gas Efficiency       : ${fmt(gas.gasEfficiencyScore, '%')}
  Total Gas Spent      : $${gas.totalGasCostUSD || 0}
  Avg Gas / Tx         : $${gas.averageGasCostUSD || 0}`;
}

// ── Prompt builders — audience-aware, format-specific ────────────────────────

function promptInvestorSummary(metricBlock) {
  const data = metricBlock
    ? `\n\n--- VERIFIED ON-CHAIN DATA (do not change or invent numbers) ---\n${metricBlock}\n---\n`
    : '\n\n(No indexed data yet — use placeholder values and flag them.)\n';
  return `You are a blockchain analyst writing a traction memo for a professional investor.
Audience: Seed/Series-A VCs, angels, and crypto fund analysts. Tone: concise, data-driven, honest.${data}
Write the memo in this exact structure. Use **bold** for each section header:

**CONTRACT OVERVIEW**
What this smart contract does and its market context. (2-3 sentences)

**TRACTION SNAPSHOT**
Every metric from the data as a bullet: • [Metric]: [exact value] — [what it signals to an investor]

**BENCHMARK COMPARISON**
Compare the 5 most telling metrics against DeFi/Web3 category benchmarks:
• [Metric]: [our value] vs [benchmark] → [above average / below average / on par]
Use these reference benchmarks: D1 ~20%, D7 ~10%, D30 ~6%, Activation ~40%, Bounce <35%, Churn <25%.

**GROWTH NARRATIVE**
What the data collectively says about growth trajectory and product-market fit. (2-3 sentences, no fluff)

**RISK FACTORS**
2-3 honest risks visible in the data (e.g. high bounce, low D30).

**OPPORTUNITIES**
3 high-impact actions tied to specific weak metrics, each with expected outcome.

**VERDICT**
One clear sentence: investment signal (strong / early traction / watch / not yet) and primary reason.

Rules: use exact numbers, no invented figures, under 500 words total.`;
}

function promptTwitterThread(metricBlock) {
  const data = metricBlock
    ? `\n\n--- ON-CHAIN DATA (use exact numbers) ---\n${metricBlock}\n---\n`
    : '\n\n(No indexed data yet.)\n';
  return `You are a Web3 growth marketer writing a Twitter/X thread for a smart contract project.
Audience: crypto Twitter — developers, DeFi users, investors. Tone: confident, punchy, numbers-forward.${data}
Write 6-7 tweets following this structure:
Tweet 1 — HOOK: Most impressive metric as a bold opening claim. Start with a number.
Tweet 2 — USER GROWTH: DAU/WAU/MAU or total users with context.
Tweet 3 — RETENTION: D7 or D30 retention with what it means vs industry.
Tweet 4 — ACTIVATION: Activation rate and what drives return users.
Tweet 5 — QUALITY: Power users, success rate, or gas efficiency.
Tweet 6 — NARRATIVE: What the data story means for the protocol's future.
Tweet 7 — CTA: "Track your own smart contract → metagauge.xyz" (optional, include only if space allows)

STRICT RULES:
- Every tweet ≤ 240 characters (hard limit)
- Use EXACT numbers from the data — never round, never invent
- No hashtags unless they fit naturally within the char limit
- Return ONLY a valid JSON array of strings, no other text before or after:
["tweet 1", "tweet 2", ...]`;
}

function promptPitchSlide(metricBlock) {
  const data = metricBlock
    ? `\n\n--- ON-CHAIN DATA (use exact numbers) ---\n${metricBlock}\n---\n`
    : '\n\n(No indexed data yet.)\n';
  return `You are a pitch deck consultant creating the "Traction" slide for a blockchain startup.
Audience: VCs in a 5-minute pitch meeting. Every word must earn its place.${data}
Return ONLY a valid JSON object. No text before or after the JSON. No markdown code fences.

{
  "headline": "Single strongest metric as a compelling headline — max 10 words",
  "subheadline": "One supporting sentence giving context — max 15 words",
  "highlight": "The investor punchline — one short phrase (e.g. '2.1x DeFi average D7 retention')",
  "bullets": [
    "• D1 / D7 / D30 Retention: [exact values]% — vs [DeFi benchmark], [above/below] average",
    "• Activation: [exact value]% of wallets return for a 2nd transaction",
    "• [Strongest growth metric]: [exact value] — [investor-relevant context]",
    "• Power Users: [exact value]% of wallets are high-frequency — signals loyal core",
    "• Tx Success Rate: [exact value]% — [reliability signal]"
  ],
  "chart_data": [
    { "label": "D1 Retention",    "value": "[exact %]", "benchmark": "~20%" },
    { "label": "D7 Retention",    "value": "[exact %]", "benchmark": "~10%" },
    { "label": "D30 Retention",   "value": "[exact %]", "benchmark": "~6%"  },
    { "label": "Activation Rate", "value": "[exact %]", "benchmark": "~40%" },
    { "label": "Power Users",     "value": "[exact %]", "benchmark": "~15%" }
  ],
  "footnote": "Verified on-chain data · MetaGauge · metagauge.xyz · ${new Date().toLocaleDateString('en-GB')}"
}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export class TractionNarrator {
  static async generate(userId, type, { contractAddress, chain } = {}) {
    const snap = await fetchMetricSnapshot(userId);
    const metricBlock = buildMetricBlock(snap);

    let prompt;
    if (type === 'investor_summary') prompt = promptInvestorSummary(metricBlock);
    else if (type === 'twitter_thread') prompt = promptTwitterThread(metricBlock);
    else if (type === 'pitch_slide') prompt = promptPitchSlide(metricBlock);
    else throw new Error(`Unknown content type: ${type}`);

    const raw = await callGemini(prompt);

    return {
      content: raw.trim(),
      type,
      hasRealData: !!snap,
      metrics: snap ? {
        uniqueUsers:    snap.fr.summary?.uniqueUsers,
        totalTx:        snap.fr.summary?.totalTransactions,
        d7Retention:    snap.fr.retentionMetrics?.d7Retention,
        activationRate: snap.fr.activationMetrics?.activationRate,
        contractName:   snap.contractName,
      } : null,
      generatedAt: new Date().toISOString(),
    };
  }
}
