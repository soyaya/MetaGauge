import express from 'express';
import { UserStorage, AnalysisStorage, AlertConfigStorage, CompetitorDataStorage, LivePollStorage } from '../database/index.js';
import { buildFullReportFromAnalysis } from './onboarding.js';
import { functionDecoder } from '../../services/FunctionSignatureDecoder.js';
import subscriptionService from '../../services/SubscriptionService.js';

export const competitiveRouter = express.Router();

const featureLabel = (input, txTo = null, contractAddress = null) => {
  if (!input || input === '0x') return 'ETH Transfer';
  const sig = input.slice(0, 10);
  const name = functionDecoder.decodeWithContext
    ? functionDecoder.decodeWithContext(sig, txTo, contractAddress)
    : functionDecoder.decode(sig, contractAddress);
  return name || sig;
};
const hexToNum = v => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.startsWith('0x')) return parseInt(v, 16);
  return Number(v) || 0;
};

/** Build per-feature metrics from raw transactions */
function buildFeatureMetrics(transactions, contractAddress = null) {
  const ETH_PRICE = 2500;
  const featureMap = {};
  const userTxs = {};

  transactions.forEach(tx => {
    const f = featureLabel(tx.input, tx.to, contractAddress);
    if (!featureMap[f]) featureMap[f] = { txCount:0, wallets:new Set(), success:0, failed:0, gasTotal:0, valueETH:0 };
    const fm = featureMap[f];
    fm.txCount++;
    fm.wallets.add(tx.from);
    if (tx.status) fm.success++; else fm.failed++;
    fm.gasTotal += hexToNum(tx.gasUsed) * hexToNum(tx.gasPrice) / 1e18;
    try { fm.valueETH += Number(BigInt(tx.value||'0')) / 1e18; } catch {}

    // track per-user for retention
    if (!userTxs[tx.from]) userTxs[tx.from] = [];
    if (tx.blockTimestamp) userTxs[tx.from].push(tx.blockTimestamp);
  });

  const totalUsers = new Set(transactions.map(t => t.from)).size;
  const returning  = Object.values(userTxs).filter(arr => arr.length > 1).length;
  const retentionRate = totalUsers > 0 ? Number(((returning / totalUsers) * 100).toFixed(1)) : 0;

  return Object.entries(featureMap).map(([name, f]) => ({
    feature:      name,
    adoption:     f.wallets.size,
    adoptionPct:  totalUsers > 0 ? Number(((f.wallets.size / totalUsers) * 100).toFixed(1)) : 0,
    failRate:     f.txCount > 0 ? Number(((f.failed / f.txCount) * 100).toFixed(1)) : 0,
    returnUsers7d: retentionRate, // approximation — no per-feature retention without timestamps
    avgGasUSD:    f.txCount > 0 ? Number((f.gasTotal / f.txCount * ETH_PRICE).toFixed(2)) : 0,
    volumeETH:    Number(f.valueETH.toFixed(4)),
    txCount:      f.txCount,
  })).sort((a, b) => b.adoption - a.adoption);
}

