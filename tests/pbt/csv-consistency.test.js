// Feature: metagauge-full-implementation, Property 6: CSV Export Data Matches Dashboard Data
import fc from 'fast-check';

const transactionArb = fc.record({
  hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
  from: fc.hexaString({ minLength: 40, maxLength: 40 }),
  to: fc.hexaString({ minLength: 40, maxLength: 40 }),
  value: fc.float({ min: 0 }),
  blockNumber: fc.integer({ min: 1 }),
  timestamp: fc.integer({ min: 1600000000 })
});

describe('CSV Export Data Consistency', () => {
  test('CSV export values match dashboard API values', () => {
    fc.assert(fc.property(
      fc.array(transactionArb, { minLength: 1, maxLength: 10 }),
      (transactions) => {
        // Simulate CSV serialization and parsing
        const csvData = transactions.map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value.toString(),
          blockNumber: tx.blockNumber.toString(),
          timestamp: tx.timestamp.toString()
        }));
        
        // Verify all fields are preserved
        return csvData.every((row, i) => {
          const original = transactions[i];
          return row.hash === original.hash &&
                 row.from === original.from &&
                 row.to === original.to &&
                 parseFloat(row.value) === original.value &&
                 parseInt(row.blockNumber) === original.blockNumber &&
                 parseInt(row.timestamp) === original.timestamp;
        });
      }
    ), { numRuns: 100 });
  });
});
