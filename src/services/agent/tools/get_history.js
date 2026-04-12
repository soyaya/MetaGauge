import { MetricsHistoryStorage } from '../../../api/database/index.js';

export const schema = {
  name: 'get_history',
  description: 'Get historical metrics snapshots for the user to identify trends and changes over time.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function execute(userId) {
  const history = await MetricsHistoryStorage.get(userId).catch(() => []);
  if (!history.length) return { history: [], trend: 'unknown', deltaLast7d: null };

  const recent = history.slice(-7);
  const first = recent[0];
  const last = recent[recent.length - 1];

  let trend = 'stable';
  let deltaLast7d = null;

  const key = ['retentionRate', 'd7Retention', 'totalUsers'].find(k => last[k] != null);
  if (key && first[key] != null) {
    const delta = last[key] - first[key];
    deltaLast7d = delta;
    trend = delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable';
  }

  return { history, trend, deltaLast7d };
}
