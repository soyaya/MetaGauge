// Feature: metagauge-full-implementation, Property 5: Alert Fires If and Only If Threshold Is Crossed
import fc from 'fast-check';
import { checkRetentionDrop, checkBotSurge, checkRevenueChange, checkChurnSpike } from '../../src/services/AlertEngine.js';
import { existsSync, unlinkSync } from 'fs';

// Clear alerts file before each test to avoid dedup suppression
beforeEach(() => {
  if (existsSync('./data/alerts.json')) unlinkSync('./data/alerts.json');
});

test('retention drop fires iff d7 < threshold', () => {
  fc.assert(fc.property(
    fc.float({ min: 0, max: 100 }),
    fc.float({ min: 1, max: 50 }),
    (d7, threshold) => {
      if (existsSync('./data/alerts.json')) unlinkSync('./data/alerts.json');
      const metrics = { retentionRate7d: d7 };
      const alert = checkRetentionDrop(metrics, 'c1', 'u1', { retentionDrop: threshold });
      const shouldFire = d7 < threshold;
      return shouldFire ? alert !== null : alert === null;
    }
  ), { numRuns: 100 });
});

test('bot surge fires iff botPct >= threshold', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 1, max: 100 }),
    fc.float({ min: 1, max: 50 }),
    (bots, total, threshold) => {
      if (existsSync('./data/alerts.json')) unlinkSync('./data/alerts.json');
      const botArr = Array.from({ length: Math.min(bots, total) }, (_, i) => ({ address: `0x${i}` }));
      const alert = checkBotSurge(botArr, total, 'c1', 'u1', { botSurgePct: threshold });
      const pct = (botArr.length / total) * 100;
      const shouldFire = pct >= threshold;
      return shouldFire ? alert !== null : alert === null;
    }
  ), { numRuns: 100 });
});

test('revenue change fires iff change% >= threshold', () => {
  fc.assert(fc.property(
    fc.float({ min: 1, max: 10000, noNaN: true }),
    fc.float({ min: 1, max: 10000, noNaN: true }),
    fc.float({ min: 1, max: 80, noNaN: true }),
    (current, previous, threshold) => {
      if (existsSync('./data/alerts.json')) unlinkSync('./data/alerts.json');
      const alert = checkRevenueChange(current, previous, 'c1', 'u1', { revenueChangePct: threshold });
      const changePct = Math.abs((current - previous) / previous * 100);
      const shouldFire = changePct >= threshold;
      return shouldFire ? alert !== null : alert === null;
    }
  ), { numRuns: 100 });
});

test('churn spike fires iff increase >= threshold', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 100 }).map(n => n / 1),
    fc.integer({ min: 1, max: 100 }).map(n => n / 1),
    fc.integer({ min: 1, max: 50 }).map(n => n / 1),
    (current, previous, threshold) => {
      if (existsSync('./data/alerts.json')) unlinkSync('./data/alerts.json');
      const alert = checkChurnSpike(current, previous, 'c1', 'u1', { churnSpikePct: threshold });
      const increase = current - previous;
      const shouldFire = increase >= threshold;
      return shouldFire ? alert !== null : alert === null;
    }
  ), { numRuns: 100 });
});
