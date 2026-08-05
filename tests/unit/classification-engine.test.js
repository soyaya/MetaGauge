/**
 * Unit tests for ClassificationEngine — mirrors the demo cases in
 * classification_engine.py (the reference implementation this was ported
 * from) so the two stay behaviorally aligned.
 */

import { ClassificationEngine, CONFIRM_THRESHOLD } from '../../src/services/ledger/ClassificationEngine.js';

const TREASURY = '0xCompanyTreasury000000000000000000000001';
const COINBASE_WITHDRAWAL = '0xCoinbaseWithdrawal0000000000000000000002';
const UNISWAP_ROUTER = '0xUniswapV3Router00000000000000000000000003';
const AAVE_POOL = '0xAaveV3Pool0000000000000000000000000000004';
const PAYROLL_PROCESSOR = '0xPayrollProcessor000000000000000000000005';
const UNKNOWN_ADDRESS = '0xUnknownAddress00000000000000000000000009';

function buildRegistry() {
  const registry = new Map();
  registry.set(COINBASE_WITHDRAWAL.toLowerCase(), {
    label: 'Coinbase Prime Withdrawal', protocolType: 'cex',
    defaultAccountCode: '4020', confidenceWeight: 0.95,
  });
  registry.set(UNISWAP_ROUTER.toLowerCase(), {
    label: 'Uniswap V3 Router', protocolType: 'dex',
    defaultAccountCode: '1030', confidenceWeight: 0.95,
  });
  registry.set(AAVE_POOL.toLowerCase(), {
    label: 'Aave V3 Pool', protocolType: 'lending',
    defaultAccountCode: '1130', confidenceWeight: 0.95,
  });
  return registry;
}

describe('ClassificationEngine', () => {
  test('internal transfer between two company wallets -> INTERNAL, confidence 1.0, confirmed', () => {
    const engine = new ClassificationEngine([TREASURY, PAYROLL_PROCESSOR], buildRegistry());
    const result = engine.classify({ from: TREASURY, to: PAYROLL_PROCESSOR, amount: 100 });

    expect(result.proposedAccountCode).toBe('INTERNAL');
    expect(result.confidence).toBe(1.0);
    expect(result.source).toBe('rule');
    expect(result.status).toBe('confirmed');
  });

  test('inflow from a registered CEX withdrawal address -> grant income (4020), confirmed', () => {
    const engine = new ClassificationEngine([TREASURY], buildRegistry());
    const result = engine.classify({ from: COINBASE_WITHDRAWAL, to: TREASURY, amount: 10000 });

    expect(result.proposedAccountCode).toBe('4020');
    expect(result.confidence).toBe(0.95);
    expect(result.source).toBe('rule');
    expect(result.status).toBe('confirmed');
  });

  test('outflow to a DEX router -> asset conversion (1030), not revenue/expense', () => {
    const engine = new ClassificationEngine([TREASURY], buildRegistry());
    const result = engine.classify({ from: TREASURY, to: UNISWAP_ROUTER, amount: 2.5 });

    expect(result.proposedAccountCode).toBe('1030');
    expect(result.source).toBe('rule');
  });

  test('outflow to a lending pool -> long-term position (1130), direction-aware', () => {
    const engine = new ClassificationEngine([TREASURY], buildRegistry());
    const outflow = engine.classify({ from: TREASURY, to: AAVE_POOL, amount: 5.0 });
    expect(outflow.proposedAccountCode).toBe('1130');

    const inflow = engine.classify({ from: AAVE_POOL, to: TREASURY, amount: 5.0 });
    expect(inflow.proposedAccountCode).toBe('1030'); // withdrawing back out
  });

  test('recurring confirmed counterparty (heuristic) -> matches prior classification, confidence 0.85', () => {
    const recurringPatterns = new Map([[PAYROLL_PROCESSOR.toLowerCase(), '6010']]);
    const engine = new ClassificationEngine([TREASURY], buildRegistry(), recurringPatterns);
    const result = engine.classify({ from: TREASURY, to: PAYROLL_PROCESSOR, amount: 14000 });

    expect(result.proposedAccountCode).toBe('6010');
    expect(result.confidence).toBe(0.85);
    expect(result.source).toBe('heuristic');
    expect(result.status).toBe('confirmed');
  });

  test('unknown counterparty, no rule or heuristic match -> low-confidence pending, inflow default 4040', () => {
    const engine = new ClassificationEngine([TREASURY], buildRegistry());
    const result = engine.classify({ from: UNKNOWN_ADDRESS, to: TREASURY, amount: 3200 });

    expect(result.proposedAccountCode).toBe('4040');
    expect(result.confidence).toBe(0.30);
    expect(result.confidence).toBeLessThan(CONFIRM_THRESHOLD);
    expect(result.source).toBe('unresolved');
    expect(result.status).toBe('pending');
  });

  test('unknown counterparty outflow defaults to unconfirmed G&A (6040)', () => {
    const engine = new ClassificationEngine([TREASURY], buildRegistry());
    const result = engine.classify({ from: TREASURY, to: UNKNOWN_ADDRESS, amount: 500 });

    expect(result.proposedAccountCode).toBe('6040');
    expect(result.status).toBe('pending');
  });

  test('address matching is case-insensitive', () => {
    const engine = new ClassificationEngine([TREASURY.toUpperCase()], buildRegistry());
    const result = engine.classify({ from: TREASURY.toLowerCase(), to: PAYROLL_PROCESSOR.toLowerCase(), amount: 1 });
    // TREASURY isn't in registry/recurring, and PAYROLL_PROCESSOR isn't a company
    // wallet here, so this exercises the case-insensitive company-wallet lookup
    // via the "not internal" (rule/heuristic-miss) path rather than INTERNAL.
    expect(result.proposedAccountCode).toBe('6040');
  });
});
