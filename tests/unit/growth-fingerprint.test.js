/**
 * GrowthFingerprintEngine Unit Tests
 * Tests fingerprint extraction, comp matching, score bounds, and edge cases.
 */

import GrowthFingerprintEngine from '../../src/services/GrowthFingerprintEngine.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_ONCHAIN_EARLY = {
  uniqueUsers:     120,
  newUsers:        40,
  activeUsers:     90,
  d1Retention:     60,
  d7Retention:     35,
  d30Retention:    18,
  totalFeeEth:     0.8,
  totalVolumeEth:  45,
  churnRate:       15,
  retentionRate:   35,
};

const MOCK_ONCHAIN_MATURE = {
  uniqueUsers:     15000,
  newUsers:        300,
  activeUsers:     4000,
  d1Retention:     71,
  d7Retention:     52,
  d30Retention:    34,
  totalFeeEth:     45,
  totalVolumeEth:  8000,
  churnRate:       5,
  retentionRate:   65,
};

const MOCK_FINANCIAL_DATA = [
  {
    income_statement: { net_profit: -5000 },
    unit_economics:   { cac: 33, monthly_burn: 22000, runway_months: 3.8 },
    period:           '2026-07',
  },
];

// ── extractFingerprint ────────────────────────────────────────────────────────

describe('GrowthFingerprintEngine.extractFingerprint()', () => {
  it('returns an object', () => {
    const fp = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, MOCK_FINANCIAL_DATA);
    expect(typeof fp).toBe('object');
    expect(fp).not.toBeNull();
  });

  it('includes retentionCurveShape with d1, d7, d30', () => {
    const fp = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, MOCK_FINANCIAL_DATA);
    expect(fp).toHaveProperty('retentionCurveShape');
    if (fp.retentionCurveShape) {
      expect(fp.retentionCurveShape).toHaveProperty('d1');
      expect(fp.retentionCurveShape).toHaveProperty('d7');
      expect(fp.retentionCurveShape).toHaveProperty('d30');
    }
  });

  it('includes cacTrend field', () => {
    const fp = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, MOCK_FINANCIAL_DATA);
    expect(fp).toHaveProperty('cacTrend');
  });

  it('stage is one of early / growth / mature', () => {
    const fp = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, MOCK_FINANCIAL_DATA);
    expect(['early', 'growth', 'mature']).toContain(fp.stage);
  });

  it('classifies low-user project as early stage', () => {
    const fp = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, MOCK_FINANCIAL_DATA);
    expect(fp.stage).toBe('early');
  });

  it('classifies high-user project as growth or mature', () => {
    const fp = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_MATURE, []);
    expect(['growth', 'mature']).toContain(fp.stage);
  });

  it('handles empty financial data array gracefully', () => {
    expect(() => GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, [])).not.toThrow();
  });

  it('handles all-zero on-chain data gracefully', () => {
    const zeros = Object.fromEntries(Object.keys(MOCK_ONCHAIN_EARLY).map(k => [k, 0]));
    expect(() => GrowthFingerprintEngine.extractFingerprint(zeros, [])).not.toThrow();
  });

  it('handles null on-chain data gracefully', () => {
    expect(() => GrowthFingerprintEngine.extractFingerprint(null, [])).not.toThrow();
  });

  it('handles non-array financialData gracefully', () => {
    expect(() => GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, null)).not.toThrow();
    expect(() => GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, 'bad')).not.toThrow();
  });
});

// ── matchAgainstComps ─────────────────────────────────────────────────────────

describe('GrowthFingerprintEngine.matchAgainstComps()', () => {
  let fingerprint;

  beforeAll(async () => {
    fingerprint = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_EARLY, MOCK_FINANCIAL_DATA);
  });

  it('returns an object with matchedComps and earlyGrowthMatchScore', async () => {
    const result = await GrowthFingerprintEngine.matchAgainstComps(fingerprint);
    expect(result).toHaveProperty('matchedComps');
    expect(result).toHaveProperty('earlyGrowthMatchScore');
  });

  it('matchedComps is an array', async () => {
    const result = await GrowthFingerprintEngine.matchAgainstComps(fingerprint);
    expect(Array.isArray(result.matchedComps)).toBe(true);
  });

  it('earlyGrowthMatchScore is between 0 and 100', async () => {
    const result = await GrowthFingerprintEngine.matchAgainstComps(fingerprint);
    expect(result.earlyGrowthMatchScore).toBeGreaterThanOrEqual(0);
    expect(result.earlyGrowthMatchScore).toBeLessThanOrEqual(100);
  });

  it('each matched comp has a name and similarity score', async () => {
    const result = await GrowthFingerprintEngine.matchAgainstComps(fingerprint);
    result.matchedComps.forEach(comp => {
      expect(comp).toHaveProperty('name');
      expect(typeof comp.score === 'number' || typeof comp.similarity === 'number').toBe(true);
    });
  });

  it('returns at most 3 comps', async () => {
    const result = await GrowthFingerprintEngine.matchAgainstComps(fingerprint);
    expect(result.matchedComps.length).toBeLessThanOrEqual(3);
  });

  it('comp scores are between 0 and 100', async () => {
    const result = await GrowthFingerprintEngine.matchAgainstComps(fingerprint);
    result.matchedComps.forEach(comp => {
      const score = comp.score ?? comp.similarity ?? 0;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  it('mature project score computed without error', async () => {
    const fpMature = GrowthFingerprintEngine.extractFingerprint(MOCK_ONCHAIN_MATURE, []);
    const result = await GrowthFingerprintEngine.matchAgainstComps(fpMature);
    expect(typeof result.earlyGrowthMatchScore).toBe('number');
  });

  it('handles null fingerprint gracefully', async () => {
    await expect(GrowthFingerprintEngine.matchAgainstComps(null)).resolves.toBeDefined();
  });

  it('handles empty fingerprint object gracefully', async () => {
    await expect(GrowthFingerprintEngine.matchAgainstComps({})).resolves.toBeDefined();
  });
});

// ── Seed data integrity ───────────────────────────────────────────────────────

describe('Seed comps data', () => {
  it('loads seed comps without error', () => {
    expect(() => GrowthFingerprintEngine.loadSeedComps?.()).not.toThrow();
  });

  it('computeAndSave is a function', () => {
    expect(typeof GrowthFingerprintEngine.computeAndSave).toBe('function');
  });

  it('loadFingerprint is a function', () => {
    expect(typeof GrowthFingerprintEngine.loadFingerprint).toBe('function');
  });

  it('saveFingerprint is a function', () => {
    expect(typeof GrowthFingerprintEngine.saveFingerprint).toBe('function');
  });
});
