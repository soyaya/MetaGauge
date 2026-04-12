import { AnalysisStorage, UserStorage } from '../database/index.js';
import { buildFullReportFromAnalysis as buildFullReport } from './onboarding.js';
import { priceService } from '../../services/PriceService.js';

/**
 * Enhanced Metrics API Routes — reads from per-user storage
 */

export async function getAnalysisMetrics(req, res) {
  try {
    const analysis = await AnalysisStorage.findById(req.params.analysisId);
    if (!analysis || analysis.userId !== req.user.id) return res.status(404).json({ error: 'Analysis not found' });
    const metrics = analysis.results?.target?.fullReport || analysis.results?.target?.metrics || {};
    res.json({ success: true, analysisId: analysis.id, metrics });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function getUserMetrics(req, res) {
  try {
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const completed = analyses.filter(a => a.status === 'completed');
    if (!completed.length) return res.status(404).json({ error: 'No completed analyses' });
    const latest = completed[0];
    const metrics = latest.results?.target?.fullReport || latest.results?.target?.metrics || {};
    res.json({ success: true, analysisId: latest.id, metrics });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function recalculateAllMetrics(req, res) {
  res.json({ success: true, message: 'Metrics are calculated live from analysis results', updatedCount: 0 });
}

export async function getMetricsSummary(req, res) {
  try {
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    res.json({ success: true, total: analyses.length, completed: analyses.filter(a => a.status === 'completed').length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function getDashboardMetrics(req, res) {
  try {
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const completed = analyses.filter(a => a.status === 'completed');
    if (!completed.length) return res.status(404).json({ error: 'No completed analyses' });

    // Sort by most recent
    const latest = completed.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];

    const rawMetrics = latest.results?.target?.metrics || {};
    const transactions = latest.results?.target?.transactions || [];

    // Build full report from real transactions (same as default-contract endpoint)
    const ethPriceUSD = await priceService.getPrice('eth').catch(() => 2500);
    const contract = { ...latest.results?.target?.contract, _ethPriceUSD: ethPriceUSD };
    const fullReport = transactions.length > 0 ? buildFullReport(transactions, rawMetrics, contract) : {};

    res.json({
      success: true,
      analysisId: latest.id,
      ...fullReport,
      totalAnalyses: analyses.length,
      completedAnalyses: completed.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
