import { AnalysisStorage } from '../../../api/database/index.js';
import { buildFullReportFromAnalysis } from '../../../api/routes/onboarding.js';

export const schema = {
  name: 'get_metrics',
  description: 'Get the latest contract metrics for the user including retention, gas, DeFi, and user behavior data.',
  parameters: { type: 'object', properties: {}, required: [] },
};

export async function execute(userId) {
  const analyses = await AnalysisStorage.findByUserId(userId);
  const latest = analyses.find(a => a.status === 'completed');
  if (!latest) return { error: 'No completed analysis found. Please run an analysis first.' };

  const target = latest.results?.target || {};

  // Use pre-computed fullReport if available, otherwise build from raw transactions
  const fr = target.fullReport
    ? target.fullReport
    : buildFullReportFromAnalysis(target.transactions || [], target.metrics || {}, target);

  return {
    summary:           fr.summary           || null,
    retentionMetrics:  fr.retentionMetrics   || null,
    activationMetrics: fr.activationMetrics  || null,
    gasAnalysis:       fr.gasAnalysis        || null,
    defiMetrics:       fr.defiMetrics        || null,
    userBehavior:      fr.userBehavior       || null,
    userQualityMetrics:fr.userQualityMetrics || null,
    analysisId:        latest.id,
    completedAt:       latest.completedAt,
  };
}
