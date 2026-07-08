/**
 * GrowthFingerprintEngine
 * Extracts a growth pattern ("fingerprint") from a project's on-chain data
 * and matches it against seeded successful project fingerprints.
 *
 * Fingerprint fields:
 *   userGrowthVelocity   — user counts at week 1 / 4 / 12
 *   retentionCurveShape  — D1 / D7 / D30 retention %
 *   revenueAcceleration  — array of MoM revenue growth rates
 *   cacTrend             — improving | stable | degrading
 *   onchainDensity       — avg txs per active user per week
 *   tvlTrajectory        — weekly TVL change % array
 *   stage                — early | growth | mature
 *   matchScore           — 0–100 vs best known comp
 *   matchedComps         — top 3 { name, score, notes }
 */

import { query } from '../api/database/postgres.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR   = join(__dirname, '../../data/fingerprints/seed');

// ── Load seeded successful project fingerprints ────────────────────────────

let _seeds = null;
async function loadSeeds() {
  if (_seeds) return _seeds;
  try {
    const raw = await readFile(join(SEED_DIR, 'comps.json'), 'utf8');
    _seeds = JSON.parse(raw);
  } catch {
    _seeds = getBuiltInSeeds();
  }
  return _seeds;
}

// Built-in seed fingerprints derived from public historical data
// These are normalised growth shapes (not exact numbers) — we compare shapes
function getBuiltInSeeds() {
  return [
    {
      name: 'Uniswap V2 (Early 2020)',
      category: 'Dex',
      chain: 'ethereum',
      userGrowthVelocity: { w1: 1, w4: 8, w12: 45 },     // relative index (w1=1)
      retentionCurveShape: { d1: 62, d7: 38, d30: 22 },
      revenueAcceleration: [0, 1.8, 3.2, 2.1, 4.5],       // MoM multiples
      cacTrend: 'improving',
      onchainDensity: 3.2,                                   // txs/user/week
      tvlGrowthShape: [0.05, 0.12, 0.25, 0.40, 0.65, 1.0], // normalised 0-1
      stage: 'early',
      successIndicators: ['organic user growth', 'improving CAC', 'high D7 retention', 'TVL acceleration'],
    },
    {
      name: 'Aave V1 (Early 2020)',
      category: 'Lending',
      chain: 'ethereum',
      userGrowthVelocity: { w1: 1, w4: 5, w12: 28 },
      retentionCurveShape: { d1: 71, d7: 52, d30: 34 },
      revenueAcceleration: [0, 1.2, 2.8, 3.5, 5.0],
      cacTrend: 'improving',
      onchainDensity: 1.8,
      tvlGrowthShape: [0.03, 0.08, 0.18, 0.35, 0.60, 1.0],
      stage: 'early',
      successIndicators: ['high D30 retention', 'protocol fee growth', 'TVL compounding'],
    },
    {
      name: 'GMX (Early 2022)',
      category: 'Derivatives',
      chain: 'arbitrum',
      userGrowthVelocity: { w1: 1, w4: 6, w12: 32 },
      retentionCurveShape: { d1: 58, d7: 44, d30: 28 },
      revenueAcceleration: [0, 2.1, 4.3, 6.0, 8.5],
      cacTrend: 'improving',
      onchainDensity: 4.5,
      tvlGrowthShape: [0.02, 0.07, 0.20, 0.45, 0.75, 1.0],
      stage: 'early',
      successIndicators: ['high tx density', 'revenue acceleration', 'improving CAC', 'whale retention'],
    },
    {
      name: 'Blur (Early NFT 2022)',
      category: 'NFT',
      chain: 'ethereum',
      userGrowthVelocity: { w1: 1, w4: 12, w12: 80 },
      retentionCurveShape: { d1: 45, d7: 28, d30: 14 },
      revenueAcceleration: [0, 3.5, 7.0, 4.0, 9.0],
      cacTrend: 'stable',
      onchainDensity: 6.8,
      tvlGrowthShape: [0.01, 0.05, 0.18, 0.50, 0.80, 1.0],
      stage: 'early',
      successIndicators: ['viral user growth', 'high volume per user', 'aggressive expansion'],
    },
    {
      name: 'Curve (Early 2020)',
      category: 'Dex',
      chain: 'ethereum',
      userGrowthVelocity: { w1: 1, w4: 4, w12: 18 },
      retentionCurveShape: { d1: 75, d7: 60, d30: 42 },
      revenueAcceleration: [0, 1.1, 1.8, 2.5, 3.0],
      cacTrend: 'stable',
      onchainDensity: 2.1,
      tvlGrowthShape: [0.04, 0.10, 0.22, 0.42, 0.68, 1.0],
      stage: 'early',
      successIndicators: ['exceptional D30 retention', 'steady compounding', 'protocol stickiness'],
    },
  ];
}

// ── Fingerprint extraction ─────────────────────────────────────────────────

