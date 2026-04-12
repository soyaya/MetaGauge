// Feature: metagauge-full-implementation, Property 4: Cohort Recalculation Idempotence
import fc from 'fast-check';
import { calculateCohorts } from '../../src/services/CohortCalculator.js';

test('running calculateCohorts N times produces same result each time', () => {
  fc.assert(fc.property(
    fc.array(fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }), { minLength: 2, maxLength: 20 }),
    (timestamps) => {
      const users = [{ address: '0xtest', firstSeen: new Date(timestamps[0] * 1000).toISOString() }];
      const transactions = timestamps.map(ts => ({ from: '0xtest', blockTimestamp: ts }));

      const run1 = calculateCohorts(users, transactions);
      const run2 = calculateCohorts(users, transactions);
      const run3 = calculateCohorts(users, transactions);

      return JSON.stringify(run1) === JSON.stringify(run2) &&
             JSON.stringify(run2) === JSON.stringify(run3);
    }
  ), { numRuns: 100 });
});

test('no duplicate cohort_week entries for same input', () => {
  fc.assert(fc.property(
    fc.array(fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }), { minLength: 1, maxLength: 30 }),
    (timestamps) => {
      const users = [{ address: '0xtest', firstSeen: new Date(timestamps[0] * 1000).toISOString() }];
      const transactions = timestamps.map(ts => ({ from: '0xtest', blockTimestamp: ts }));
      const cohorts = calculateCohorts(users, transactions);
      const weeks = cohorts.map(c => c.cohort_week);
      return weeks.length === new Set(weeks).size;
    }
  ), { numRuns: 100 });
});
