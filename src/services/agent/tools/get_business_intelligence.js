import { AnalysisStorage } from '../../../api/database/index.js';
import { BusinessIntelligenceEngine as BI } from '../../BusinessIntelligenceEngine.js';

export const schema = {
  name: 'get_business_intelligence',
  description: 'Get advanced business intelligence: LTV segments, churn risk, session analysis, feature funnel, time patterns, revenue forecast, pattern recognition, predictive next actions, user growth forecast, and smart money detection.',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Which section to return: ltv | churn | sessions | funnel | time | revenue | patterns | predictions | growth | smart_money | all',
      },
    },
    required: [],
  },
};

export async function execute(userId, args = {}) {
  const analyses = await AnalysisStorage.findByUserId(userId);
  const latest = analyses.find(a => a.status === 'completed');
  if (!latest) return { error: 'No completed analysis found.' };

  const txs = latest.results?.target?.transactions || [];
  if (!txs.length) return { error: 'No transactions indexed yet.' };

  const section = args.section || 'all';
  const ethPrice = 2500;

  if (section === 'all') return BI.runAll(txs, ethPrice);
  if (section === 'ltv')         return BI.computeLTV(txs, ethPrice);
  if (section === 'churn')       return BI.computeChurnRisk(txs);
  if (section === 'sessions')    return BI.computeSessions(txs);
  if (section === 'funnel')      return BI.computeFeatureFunnel(txs);
  if (section === 'time')        return BI.computeTimePatterns(txs);
  if (section === 'revenue')     return BI.computeRevenueForecast(txs, ethPrice);
  if (section === 'patterns')    return BI.recognizePatterns(txs);
  if (section === 'predictions') return BI.predictNextActions(txs);
  if (section === 'growth')      return BI.predictUserGrowth(txs);
  if (section === 'smart_money') return BI.detectSmartMoney(txs);

  return { error: `Unknown section: ${section}` };
}
