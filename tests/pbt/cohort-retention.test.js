// Feature: metagauge-full-implementation, Property 3: Cohort Retention Rate Correctness
import fc from 'fast-check';
import { calculateCohorts } from '../../src/services/CohortCalculator.js';

test('retention rate equals retained_count / cohort_size', () => {
  fc.assert(fc.property(
    fc.array(fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }), { minLength: 1, maxLength: 50 }),
    (timestamps) => {
      const address = '0xtest';
      const users = [{ address, firstSeen: new Date(timestamps[0] * 1000).toISOString(), lastSeen: new Date(Math.max(...timestamps) * 1000).toISOString() }];
      const transactions = timestamps.map(ts => ({ from: address, blockTimestamp: ts }));
      const cohorts = calculateCohorts(users, transactions);

      return cohorts.every(c => {
        const d1Check = c.size === 0 || Math.abs(c.d1_rate - (c.d1 / c.size * 100)) < 0.2;
        const d7Check = c.size === 0 || Math.abs(c.d7_rate - (c.d7 / c.size * 100)) < 0.2;
        return d1Check && d7Check;
      });
    }
  ), { numRuns: 100 });
});

test('retention rates are always between 0 and 100', () => {
  fc.assert(fc.property(
    fc.array(fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }), { minLength: 1, maxLength: 30 }),
    (timestamps) => {
      const users = [{ address: '0xtest', firstSeen: new Date(timestamps[0] * 1000).toISOString() }];
      const transactions = timestamps.map(ts => ({ from: '0xtest', blockTimestamp: ts }));
      const cohorts = calculateCohorts(users, transactions);
      return cohorts.every(c =>
        c.d1_rate >= 0 && c.d1_rate <= 100 &&
        c.d7_rate >= 0 && c.d7_rate <= 100 &&
        c.d30_rate >= 0 && c.d30_rate <= 100 &&
        c.d90_rate >= 0 && c.d90_rate <= 100
      );
    }
  ), { numRuns: 100 });
});
