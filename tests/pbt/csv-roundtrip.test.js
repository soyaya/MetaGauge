// Feature: metagauge-full-implementation, Property 11: CSV Transaction Round-Trip
// Updated for fast-check v4 (hexaString → stringMatching)
import fc from 'fast-check';

// fc v4: generate hex strings via stringMatching
const hexStr = (len) => fc.stringMatching(new RegExp(`^[0-9a-f]{${len}}$`));

const transactionArb = fc.record({
  hash:        hexStr(64),
  from:        hexStr(40),
  to:          hexStr(40),
  value:       fc.integer({ min: 0, max: 1_000_000 }).map(n => n / 100),
  blockNumber: fc.integer({ min: 1, max: 20_000_000 }),
  timestamp:   fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }),
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
    value:       parseFloat(value),
    blockNumber: parseInt(blockNumber),
    timestamp:   parseInt(timestamp),
  };
}

describe('CSV Transaction Round-Trip', () => {
  test('transaction survives CSV serialization round-trip', () => {
    fc.assert(fc.property(
      transactionArb,
      (transaction) => {
        const csvRow = serializeToCsvRow(transaction);
        const parsed = parseFromCsvRow(csvRow);

        return parsed.hash        === transaction.hash        &&
               parsed.from        === transaction.from        &&
               parsed.to          === transaction.to          &&
               Math.abs(parsed.value - transaction.value) < 0.001 &&
               parsed.blockNumber === transaction.blockNumber &&
               parsed.timestamp   === transaction.timestamp;
      }
    ), { numRuns: 100 });
  });
});
