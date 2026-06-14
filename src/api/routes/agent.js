import express from 'express';
import AgentService from '../../services/AgentService.js';
import { ContractStorage, UserStorage, AgentConfigStorage } from '../database/index.js';

const router = express.Router();

// POST /api/agent/chat — direct agent chat (also used internally by chat.js)
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, contractAddress, chain, sessionHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    const result = await AgentService.run(req.user.id, message, { contractAddress, chain, sessionId, sessionHistory, source: 'chat' });
    res.json({ ...result, sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/analyze — agent analyzes contract and creates enriched tasks
router.post('/analyze', async (req, res) => {
  try {
    const { contractAddress, chain } = req.body;
    const result = await AgentService.run(
      req.user.id,
      'Analyze this contract. Identify all failing or underperforming metrics. For each one, call create_task to create an actionable task with market context and a deadline.',
      { contractAddress, chain, source: 'analyzer' }
    );
    res.json({ tasks: [], opsScore: null, insights: [], components: result.components, content: result.content, toolsUsed: result.toolsUsed });
  } catch (err) {
    res.json({ tasks: [], opsScore: null, insights: [], components: [], content: 'AI unavailable — please check your API key.', toolsUsed: [] });
  }
});

// POST /api/agent/feedback — save user rating on an AI response
router.post('/feedback', async (req, res) => {
  try {
    const { FeedbackProcessor } = await import('../../services/FeedbackProcessor.js');
    await FeedbackProcessor.save(req.user.id, req.body);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/digest — get latest briefing for user
router.get('/digest', async (req, res) => {
  try {
    const { type = 'daily' } = req.query;
    const { BriefingsStorage } = await import('../database/index.js');
    const briefings = await BriefingsStorage.findByUserId(req.user.id, type);
    res.json({ briefing: briefings[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/generate-content — marketing content via TractionNarrator
router.post('/generate-content', async (req, res) => {
  try {
    const { type, contractAddress, chain } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    const { TractionNarrator } = await import('../../services/TractionNarrator.js');
    const result = await TractionNarrator.generate(req.user.id, type, { contractAddress, chain });
    res.json(result);
  } catch (err) {
    res.json({ content: 'AI unavailable — please check your API key.', type: req.body?.type, generatedAt: new Date().toISOString() });
  }
});

// POST /api/agent/social/post — manually trigger a social post now
router.post('/social/post', async (req, res) => {
  try {
    const { runDailySocialPost } = await import('../../services/SocialMediaAgent.js');
    const result = await runDailySocialPost(req.user.id);
    if (!result) return res.status(400).json({ error: 'No indexed contract found or already posted today' });
    res.json({ ok: true, postText: result.postText, platforms: result.results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/social/history — get past social posts
router.get('/social/history', async (req, res) => {
  try {
    const { getSocialPostHistory } = await import('../../services/SocialMediaAgent.js');
    const posts = await getSocialPostHistory(req.user.id);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/business-intelligence — full BI report
router.get('/business-intelligence', async (req, res) => {
  try {
    const { AnalysisStorage } = await import('../database/index.js');
    const { BusinessIntelligenceEngine: BI } = await import('../../services/BusinessIntelligenceEngine.js');
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest = analyses.find(a => a.status === 'completed');
    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });
    const txs = latest.results?.target?.transactions || [];
    if (!txs.length) return res.json({ error: 'No transactions indexed yet', txCount: 0 });
    const section = req.query.section || 'all';
    const ethPrice = 2500;
    const result = section === 'all' ? BI.runAll(txs, ethPrice)
      : section === 'ltv'         ? BI.computeLTV(txs, ethPrice)
      : section === 'churn'       ? BI.computeChurnRisk(txs)
      : section === 'sessions'    ? BI.computeSessions(txs)
      : section === 'funnel'      ? BI.computeFeatureFunnel(txs)
      : section === 'time'        ? BI.computeTimePatterns(txs)
      : section === 'revenue'     ? BI.computeRevenueForecast(txs, ethPrice)
      : section === 'patterns'    ? BI.recognizePatterns(txs)
      : section === 'predictions' ? BI.predictNextActions(txs)
      : section === 'growth'      ? BI.predictUserGrowth(txs)
      : section === 'smart_money' ? BI.detectSmartMoney(txs)
      : { error: 'Unknown section' };
    res.json({ section, txCount: txs.length, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/onchain-risk — deep on-chain risk for user's contract
router.get('/onchain-risk', async (req, res) => {
  try {
    const { contractAddress, chain = 'ethereum' } = req.query;
    const { OnChainRiskAnalyzer } = await import('../../services/OnChainRiskAnalyzer.js');
    if (!contractAddress) return res.status(400).json({ error: 'contractAddress query param required' });
    const result = await OnChainRiskAnalyzer.analyze(contractAddress, chain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/github — GitHub dev health for a repo
router.get('/github', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url query param required' });
    const { GitHubAnalyzer } = await import('../../services/GitHubAnalyzer.js');
    const result = await GitHubAnalyzer.analyze(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/sentiment — social sentiment for user's contract
router.get('/sentiment', async (req, res) => {
  try {
    const { contractAddress, chain = 'ethereum', twitterHandle } = req.query;
    if (!contractAddress) return res.status(400).json({ error: 'contractAddress query param required' });
    const { SentimentAnalyzer } = await import('../../services/SentimentAnalyzer.js');
    const result = await SentimentAnalyzer.analyze(contractAddress, chain, twitterHandle || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/intelligence-scores — combined traction/risk/sustainability scores
router.get('/intelligence-scores', async (req, res) => {
  try {
    const { AnalysisStorage } = await import('../database/index.js');
    const { ScoringEngine } = await import('../../services/ScoringEngine.js');
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest = analyses.find(a => a.status === 'completed');
    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });
    const scores = ScoringEngine.compute(null, latest);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/benchmarks — metric benchmarks vs category peers
router.get('/benchmarks', async (req, res) => {
  try {
    const { AnalysisStorage, ContractStorage } = await import('../database/index.js');
    const { BenchmarkService } = await import('../../services/BenchmarkService.js');
    const [analyses, contracts] = await Promise.all([
      AnalysisStorage.findByUserId(req.user.id),
      ContractStorage.findByUserId(req.user.id),
    ]);
    const latest = analyses.find(a => a.status === 'completed');
    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });
    const category = contracts[0]?.category || req.query.category || 'defi';
    const metrics  = latest.results?.target?.metrics || {};
    const fr       = latest.results?.target?.fullReport || {};
    const result   = await BenchmarkService.benchmark(metrics, fr, category);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/playbooks — growth playbooks for underperforming metrics
router.get('/playbooks', async (req, res) => {
  try {
    const { AnalysisStorage, ContractStorage } = await import('../database/index.js');
    const { BenchmarkService } = await import('../../services/BenchmarkService.js');
    const { PlaybookService } = await import('../../services/PlaybookService.js');
    const [analyses, contracts] = await Promise.all([
      AnalysisStorage.findByUserId(req.user.id),
      ContractStorage.findByUserId(req.user.id),
    ]);
    const latest = analyses.find(a => a.status === 'completed');
    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });
    const category = contracts[0]?.category || 'defi';
    const metrics  = latest.results?.target?.metrics || {};
    const fr       = latest.results?.target?.fullReport || {};
    const benchmarkResult = await BenchmarkService.benchmark(metrics, fr, category);
    const playbooks = PlaybookService.getForBenchmarks(benchmarkResult);
    res.json({ playbooks, category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/market-position — rank in category vs competitors
router.get('/market-position', async (req, res) => {
  try {
    const { AnalysisStorage, ContractStorage, CompetitorDataStorage } = await import('../database/index.js');
    const { ScoringEngine } = await import('../../services/ScoringEngine.js');
    const { BenchmarkService } = await import('../../services/BenchmarkService.js');

    const [analyses, contracts, competitors] = await Promise.all([
      AnalysisStorage.findByUserId(req.user.id),
      ContractStorage.findByUserId(req.user.id),
      CompetitorDataStorage.findByUserId(req.user.id).catch(() => []),
    ]);

    const latest   = analyses.find(a => a.status === 'completed');
    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });

    const category = contracts[0]?.category || 'defi';
    const metrics  = latest.results?.target?.metrics || {};
    const fr       = latest.results?.target?.fullReport || {};
    const scores   = ScoringEngine.compute(null, latest);
    const bench    = await BenchmarkService.benchmark(metrics, fr, category);

    // Build comparison set: user + competitors
    const allProtocols = [
      {
        name: contracts[0]?.name || 'Your Protocol',
        address: contracts[0]?.address,
        isYou: true,
        tractionScore: scores.tractionScore,
        riskScore: scores.riskScore,
        users: metrics.uniqueUsers || 0,
        txs: metrics.transactions || 0,
      },
      ...competitors.slice(0, 5).map(c => ({
        name: c.name || c.address?.slice(0, 8),
        address: c.address,
        isYou: false,
        tractionScore: null, // competitors don't have full scores
        users: c.metrics?.uniqueUsers || 0,
        txs: c.metrics?.transactions || 0,
      })),
    ].sort((a, b) => b.users - a.users);

    const yourRank = allProtocols.findIndex(p => p.isYou) + 1;

    // Compute overall position from benchmark statuses
    const goodCount = Object.values(bench.benchmarks).filter((v) => v.status === 'good').length;
    const total     = Object.keys(bench.benchmarks).length || 1;
    const pctGood   = Math.round((goodCount / total) * 100);

    const positionLabel = pctGood >= 80 ? 'Top Performer'
      : pctGood >= 60 ? 'Above Average'
      : pctGood >= 40 ? 'Average'
      : pctGood >= 20 ? 'Below Average'
      : 'Needs Improvement';

    res.json({
      category,
      rank: yourRank,
      totalProtocols: allProtocols.length,
      positionLabel,
      positionScore: pctGood,
      protocols: allProtocols,
      benchmarkSummary: {
        good: goodCount,
        warn: Object.values(bench.benchmarks).filter((v) => v.status === 'warn').length,
        bad:  Object.values(bench.benchmarks).filter((v) => v.status === 'bad').length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/lifecycle-campaigns — campaign suggestions by wallet lifecycle stage
router.get('/lifecycle-campaigns', async (req, res) => {
  try {
    const { AnalysisStorage } = await import('../database/index.js');
    const { BusinessIntelligenceEngine: BI } = await import('../../services/BusinessIntelligenceEngine.js');
    const { LifecycleCampaignService } = await import('../../services/LifecycleCampaignService.js');
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest   = analyses.find(a => a.status === 'completed');
    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });
    const txs       = latest.results?.target?.transactions || [];
    const fr        = latest.results?.target?.fullReport   || {};
    const biData    = txs.length ? BI.runAll(txs, 2500) : {};
    const campaigns = LifecycleCampaignService.generate(fr, biData);
    res.json({ campaigns, txCount: txs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/at-risk-wallets — churned high-value wallets for outreach
router.get('/at-risk-wallets', async (req, res) => {
  try {
    const { AnalysisStorage } = await import('../database/index.js');
    const { BusinessIntelligenceEngine: BI } = await import('../../services/BusinessIntelligenceEngine.js');
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest   = analyses.find(a => a.status === 'completed');
    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });
    const txs = latest.results?.target?.transactions || [];
    if (!txs.length) return res.json({ wallets: [], message: 'No transaction data yet' });
    const ethPrice = 2500;
    const { highRisk }  = BI.computeChurnRisk(txs);
    const { segments }  = BI.computeLTV(txs, ethPrice);
    // Intersect: wallets that are both high churn risk AND high/mid LTV
    const highLtvAddresses = new Set([
      ...segments.high.map(w => w.address?.toLowerCase()),
      ...segments.mid.map(w => w.address?.toLowerCase()),
    ]);
    const atRisk = highRisk
      .filter(w => highLtvAddresses.has(w.address?.toLowerCase()))
      .slice(0, 50)
      .map(w => {
        const ltvData = [...segments.high, ...segments.mid].find(l => l.address?.toLowerCase() === w.address?.toLowerCase());
        return {
          address: w.address,
          daysSinceLast: w.daysSinceLast,
          txCount: w.txCount,
          ltv: ltvData?.ltv || 0,
          segment: segments.high.find(l => l.address?.toLowerCase() === w.address?.toLowerCase()) ? 'high' : 'mid',
        };
      })
      .sort((a, b) => b.ltv - a.ltv);
    res.json({ wallets: atRisk, count: atRisk.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/config — get user's agent automation settings
router.get('/config', async (req, res) => {  try {
    const cfg = await AgentConfigStorage.get(req.user.id);
    res.json(cfg || { enabled: false, permissions: {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/agent/config — update automation toggles
router.put('/config', async (req, res) => {
  try {
    const { enabled, permissions } = req.body;
    const existing = await AgentConfigStorage.get(req.user.id) || { userId: req.user.id, enabled: true, permissions: {} };
    const updated = {
      ...existing,
      ...(enabled !== undefined && { enabled }),
      permissions: { ...existing.permissions, ...(permissions || {}) },
    };
    await AgentConfigStorage.save(req.user.id, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
