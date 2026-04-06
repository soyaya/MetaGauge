/**
 * Billing routes — pay-as-you-go metering + Stripe top-up
 */
import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/auth.js';
import subscriptionService, { PRICING } from '../../services/SubscriptionService.js';
import { UserStorage } from '../database/index.js';

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// ── Authenticated routes ──────────────────────────────────────────────────

router.use(authenticateToken);

// GET /api/billing/usage
router.get('/usage', async (req, res) => {
  try {
    const usage = await subscriptionService.getUsage(req.user.id);
    res.json(usage);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/billing/pricing
router.get('/pricing', (req, res) => {
  res.json(PRICING);
});

// GET /api/billing/transactions
router.get('/transactions', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    const txs = user?.billing?.transactions || [];
    res.json({ transactions: txs.slice().reverse() });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/billing/checkout — create Stripe checkout session
router.post('/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ message: 'Stripe not configured. Set STRIPE_SECRET_KEY in .env' });

  const { amount = 10 } = req.body; // USD amount to top up
  const amountCents = Math.round(parseFloat(amount) * 100);
  if (amountCents < 100) return res.status(400).json({ message: 'Minimum top-up is $1' });

  try {
    const user = await UserStorage.findById(req.user.id);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'MetaGauge Credits',
            description: `$${amount} of analysis credits`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription?success=1`,
      cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription?cancelled=1`,
      metadata: {
        userId:    req.user.id,
        userEmail: user?.email || '',
        amountUSD: String(amount),
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Stripe webhook (no auth — verified by signature) ─────────────────────
// Must be registered BEFORE express.json() middleware in server.js
export async function stripeWebhookHandler(req, res) {
  if (!stripe) return res.status(503).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('[Stripe] Webhook signature failed:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, amountUSD } = session.metadata || {};
    if (userId && amountUSD) {
      try {
        await subscriptionService.topUp(userId, parseFloat(amountUSD));
        console.log(`[Stripe] Topped up $${amountUSD} for user ${userId}`);
      } catch (e) {
        console.error('[Stripe] Top-up failed:', e.message);
      }
    }
  }

  res.json({ received: true });
}

export default router;
