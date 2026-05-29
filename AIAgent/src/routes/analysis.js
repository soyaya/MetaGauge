import { Router } from 'express';
import { MainAppClient } from '../services/MainAppClient.js';
import { ScoringEngine } from '../services/ScoringEngine.js';
import { RiskDetector } from '../services/RiskDetector.js';
import { GitHubAnalyzer } from '../services/GitHubAnalyzer.js';

const router = Router();

/**
 * POST /api/analysis/run
 * Fetches user's contract + GitHub data, scores everything, returns intelligence report.
 * Body (optional): { githubUrl }
 */
router.post('/run', async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7);
    const userId = req.user.userId || req.user.id;
    const { githubUrl } = req.body;

    // Fetch main app data + GitHub in parallel
    const [contracts, traction, analysis, github] = await Promise.allSettled([
      MainAppClient.getContracts(token),
      MainAppClient.getTraction(token),
      MainAppClient.getAnalysis(token),
      githubUrl ? GitHubAnalyzer.analyze(githubUrl) : Promise.resolve(null),
    ]);

    const contractList = contracts.status === 'fulfilled' ? contracts.value : [];
    const tractionData = traction.status  === 'fulfilled' ? traction.value  : null;
    const analysisData = analysis.status  === 'fulfilled' ? analysis.value  : null;
    const githubData   = github.status    === 'fulfilled' ? github.value    : null;

    if (!tractionData && !analysisData) {
      return res.status(404).json({ error: 'No analysis data found. Please run an analysis in the main app first.' });
    }

    const scores = ScoringEngine.compute(tractionData, analysisData, githubData);

    // Deep on-chain risk — use contract address from main app data
    const contractAddress = contractList[0]?.address || tractionData?.contract?.address;
    const contractChain   = contractList[0]?.chain   || tractionData?.contract?.chain || 'ethereum';

    let riskSignals, onChainDetails;
    if (contractAddress) {
      const result = await RiskDetector.detectWithOnChain(tractionData, analysisData, githubData, contractAddress, contractChain);
      riskSignals    = result.signals;
      onChainDetails = result.onChainDetails;
    } else {
      riskSignals    = RiskDetector.detect(tractionData, analysisData, githubData);
      onChainDetails = null;
    }

    const contract = contractList[0] || tractionData?.contract || {};

    res.json({
      userId,
      contract,
      scores,
      riskSignals,
      onChainDetails,
      githubMetrics: githubData,
      dataSource: 'main-app',
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analysis/github?url=https://github.com/owner/repo
 * Standalone GitHub analysis endpoint.
 */
router.get('/github', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url query param required' });
    const result = await GitHubAnalyzer.analyze(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
