import { AITaskManager } from '../../AITaskManager.js';
import { isAgentPermitted } from '../../AgentService.js';

export const schema = {
  name: 'create_task',
  description: 'Create an actionable task for a failing metric. Use this when you identify a metric that needs improvement.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short task title' },
      description: { type: 'string', description: 'What needs to be done and why' },
      metric: { type: 'string', description: 'The metric key e.g. d7Retention' },
      current: { type: 'number', description: 'Current metric value' },
      target: { type: 'number', description: 'Target metric value' },
      lowerBetter: { type: 'boolean', description: 'True if lower value is better (e.g. churn, gas)' },
      pillar: { type: 'string', description: 'OPS pillar: retention, activation, revenue, engagement' },
      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
      action: { type: 'string', description: 'Specific recommended action' },
      deadlineDays: { type: 'number', description: 'Days until deadline (default 14)' },
    },
    required: ['title', 'metric', 'current', 'target'],
  },
};

export async function execute(userId, args = {}, context = {}) {
  if (!isAgentPermitted(userId, 'createTasks')) {
    return { error: 'Task creation is disabled. Enable "Create Tasks" in Alerts → Agent Controls.' };
  }
  const task = await AITaskManager.createTask({
    userId,
    contractAddress: context.contractAddress || '',
    chain: context.chain || 'ethereum',
    goal: args.title,
    targetMetric: args.metric,
    targetValue: args.target,
    deadlineDays: args.deadlineDays || 14,
    rationale: args.description || args.action || '',
  });

  return { task, taskId: task.id, created: true };
}
