import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserStorage } from '../database/index.js';
import { PRICING } from '../../config/pricing.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ── Rate limit store (in-memory, Redis-ready) ─────────────────────────────────
// { apiKey: { count: N, windowStart: timestamp, dayCount: N, dayStart: timestamp } }
const rateLimitStore = new Map();

const RATE_LIMITS = {
  perMinute: 60,
  perDay:    1000,
};

function checkRateLimit(apiKey) {
  const now = Date.now();
  const entry = rateLimitStore.get(apiKey) || { count: 0, windowStart: now, dayCount: 0, dayStart: now };

  // Reset per-minute window
  if (now - entry.windowStart > 60_000) {
    entry.count = 0;
    entry.windowStart = now;
  }
  // Reset per-day window
  if (now - entry.dayStart > 86_400_000) {
    entry.dayCount = 0;
    entry.dayStart = now;
  }

  entry.count++;
  entry.dayCount++;
  rateLimitStore.set(apiKey, entry);

  // Evict old entries every 1000 checks
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      if (now - v.windowStart > 120_000) rateLimitStore.delete(k);
    }
  }

  return {
    allowed:          entry.count <= RATE_LIMITS.perMinute && entry.dayCount <= RATE_LIMITS.perDay,
    minuteRemaining:  Math.max(0, RATE_LIMITS.perMinute - entry.count),
    dayRemaining:     Math.max(0, RATE_LIMITS.perDay    - entry.dayCount),
    minuteReset:      Math.ceil((entry.windowStart + 60_000 - now) / 1000),
  };
}

// ── Token helpers ─────────────────────────────────────────────────────────────
export function generateToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, tier: user.tier }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { throw new Error('Invalid or expired token'); }
}

export function generateApiKey() {
  return 'mg_live_' + crypto.randomBytes(32).toString('hex');
}

// ── JWT middleware ────────────────────────────────────────────────────────────
export async function authenticateToken(req, res, next) {
  // Support both JWT (Authorization: Bearer) and API key (X-API-Key) on same routes
  const apiKey = req.headers['x-api-key'];
  if (apiKey) return authenticateApiKey(req, res, next);

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = verifyToken(token);
    const user = await UserStorage.findById(decoded.userId);
    if (!user)       return res.status(401).json({ error: 'User not found' });
    if (!user.isActive) return res.status(401).json({ error: 'Account deactivated' });

    const { password, ...u } = user;
    req.user = u;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed', message: err.message });
  }
}

// ── API Key middleware ────────────────────────────────────────────────────────
export async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required', message: 'Pass your key as X-API-Key header' });

    if (!apiKey.startsWith('mg_live_')) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    const user = await UserStorage.findByApiKey(apiKey);
    if (!user)          return res.status(401).json({ error: 'Invalid API key' });
    if (!user.isActive) return res.status(401).json({ error: 'Account deactivated' });

    // API key requires balance — no free quota
    const balance = user.billing?.balance || 0;
    if (balance <= 0) {
      return res.status(402).json({
        error: 'No balance',
        message: 'API key access requires a positive balance. Please top up at /subscription.',
        balance,
      });
    }

    // Rate limiting
    const rl = checkRateLimit(apiKey);
    res.set({
      'X-RateLimit-Limit-Minute': RATE_LIMITS.perMinute,
      'X-RateLimit-Limit-Day':    RATE_LIMITS.perDay,
      'X-RateLimit-Remaining-Minute': rl.minuteRemaining,
      'X-RateLimit-Remaining-Day':    rl.dayRemaining,
      'X-RateLimit-Reset':            rl.minuteReset,
    });

    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Limit: ${RATE_LIMITS.perMinute}/min, ${RATE_LIMITS.perDay}/day`,
        minuteRemaining: rl.minuteRemaining,
        dayRemaining:    rl.dayRemaining,
        retryAfter:      rl.minuteReset,
      });
    }

    const { password, ...u } = user;
    req.user = u;
    req.isApiKey = true; // flag so routes can charge accordingly
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed', message: err.message });
  }
}

export function requireTier(requiredTier) {
  const levels = { free: 1, starter: 2, pro: 3, enterprise: 4 };
  return (req, res, next) => {
    const level = levels[req.user?.tier || 'free'] || 1;
    if (level < (levels[requiredTier] || 1)) {
      return res.status(403).json({ error: 'Insufficient tier', required: requiredTier });
    }
    next();
  };
}

export default { generateToken, verifyToken, generateApiKey, authenticateToken, authenticateApiKey, requireTier };
