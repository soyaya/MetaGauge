import express from 'express';
import AgentService from '../../services/AgentService.js';
import { ContractStorage, UserStorage } from '../database/index.js';

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

export default router;
