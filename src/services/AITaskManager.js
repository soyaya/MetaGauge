/**
 * AITaskManager
 * Creates, tracks, and observes AI-assigned tasks.
 * Tasks are on-chain goals — completion is verified by metric changes.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { checkAllAlerts } from './AlertEngine.js';

const TASKS_FILE = path.resolve('./data/ai-tasks.json');

async function readTasks() {
  try { return JSON.parse(await fs.readFile(TASKS_FILE, 'utf8')); } catch { return []; }
}
async function writeTasks(tasks) {
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export class AITaskManager {
  /**
   * Create a new AI-assigned task.
   */
  static async createTask({ userId, contractId, contractAddress, chain, goal, targetMetric, targetValue, deadlineDays = 14, rationale }) {
    const tasks = await readTasks();
    const task = {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      userId,
      contractId,
      contractAddress,
      chain,
      goal,
      targetMetric,
      targetValue,
      rationale,
      status: 'active', // active | completed | overdue | dismissed
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + deadlineDays * 86400000).toISOString(),
      completedAt: null,
      baselineValue: null, // set on first observe
      progressHistory: [],
    };
    tasks.unshift(task);
    await writeTasks(tasks);
    return task;
  }

  /**
   * Get active tasks for a user/contract.
   */
  static async getActiveTasks(userId, contractId = null) {
    const tasks = await readTasks();
    return tasks.filter(t =>
      t.userId === userId &&
      t.status === 'active' &&
      (!contractId || t.contractId === contractId)
    );
  }

  static async getAllTasks(userId) {
    const tasks = await readTasks();
    return tasks.filter(t => t.userId === userId);
  }

  /**
   * Observe all active tasks for a user after an analysis run.
   * Checks if targetMetric has reached targetValue.
   * Fires alerts on completion or overdue.
   */
  static async observeAllTasks(userId, currentMetrics, wsManager = null) {
    const tasks = await readTasks();
    const now = Date.now();
    let changed = false;

    for (const task of tasks) {
      if (task.userId !== userId || task.status !== 'active') continue;

      const current = currentMetrics[task.targetMetric];
      if (current == null) continue;

      // Set baseline on first observation
      if (task.baselineValue == null) {
        task.baselineValue = current;
      }

      // Record progress
      task.progressHistory.push({ date: new Date().toISOString(), value: current });
      task.progressHistory = task.progressHistory.slice(-30);

      // Check completion
      const target = parseFloat(task.targetValue);
      const curr = parseFloat(current);
      const completed = AITaskManager._isTargetMet(curr, target, task.targetMetric);

      if (completed) {
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        changed = true;
        console.log(`✅ Task completed: ${task.goal} (${task.targetMetric}: ${curr})`);
        // Fire alert
        await AITaskManager._fireTaskAlert(task, 'completed', wsManager);
      } else if (now > new Date(task.deadline).getTime()) {
        task.status = 'overdue';
        changed = true;
        console.log(`⚠️ Task overdue: ${task.goal}`);
        await AITaskManager._fireTaskAlert(task, 'overdue', wsManager);
      }
    }

    if (changed) await writeTasks(tasks);
    return tasks.filter(t => t.userId === userId);
  }

  /**
   * Determine if a metric target is met.
   * Handles both "increase to X" and "decrease to X" goals.
   */
  static _isTargetMet(current, target, metricKey) {
    // Metrics where lower is better (failure rate, bot ratio, churn)
    const lowerIsBetter = ['failureRate', 'botRatio', 'churnRate', 'whaleConcentration', 'avgGasUsed', 'gasEfficiency'];
    if (lowerIsBetter.includes(metricKey)) return current <= target;
    return current >= target;
  }

  static async _fireTaskAlert(task, type, wsManager) {
    const alertData = {
      id: `task-alert-${Date.now()}`,
      type: `task_${type}`,
      severity: type === 'completed' ? 'medium' : 'high',
      contractId: task.contractId,
      userId: task.userId,
      title: type === 'completed' ? `✅ Task Completed: ${task.goal}` : `⚠️ Task Overdue: ${task.goal}`,
      message: type === 'completed'
        ? `${task.targetMetric} reached ${task.progressHistory.at(-1)?.value} (target: ${task.targetValue})`
        : `Deadline passed. ${task.targetMetric} is still ${task.progressHistory.at(-1)?.value} (target: ${task.targetValue})`,
      is_read: false,
      acknowledged_at: null,
      createdAt: new Date().toISOString(),
    };

    // Write to alerts file
    const ALERTS_FILE = path.resolve('./data/alerts.json');
    let alerts = [];
    try { alerts = JSON.parse(await fs.readFile(ALERTS_FILE, 'utf8')); } catch {}
    alerts.unshift(alertData);
    await fs.writeFile(ALERTS_FILE, JSON.stringify(alerts, null, 2));

    // Push via WebSocket
    if (wsManager) {
      wsManager.emitProgress(task.userId, { type: 'alert', alert: alertData });
    }
  }

  static async dismissTask(taskId, userId) {
    const tasks = await readTasks();
    const task = tasks.find(t => t.id === taskId && t.userId === userId);
    if (!task) return null;
    task.status = 'dismissed';
    await writeTasks(tasks);
    return task;
  }
}
