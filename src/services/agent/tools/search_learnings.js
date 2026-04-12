import { AILearningsStorage, FeedbackStorage } from '../../../api/database/index.js';

export const schema = {
  name: 'search_learnings',
  description: 'Search past task resolutions and user feedback to find what worked before for similar problems.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query e.g. "improve retention"' },
      metricName: { type: 'string', description: 'Optional metric name to filter by e.g. "d7Retention"' },
    },
    required: ['query'],
  },
};

export async function execute(userId, args = {}) {
  const { query = '', metricName } = args;
  const q = query.toLowerCase();

  const [resolutions, feedback] = await Promise.all([
    AILearningsStorage.getAll(),
    FeedbackStorage.findByUserId(userId),
  ]);

  const matchedResolutions = resolutions.filter(r =>
    (!metricName || r.taskId?.includes(metricName) || r.metricName === metricName) &&
    (r.feedback?.toLowerCase().includes(q) || r.taskId?.toLowerCase().includes(q))
  );

  const feedbackPatterns = feedback.filter(f =>
    f.note?.toLowerCase().includes(q) || f.componentType?.toLowerCase().includes(q)
  );

  return { resolutions: matchedResolutions, feedbackPatterns, relevantCount: matchedResolutions.length + feedbackPatterns.length };
}
