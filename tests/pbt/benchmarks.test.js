// Feature: metagauge-full-implementation, Property 9: Benchmark Percentile Ordering Invariant
import fc from 'fast-check';
import { BenchmarkingService } from '../src/services/BenchmarkingService.js';

describe('Benchmark Percentile Ordering Invariant', () => {
  test('percentiles maintain ordering p25 ≤ p50 ≤ p75 ≤ p90', () => {
    fc.assert(fc.property(
      fc.array(fc.float({ min: 0, max: 1000 }), { minLength: 3, maxLength: 100 }),
      (values) => {
        const service = new BenchmarkingService();
        const sortedValues = [...values].sort((a, b) => a - b);
        
        const p25 = service.percentile(sortedValues, 0.25);
        const p50 = service.percentile(sortedValues, 0.50);
        const p75 = service.percentile(sortedValues, 0.75);
        const p90 = service.percentile(sortedValues, 0.90);
        
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return p25 <= p50 && 
               p50 <= p75 && 
               p75 <= p90 &&
               avg >= min &&
               avg <= max;
      }
    ), { numRuns: 100 });
  });
});
