/**
 * Billing routes — pay-as-you-go metering
 * Flutterwave v4 (primary): OAuth2 token → customer → card object → charge
 * Paystack (fallback): redirect-based checkout
 */
import express from 'express';
import https from 'https';
import crypto from 'crypto';
import { UserStorage } from '../database/index.js';
import subscriptionService, { PRICING } from '../../services/SubscriptionService.js';
import ProjectRegistryService from '../../services/ProjectRegistryService.js';

const router = express.Router();

const FLW_CLIENT_ID     = process.env.FLW_CLIENT_ID;
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET;
const FLW_ENC_KEY       = process.env.FLW_ENCRYPTION_KEY; // base64 AES-256 key
const PAYSTACK_SECRET   = process.env.PAYSTACK_SECRET_KEY;

const FLW_IDP_HOST  = 'idp.flutterwave.com';
const FLW_API_HOST  = process.env.FLW_SANDBOX === 'true'
  ? 'developersandbox-api.flutterwave.com'
  : 'api.flutterwave.com';

// ── HTTP helper ───────────────────────────────────────────────────────────

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON response')); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsFormPost(hostname, path, formBody) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(formBody).toString();
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON response')); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function paystackPost(path, body) {
  return httpsPost('api.paystack.co', path, body, { Authorization: `Bearer ${PAYSTACK_SECRET}` });
}

// Reusable Paystack redirect-checkout builder — shared by wallet top-ups and
// one-off paid features (e.g. Discover "Feature My Project").
async function createPaystackCheckout({ user, amountUSD, callbackPath = '/subscription?success=1&provider=paystack', metadata = {} }) {
  if (!PAYSTACK_SECRET) throw new Error('Paystack not configured. Set PAYSTACK_SECRET_KEY in .env');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const txRef = `mg-${user.id}-${Date.now()}`;

  const response = await paystackPost('/transaction/initialize', {
    email:        user.email,
    amount:       Math.round(amountUSD * 100),
    currency:     process.env.PAYSTACK_CURRENCY || 'USD',
    reference:    txRef,
    callback_url: `${frontendUrl}${callbackPath}`,
    metadata:     { userId: user.id, amountUSD: String(amountUSD), ...metadata },
  });
  if (!response.status) throw new Error(response.message || 'Paystack error');
  return { url: response.data.authorization_url, reference: txRef };
}

// ── Flutterwave v4 helpers ────────────────────────────────────────────────

// Step 1: Get OAuth2 access token (valid 10 min)
async function flwGetToken() {
  const res = await httpsFormPost(FLW_IDP_HOST,
    '/realms/flutterwave/protocol/openid-connect/token', {
      client_id:     FLW_CLIENT_ID,
      client_secret: FLW_CLIENT_SECRET,
      grant_type:    'client_credentials',
    });
  if (!res.access_token) throw new Error(`FLW token error: ${res.error_description || JSON.stringify(res)}`);
  return res.access_token;
}

// Step 2: Create or retrieve customer
async function flwCreateCustomer(token, user, traceId) {
  const [first, ...rest] = (user.name || user.email).split(' ');
  return httpsPost(FLW_API_HOST, '/customers', {
    email: user.email,
    name:  { first: first || 'User', last: rest.join(' ') || 'Account' },
    phone: { country_code: '1', number: '0000000000' },
    address: { city: 'N/A', country: 'US', line1: 'N/A', postal_code: '00000', state: 'N/A' },
  }, { Authorization: `Bearer ${token}`, 'X-Trace-Id': traceId });
}

// Step 3: Create card payment method (encrypted card data from frontend)
async function flwCreateCard(token, encryptedCard, traceId, idempotencyKey) {
  return httpsPost(FLW_API_HOST, '/payment-methods', {
    type: 'card',
    card: encryptedCard,
  }, {
    Authorization:      `Bearer ${token}`,
    'X-Trace-Id':       traceId,
    'X-Idempotency-Key': idempotencyKey,
  });
}

// Step 4: Create charge
async function flwCharge(token, body, traceId, idempotencyKey) {
  return httpsPost(FLW_API_HOST, '/charges', body, {
    Authorization:      `Bearer ${token}`,
    'X-Trace-Id':       traceId,
    'X-Idempotency-Key': idempotencyKey,
  });
}

