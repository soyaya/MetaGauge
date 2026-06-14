import express from 'express';
import { createShareToken, validateShareToken, revokeShareToken } from '../../services/ShareTokenService.js';
import { AnalysisStorage, ContractStorage } from '../database/index.js';
import { ScoringEngine } from '../../services/ScoringEngine.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/share — create a share token for current user's contract
router.post('/', authenticateToken, async (req, res) => {
  try {
    const contracts = await ContractStorage.findByUserId(req.user.id);
    if (!contracts.length) return res.status(404).json({ error: 'No contract found' });
    const contract = contracts[0];
    const { token, expiresAt } = await createShareToken(contract.id || contract.address, req.user.id);
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${token}`;
    res.json({ token, shareUrl, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/share/:token — revoke a token
router.delete('/:token', authenticateToken, async (req, res) => {
  try {
    await revokeShareToken(req.params.token);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/share/:token/data — public endpoint, no auth — returns scores for share page
router.get('/:token/data', async (req, res) => {
  try {
    const { valid, contractId, status } = await validateShareToken(req.params.token);
    if (!valid) return res.status(status || 410).json({ error: 'Link expired or invalid' });

    // Find the analysis for this contract
    const analyses = await AnalysisStorage.findAll().catch(() => []);
    const latest = analyses.find(a =>
      (a.contractId === contractId || a.results?.target?.contract?.address === contractId) &&
      a.status === 'completed'
    );

    if (!latest) return res.status(404).json({ error: 'No analysis data available' });

    const scores = ScoringEngine.compute(null, latest);
    const contract = latest.results?.target?.contract || {};
    const metrics = latest.results?.target?.metrics || {};

    // Return only public-safe data — no user info
    res.json({
      contract: {
        name: contract.name || contractId,
        address: contract.address || contractId,
        chain: contract.chain || 'ethereum',
        category: contract.category,
      },
      scores,
      metrics: {
        transactions: metrics.transactions || 0,
        uniqueUsers: metrics.uniqueUsers || 0,
        successRate: latest.results?.target?.fullReport?.summary?.successRate || 0,
        retentionRate: latest.results?.target?.fullReport?.retentionMetrics?.retentionRate || 0,
      },
      generatedAt: latest.completedAt || latest.createdAt,
      poweredBy: 'MetaGauge Intelligence',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
