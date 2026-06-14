/**
 * EmailService - Send briefings and alerts via email
 * Professional HTML templates with MetaGauge branding.
 */
import nodemailerPkg from 'nodemailer';
const nodemailer = nodemailerPkg.default || nodemailerPkg;

const BRAND_COLOR = '#6366f1';
const FROM = process.env.FROM_EMAIL || 'MetaGauge <noreply@metagauge.io>';

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header -->
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">MetaGauge</span>
          <span style="color:rgba(255,255,255,.6);font-size:13px;margin-left:8px;">AI Intelligence</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            You're receiving this because you enabled AI alerts on MetaGauge.<br>
            Manage your preferences in <a href="${process.env.FRONTEND_URL || 'https://metagauge.io'}/agent" style="color:${BRAND_COLOR};">Agent Settings</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const SEVERITY_STYLES = {
  critical: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', icon: '🔴' },
  high:     { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', icon: '🔴' },
  medium:   { bg: '#fffbeb', border: '#f59e0b', text: '#d97706', icon: '🟡' },
  low:      { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a', icon: '🟢' },
  info:     { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb', icon: '🔵' },
};

export class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendAlert(to, alert) {
    const s = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium;
    const timestamp = alert.createdAt
      ? new Date(alert.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

    const content = `
      <div style="background:${s.bg};border-left:4px solid ${s.border};border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${s.text};text-transform:uppercase;letter-spacing:.5px;">
          ${s.icon} ${(alert.severity || 'Alert').toUpperCase()}
        </p>
        <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${alert.title}</h2>
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">${alert.message}</p>
      </div>
      ${alert.contractId ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#94a3b8;font-size:13px;width:120px;">Contract</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-family:monospace;">${alert.contractId}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Detected</td>
          <td style="padding:10px 0;color:#0f172a;font-size:13px;">${timestamp}</td>
        </tr>
      </table>` : ''}
      <a href="${process.env.FRONTEND_URL || 'https://metagauge.io'}/dashboard"
         style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
        View Dashboard →
      </a>`;

    return this._send(to, `${s.icon} ${alert.title}`, baseTemplate(content));
  }

  async sendBriefing(to, briefing) {
    const type = (briefing.type || 'daily').charAt(0).toUpperCase() + (briefing.type || 'daily').slice(1);
    const date = new Date(briefing.createdAt || Date.now()).toLocaleDateString('en-GB', { dateStyle: 'long' });

    // Convert plain text content to formatted paragraphs
    const formattedContent = (briefing.content || '')
      .split('\n\n')
      .filter(Boolean)
      .map(para => {
        // Section headings (lines starting with ===, ---, or ALL CAPS short lines)
        if (/^[=\-]{3,}/.test(para) || /^[A-Z][A-Z\s]{4,}$/.test(para.trim())) {
          return `<h3 style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.5px;">${para.replace(/[=\-]/g, '').trim()}</h3>`;
        }
        // Bullet points
        if (para.trim().startsWith('•') || para.trim().startsWith('-')) {
          const items = para.split('\n').filter(Boolean).map(l =>
            `<li style="margin:4px 0;color:#475569;font-size:14px;line-height:1.6;">${l.replace(/^[•\-]\s*/, '')}</li>`
          ).join('');
          return `<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
        }
        return `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${para.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    const content = `
      <h2 style="margin:0 0 4px;font-size:22px;color:#0f172a;">${briefing.title || `${type} Intelligence Brief`}</h2>
      <p style="margin:0 0 28px;color:#94a3b8;font-size:13px;">${date}</p>
      <div style="border-top:2px solid #6366f1;padding-top:24px;">
        ${formattedContent}
      </div>
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'https://metagauge.io'}/dashboard"
           style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          Open Dashboard →
        </a>
      </div>`;

    return this._send(to, `📊 Your ${type} MetaGauge Brief — ${date}`, baseTemplate(content));
  }

  async _send(to, subject, html) {
    try {
      await this.transporter.sendMail({ from: FROM, to, subject, html });
      console.log(`✅ Email sent → ${to}: ${subject}`);
      return true;
    } catch (err) {
      console.error('❌ Email send failed:', err.message);
      return false;
    }
  }
}
