import { getTraction } from '../../../api/database/TractionStorage.js';
import { AITaskManager } from '../../AITaskManager.js';

export const schema = {
  name: 'get_analyzer_state',
  description: 'Get the current OPS score, pillar breakdown, and task health for the analyzer dashboard.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function execute(userId) {
  const [traction, aiTasks] = await Promise.all([
    getTraction(userId),
    AITaskManager.getActiveTasks(userId),
  ]);

  const tasks = traction.tasks || [];
  const openTasks = tasks.filter(t => t.status !== 'resolved').length + aiTasks.length;
  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'resolved').length;

  return {
    opsScore: traction.productivityScore || 0,
    opsLabel: getLabel(traction.productivityScore || 0),
    pillars: traction.pillars || {},
    openTasks,
    highPriorityTasks,
    productivityScore: traction.productivityScore || 0,
  };
}

function getLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Critical';
}
