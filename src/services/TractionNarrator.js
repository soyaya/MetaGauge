import AgentService from './AgentService.js';

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
    return { fr, contractName: contract.name || contract.address || 'Unknown', chain: contract.chain || 'ethereum', txCount: txs.length };
  } catch { return null; }
}

function buildMetricContext(snap) {
  if (!snap) return null;
  const { fr, contractName, chain, txCount } = snap;
  const ret  = fr.retentionMetrics   || {};
  const act  = fr.activationMetrics  || {};
  const gas  = fr.gasAnalysis        || {};
  const dm   = fr.defiMetrics        || {};
  const sum  = fr.summary            || {};
  const qual = fr.userQualityMetrics || {};
  return `CONTRACT: ${contractName} on ${chain}
INDEXED TRANSACTIONS: ${txCount}
Total Users: ${sum.uniqueUsers || 0}
Total Transactions: ${sum.totalTransactions || 0}
Success Rate: ${sum.successRate || 0}%
DAU: ${dm.dau || 0} | WAU: ${dm.wau || 0} | MAU: ${dm.mau || 0}
D1 Retention: ${ret.d1Retention || 0}% | D7: ${ret.d7Retention || 0}% | D30: ${ret.d30Retention || 0}%
Activation Rate: ${act.activationRate || 0}% (users who made a 2nd tx)
Bounce Rate: ${dm.bounceRate || 0}% (single-tx users who never returned)
Churn Rate: ${ret.churnRate || 0}%
Resurrection Rate: ${ret.resurrectionRate || 0}%
Avg Time to Activation: ${act.avgTimeToActivation || 'N/A'}
Power User Rate: ${qual.powerUserRate || 0}%
Bot Activity: ${qual.botPct || 0}%
Token Supply Value: ${dm.tvl != null ? '$' + Number(dm.tvl).toLocaleString() : 'N/A'}
Gas Efficiency Score: ${gas.gasEfficiencyScore || 0}%
Total Gas Spent by Users: $${gas.totalGasCostUSD || 0}
Avg Gas Cost per Tx: $${gas.averageGasCostUSD || 0}`;
}

function buildPrompt(type, metricCtx) {
  const dataBlock = metricCtx
    ? `\n\nREAL ON-CHAIN METRICS — use these exact numbers, do NOT invent or change them:\n${metricCtx}\n`
    : '\n\n(No indexed data available yet.)\n';

  switch (type) {
    case 'investor_summary':
      return `You are writing an investor traction summary for a smart contract.${dataBlock}
Write structured text using exactly this format (use markdown bold for section headers):

**CONTRACT OVERVIEW**
2-3 sentences about what this contract does.

**KEY TRACTION METRICS**
List every metric above as: • Metric Name: [exact value] — [1-line interpretation]

**BENCHMARKS**
Compare the 5 most important metrics vs DeFi/Web3 industry averages:
• [Metric]: [value] vs [industry avg] ([above/below] average)

**GROWTH NARRATIVE**
2-3 sentences interpreting what the data says about the growth trajectory.

**TOP OPPORTUNITIES**
3 specific actions based on the weakest metrics. Format: • [Action]: [expected impact]

**INVESTOR SIGNAL**
1-2 sentences: honest assessment of whether this merits attention and why.

Use exact numbers. Keep total length under 450 words.`;

    case 'twitter_thread':
      return `You are writing a Twitter/X thread about on-chain traction milestones.${dataBlock}
Rules:
- EVERY tweet must be strictly under 240 characters
- Use EXACT numbers from the data — never round or invent
- Tweet 1: Hook with the single most impressive metric
- Tweets 2-5: One specific data point each with brief context
- Tweet 6: Forward-looking statement
- Tweet 7 (optional): CTA — track your contract at metagauge.xyz

Return ONLY a valid JSON array of strings, nothing else:
["tweet text", "tweet text", ...]`;

    case 'pitch_slide':
      return `You are generating a pitch deck "Traction" slide.${dataBlock}
Return ONLY a valid JSON object, nothing else before or after the JSON:
{
  "headline": "One compelling headline using the strongest metric (max 12 words)",
  "subheadline": "Supporting context sentence (max 18 words)",
  "bullets": [
    "D1/D7/D30 Retention: [exact values]% — [benchmark comparison]",
    "Activation: [exact value]% of wallets make a 2nd transaction",
    "Power Users: [exact value]% classified as high-frequency wallets",
    "[strongest metric]: [exact value] — [investor-relevant context]",
    "[growth signal]: [exact value] — [what it signals]"
  ],
  "chart_data": [
    { "label": "D1 Retention",    "value": "[exact value from data]%" },
    { "label": "D7 Retention",    "value": "[exact value from data]%" },
    { "label": "D30 Retention",   "value": "[exact value from data]%" },
    { "label": "Activation Rate", "value": "[exact value from data]%" },
    { "label": "Power Users",     "value": "[exact value from data]%" }
  ],
  "highlight": "The single most investor-relevant stat as a short phrase",
  "footnote": "Verified on-chain data via MetaGauge · metagauge.xyz"
}`;

    default:
      throw new Error(`Unknown content type: ${type}`);
  }
}

export class TractionNarrator {
  static async generate(userId, type, { contractAddress, chain } = {}) {
    const snap = await fetchMetricSnapshot(userId);
    const metricCtx = buildMetricContext(snap);
    const prompt = buildPrompt(type, metricCtx);

    const result = await AgentService.run(userId, prompt, {
      contractAddress: contractAddress || '',
      chain: chain || snap?.chain || 'ethereum',
      source: 'marketing',
    });

    return {
      content: result.content,
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
