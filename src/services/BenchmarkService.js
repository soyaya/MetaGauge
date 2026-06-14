/**
 * BenchmarkService
 * Labels user metrics against category benchmarks using the existing
 * metrics-definitions.json knowledge base.
 *
 * Returns per-metric context: status (good/warn/bad), label, and peer comparison text.
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

const KB_PATH = resolve('./data/ai-knowledge/metrics-definitions.json');

// Category-specific benchmark overrides (vs generic thresholds)
// Source: typical DeFi / NFT / Gaming on-chain benchmarks
const CATEGORY_BENCHMARKS = {
  defi: {
    retentionRate7d:  { avg: 22, top25: 40, top10: 55 },
    retentionRate:    { avg: 35, top25: 55, top10: 70 },
    successRate:      { avg: 91, top25: 96, top10: 98 },
    churnRate:        { avg: 45, top25: 25, top10: 15 },
    botRatio:         { avg: 12, top25: 5,  top10: 2  },
    uniqueUsers:      { avg: 800, top25: 3000, top10: 10000 },
  },
  nft: {
    retentionRate7d:  { avg: 15, top25: 30, top10: 45 },
    retentionRate:    { avg: 25, top25: 40, top10: 60 },
    successRate:      { avg: 88, top25: 94, top10: 97 },
    churnRate:        { avg: 60, top25: 35, top10: 20 },
    uniqueUsers:      { avg: 400, top25: 2000, top10: 8000 },
  },
  gaming: {
    retentionRate7d:  { avg: 30, top25: 50, top10: 65 },
    retentionRate:    { avg: 45, top25: 65, top10: 80 },
    successRate:      { avg: 93, top25: 97, top10: 99 },
    churnRate:        { avg: 35, top25: 18, top10: 8  },
    uniqueUsers:      { avg: 1200, top25: 5000, top10: 20000 },
  },
};

// Default (unknown category) — use defi as baseline
const DEFAULT_BENCHMARKS = CATEGORY_BENCHMARKS.defi;

async function loadDefs() {
  try {
    return JSON.parse(await readFile(KB_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getBenchmarks(category) {
  return CATEGORY_BENCHMARKS[category?.toLowerCase()] || DEFAULT_BENCHMARKS;
}

/**
 * Compare a single metric value against category benchmarks.
 * Returns { status, label, context }
 */
function compareMetric(key, value, benchmarks, defs) {
  if (value == null || isNaN(Number(value))) return null;
  const num = Number(value);
  const bench = benchmarks[key];
  const def = defs[key];

  // Determine if lower is better
  const lowerBetter = ['churnRate', 'failureRate', 'botRatio', 'bounceRate'].includes(key);

  let status = 'neutral';
  let context = '';

  if (bench) {
    if (lowerBetter) {
      if (num <= bench.top10) { status = 'good'; context = `top 10% for your category`; }
      else if (num <= bench.top25) { status = 'good'; context = `top 25% for your category`; }
      else if (num <= bench.avg) { status = 'warn'; context = `near category average (${bench.avg}%)`; }
      else { status = 'bad'; context = `above category average (${bench.avg}%)`; }
    } else {
      if (num >= bench.top10) { status = 'good'; context = `top 10% for your category`; }
      else if (num >= bench.top25) { status = 'good'; context = `top 25% for your category`; }
      else if (num >= bench.avg) { status = 'warn'; context = `near category average (${bench.avg})`; }
      else { status = 'bad'; context = `below category average (${bench.avg})`; }
    }
  } else if (def) {
    // Fall back to good/warn/bad ranges from metrics-definitions.json
    const good = def.goodRange;
    const bad = def.badRange;
    if (good?.startsWith('>') && num > parseFloat(good.slice(1))) status = 'good';
    else if (good?.startsWith('<') && num < parseFloat(good.slice(1))) status = 'good';
    else if (bad?.startsWith('<') && num < parseFloat(bad.slice(1))) status = 'bad';
    else if (bad?.startsWith('>') && num > parseFloat(bad.slice(1))) status = 'bad';
    else status = 'warn';
    context = def.interpretation || '';
  }

  return { status, context, avg: bench?.avg ?? null, top25: bench?.top25 ?? null };
}

export class BenchmarkService {
  /**
   * Benchmark a set of metrics against category peers.
   * @param {object} metrics — flat metrics object
   * @param {object} fullReport — fullReport from analysis
   * @param {string} category — contract category (defi, nft, gaming, etc.)
   * @returns {object} — map of metric key → { value, status, context, avg, top25 }
   */
  static async benchmark(metrics = {}, fullReport = {}, category = 'defi') {
    const defs = await loadDefs();
    const benchmarks = getBenchmarks(category);

    const inputs = {
      retentionRate7d:  fullReport.retentionMetrics?.d7Retention ?? metrics.d7Retention,
      retentionRate:    fullReport.retentionMetrics?.retentionRate ?? metrics.retentionRate,
      successRate:      fullReport.summary?.successRate ?? metrics.successRate,
      churnRate:        fullReport.retentionMetrics?.churnRate ?? metrics.churnRate,
      botRatio:         fullReport.userQualityMetrics?.botPct ?? metrics.botPct,
      uniqueUsers:      metrics.uniqueUsers,
    };

    const result = {};
    for (const [key, value] of Object.entries(inputs)) {
      const comparison = compareMetric(key, value, benchmarks, defs);
      if (comparison) {
        result[key] = { value, ...comparison };
      }
    }

    return { benchmarks: result, category };
  }
}
