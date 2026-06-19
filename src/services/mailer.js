/**
 * mailer.js — single email sender for the whole app.
 * Strategy: Resend (if RESEND_API_KEY set) → SMTP (if SMTP_USER+SMTP_PASS set) → log only.
 */
import nodemailerPkg from 'nodemailer';
const nodemailer = nodemailerPkg.default || nodemailerPkg;

function getFrom() {
  return process.env.FROM_EMAIL || `"MetaGauge" <${process.env.SMTP_USER || 'noreply@metagauge.io'}>`;
}

function getSMTPTransport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Send an email. Returns true on success, false on failure.
 * @param {{ to: string, subject: string, html: string, from?: string }} options
 */
export async function sendEmail({ to, subject, html, from }) {
  const sender = from || getFrom();

  // 1. Try Resend
  if (process.env.RESEND_API_KEY) {
    // Use Resend's shared sender if FROM_EMAIL is not a verified Resend domain
    const resendFrom = process.env.RESEND_FROM_EMAIL || 'MetaGauge <onboarding@resend.dev>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: resendFrom, to: [to], subject, html }),
      });
      if (res.ok) {
        console.log(`[mailer] sent via Resend → ${to}: ${subject}`);
        return true;
      }
      const err = await res.json().catch(() => ({}));
      console.warn('[mailer] Resend failed, trying SMTP:', JSON.stringify(err));
    } catch (e) {
      console.warn('[mailer] Resend error, trying SMTP:', e.message);
    }
  }

  // 2. Try SMTP
  const transport = getSMTPTransport();
  if (transport) {
    try {
      await transport.sendMail({ from: sender, to, subject, html });
      console.log(`[mailer] sent via SMTP → ${to}: ${subject}`);
      return true;
    } catch (e) {
      console.error('[mailer] SMTP failed:', e.message);
    }
  }

  // 3. No provider — log and fail gracefully
  console.warn(`[mailer] no email provider configured. Would have sent "${subject}" to ${to}`);
  return false;
}
