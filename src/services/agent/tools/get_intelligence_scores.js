import { AnalysisStorage } from '../../../api/database/index.js';
import { ScoringEngine } from '../../ScoringEngine.js';

export const schema = {
  name: 'get_intelligence_scores',
  description: 'Get combined intelligence scores: traction score, risk score, sustainability score, community health score, growth probability. Call this when asked about overall project health, scores, or growth potential.',
  parameters: { type: 'object', properties: {}, required: [] },
};

export async function execute(userId) {
  const analyses = await AnalysisStorage.findByUserId(userId);
  const latest   = analyses.find(a => a.status === 'completed');
  if (!latest) return { error: 'No completed analysis found. Run an analysis first.' };
  return ScoringEngine.compute(null, latest);
}
