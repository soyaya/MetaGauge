import * as getMetrics from './get_metrics.js';
import * as getTasks from './get_tasks.js';
import * as getHistory from './get_history.js';
import * as getCompetitors from './get_competitors.js';
import * as getTransactions from './get_transactions.js';
import * as resolveTask from './resolve_task.js';
import * as searchLearnings from './search_learnings.js';
import * as getMarketContext from './get_market_context.js';
import * as getAnalyzerState from './get_analyzer_state.js';
import * as createTask from './create_task.js';
import * as getBusinessIntelligence from './get_business_intelligence.js';
import * as getOnchainRisk from './get_onchain_risk.js';
import * as getGithubIntelligence from './get_github_intelligence.js';
import * as getIntelligenceScores from './get_intelligence_scores.js';
import * as getSentiment from './get_sentiment.js';

const ALL_TOOLS = [
  getMetrics, getTasks, getHistory, getCompetitors, getTransactions,
  resolveTask, searchLearnings, getMarketContext, getAnalyzerState, createTask,
  getBusinessIntelligence,
  getOnchainRisk, getGithubIntelligence, getIntelligenceScores, getSentiment,
];

export const TOOL_SCHEMAS = ALL_TOOLS.map(t => ({
  name: t.schema.name,
  description: t.schema.description,
  parameters: t.schema.parameters,
}));

export const TOOL_EXECUTORS = Object.fromEntries(
  ALL_TOOLS.map(t => [t.schema.name, t.execute])
);