/** Build summary benchmark from transactions + buildFullReport */
function buildBenchmark(name, address, chain, transactions, metrics) {
  const fr = buildFullReportFromAnalysis(transactions, metrics, { address, chain, name });
  return {
    name,
    address,
    chain,
    totalTxs:      fr.summary?.totalTransactions || 0,
    uniqueUsers:   fr.summary?.uniqueUsers || 0,
    successRate:   Number(fr.summary?.successRate || 0),
    totalVolumeETH:fr.defiMetrics?.totalVolumeEth || 0,
    avgGasUsed:    fr.gasAnalysis?.averageGasUsed || 0,
    avgGasCostUSD: fr.gasAnalysis?.averageGasCostUSD || 0,
    activationRate:fr.defiMetrics?.activationRate || 0,
    bounceRate:    fr.defiMetrics?.bounceRate || 0,
    retentionRate: fr.retentionMetrics?.retentionRate || fr.userLifecycle?.summary?.retentionRate || 0,
    d7Retention:   fr.retentionMetrics?.d7Retention || 0,
    d1Retention:   fr.retentionMetrics?.d1Retention || 0,
    d30Retention:  fr.retentionMetrics?.d30Retention || 0,
    churnRate:     fr.retentionMetrics?.churnRate || 0,
    dau:           fr.defiMetrics?.dau || 0,
    wau:           fr.defiMetrics?.wau || 0,
    mau:           fr.defiMetrics?.mau || 0,
    walletQuality: fr.userQualityMetrics?.avgWalletQuality || 0,
    botPct:        fr.userQualityMetrics?.botPct || 0,
    features:      buildFeatureMetrics(transactions, address),
  };
}

