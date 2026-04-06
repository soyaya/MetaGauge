// Feature: metagauge-full-implementation, Property 11: CSV Transaction Round-Trip
import fc from 'fast-check';

const transactionArb = fc.record({
  hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
  from: fc.hexaString({ minLength: 40, maxLength: 40 }),
  to: fc.hexaString({ minLength: 40, maxLength: 40 }),
  value: fc.float({ min: 0 }),
  blockNumber: fc.integer({ min: 1 }),
  timestamp: fc.integer({ min: 1600000000 })
});

function serializeToCsvRow(tx) {
  return `${tx.hash},${tx.from},${tx.to},${tx.value},${tx.blockNumber},${tx.timestamp}`;
}

function parseFromCsvRow(row) {
  const [hash, from, to, value, blockNumber, timestamp] = row.split(',');
  return {
    hash,
    from,
    to,
    value: parseFloat(value),
    blockNumber: parseInt(blockNumber),
    timestamp: parseInt(timestamp)
  };
}

describe('CSV Transaction Round-Trip', () => {
  test('transaction survives CSV serialization round-trip', () => {
    fc.assert(fc.property(
      transactionArb,
      (transaction) => {
        const csvRow = serializeToCsvRow(transaction);
        const parsed = parseFromCsvRow(csvRow);
        
        return parsed.hash === transaction.hash &&
               parsed.from === transaction.from &&
               parsed.to === transaction.to &&
               Math.abs(parsed.value - transaction.value) < 0.0001 &&
               parsed.blockNumber === transaction.blockNumber &&
               parsed.timestamp === transaction.timestamp;
      }
    ), { numRuns: 100 });
  });
});
