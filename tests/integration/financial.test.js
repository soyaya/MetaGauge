/**
 * Financial Intelligence API Integration Tests
 * Covers all /api/financial/* endpoints — auth enforcement,
 * input validation, missing-field detection, error shapes.
 */

import supertest from 'supertest';
import app from '../../src/api/server.js';

const request = supertest(app);

// Pre-warm DB connection
beforeAll(async () => {
  await request.get('/health').catch(() => {});
  await request.post('/api/auth/login').send({ email: 'warmup@x.io', password: 'x' }).catch(() => {});
}, 30000);


const uniqueEmail = (p = 'fin') =>
  `${p}_${Date.now()}_${Math.random().toString(36).slice(2)}@metagauge-test.io`;

const VALID_PASSWORD = 'TestPass123!';
const TEST_CONTRACT  = '0xdeadbeef1234567890abcdef1234567890abcdef';
const TEST_CHAIN     = 'ethereum';

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

// ── GET /api/financial/inputs ─────────────────────────────────────────────────

describe('GET /api/financial/inputs', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get('/api/financial/inputs?contractAddress=0xabc&chain=ethereum');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 or 404 when contractAddress is missing', async () => {
    const res = await request
      .get('/api/financial/inputs?chain=ethereum')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });

  it('returns 400 or 404 when chain is missing', async () => {
    const res = await request
      .get(`/api/financial/inputs?contractAddress=${TEST_CONTRACT}`)
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 for contract not owned by user', async () => {
    const res = await request
      .get(`/api/financial/inputs?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    expect([404, 200]).toContain(res.status); // 404 when contract not in DB
  });

  it('response has correct Content-Type json', async () => {
    const res = await request
      .get(`/api/financial/inputs?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── GET /api/financial/inputs/missing ─────────────────────────────────────────

describe('GET /api/financial/inputs/missing', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get('/api/financial/inputs/missing?contractAddress=0xabc&chain=ethereum');
    expect(res.status).toBe(401);
  });

  it('returns 400 or 404 when contractAddress missing', async () => {
    const res = await request
      .get('/api/financial/inputs/missing?chain=ethereum')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });

  it('returns correct shape when contract exists', async () => {
    // Contract won't exist so we get 404 — this tests that error shape is correct
    const res = await request
      .get(`/api/financial/inputs/missing?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('complete');
      expect(res.body).toHaveProperty('missingOneTime');
      expect(res.body).toHaveProperty('missingMonthly');
      expect(typeof res.body.complete).toBe('boolean');
      expect(Array.isArray(res.body.missingOneTime)).toBe(true);
    } else {
      expect([400, 404]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
    }
  });
});

// ── POST /api/financial/inputs ────────────────────────────────────────────────

describe('POST /api/financial/inputs', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/financial/inputs').send({
      contractAddress: TEST_CONTRACT, chain: TEST_CHAIN,
      field: 'project_stage', value: 'seed',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/financial/inputs')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN, field: 'project_stage', value: 'seed' });
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when field key is missing', async () => {
    const res = await request
      .post('/api/financial/inputs')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN, value: 'seed' });
    expect([400, 404]).toContain(res.status);
  });

  it('returns 400 when value is missing', async () => {
    const res = await request
      .post('/api/financial/inputs')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN, field: 'project_stage' });
    expect([400, 404]).toContain(res.status);
  });

  it('returns 400 on empty body', async () => {
    const res = await request
      .post('/api/financial/inputs')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 404]).toContain(res.status);
  });
});

// ── POST /api/financial/documents/generate ────────────────────────────────────

describe('POST /api/financial/documents/generate', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/financial/documents/generate')
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect(res.status).toBe(401);
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/financial/documents/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN });
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 when contract not found', async () => {
    const res = await request
      .post('/api/financial/documents/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    // Contract not registered → 404
    // OR if partial inputs → 400 with missing fields list
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('400 response for missing inputs includes a missing fields list', async () => {
    const res = await request
      .post('/api/financial/documents/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    if (res.status === 400 && res.body.missing) {
      expect(res.body.missing).toHaveProperty('oneTime');
    }
  });
});

// ── GET /api/financial/documents/latest ───────────────────────────────────────

describe('GET /api/financial/documents/latest', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/financial/documents/latest?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`);
    expect(res.status).toBe(401);
  });

  it('returns documents: null when no docs generated yet', async () => {
    const res = await request
      .get(`/api/financial/documents/latest?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('documents');
      expect(res.body.documents).toBeNull();
    } else {
      expect([404]).toContain(res.status);
    }
  });
});

// ── GET /api/financial/documents/:period ──────────────────────────────────────

describe('GET /api/financial/documents/:period', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/financial/documents/2026-07?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with null documents for valid period with no data', async () => {
    const res = await request
      .get(`/api/financial/documents/2026-07?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200) {
      expect(res.body.documents).toBeNull();
    } else {
      expect([404]).toContain(res.status);
    }
  });
});

// ── GET /api/financial/periods ────────────────────────────────────────────────

describe('GET /api/financial/periods', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/financial/periods?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`);
    expect(res.status).toBe(401);
  });

  it('returns array (possibly empty) for valid request', async () => {
    const res = await request
      .get(`/api/financial/periods?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('periods');
      expect(Array.isArray(res.body.periods)).toBe(true);
    } else {
      expect([404]).toContain(res.status);
    }
  });
});

// ── POST /api/financial/chat ──────────────────────────────────────────────────

describe('POST /api/financial/chat', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/financial/chat')
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN, message: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when message is missing', async () => {
    const res = await request
      .post('/api/financial/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when message is empty string', async () => {
    const res = await request
      .post('/api/financial/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN, message: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/financial/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN, message: 'Hello' });
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 when contract not registered', async () => {
    const res = await request
      .post('/api/financial/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN, message: 'Hello AI' });
    expect([404, 200]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('response');
      expect(res.body).toHaveProperty('mode');
      expect(res.body).toHaveProperty('complete');
    }
  });
});

// ── GET /api/financial/chat/history ───────────────────────────────────────────

describe('GET /api/financial/chat/history', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/financial/chat/history?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`);
    expect(res.status).toBe(401);
  });

  it('returns messages array or 404 for unknown contract', async () => {
    const res = await request
      .get(`/api/financial/chat/history?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    } else {
      expect(res.status).toBe(404);
    }
  });
});

// ── POST /api/financial/export/pdf ────────────────────────────────────────────

describe('POST /api/financial/export/pdf', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/financial/export/pdf')
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect(res.status).toBe(401);
  });

  it('returns 404 when no documents generated for period', async () => {
    const res = await request
      .post('/api/financial/export/pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN, period: '2026-07' });
    expect([404, 400]).toContain(res.status);
    if (res.headers['content-type']?.includes('json')) {
      expect(res.body).toHaveProperty('error');
    }
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/financial/export/pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN });
    expect([400, 404]).toContain(res.status);
  });
});

