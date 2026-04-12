import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { UserStorage } from '../database/index.js';
import GeminiAIService from '../../services/GeminiAIService.js';
import nodemailer from 'nodemailer';
import { query } from '../database/postgres.js';

const router = express.Router();

const APP_CONTEXT = `You are MetaGauge's in-app assistant. MetaGauge is a blockchain analytics platform.
Help users navigate and understand the app. Be concise (2-3 sentences max).

Key pages:
- /dashboard — overview of their contract metrics
- /analyzer — traction score, tasks, growth metrics  
- /chat — AI chat about their specific contract data
- /alerts — set up alerts for contract events
- /developers — API key and SDK docs
- /subscription — balance, top up, usage
- /profile — account settings
- /onboarding — add their first contract

Key concepts:
- Users add a smart contract address, MetaGauge indexes it and shows analytics
- Pay-as-you-go: 3 free analyses/month, 3 free AI queries/month, then $0.10/analysis $0.05/AI query
- Continuous monitoring: $0.10/day per contract, syncs daily at registration time
- API key: requires positive balance, 60 req/min, 1000 req/day

If asked something outside MetaGauge, redirect them to the relevant page or feature.`;

// POST /api/support/ask — AI assistant answer
router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const result = await GeminiAIService._generateWithFallback({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [{ parts: [{ text: `${APP_CONTEXT}\n\nUser question: ${message.trim()}\n\nAnswer:` }] }],
    });
    const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || "I'm not sure about that. Try visiting /dashboard or contact support.";

    // Save interaction
    await query(
      'INSERT INTO support_messages (user_id, type, user_message, assistant_reply) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'ai', message.trim(), reply]
    ).catch(() => {});

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ reply: 'Something went wrong. Please try again or contact support@metagauge.io' });
  }
});

// POST /api/support/contact — send message to company
router.post('/contact', authenticateToken, async (req, res) => {
  try {
    const { message, subject = 'Support Request' } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const user = await UserStorage.findById(req.user.id);

    // Send email to support
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: process.env.SUPPORT_EMAIL || 'support@metagauge.io',
        subject: `[MetaGauge Support] ${subject} — ${user?.email}`,
        html: `<p><strong>From:</strong> ${user?.name} (${user?.email})</p><p><strong>Message:</strong></p><p>${message.trim().replace(/\n/g, '<br>')}</p>`,
      }).catch(() => {});
    }

    // Save contact message
    await query(
      'INSERT INTO support_messages (user_id, type, user_message, assistant_reply) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'contact', message.trim(), 'Message sent to support']
    ).catch(() => {});

    res.json({ success: true, message: "Message sent. We'll get back to you at " + user?.email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message', message: err.message });
  }
});

export default router;
