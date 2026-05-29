import { Router } from 'express';
import { MainAppClient } from '../services/MainAppClient.js';
import { ScoringEngine } from '../services/ScoringEngine.js';
import { RiskDetector } from '../services/RiskDetector.js';
import { AgentService } from '../services/AgentService.js';
import { GitHubAnalyzer } from '../services/GitHubAnalyzer.js';

const router = Router();

async function buildUserContext(token, githubUrl = null) {
  const [traction, analysis, contracts, github] = await Promise.allSettled([
    MainAppClient.getTraction(token),
    MainAppClient.getAnalysis(token),
    MainAppClient.getContracts(token),
    githubUrl ? GitHubAnalyzer.analyze(githubUrl) : Promise.resolve(null),
  ]);

  const tractionData = traction.status   === 'fulfilled' ? traction.value   : null;
  const analysisData = analysis.status   === 'fulfilled' ? analysis.value   : null;
  const contractList = contracts.status  === 'fulfilled' ? contracts.value  : [];
  const githubData   = github.status     === 'fulfilled' ? github.value     : null;

  const scores = ScoringEngine.compute(tractionData, analysisData, githubData);
  const riskSignals = RiskDetector.detect(tractionData, analysisData, githubData);
  const contract = contractList[0] || tractionData?.contract || {};

  return { traction: tractionData, analysis: analysisData, scores, riskSignals, contract, github: githubData };
}

router.post('/chat', async (req, res) => {
  try {
    const { message, history = [], githubUrl } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const token = req.headers.authorization?.slice(7);
    const context = await buildUserContext(token, githubUrl);

    const result = await AgentService.chat(message, { ...context, history });
    res.json({ ...result, userId: req.user.userId || req.user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/research', async (req, res) => {
  try {
    const { githubUrl } = req.body;
    const token = req.headers.authorization?.slice(7);
    const context = await buildUserContext(token, githubUrl);

    if (!context.traction && !context.analysis) {
      return res.status(404).json({ error: 'No analysis data found in main app. Run an analysis first.' });
    }

    const result = await AgentService.research(context);
    res.json({
      ...result,
      scores: context.scores,
      riskSignals: context.riskSignals,
      contract: context.contract,
      githubMetrics: context.github,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