// Step 5: Submit PIN (if 3DS required)
async function flwSubmitPin(token, chargeId, encryptedPin, nonce, traceId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ authorization: { type: 'pin', pin: { nonce, encrypted_pin: encryptedPin } } });
    const req = https.request({
      hostname: FLW_API_HOST,
      path:     `/charges/${chargeId}`,
      method:   'PUT',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-Trace-Id':   traceId,
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── GET /api/billing/usage ────────────────────────────────────────────────
router.get('/usage', async (req, res) => {
  try {
    res.json(await subscriptionService.getUsage(req.user.id));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/billing/pricing ──────────────────────────────────────────────
router.get('/pricing', (_req, res) => res.json(PRICING));

// ── GET /api/billing/transactions ─────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    res.json({ transactions: (user?.billing?.transactions || []).slice().reverse() });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/billing/flw-token ───────────────────────────────────────────
// Frontend calls this first to get a short-lived token for encryption
router.post('/flw-token', async (req, res) => {
  if (!FLW_CLIENT_ID || !FLW_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Flutterwave not configured' });
  }
  try {
    const token = await flwGetToken();
    // Return token + encryption key so frontend can encrypt card data
    res.json({
      token,
      encryptionKey: FLW_ENC_KEY, // base64 AES-256 key
      apiHost: FLW_API_HOST,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/billing/flw-charge ──────────────────────────────────────────
// Full server-side charge flow: customer → card → charge
router.post('/flw-charge', async (req, res) => {
  if (!FLW_CLIENT_ID || !FLW_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Flutterwave not configured' });
  }

  const { amount, encryptedCard, currency = 'USD' } = req.body;
  // encryptedCard = { encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year, encrypted_cvv, nonce }
  if (!amount || !encryptedCard?.encrypted_card_number) {
    return res.status(400).json({ message: 'amount and encryptedCard required' });
  }

  const amountUSD = parseFloat(amount);
  if (amountUSD < 1) return res.status(400).json({ message: 'Minimum top-up is $1' });

  const user = await UserStorage.findById(req.user.id).catch(() => null);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const traceId      = `mg-${req.user.id}-${Date.now()}`;
  const idempotency  = crypto.randomUUID();
  const reference    = `mg-${req.user.id}-${Date.now()}`;

  try {
    const token = await flwGetToken();

    // Create customer
    const customerRes = await flwCreateCustomer(token, user, traceId);
    const customerId  = customerRes?.data?.id || customerRes?.id;
    if (!customerId) throw new Error(`Customer creation failed: ${JSON.stringify(customerRes)}`);

    // Create card object
    const cardRes = await flwCreateCard(token, encryptedCard, traceId, idempotency);
    const cardId  = cardRes?.data?.id || cardRes?.id;
    if (!cardId) throw new Error(`Card creation failed: ${JSON.stringify(cardRes)}`);

    // Create charge
    const chargeRes = await flwCharge(token, {
      reference,
      currency,
      customer_id:       customerId,
      payment_method_id: cardId,
      amount:            amountUSD,
      redirect_url:      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription?success=1&provider=flutterwave`,
      meta: { userId: req.user.id, amountUSD: String(amountUSD) },
    }, traceId, idempotency);

    const chargeId = chargeRes?.data?.id || chargeRes?.id;
    const status   = chargeRes?.data?.status || chargeRes?.status;
    const nextAction = chargeRes?.data?.next_action;

    // If 3DS redirect required
    if (nextAction?.redirect_url?.url) {
      return res.json({
        status:      'redirect',
        redirectUrl: nextAction.redirect_url.url,
        chargeId,
        reference,
      });
    }

    // If PIN required
    if (status === 'pending' && nextAction?.type === 'pin') {
      return res.json({ status: 'pin_required', chargeId, reference });
    }

    // Charge succeeded immediately
    if (status === 'succeeded' || status === 'successful') {
      await subscriptionService.topUp(req.user.id, amountUSD);
      return res.json({ status: 'success', reference, balance: (await subscriptionService.getUsage(req.user.id)).balance });
    }

    res.status(400).json({ message: `Charge status: ${status}`, chargeRes });
  } catch (e) {
    console.error('[FLW charge]', e.message);
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/billing/flw-pin ─────────────────────────────────────────────
// Submit PIN for 3DS charges
router.post('/flw-pin', async (req, res) => {
  const { chargeId, encryptedPin, nonce, amountUSD } = req.body;
  if (!chargeId || !encryptedPin || !nonce) {
    return res.status(400).json({ message: 'chargeId, encryptedPin, nonce required' });
  }
  try {
    const token  = await flwGetToken();
    const result = await flwSubmitPin(token, chargeId, encryptedPin, nonce, `mg-pin-${Date.now()}`);
    const status = result?.data?.status || result?.status;

    if (status === 'succeeded' || status === 'successful') {
      await subscriptionService.topUp(req.user.id, parseFloat(amountUSD));
      return res.json({ status: 'success', balance: (await subscriptionService.getUsage(req.user.id)).balance });
    }

    const redirectUrl = result?.data?.next_action?.redirect_url?.url;
    if (redirectUrl) return res.json({ status: 'redirect', redirectUrl });

    res.status(400).json({ message: `PIN status: ${status}`, result });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/billing/checkout — Paystack redirect fallback ───────────────
router.post('/checkout', async (req, res) => {
  const { amount = 10 } = req.body;
  const amountUSD = parseFloat(amount);
  if (!amountUSD || amountUSD < 1) return res.status(400).json({ message: 'Minimum top-up is $1' });

  const user = await UserStorage.findById(req.user.id).catch(() => null);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const { url, reference } = await createPaystackCheckout({
      user, amountUSD,
      callbackPath: '/subscription?success=1&provider=paystack',
      metadata: { cancel_action: `${frontendUrl}/subscription?cancelled=1` },
    });
    res.json({ url, reference, provider: 'paystack' });
  } catch (e) {
    res.status(e.message.includes('not configured') ? 503 : 500).json({ message: e.message });
  }
});

// ── Processed webhook IDs (in-memory dedup — survives restarts via UserStorage if needed) ──
const _processedWebhooks = new Set();

// ── Flutterwave v4 webhook ────────────────────────────────────────────────
export async function flutterwaveWebhookHandler(req, res) {
  // 1. Verify signature — HMAC-SHA256 base64 of raw body
  const secretHash = process.env.FLW_WEBHOOK_HASH;
  const signature  = req.headers['flutterwave-signature'];

  if (secretHash) {
    const expected = crypto
      .createHmac('sha256', secretHash)
      .update(req.body)           // req.body is raw Buffer (express.raw middleware)
      .digest('base64');
    if (expected !== signature) {
      console.error('[FLW webhook] Invalid signature');
      return res.status(401).end();
    }
  }

  // 2. Respond 200 immediately — process async to stay within 60s timeout
  res.status(200).end();

  let event;
  try { event = JSON.parse(req.body); } catch { return; }

  // 3. Idempotency — discard duplicate webhook IDs
  const webhookId = event.id;
  if (webhookId) {
    if (_processedWebhooks.has(webhookId)) {
      console.log(`[FLW webhook] Duplicate ${webhookId} — skipped`);
      return;
    }
    _processedWebhooks.add(webhookId);
    // Prune set to avoid unbounded growth
    if (_processedWebhooks.size > 1000) {
      const first = _processedWebhooks.values().next().value;
      _processedWebhooks.delete(first);
    }
  }

  // 4. Only handle successful charges
  if (event.type !== 'charge.completed' || event.data?.status !== 'succeeded') return;

  const meta = event.data?.meta || {};
  const { userId, amountUSD, purpose, contractId, contractAddress, chain, plan } = meta;
  const reference = event.data?.reference;

  if (!userId || !amountUSD) {
    console.warn('[FLW webhook] Missing userId or amountUSD in meta', { reference });
    return;
  }

  try {
    if (purpose === 'feature_project' && contractId) {
      await ProjectRegistryService.activateFeatured(userId, contractId, contractAddress, chain, plan, reference, parseFloat(amountUSD));
      console.log(`[FLW webhook] ✅ Activated featured listing (${plan}) for user ${userId}, contract ${contractId}`);
    } else {
      await subscriptionService.topUp(userId, parseFloat(amountUSD));
      console.log(`[FLW webhook] ✅ Topped up $${amountUSD} for user ${userId} (ref: ${reference})`);
    }
  } catch (e) {
    console.error('[FLW webhook] Payment processing failed:', e.message);
  }
}

// ── Paystack webhook ──────────────────────────────────────────────────────
export async function paystackWebhookHandler(req, res) {
  if (!PAYSTACK_SECRET) return res.status(503).send('Paystack not configured');
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(req.body).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) return res.status(400).end();

  // Respond 200 immediately
  res.status(200).end();

  let event;
  try { event = JSON.parse(req.body); } catch { return; }

  if (event.event === 'charge.success') {
    const meta = event.data?.metadata || {};
    const { userId, amountUSD, purpose, contractId, contractAddress, chain, plan } = meta;
    const reference = event.data?.reference;
    if (userId && amountUSD) {
      try {
        if (purpose === 'feature_project' && contractId) {
          await ProjectRegistryService.activateFeatured(userId, contractId, contractAddress, chain, plan, reference, parseFloat(amountUSD));
          console.log(`[Paystack webhook] ✅ Activated featured listing (${plan}) for user ${userId}, contract ${contractId}`);
        } else {
          await subscriptionService.topUp(userId, parseFloat(amountUSD));
          console.log(`[Paystack webhook] ✅ Topped up $${amountUSD} for user ${userId}`);
        }
      } catch (e) {
        console.error('[Paystack webhook] Payment processing failed:', e.message);
      }
    }
  }
}

export { createPaystackCheckout };
export default router;