competitiveRouter.get('/dashboard', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(404).json({ error: 'No default contract' });
    }

    // ── My contract ──────────────────────────────────────────────────────────
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const myLatest = allAnalyses
      .filter(a => a.status === 'completed' && a.metadata?.isDefaultContract)
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];

    const myTxs     = myLatest?.results?.target?.transactions || [];
    const myMetrics = myLatest?.results?.target?.metrics || {};
    const myContract = myLatest?.results?.target?.contract || user.onboarding.defaultContract;
    const myBenchmark = buildBenchmark(myContract.name || 'Your Contract', myContract.address, myContract.chain, myTxs, myMetrics);

    // ── Competitors ──────────────────────────────────────────────────────────
    const competitors = [];
    try {
      const compList = await CompetitorDataStorage.findByUserId(req.user.id);
      for (const c of compList) {
        competitors.push(buildBenchmark(c.name || c.address?.slice(0,10), c.address, c.chain, c.transactions || [], c.metrics || {}));
      }
    } catch { /* no competitors */ }

    // ── Feature benchmark table ──────────────────────────────────────────────
    // All unique features across my contract + competitors
    const allFeatures = [...new Set([
      ...myBenchmark.features.map(f => f.feature),
      ...competitors.flatMap(c => c.features.map(f => f.feature)),
    ])];

    const featureBenchmark = allFeatures.map(feature => {
      const myF = myBenchmark.features.find(f => f.feature === feature) || null;
      const row = {
        feature,
        [myBenchmark.name]: myF ? { adoption: myF.adoption, failRate: myF.failRate, returnUsers7d: myF.returnUsers7d, avgGasUSD: myF.avgGasUSD } : null,
      };
      competitors.forEach(c => {
        const cf = c.features.find(f => f.feature === feature) || null;
        row[c.name] = cf ? { adoption: cf.adoption, failRate: cf.failRate, returnUsers7d: cf.returnUsers7d, avgGasUSD: cf.avgGasUSD } : null;
      });
      return row;
    });

    // ── Radar data ───────────────────────────────────────────────────────────
    const radarMetrics = ['successRate','activationRate','retentionRate','d7Retention','walletQuality'];
    const radarData = radarMetrics.map(m => {
      const row = { metric: m.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()), you: myBenchmark[m] || 0 };
      competitors.forEach(c => { row[c.name] = c[m] || 0; });
      return row;
    });

    // ── Insights ─────────────────────────────────────────────────────────────
    const insights = [];
    competitors.forEach(c => {
      if (c.avgGasCostUSD > 0 && myBenchmark.avgGasCostUSD > 0) {
        const ratio = (myBenchmark.avgGasCostUSD / c.avgGasCostUSD).toFixed(1);
        if (ratio > 1.5) insights.push({ type: 'warning', msg: `Your gas cost ($${myBenchmark.avgGasCostUSD}) is ${ratio}x higher than ${c.name} ($${c.avgGasCostUSD}) — consider gas optimisation` });
        else if (ratio < 0.7) insights.push({ type: 'good', msg: `Your gas cost ($${myBenchmark.avgGasCostUSD}) is lower than ${c.name} ($${c.avgGasCostUSD}) — competitive advantage` });
      }
      if (c.activationRate > myBenchmark.activationRate + 10)
        insights.push({ type: 'warning', msg: `${c.name} has ${c.activationRate}% activation vs your ${myBenchmark.activationRate}% — improve first-use experience` });
      if (c.successRate < myBenchmark.successRate)
        insights.push({ type: 'good', msg: `Your success rate (${myBenchmark.successRate}%) beats ${c.name} (${c.successRate}%) — maintain reliability` });
      if (c.uniqueUsers > myBenchmark.uniqueUsers * 2)
        insights.push({ type: 'warning', msg: `${c.name} has ${c.uniqueUsers} users vs your ${myBenchmark.uniqueUsers} — significant user gap` });
    });

    // Self-insights when no competitors
    if (competitors.length === 0) {
      if (myBenchmark.bounceRate > 70) insights.push({ type: 'warning', msg: `${myBenchmark.bounceRate}% bounce rate — most users never return. Add competitor contracts to benchmark.` });
      if (myBenchmark.successRate >= 95) insights.push({ type: 'good', msg: `${myBenchmark.successRate}% success rate — strong reliability baseline.` });
    }

    // ── Strengths & weaknesses ───────────────────────────────────────────────
    const strengths = [], weaknesses = [];
    if (myBenchmark.successRate >= 95)   strengths.push(`✓ ${myBenchmark.successRate}% transaction success rate`);
    else                                  weaknesses.push(`✗ ${myBenchmark.successRate}% success rate — target 95%+`);
    if (myBenchmark.bounceRate < 50)     strengths.push(`✓ ${myBenchmark.bounceRate}% bounce rate`);
    else                                  weaknesses.push(`✗ ${myBenchmark.bounceRate}% bounce rate — most users don't return`);
    if (myBenchmark.activationRate > 30) strengths.push(`✓ ${myBenchmark.activationRate}% activation rate`);
    else                                  weaknesses.push(`✗ ${myBenchmark.activationRate}% activation — low repeat usage`);
    if (myBenchmark.botPct < 5)          strengths.push(`✓ ${myBenchmark.botPct}% bot activity — clean user base`);
    else                                  weaknesses.push(`✗ ${myBenchmark.botPct}% bot activity`);
    if (myBenchmark.walletQuality > 50)  strengths.push(`✓ Wallet quality ${myBenchmark.walletQuality}/100`);
    else                                  weaknesses.push(`✗ Wallet quality ${myBenchmark.walletQuality}/100`);

    res.json({
      myBenchmark,
      competitors,
      featureBenchmark,
      radarData,
      insights,
      strengths:  strengths.slice(0, 6),
      weaknesses: weaknesses.slice(0, 6),
      hasCompetitors: competitors.length > 0,
      allContractNames: [myBenchmark.name, ...competitors.map(c => c.name)],
      quota: (() => {
        const tier = user?.tier || 'free';
        const COMP_LIMITS = { free: 2, starter: 4, pro: 9, enterprise: 24 };
        const limit = COMP_LIMITS[tier] ?? 2;
        const used = user?.competitorAnalysisCount || 0;
        return { used, limit, remaining: Math.max(0, limit - used), tier };
      })(),
    });
  } catch (err) {
    console.error('competitive dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

competitiveRouter.post('/add-competitor', async (req, res) => {
  try {
    const { address, chain, name } = req.body;
    if (!address || !chain) return res.status(400).json({ error: 'address and chain required' });

    const user = await UserStorage.findById(req.user.id);
    const tier = user?.tier || 'free';

    // Tier limits: free=2 competitors (+ 1 own project = 3 total analyses)
    const COMP_LIMITS = { free: 2, starter: 4, pro: 9, enterprise: 24 };
    const limit = COMP_LIMITS[tier] ?? 2;

    // Count lifetime competitor analyses (including deleted ones) — stored in user record
    const lifetimeCount = user?.competitorAnalysisCount || 0;
    if (lifetimeCount >= limit) {
      return res.status(402).json({
        error: 'Competitor limit reached',
        message: `Your ${tier} plan allows ${limit} competitor${limit !== 1 ? 's' : ''}. Upgrade to add more.`,
        lifetime: lifetimeCount, limit,
      });
    }

    // Increment lifetime counter immediately (counts even if deleted later)
    await UserStorage.update(req.user.id, {
      competitorAnalysisCount: lifetimeCount + 1,
    });

    const competitorId = `${address.toLowerCase()}_${chain}`;
    const { indexCompetitor } = await import('./competitor-indexing.js');

    res.json({
      message: 'Competitor indexing started', address, chain, name, competitorId,
      remaining: limit - lifetimeCount - 1,
    });

    setImmediate(() => {
      indexCompetitor(req.user.id, { id: competitorId, address, chain, name: name || address.slice(0,10) })
        .catch(e => console.warn('Competitor indexing error:', e.message));
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

competitiveRouter.delete('/remove-competitor/:competitorId', async (req, res) => {
  try {
    const { competitorId } = req.params;
    const [address, chain] = competitorId.split('_');
    await CompetitorDataStorage.delete(req.user.id, address, chain);
    const poll = await LivePollStorage.get(req.user.id) || {};
    delete poll[`competitor_${competitorId}`];
    await LivePollStorage.save(req.user.id, poll);
    res.json({ message: 'Competitor removed', competitorId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

competitiveRouter.get('/list', async (req, res) => {
  try {
    const compList = await CompetitorDataStorage.findByUserId(req.user.id);
    const competitors = compList.map(c => ({
      id: c.id, name: c.name, address: c.address, chain: c.chain,
      txs: c.transactions?.length || 0,
      uniqueUsers: c.metrics?.uniqueUsers || 0,
      successRate: c.metrics?.successRate || 0,
      lastUpdated: c.lastUpdated,
    }));
    res.json({ competitors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

competitiveRouter.get('/insight/:competitorId', async (req, res) => {
  try {
    const { competitorId } = req.params;
    const [address, chain] = competitorId.split('_');
    const c = await CompetitorDataStorage.get(req.user.id, address, chain);
    if (!c) return res.status(404).json({ error: 'Competitor not found' });

    // Get my metrics
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const myLatest = allAnalyses
      .filter(a => a.status === 'completed' && a.metadata?.isDefaultContract)
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];
    const myTxs     = myLatest?.results?.target?.transactions || [];
    const myMetrics = myLatest?.results?.target?.metrics || {};
    const myContract = myLatest?.results?.target?.contract || {};
    const myBenchmark = buildBenchmark(myContract.name || 'Your Contract', myContract.address, myContract.chain, myTxs, myMetrics);
    const compBenchmark = buildBenchmark(c.name, c.address, c.chain, c.transactions || [], c.metrics || {});

    // Build insight using Gemini if available, else rule-based
    let insight;
    try {
      const charge = await subscriptionService.charge(req.user.id, 'ai_query');
      if (charge.allowed) {
        const GeminiAIService = (await import('../../services/GeminiAIService.js')).default;
      const gemini = new GeminiAIService();
      const prompt = `Compare these two blockchain contracts and give 3-5 actionable insights:

MY CONTRACT (${myBenchmark.name}):
- Transactions: ${myBenchmark.totalTxs}, Users: ${myBenchmark.uniqueUsers}
- Success Rate: ${myBenchmark.successRate}%, Activation: ${myBenchmark.activationRate}%
- Bounce Rate: ${myBenchmark.bounceRate}%, Retention: ${myBenchmark.retentionRate}%
- Avg Gas Cost: $${myBenchmark.avgGasCostUSD}, Wallet Quality: ${myBenchmark.walletQuality}/100

COMPETITOR (${compBenchmark.name}):
- Transactions: ${compBenchmark.totalTxs}, Users: ${compBenchmark.uniqueUsers}
- Success Rate: ${compBenchmark.successRate}%, Activation: ${compBenchmark.activationRate}%
- Bounce Rate: ${compBenchmark.bounceRate}%, Retention: ${compBenchmark.retentionRate}%
- Avg Gas Cost: $${compBenchmark.avgGasCostUSD}, Wallet Quality: ${compBenchmark.walletQuality}/100

Give specific, actionable insights. Be concise.`;
        const text = await gemini.generateContent(prompt);
        insight = { source: 'ai', text };
      }
    } catch {
      // Rule-based fallback
      const lines = [];
      if (compBenchmark.uniqueUsers > myBenchmark.uniqueUsers * 1.5)
        lines.push(`⚠️ ${c.name} has ${compBenchmark.uniqueUsers} users vs your ${myBenchmark.uniqueUsers} — focus on user acquisition.`);
      if (myBenchmark.avgGasCostUSD < compBenchmark.avgGasCostUSD * 0.7)
        lines.push(`✅ Your gas cost ($${myBenchmark.avgGasCostUSD}) is significantly lower than ${c.name} ($${compBenchmark.avgGasCostUSD}) — highlight this as a competitive advantage.`);
      if (compBenchmark.activationRate > myBenchmark.activationRate + 10)
        lines.push(`⚠️ ${c.name} activation rate (${compBenchmark.activationRate}%) beats yours (${myBenchmark.activationRate}%) — improve your first-use experience.`);
      if (myBenchmark.successRate >= compBenchmark.successRate)
        lines.push(`✅ Your success rate (${myBenchmark.successRate}%) matches or beats ${c.name} (${compBenchmark.successRate}%) — maintain reliability.`);
      if (myBenchmark.bounceRate > compBenchmark.bounceRate + 10)
        lines.push(`⚠️ Your bounce rate (${myBenchmark.bounceRate}%) is higher than ${c.name} (${compBenchmark.bounceRate}%) — add retention hooks.`);
      insight = { source: 'rules', text: lines.join('\n') || 'Metrics are comparable — add more data over time for deeper insights.' };
    }

    res.json({ competitor: compBenchmark, myContract: myBenchmark, insight });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/competitive/alert — create a competitive threshold alert
competitiveRouter.post('/alert', async (req, res) => {
  try {
    const { competitorId, metric, condition, threshold, name } = req.body;
    // condition: 'above' | 'below' | 'overtakes_me'
    if (!competitorId || !metric || !condition || threshold == null)
      return res.status(400).json({ error: 'competitorId, metric, condition, threshold required' });

    const config = await AlertConfigStorage.create({
      userId: req.user.id,
      type: 'competitive',
      competitorId,
      metric,       // e.g. 'uniqueUsers', 'successRate', 'avgGasCostUSD'
      condition,    // 'above' | 'below' | 'overtakes_me'
      threshold,    // numeric value
      name: name || `${metric} ${condition} ${threshold}`,
      enabled: true,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ config, message: 'Competitive alert created. Will fire on next live poll.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/competitive/alerts — list all competitive alerts for this user
competitiveRouter.get('/alerts', async (req, res) => {
  try {
    const all = await AlertConfigStorage.findByUserId(req.user.id);
    res.json({ alerts: all.filter(a => a.type === 'competitive') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/competitive/alerts/:id — remove a competitive alert
competitiveRouter.delete('/alerts/:id', async (req, res) => {
  try {
    const config = await AlertConfigStorage.findById(req.params.id);
    if (!config || config.userId !== req.user.id) return res.status(404).json({ error: 'Alert not found' });
    await AlertConfigStorage.delete(req.params.id);
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
