import { resolveTask, saveLearning } from '../../../api/database/TractionStorage.js';

export const schema = {
  name: 'resolve_task',
  description: 'Mark a traction task as resolved and save a learning note about what worked.',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID to resolve' },
      note: { type: 'string', description: 'What worked / what was done to resolve it' },
    },
    required: ['taskId'],
  },
};

export async function execute(userId, args = {}) {
  const { taskId, note = '' } = args;
  const task = await resolveTask(userId, taskId);
  if (note) await saveLearning(userId, { taskId, feedback: note });
  return { task, saved: true };
}
