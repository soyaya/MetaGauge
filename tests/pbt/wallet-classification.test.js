// Feature: metagauge-full-implementation, Property 2: Wallet Classification Determinism and Priority
import fc from 'fast-check';
import { classifyWallet, SEGMENTS } from '../../src/services/WalletClassificationEngine.js';

const VALID_SEGMENTS = new Set(Object.values(SEGMENTS));

const txArb = fc.record({
  blockTimestamp: fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }),
  status: fc.boolean(),
  input: fc.string({ minLength: 8, maxLength: 8 }).map(s => '0x' + s),
  methodId: fc.string({ minLength: 8, maxLength: 8 }).map(s => '0x' + s),
});

const walletArb = fc.record({
  address: fc.string({ minLength: 10, maxLength: 10 }).map(s => '0x' + s),
  totalValue: fc.float({ min: 0, max: 1_000_000 }),
  totalGasSpent: fc.float({ min: 0, max: 10_000 }),
  firstSeen: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
  lastSeen: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
  transactions: fc.array(txArb, { minLength: 0, maxLength: 20 }),
});

test('result is always a valid segment', () => {
  fc.assert(fc.property(walletArb, (wallet) => {
    const result = classifyWallet(wallet, [wallet]);
    return VALID_SEGMENTS.has(result);
  }), { numRuns: 100 });
});

test('same input always returns same output (determinism)', () => {
  fc.assert(fc.property(walletArb, (wallet) => {
    return classifyWallet(wallet, [wallet]) === classifyWallet(wallet, [wallet]);
  }), { numRuns: 100 });
});

test('bot heuristic takes priority over whale', () => {
  // Wallet with >100 txs in 24h window AND high value (would be whale)
  const ts = 1_700_000_000;
  const botWallet = {
    address: '0xbot',
    totalValue: 999_999_999,
    totalGasSpent: 0,
    firstSeen: new Date((ts - 86400 * 10) * 1000).toISOString(),
    lastSeen: new Date(ts * 1000).toISOString(),
    transactions: Array.from({ length: 110 }, (_, i) => ({
      blockTimestamp: ts + i * 100, status: true, input: '0xdeadbeef', methodId: '0xdeadbeef'
    }))
  };
  const result = classifyWallet(botWallet, [botWallet]);
  expect(result).toBe(SEGMENTS.BOT);
});
