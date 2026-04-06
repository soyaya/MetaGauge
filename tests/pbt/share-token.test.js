// Feature: metagauge-full-implementation, Property 7: Share Token Uniqueness and Minimum Length
import fc from 'fast-check';
import { createShareToken } from '../src/services/ShareTokenService.js';

describe('Share Token Uniqueness and Minimum Length', () => {
  test('all generated tokens are unique and minimum 64 hex chars', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 100 }),
      (n) => {
        const tokens = [];
        for (let i = 0; i < n; i++) {
          const { token } = createShareToken(`contract-${i}`, `user-${i}`);
          tokens.push(token);
        }
        
        // Check uniqueness
        const uniqueTokens = new Set(tokens);
        const allUnique = uniqueTokens.size === tokens.length;
        
        // Check minimum length (64 hex chars)
        const allMinLength = tokens.every(token => 
          token.length >= 64 && /^[0-9a-f]+$/i.test(token)
        );
        
        return allUnique && allMinLength;
      }
    ), { numRuns: 50 });
  });
});
