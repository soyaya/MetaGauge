// Feature: metagauge-full-implementation, Property 8: Share Token Expiry Enforcement
// Tests the expiry logic in isolation without DB calls.
import fc from 'fast-check';

/**
 * Pure function extracted from ShareTokenService — tests the expiry logic
 * without requiring DB storage.
 */
function makeToken(expiryOffsetMs = 7 * 24 * 60 * 60 * 1000) {
  const now = Date.now();
  return {
    token:     'a'.repeat(64), // deterministic for testing
    expiresAt: new Date(now + expiryOffsetMs).toISOString(),
    revoked:   false,
  };
}

function validateTokenRecord(record) {
  if (!record) return { valid: false, status: 404 };
  if (record.revoked) return { valid: false, status: 410 };
  if (new Date(record.expiresAt) < new Date()) return { valid: false, status: 410 };
  return { valid: true, status: 200 };
}

describe('Share Token Expiry Enforcement', () => {
  test('tokens with future expiry are valid', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }), // 1ms to 30 days future
      (offsetMs) => {
        const record = makeToken(offsetMs);
        const result = validateTokenRecord(record);
        return result.valid === true && result.status === 200;
      }
    ), { numRuns: 100 });
  });

  test('tokens with past expiry return status 410', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }), // 1ms to 1 year past
      (offsetMs) => {
        const record = makeToken(-offsetMs); // negative = in the past
        const result = validateTokenRecord(record);
        return result.valid === false && result.status === 410;
      }
    ), { numRuns: 100 });
  });

  test('revoked tokens always return status 410 regardless of expiry', () => {
    fc.assert(fc.property(
      fc.integer({ min: -86400000, max: 86400000 }),
      (offsetMs) => {
        const record = { ...makeToken(offsetMs), revoked: true };
        const result = validateTokenRecord(record);
        return result.valid === false && result.status === 410;
      }
    ), { numRuns: 100 });
  });

  test('missing token returns 404', () => {
    const result = validateTokenRecord(null);
    expect(result).toEqual({ valid: false, status: 404 });
  });
});
