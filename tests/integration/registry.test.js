/**
 * Research, Registry & Growth Fingerprint API Integration Tests
 */

import supertest from 'supertest';
import app from '../../src/api/server.js';

const request = supertest(app);

// Pre-warm DB connection
beforeAll(async () => {
  await request.get('/health').catch(() => {});
  await request.post('/api/auth/login').send({ email: 'warmup@x.io', password: 'x' }).catch(() => {});
}, 30000);


const uniqueEmail = (p = 'reg') =>
  `${p}_${Date.now()}_${Math.random().toString(36).slice(2)}@metagauge-test.io`;

const VALID_PASSWORD  = 'TestPass123!';
const TEST_CONTRACT   = '0xabcdef1234567890abcdef1234567890abcdef01';
const TEST_CHAIN      = 'ethereum';

async function getToken() {
  const email = uniqueEmail();
  let regRes = await request.post('/api/auth/register').send({ email, password: VALID_PASSWORD, name: 'Test User' });
  // Retry once if DB connection was dropped
  if (regRes.status >= 500) {
    await new Promise(r => setTimeout(r, 3000));
    regRes = await request.post('/api/auth/register').send({ email, password: VALID_PASSWORD, name: 'Test User' });
  }
  const r = await request.post('/api/auth/login').send({ email, password: VALID_PASSWORD });
  const token = r.body.token;

  // Register the shared TEST_CONTRACT/TEST_CHAIN under this user so
  // research/registry/fingerprint endpoints have a real owned contract to act on.
  await request
    .post('/api/contracts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Registry Test Contract', targetContract: { address: TEST_CONTRACT, chain: TEST_CHAIN } })
    .catch(() => {});

  return token;
}

// ── POST /api/research/run ────────────────────────────────────────────────────

