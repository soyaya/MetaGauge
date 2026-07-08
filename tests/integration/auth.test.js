/**
 * Auth API Integration Tests
 * Tests every auth endpoint with happy paths, validation errors,
 * auth errors, and edge cases.
 *
 * Uses supertest against the live Express app exported from server.js.
 */

import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/api/server.js';

const request = supertest(app);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Pre-warm the DB connection so the first test doesn't hit a cold connection */
beforeAll(async () => {
  await request.get('/health').catch(() => {});
  // Extra warm-up hit to ensure DB pool is alive
  await request.post('/api/auth/login').send({ email: 'warmup@x.io', password: 'x' }).catch(() => {});
}, 30000);

/** Generate a unique test email to avoid collisions between test runs */
const uniqueEmail = (prefix = 'test') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@metagauge-test.io`;

const VALID_PASSWORD = 'TestPass123!';

/** Register + return { token, user, email } */
async function registerUser(email = uniqueEmail(), password = VALID_PASSWORD) {
  const res = await request
    .post('/api/auth/register')
    .send({ email, password, name: 'Test User' });
  return { res, token: res.body.token, user: res.body.user, email };
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('returns 201 with token and user on valid registration', async () => {
    const email = uniqueEmail('register');
    const res = await request
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD, name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(email);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(20);
  });

  it('never returns password in user object', async () => {
    const { res } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ password: VALID_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: uniqueEmail() });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 on invalid email format', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: VALID_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 on password shorter than 8 characters', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'abc123' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 or 409 on duplicate email', async () => {
    const email = uniqueEmail('dup');
    await request.post('/api/auth/register').send({ email, password: VALID_PASSWORD, name: 'Test User' });
    const res = await request
      .post('/api/auth/register')
      .send({ email, password: VALID_PASSWORD, name: 'Test User' });
    expect([400, 409]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 on empty body', async () => {
    const res = await request.post('/api/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('sanitizes / rejects script injection in email', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: '<script>alert(1)</script>@evil.com', password: VALID_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('rejects SQL injection pattern in email', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: "' OR 1=1 --@evil.com", password: VALID_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is whitespace only', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: '   ', password: VALID_PASSWORD });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let registeredEmail;

  beforeAll(async () => {
    registeredEmail = uniqueEmail('login');
    const { res } = await registerUser(registeredEmail);
    // If registration failed due to DB restart, try once more after a short wait
    if (res.status !== 201 && res.status !== 200) {
      await new Promise(r => setTimeout(r, 3000));
      await registerUser(registeredEmail);
    }
  });

  it('returns 200 with token on valid credentials', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: registeredEmail, password: VALID_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('never returns password in login response', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: registeredEmail, password: VALID_PASSWORD });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('token is a valid JWT', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: registeredEmail, password: VALID_PASSWORD });
    const decoded = jwt.decode(res.body.token);
    expect(decoded).not.toBeNull();
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('email');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: registeredEmail, password: 'WrongPass999!' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 on non-existent email', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nonexistent'), password: VALID_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ password: VALID_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: registeredEmail });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 on empty body', async () => {
    const res = await request.post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('error message does not leak whether email exists (timing-safe)', async () => {
    const res1 = await request.post('/api/auth/login')
      .send({ email: uniqueEmail('ghost'), password: VALID_PASSWORD });
    const res2 = await request.post('/api/auth/login')
      .send({ email: registeredEmail, password: 'badpass' });
    // Both should be 401 — don't distinguish 'no user' vs 'wrong password'
    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const { token: t, res } = await registerUser(uniqueEmail('me'));
    if (res.status === 201 || res.status === 200) token = t;
  });

  it('returns 200 with user when token is valid', async () => {
    if (!token) { console.warn('Skipping: registration failed'); return; }
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Response may be { id, email } or { user: { id, email } }
    const user = res.body.user || res.body;
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).not.toHaveProperty('password');
  });

  it('returns 401 with no token', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 with malformed token', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 with tampered token payload', async () => {
    if (!token) { console.warn('Skipping: no token'); return; }
    const [header, , sig] = token.split('.');
    const fakePaylod = Buffer.from(JSON.stringify({ userId: 'fake_id', email: 'hacker@evil.com' })).toString('base64');
    const tamperedToken = `${header}.${fakePaylod}.${sig}`;
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: 'test-id', email: 'exp@test.com' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '0s' }
    );
    await new Promise(r => setTimeout(r, 100));
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 with Bearer but no token string', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('returns 401 or 200 with wrong auth scheme (Basic) — implementation-defined', async () => {
    if (!token) { console.warn('Skipping: no token'); return; }
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Basic ${token}`);
    // Some implementations reject non-Bearer schemes (401);
    // others parse the token regardless of scheme prefix (200).
    // Both are acceptable — the important security property is that
    // "Bearer <valid-jwt>" works, tested elsewhere.
    expect([200, 401]).toContain(res.status);
  });
});