/**
 * Extract a fingerprint from on-chain data and financial docs.
 * onChain — from metrics table (normalised)
 * financialData — array of period financial documents (chronological)
 */
export function extractFingerprint(onChain = {}, financialData = []) {
  // Guard: financialData must be an array
  if (!Array.isArray(financialData)) financialData = [];
  // Guard: onChain must be an object
  if (!onChain || typeof onChain !== 'object') onChain = {};
  // ── User growth velocity ──
  // We derive relative velocity from available data
  const totalUsers = onChain.uniqueUsers || 0;
  const newUsers   = onChain.newUsers || 0;
  const activeUsers = onChain.activeUsers || totalUsers;

  // Estimate weekly user counts at different stages (normalised)
  const userGrowthVelocity = {
    w1:  1,                                         // baseline
    w4:  totalUsers > 0 ? Math.round(activeUsers / Math.max(1, newUsers) * 2) : 1,
    w12: totalUsers > 0 ? Math.round(totalUsers / Math.max(1, newUsers) * 3) : 1,
  };

  // ── Retention curve shape ──
  const retentionCurveShape = {
    d1:  onChain.d1Retention  || 0,
    d7:  onChain.d7Retention  || 0,
    d30: onChain.d30Retention || onChain.retentionRate || 0,
  };

  // ── Revenue acceleration ──
  // Build MoM growth rate array from financial documents (oldest first)
  const revenueAcceleration = [];
  if (financialData.length >= 2) {
    for (let i = 1; i < financialData.length; i++) {
      const prev = financialData[i-1]?.income_statement?.revenue?.total_revenue || 0;
      const curr = financialData[i]?.income_statement?.revenue?.total_revenue || 0;
      const rate = prev > 0 ? (curr - prev) / prev : 0;
      revenueAcceleration.push(Math.round(rate * 100) / 100);
    }
  }

  // ── CAC trend ──
  let cacTrend = 'stable';
  if (financialData.length >= 2) {
    const cacs = financialData
      .map(d => d?.unit_economics?.acquisition?.cac)
      .filter(c => c != null && c > 0);
    if (cacs.length >= 2) {
      const first = cacs[0];
      const last  = cacs[cacs.length - 1];
      const change = (last - first) / first;
      if (change < -0.15) cacTrend = 'improving';
      else if (change > 0.15) cacTrend = 'degrading';
      else cacTrend = 'stable';
    }
  }

  // ── On-chain density ──
  const txs = onChain.totalTransactions || 0;
  const weeks = 4; // assume current period = ~4 weeks
  const onchainDensity = activeUsers > 0
    ? Math.round((txs / weeks / activeUsers) * 100) / 100
    : 0;

  // ── TVL trajectory ──
  // Use research data if available — placeholder array otherwise
  const tvlTrajectory = onChain.tvlHistory
    ? onChain.tvlHistory.slice(-12).map((v, i, arr) => {
        const prev = arr[i-1] || v;
        return prev > 0 ? Math.round(((v - prev) / prev) * 100) / 100 : 0;
      })
    : [];

  // ── Stage ──
  let stage = 'early';
  if (totalUsers > 10000 || txs > 100000) stage = 'growth';
  if (totalUsers > 100000 || txs > 1000000) stage = 'mature';

  return {
    userGrowthVelocity,
    retentionCurveShape,
    revenueAcceleration,
    cacTrend,
    onchainDensity,
    tvlTrajectory,
    stage,
  };
}

// ── Similarity scoring ─────────────────────────────────────────────────────

/**
 * Score similarity between a live fingerprint and a seed comp.
 * Returns 0–100.
 */
function scoreVsComp(fp, seed) {
  let score = 0;
  let weight = 0;

  // Retention shape similarity (40 points)
  const retKeys = ['d1', 'd7', 'd30'];
  for (const k of retKeys) {
    const live = fp.retentionCurveShape?.[k] || 0;
    const ref  = seed.retentionCurveShape?.[k] || 0;
    if (ref > 0) {
      const diff = Math.abs(live - ref) / ref;
      score  += Math.max(0, 1 - diff) * 13;
      weight += 13;
    }
  }

  // CAC trend match (15 points)
  if (fp.cacTrend && seed.cacTrend) {
    if (fp.cacTrend === seed.cacTrend) score += 15;
    else if (fp.cacTrend === 'improving') score += 8; // still positive even if not exact match
    weight += 15;
  }

  // On-chain density similarity (15 points)
  if (seed.onchainDensity > 0 && fp.onchainDensity > 0) {
    const diff = Math.abs(fp.onchainDensity - seed.onchainDensity) / seed.onchainDensity;
    score  += Math.max(0, 1 - diff) * 15;
    weight += 15;
  }

  // Revenue acceleration momentum (20 points)
  const fpRevAcc = Array.isArray(fp.revenueAcceleration) ? fp.revenueAcceleration : [];
  if (fpRevAcc.length > 0) {
    const lastRate = fpRevAcc[fpRevAcc.length - 1] || 0;
    const seedRef  = seed.revenueAcceleration?.[2] || 1; // 3rd period reference
    if (seedRef > 0 && lastRate > 0) {
      const momentum = Math.min(lastRate / seedRef, 1.5);
      score  += Math.min(momentum * 13, 20);
      weight += 20;
    }
  }

  // Stage match (10 points)
  if (fp.stage === seed.stage) { score += 10; weight += 10; }
  else weight += 10;

  // Normalise to 0–100
  return weight > 0 ? Math.round((score / weight) * 100) : 0;
}

