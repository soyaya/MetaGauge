import { AnalysisStorage } from '../../../api/database/index.js';

export const schema = {
  name: 'get_transactions',
  description: 'Get transactions from the latest analysis with optional filtering.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max transactions to return (default 50)' },
      filter: { type: 'string', enum: ['all', 'failed', 'whale'], description: 'Filter type' },
    },
    required: [],
  },
};

export async function execute(userId, args = {}) {
  const { limit = 50, filter = 'all' } = args;
  const analyses = await AnalysisStorage.findByUserId(userId);
  const latest = analyses.find(a => a.status === 'completed');
  if (!latest) return { transactions: [], totalCount: 0, failureRate: 0, avgValue: 0 };

  let txs = latest.results?.target?.transactions || [];
  const totalCount = txs.length;
  const failed = txs.filter(t => t.status === false || t.status === 0);
  const failureRate = totalCount ? Math.round((failed.length / totalCount) * 100) : 0;
  const avgValue = totalCount ? txs.reduce((s, t) => s + (Number(t.value) || 0), 0) / totalCount : 0;

  if (filter === 'failed') txs = failed;
  else if (filter === 'whale') txs = txs.filter(t => (Number(t.value) || 0) > 1e18); // >1 ETH

  return { transactions: txs.slice(0, limit), totalCount, failureRate, avgValue };
}