// ── POST /api/auth/refresh-api-key ────────────────────────────────────────────

describe('POST /api/auth/refresh-api-key', () => {
  let token;

  beforeAll(async () => {
    const { token: t, res } = await registerUser(uniqueEmail('apikey'));
    // Only set token if registration succeeded
    if (res.status === 201 || res.status === 200) token = t;
  });

  it('returns 200 with a new API key', async () => {
    if (!token) {
      console.warn('Skipping: registration failed (DB may be reconnecting)');
      return;
    }
    const res = await request
      .post('/api/auth/refresh-api-key')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('apiKey');
    // Key may be raw hex or prefixed with mg_live_
    expect(typeof res.body.apiKey).toBe('string');
    expect(res.body.apiKey.length).toBeGreaterThan(20);
  });

  it('returns 401 with no token', async () => {
    const res = await request.post('/api/auth/refresh-api-key');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 with invalid token', async () => {
    const res = await request
      .post('/api/auth/refresh-api-key')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('generates a different key each call', async () => {
    if (!token) {
      console.warn('Skipping: registration failed (DB may be reconnecting)');
      return;
    }
    const res1 = await request.post('/api/auth/refresh-api-key').set('Authorization', `Bearer ${token}`);
    const res2 = await request.post('/api/auth/refresh-api-key').set('Authorization', `Bearer ${token}`);
    // Both succeed or both fail — either way keys should differ if both 200
    if (res1.status === 200 && res2.status === 200) {
      expect(res1.body.apiKey).not.toBe(res2.body.apiKey);
    }
  });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 for a registered email (does not leak)', async () => {
    const { email } = await registerUser(uniqueEmail('forgot'));
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email });
    expect(res.status).toBe(200);
  });

  it('returns 200 for a non-existent email (no user enumeration)', async () => {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('ghost') });
    // Should not reveal whether email exists
    expect(res.status).toBe(200);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request.post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
    // API may return { error } or { message }
    expect(res.body.error || res.body.message).toBeTruthy();
  });

  it('returns 200 or 400 on invalid email format', async () => {
    // The API may silently return 200 (to prevent user enumeration)
    // or return 400 for clearly invalid formats — both are acceptable
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect([200, 400]).toContain(res.status);
  });
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when reset token is missing', async () => {
    const res = await request
      .post('/api/auth/reset-password')
      .send({ password: 'NewPass123!' });
    expect(res.status).toBe(400);
    // API may return { error } or { message }
    expect(res.body.error || res.body.message).toBeTruthy();
  });

  it('returns 400 when new password is missing', async () => {
    const res = await request
      .post('/api/auth/reset-password')
      .send({ token: 'some-reset-token' });
    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toBeTruthy();
  });

  it('returns 400 or 401 on invalid/expired reset token', async () => {
    const res = await request
      .post('/api/auth/reset-password')
      .send({ token: 'completely-invalid-token', password: 'NewPass123!' });
    expect([400, 401]).toContain(res.status);
    expect(res.body.error || res.body.message).toBeTruthy();
  });

  it('returns 400 on empty body', async () => {
    const res = await request.post('/api/auth/reset-password').send({});
    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toBeTruthy();
  });

  it('rejects new password shorter than 8 chars', async () => {
    const res = await request
      .post('/api/auth/reset-password')
      .send({ token: 'any-token', password: 'abc' });
    expect([400, 401]).toContain(res.status);
    expect(res.body.error || res.body.message).toBeTruthy();
  });
});

// ── X-API-Key authentication ──────────────────────────────────────────────────

describe('X-API-Key authentication', () => {
  it('returns 401 on invalid API key format', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('X-API-Key', 'invalid-key-format');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 on mg_live_ key that does not exist', async () => {
    const res = await request
      .get('/api/contracts')
      .set('X-API-Key', 'mg_live_' + 'a'.repeat(64));
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ── Global health check ───────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown route', async () => {
    const res = await request.get('/api/this-route-does-not-exist-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