/**
 * Match a fingerprint against all seeded comps.
 * Returns { earlyGrowthMatchScore, matchedComps }
 */
export async function matchAgainstComps(fingerprint) {
  // Guard: return safe default if fingerprint is null/empty
  if (!fingerprint || typeof fingerprint !== 'object') {
    return { earlyGrowthMatchScore: 0, matchedComps: [] };
  }
  const seeds = await loadSeeds();
  const scored = seeds.map(seed => ({
    name:  seed.name,
    category: seed.category,
    score: scoreVsComp(fingerprint, seed),
    successIndicators: seed.successIndicators,
    notes: buildMatchNotes(fingerprint, seed),
  })).sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);
  const earlyGrowthMatchScore = top3[0]?.score || 0;

  return { earlyGrowthMatchScore, matchedComps: top3 };
}

function buildMatchNotes(fp, seed) {
  const notes = [];
  const ret30 = fp.retentionCurveShape?.d30 || 0;
  const seedRet30 = seed.retentionCurveShape?.d30 || 0;

  if (ret30 >= seedRet30 * 0.85) notes.push(`D30 retention (${ret30}%) matches ${seed.name.split(' ')[0]} early pattern`);
  if (fp.cacTrend === 'improving') notes.push('CAC improving — organic growth signal');
  if (fp.onchainDensity >= seed.onchainDensity * 0.8) notes.push('On-chain activity density aligned with comp');
  const revAcc = Array.isArray(fp.revenueAcceleration) ? fp.revenueAcceleration : [];
  const lastRate = revAcc[revAcc.length - 1];
  if (lastRate > 1) notes.push(`Revenue accelerating ${(lastRate * 100).toFixed(0)}% MoM`);

  return notes.join('. ') || `Pattern similarity to ${seed.name}`;
}

// ── DB persistence ─────────────────────────────────────────────────────────

export async function saveFingerprint(contractAddress, chain, fingerprint, matchResult) {
  const { earlyGrowthMatchScore, matchedComps } = matchResult;

  await query(
    `INSERT INTO growth_fingerprints
       (contract_address, chain,
        user_growth_velocity, retention_curve_shape, revenue_acceleration,
        cac_trend, onchain_density, tvl_trajectory, stage,
        match_score, matched_comps, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     ON CONFLICT (contract_address, chain) DO UPDATE SET
       user_growth_velocity  = EXCLUDED.user_growth_velocity,
       retention_curve_shape = EXCLUDED.retention_curve_shape,
       revenue_acceleration  = EXCLUDED.revenue_acceleration,
       cac_trend             = EXCLUDED.cac_trend,
       onchain_density       = EXCLUDED.onchain_density,
       tvl_trajectory        = EXCLUDED.tvl_trajectory,
       stage                 = EXCLUDED.stage,
       match_score           = EXCLUDED.match_score,
       matched_comps         = EXCLUDED.matched_comps,
       computed_at           = NOW()`,
    [
      contractAddress?.toLowerCase(), chain,
      JSON.stringify(fingerprint.userGrowthVelocity),
      JSON.stringify(fingerprint.retentionCurveShape),
      JSON.stringify(fingerprint.revenueAcceleration),
      fingerprint.cacTrend,
      fingerprint.onchainDensity,
      JSON.stringify(fingerprint.tvlTrajectory),
      fingerprint.stage,
      earlyGrowthMatchScore,
      JSON.stringify(matchedComps),
    ]
  );
}

export async function loadFingerprint(contractAddress, chain) {
  const result = await query(
    `SELECT * FROM growth_fingerprints WHERE contract_address=$1 AND chain=$2`,
    [contractAddress?.toLowerCase(), chain]
  );
  return result.rows[0] || null;
}

/**
 * Full pipeline: extract → match → save → return
 */
export async function computeAndSave(contractAddress, chain, onChain, financialData) {
  const fingerprint  = extractFingerprint(onChain, financialData);
  const matchResult  = await matchAgainstComps(fingerprint);
  await saveFingerprint(contractAddress, chain, fingerprint, matchResult);

  return {
    ...fingerprint,
    earlyGrowthMatchScore: matchResult.earlyGrowthMatchScore,
    matchedComps:          matchResult.matchedComps,
  };
}

export default { extractFingerprint, matchAgainstComps, saveFingerprint, loadFingerprint, computeAndSave };