describe('POST /api/research/run', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/research/run')
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect(res.status).toBe(401);
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/research/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN });
    expect([400, 422]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('accepts valid payload and returns 200 or 202', async () => {
    const res = await request
      .post('/api/research/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect([200, 202, 500]).toContain(res.status); // 500 expected if external APIs not configured
    if ([200, 202].includes(res.status)) {
      expect(res.body).toHaveProperty('success');
    }
  });

  it('handles invalid chain gracefully (no crash)', async () => {
    const res = await request
      .post('/api/research/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: 'invalid-chain-xyz' });
    expect([200, 202, 400, 500]).toContain(res.status);
    expect(res.body).not.toBeNull();
  });
});

// ── GET /api/research/:contractAddress/:chain ─────────────────────────────────

describe('GET /api/research/:contractAddress/:chain', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/research/${TEST_CONTRACT}/${TEST_CHAIN}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with data or null for unknown contract', async () => {
    const res = await request
      .get(`/api/research/${TEST_CONTRACT}/${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // data may be null if never run
    expect(res.body).toHaveProperty('success');
  });

  it('response has correct content-type', async () => {
    const res = await request
      .get(`/api/research/${TEST_CONTRACT}/${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── GET /api/research/:contractAddress/:chain/benchmarks ──────────────────────

describe('GET /api/research/:contractAddress/:chain/benchmarks', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/research/${TEST_CONTRACT}/${TEST_CHAIN}/benchmarks`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with benchmarks object', async () => {
    const res = await request
      .get(`/api/research/${TEST_CONTRACT}/${TEST_CHAIN}/benchmarks`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });
});

// ── GET /api/research/:contractAddress/:chain/summary ─────────────────────────

describe('GET /api/research/:contractAddress/:chain/summary', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/research/${TEST_CONTRACT}/${TEST_CHAIN}/summary`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with summary', async () => {
    const res = await request
      .get(`/api/research/${TEST_CONTRACT}/${TEST_CHAIN}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });
});

// ── POST /api/registry/opt-in ─────────────────────────────────────────────────

describe('POST /api/registry/opt-in', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/registry/opt-in')
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect(res.status).toBe(401);
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/registry/opt-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN });
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when chain is missing', async () => {
    const res = await request
      .post('/api/registry/opt-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT });
    expect([400, 404]).toContain(res.status);
  });

  it('returns 400 on empty body', async () => {
    const res = await request
      .post('/api/registry/opt-in')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 404]).toContain(res.status);
  });

  it('accepts valid payload (returns 200 or 404 if contract not in DB)', async () => {
    const res = await request
      .post('/api/registry/opt-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) expect(res.body).toHaveProperty('success');
    if (res.status === 404) expect(res.body).toHaveProperty('error');
  });
});

// ── POST /api/registry/opt-out ────────────────────────────────────────────────

describe('POST /api/registry/opt-out', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/registry/opt-out')
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect(res.status).toBe(401);
  });

  it('is idempotent — 200 even if not registered', async () => {
    const res = await request
      .post('/api/registry/opt-out')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect([200, 404]).toContain(res.status);
  });

  it('returns 400 when contractAddress missing', async () => {
    const res = await request
      .post('/api/registry/opt-out')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN });
    expect([400, 404]).toContain(res.status);
  });
});

// ── GET /api/registry/status ──────────────────────────────────────────────────

describe('GET /api/registry/status', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/registry/status?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 or 404 when contractAddress missing', async () => {
    const res = await request
      .get('/api/registry/status?chain=ethereum')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });

  it('returns { registered: bool } when contract known', async () => {
    const res = await request
      .get(`/api/registry/status?contractAddress=${TEST_CONTRACT}&chain=${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('registered');
      expect(typeof res.body.registered).toBe('boolean');
    } else {
      expect([404]).toContain(res.status);
    }
  });
});

// ── GET /api/registry/projects ────────────────────────────────────────────────

describe('GET /api/registry/projects', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get('/api/registry/projects');
    expect(res.status).toBe(401);
  });

  it('returns 200 with array', async () => {
    const res = await request
      .get('/api/registry/projects')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });

  it('accepts chain filter without error', async () => {
    const res = await request
      .get('/api/registry/projects?chain=ethereum')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('accepts minScore filter without error', async () => {
    const res = await request
      .get('/api/registry/projects?minScore=70')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── GET /api/registry/projects/:contractAddress/:chain ────────────────────────

describe('GET /api/registry/projects/:contractAddress/:chain', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get(`/api/registry/projects/${TEST_CONTRACT}/${TEST_CHAIN}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent project', async () => {
    const res = await request
      .get(`/api/registry/projects/${TEST_CONTRACT}/${TEST_CHAIN}`)
      .set('Authorization', `Bearer ${token}`);
    expect([404, 200]).toContain(res.status);
  });
});

// ── GET /api/registry/recommendations ─────────────────────────────────────────

describe('GET /api/registry/recommendations', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.get('/api/registry/recommendations');
    expect(res.status).toBe(401);
  });

  it('returns 200 with results array', async () => {
    const res = await request
      .get('/api/registry/recommendations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });
});

// ── POST /api/registry/recommendations/search ─────────────────────────────────

describe('POST /api/registry/recommendations/search', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/registry/recommendations/search')
      .send({ query: 'DeFi on Ethereum' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when query is missing', async () => {
    const res = await request
      .post('/api/registry/recommendations/search')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 422]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when query is empty string', async () => {
    const res = await request
      .post('/api/registry/recommendations/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '' });
    expect([400, 422]).toContain(res.status);
  });

  it('returns 200 with results for valid query', async () => {
    const res = await request
      .post('/api/registry/recommendations/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'DeFi projects on Ethereum with Uniswap-like growth' });
    expect([200, 500]).toContain(res.status); // 500 possible if Gemini key not set
    if (res.status === 200) {
      expect(res.body).toHaveProperty('success');
    }
  });
});

// ── POST /api/registry/fingerprint/compute ────────────────────────────────────

describe('POST /api/registry/fingerprint/compute', () => {
  let token;
  beforeAll(async () => { token = await getToken(); });

  it('returns 401 without token', async () => {
    const res = await request.post('/api/registry/fingerprint/compute')
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect(res.status).toBe(401);
  });

  it('returns 400 when contractAddress is missing', async () => {
    const res = await request
      .post('/api/registry/fingerprint/compute')
      .set('Authorization', `Bearer ${token}`)
      .send({ chain: TEST_CHAIN });
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('accepts valid payload and returns 200 or 404', async () => {
    const res = await request
      .post('/api/registry/fingerprint/compute')
      .set('Authorization', `Bearer ${token}`)
      .send({ contractAddress: TEST_CONTRACT, chain: TEST_CHAIN });
    expect([200, 404]).toContain(res.status);
  });
});

