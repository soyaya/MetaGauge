import { UserStorage, AIAdviceStorage } from '../api/database/index.js';
import { EmailService } from './EmailService.js';

const emailService = new EmailService();

async function readLog(userId) {
  const all = await AIAdviceStorage.findByUserId(userId);
  return all.filter(e => e.data?.type === 'email-log').map(e => e.data);
}

async function logSent(userId, type) {
  await AIAdviceStorage.append({ userId, data: { type: 'email-log', emailType: type, sentAt: new Date().toISOString() } });
}

async function canSend(userId, type, critical = false) {
  if (critical) return true;
  const log = await readLog(userId);
  const today = new Date().toDateString();
  return !log.some(e => e.emailType === type && new Date(e.sentAt).toDateString() === today);
}

async function getEmail(userId) {
  const user = await UserStorage.findById(userId);
  return user?.email || null;
}

export class EmailAutomation {
  static async sendRegressionAlert(userId, metric, before, after) {
    try {
      if (!await canSend(userId, 'regression_alert', true)) return;
      const email = await getEmail(userId);
      if (!email) return;
      await emailService.sendAlert(email, {
        severity: 'high',
        title: `${metric} dropped ${Math.round(((before - after) / before) * 100)}%`,
        message: `${metric} fell from ${before} to ${after} since last analysis.`,
      });
      await logSent(userId, 'regression_alert');
    } catch (err) { console.warn('[EmailAutomation] regression alert failed:', err.message); }
  }

  static async sendTaskAlert(userId, task, type) {
    try {
      if (!await canSend(userId, `task_${type}`)) return;
      const email = await getEmail(userId);
      if (!email) return;
      const title = type === 'completed' ? `Task resolved: ${task.goal}` : `Task overdue: ${task.goal}`;
      await emailService.sendAlert(email, { severity: type === 'overdue' ? 'high' : 'low', title, message: task.rationale || '' });
      await logSent(userId, `task_${type}`);
    } catch (err) { console.warn('[EmailAutomation] task alert failed:', err.message); }
  }

  static async sendInactiveNudge(userId, openTaskCount) {
    try {
      if (!await canSend(userId, 'inactive_nudge')) return;
      const email = await getEmail(userId);
      if (!email) return;
      await emailService.sendAlert(email, {
        severity: 'low',
        title: 'You have unresolved issues',
        message: `${openTaskCount} open task${openTaskCount !== 1 ? 's' : ''} on your contract need attention.`,
      });
      await logSent(userId, 'inactive_nudge');
    } catch (err) { console.warn('[EmailAutomation] nudge failed:', err.message); }
  }

  static async sendDigest(userId, briefing) {
    try {
      const email = await getEmail(userId);
      if (!email) return;
      await emailService.sendBriefing(email, briefing);
      await logSent(userId, 'digest');
    } catch (err) { console.warn('[EmailAutomation] digest failed:', err.message); }
  }
}
