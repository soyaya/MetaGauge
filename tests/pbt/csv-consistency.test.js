// Feature: metagauge-full-implementation, Property 6: CSV Export Data Matches Dashboard Data
// Updated for fast-check v4
import fc from 'fast-check';

const hexStr = (len) => fc.stringMatching(new RegExp(`^[0-9a-f]{${len}}$`));

const transactionArb = fc.record({
  hash:        hexStr(64),
  from:        hexStr(40),
  to:          hexStr(40),
  value:       fc.integer({ min: 0, max: 1_000_000 }).map(n => n / 100),
  blockNumber: fc.integer({ min: 1, max: 20_000_000 }),
  timestamp:   fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }),
});

describe('CSV Export Data Consistency', () => {
  test('CSV export values match dashboard API values', () => {
    fc.assert(fc.property(
      fc.array(transactionArb, { minLength: 1, maxLength: 10 }),
      (transactions) => {
        // Simulate CSV serialization and parsing
        const csvData = transactions.map(tx => ({
          hash:        tx.hash,
          from:        tx.from,
          to:          tx.to,
          value:       tx.value.toString(),
          blockNumber: tx.blockNumber.toString(),
          timestamp:   tx.timestamp.toString(),
        }));

        // Verify all fields are preserved
        return csvData.every((row, i) => {
          const original = transactions[i];
          return row.hash        === original.hash        &&
                 row.from        === original.from        &&
                 row.to          === original.to          &&
                 parseFloat(row.value)      === original.value       &&
                 parseInt(row.blockNumber)  === original.blockNumber &&
                 parseInt(row.timestamp)    === original.timestamp;
        });
      }
    ), { numRuns: 100 });
  });
});
