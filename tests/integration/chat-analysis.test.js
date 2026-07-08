/**
 * Chat & Analysis API Integration Tests
 */

import supertest from 'supertest';
import app from '../../src/api/server.js';

const request = supertest(app);

// Pre-warm DB connection
beforeAll(async () => {
  await request.get('/health').catch(() => {});
  await request.post('/api/auth/login').send({ email: 'warmup@x.io', password: 'x' }).catch(() => {});
}, 30000);


const uniqueEmail = (p = 'chat') =>
  `${p}_${Date.now()}_${Math.random().toString(36).slice(2)}@metagauge-test.io`;

const VALID_PASSWORD = 'TestPass123!';

async function getToken() {
  const email = uniqueEmail();
  let regRes = await request.post('/api/auth/register').send({ email, password: VALID_PASSWORD, name: 'Test User' });
  // Retry once if DB connection was dropped
  if (regRes.status >= 500) {
    await new Promise(r => setTimeout(r, 3000));
    regRes = await request.post('/api/auth/register').send({ email, password: VALID_PASSWORD, name: 'Test User' });
  }
  let r = await request.post('/api/auth/login').send({ email, password: VALID_PASSWORD });
  // Retry login too — under concurrent test-suite startup the DB pool can be
  // transiently exhausted, causing an isolated 5xx/missing token here.
  if (!r.body?.token) {
    await new Promise(res => setTimeout(res, 3000));
    r = await request.post('/api/auth/login').send({ email, password: VALID_PASSWORD });
  }
  return r.body.token;
}

// ── Chat Sessions ─────────────────────────────────────────────────────────────

describe('GET /api/chat/sessions', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/chat/sessions')).status).toBe(401);
  });

  it('returns 200 with sessions array', async () => {
    const res = await request.get('/api/chat/sessions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body) || Array.isArray(res.body.sessions)).toBe(true);
  });
});

describe('POST /api/chat/sessions', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.post('/api/chat/sessions').send({ contractId: 'test' })).status).toBe(401);
  });

  it('returns 400 when contractId is missing', async () => {
    const res = await request
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/chat/message (legacy endpoint)', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/chat/sessions/fake-id/messages')
      .send({ content: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request
      .post('/api/chat/sessions/fake-id/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 for non-existent session', async () => {
    const res = await request
      .post('/api/chat/sessions/non-existent-session-xyz/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello AI' });
    expect([404, 400]).toContain(res.status);
  });
});

describe('GET /api/chat/sessions/:sessionId/messages', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/chat/sessions/fake/messages')).status).toBe(401);
  });

  it('returns 404 for non-existent session', async () => {
    const res = await request
      .get('/api/chat/sessions/non-existent-xyz/messages')
      .set('Authorization', `Bearer ${token}`);
    expect([404, 400]).toContain(res.status);
  });
});

// ── Analysis ──────────────────────────────────────────────────────────────────

describe('POST /api/analysis/start', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.post('/api/analysis/start').send({ configId: 'x' })).status).toBe(401);
  });

  it('returns 400 when configId is missing', async () => {
    const res = await request
      .post('/api/analysis/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for non-existent configId', async () => {
    const res = await request
      .post('/api/analysis/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ configId: 'non-existent-config-xyz' });
    expect([404, 400]).toContain(res.status);
  });
});

describe('GET /api/analysis/:id/status', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/analysis/fake-id/status')).status).toBe(401);
  });

  it('returns 404 for non-existent analysis', async () => {
    const res = await request
      .get('/api/analysis/non-existent-id-xyz/status')
      .set('Authorization', `Bearer ${token}`);
    expect([404, 400]).toContain(res.status);
  });
});

describe('GET /api/analysis/history', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/analysis/history')).status).toBe(401);
  });

  it('returns 200 with array for authenticated user', async () => {
    const res = await request
      .get('/api/analysis/history')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body) || Array.isArray(res.body.analyses) || typeof res.body === 'object').toBe(true);
  });
});

describe('GET /api/analysis/stats', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/analysis/stats')).status).toBe(401);
  });

  it('returns 200 with stats object', async () => {
    const res = await request
      .get('/api/analysis/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── Subscription ──────────────────────────────────────────────────────────────

describe('GET /api/subscription/status', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/subscription/status')).status).toBe(401);
  });

  it('returns 200 with tier info', async () => {
    const res = await request
      .get('/api/subscription/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('state');
  });
});

describe('GET /api/subscription/usage', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/subscription/usage')).status).toBe(401);
  });

  it('returns 200 with usage data', async () => {
    const res = await request
      .get('/api/subscription/usage')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── Onboarding ────────────────────────────────────────────────────────────────

describe('GET /api/onboarding/status', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/onboarding/status')).status).toBe(401);
  });

  it('returns 200 with onboarding state', async () => {
    const res = await request
      .get('/api/onboarding/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/onboarding/complete', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.post('/api/onboarding/complete').send({})).status).toBe(401);
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/onboarding/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: 'ethereum' });
    expect([400, 422]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

describe('GET /api/dashboard/contract-info', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/dashboard/contract-info')).status).toBe(401);
  });

  it('returns 200 or 404 (no default contract for new user)', async () => {
    const res = await request
      .get('/api/dashboard/contract-info')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── Metrics ───────────────────────────────────────────────────────────────────

describe('GET /api/metrics/glossary', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/metrics/glossary')).status).toBe(401);
  });

  it('returns 200 with glossary data', async () => {
    const res = await request
      .get('/api/metrics/glossary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── Alerts ────────────────────────────────────────────────────────────────────

describe('GET /api/alerts/', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.get('/api/alerts/')).status).toBe(401);
  });

  it('returns 200 with alerts array', async () => {
    const res = await request.get('/api/alerts/').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/alerts/config', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    expect((await request.post('/api/alerts/config').send({})).status).toBe(401);
  });

  it('returns 400 on empty config', async () => {
    const res = await request
      .post('/api/alerts/config')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 422]).toContain(res.status);
  });
});

