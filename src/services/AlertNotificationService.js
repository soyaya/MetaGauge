/**
 * AlertNotificationService
 * Delivers alerts via email with AI-generated messages via Gemini.
 */

import geminiService from './GeminiAIService.js';
import { FREE_QUOTA } from '../config/pricing.js';
import { sendEmail } from './mailer.js';

const gemini = geminiService;

export class AlertNotificationService {
  constructor() {}

  getAllowedChannels(tier) {
    const t = typeof tier === 'string' ? tier.toLowerCase() : 'free';
    if (t === 'free')       return ['inApp'];
    if (t === 'starter')    return ['inApp', 'email'];
    return ['inApp', 'email', 'webhook'];
  }

  getMaxAlerts() {
    return FREE_QUOTA.alerts;
  }

  /**
   * Generate AI-written alert message using Gemini.
   */
  async generateAIMessage(alert, metrics = {}) {
    try {
      const prompt = `You are a blockchain analytics assistant. Write a concise, actionable alert email body (3-4 sentences max) for this event:

Alert: ${alert.title}
Severity: ${alert.severity}
Contract: ${alert.contractAddress || 'unknown'}
Details: ${alert.message}
Key metrics: ${JSON.stringify(metrics).slice(0, 500)}

Be specific, mention the metric values, and suggest one action the user should take. No markdown, plain text only.`;

      const insights = await gemini.generateQuickInsights({ summary: metrics, alert }, 'system');
      return insights?.summary || alert.message;
    } catch {
      return alert.message;
    }
  }

  /**
   * Send alert via all configured channels.
   */
  async sendAlert(alert, channels = ['inApp'], userEmail = null, webhookUrl = null, metrics = {}) {
    const results = { inApp: true, email: false, webhook: false };

    if (channels.includes('email') && userEmail) {
      results.email = await this.sendEmail(alert, userEmail, metrics);
    }

    if (channels.includes('webhook') && webhookUrl) {
      results.webhook = await this.sendWebhook(alert, webhookUrl);
    }

    return results;
  }

  async sendEmail(alert, toEmail, metrics = {}) {
    try {
      const aiBody = await this.generateAIMessage(alert, metrics);
      const severityEmoji = { critical: '🚨', high: '⚠️', medium: '📊', low: 'ℹ️' }[alert.severity] || '📊';
      const subject = `${severityEmoji} [MetaGauge] ${alert.title}`;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1D4ED8;color:white;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">${severityEmoji} MetaGauge Alert</h2>
            <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${alert.severity?.toUpperCase()} severity</p>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <h3 style="margin:0 0 12px;color:#111827">${alert.title}</h3>
            <p style="color:#374151;line-height:1.6">${aiBody}</p>
            <div style="margin-top:20px;padding:12px;background:white;border-radius:6px;border:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#6b7280">
                Contract: ${alert.contractAddress || 'N/A'} &nbsp;|&nbsp; ${new Date().toLocaleString()}
              </p>
            </div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/alerts"
               style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1D4ED8;color:white;text-decoration:none;border-radius:6px;font-size:14px">
              View in Dashboard →
            </a>
          </div>
        </div>`;
      return sendEmail({ to: toEmail, subject, html });
    } catch (e) {
      console.error('[Alert] sendEmail failed:', e.message);
      return false;
    }
  }

  async sendWebhook(alert, webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'alert', ...alert, timestamp: new Date().toISOString() }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export default AlertNotificationService;
