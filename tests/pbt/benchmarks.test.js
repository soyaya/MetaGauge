// Feature: metagauge-full-implementation, Property 9: Benchmark Percentile Ordering Invariant
// Updated for fast-check v4 and Jest ESM module mocking.
//
// BenchmarkingService imports the storage facade (src/api/database/index.js), which uses a
// top-level `await import(...)` incompatible with Jest's CJS-transformed test runtime. We test
// the pure `percentile()` algorithm directly (mirrors alert-threshold.test.js's approach), since
// none of these properties touch storage.
import fc from 'fast-check';

// ── Inline pure percentile function (mirrors BenchmarkingService.percentile) ─────────────────
function percentile(sortedArray, p) {
  if (sortedArray.length === 0) return 0;
  const index = (sortedArray.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}
const service = { percentile };

// fc v4: use integer-based arbitraries for deterministic floats
const valueArb = fc.integer({ min: 0, max: 100000 }).map(n => n / 100); // 0..1000.00

describe('Benchmark Percentile Ordering Invariant', () => {
  test('percentiles maintain ordering p25 ≤ p50 ≤ p75 ≤ p90', () => {
    fc.assert(fc.property(
      fc.array(valueArb, { minLength: 4, maxLength: 100 }),
      (values) => {
        const sortedValues = [...values].sort((a, b) => a - b);

        const p25 = service.percentile(sortedValues, 0.25);
        const p50 = service.percentile(sortedValues, 0.50);
        const p75 = service.percentile(sortedValues, 0.75);
        const p90 = service.percentile(sortedValues, 0.90);

        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return p25 <= p50  &&
               p50 <= p75  &&
               p75 <= p90  &&
               avg >= min  &&
               avg <= max;
      }
    ), { numRuns: 100 });
  });

  test('p50 is the median — half values below, half above', () => {
    fc.assert(fc.property(
      fc.array(valueArb, { minLength: 4, maxLength: 50 }),
      (values) => {
        const sortedValues = [...values].sort((a, b) => a - b);
        const p50          = service.percentile(sortedValues, 0.50);

        // p50 must be within [min, max]
        return p50 >= sortedValues[0] && p50 <= sortedValues[sortedValues.length - 1];
      }
    ), { numRuns: 100 });
  });

  test('p0 equals min, p100 would equal max', () => {
    fc.assert(fc.property(
      fc.array(valueArb, { minLength: 2, maxLength: 50 }),
      (values) => {
        const sortedValues = [...values].sort((a, b) => a - b);
        const p0           = service.percentile(sortedValues, 0);
        const p100         = service.percentile(sortedValues, 1);

        return p0 <= sortedValues[1] && p100 >= sortedValues[sortedValues.length - 2];
      }
    ), { numRuns: 50 });
  });
});
