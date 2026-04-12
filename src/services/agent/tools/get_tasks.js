import { getTraction } from '../../../api/database/TractionStorage.js';
import { AITaskManager } from '../../AITaskManager.js';

export const schema = {
  name: 'get_tasks',
  description: 'Get all open, resolved, and overdue tasks for the user from both the traction system and AI task manager.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function execute(userId) {
  const [traction, aiTasks] = await Promise.all([
    getTraction(userId),
    AITaskManager.getAllTasks(userId),
  ]);

  const tractionTasks = traction.tasks || [];
  const open = [...tractionTasks.filter(t => t.status !== 'resolved'), ...aiTasks.filter(t => t.status === 'active')];
  const resolved = [...tractionTasks.filter(t => t.status === 'resolved'), ...aiTasks.filter(t => t.status === 'completed')];
  const overdue = aiTasks.filter(t => t.status === 'active' && t.deadline && new Date(t.deadline) < new Date());

  return {
    tractionTasks,
    aiTasks,
    openCount: open.length,
    resolvedCount: resolved.length,
    overdueCount: overdue.length,
  };
}
