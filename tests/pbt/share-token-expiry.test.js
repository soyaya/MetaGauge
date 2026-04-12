// Feature: metagauge-full-implementation, Property 8: Share Token Expiry Enforcement
import fc from 'fast-check';
import { createShareToken, validateShareToken } from '../src/services/ShareTokenService.js';

describe('Share Token Expiry Enforcement', () => {
  test('expired tokens return HTTP 410, valid tokens return data', () => {
    fc.assert(fc.property(
      fc.date(),
      (expiryDate) => {
        const { token } = createShareToken('test-contract', 'test-user');
        
        // Mock the expiry date
        const now = new Date();
        const isExpired = expiryDate < now;
        
        const result = validateShareToken(token);
        
        if (isExpired) {
          return result.status === 410 && !result.valid;
        } else {
          return result.valid === true;
        }
      }
    ), { numRuns: 100 });
  });
});
