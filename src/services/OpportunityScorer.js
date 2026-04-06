/**
 * OpportunityScorer
 * Scores feature gaps, user overlap, and retention plays vs competitors.
 */

import { findByContractId } from '../api/database/CompetitorStorage.js';
import { getAllResults } from './CompetitorIndexer.js';

/**
 * Feature Gap Score (0-100)
 * Based on functions used by competitors but absent from user's contract.
 */
export function scoreFeatureGap(userFunctions = [], competitorResults = []) {
  const userSet = new Set(userFunctions.map(f => f.toLowerCase()));
  const gapMap = {};

  for (const result of competitorResults) {
    const compFunctions = result.metrics?.functions || [];
    for (const fn of compFunctions) {
      const key = fn.toLowerCase();
      if (!userSet.has(key)) {
        if (!gapMap[key]) gapMap[key] = { count: 0, totalAdoption: 0 };
        gapMap[key].count++;
        gapMap[key].totalAdoption += result.metrics?.adoptionRate || 0;
      }
    }
  }

  const total = competitorResults.length || 1;
  return Object.entries(gapMap).map(([feature, data]) => ({
    feature,
    competitors_count: data.count,
    adoption_rate: data.totalAdoption / data.count,
    score: Math.round((data.count / total) * 40 + Math.min(60, data.totalAdoption / data.count * 0.6))
  })).sort((a, b) => b.score - a.score);
}

/**
 * User Overlap Score (0-100)
 * Wallets active on competitors but never on user's contract, weighted by LTV.
 */
export function scoreUserOverlap(userWallets = [], competitorWallets = [], ltvMap = {}) {
  const userSet = new Set(userWallets.map(w => (w.address || w).toLowerCase()));
  const available = competitorWallets.filter(w => !userSet.has((w.address || w).toLowerCase()));
  const total = competitorWallets.length || 1;

  const avgLTV = available.length
    ? available.reduce((s, w) => s + (ltvMap[(w.address || w)] || 0), 0) / available.length
    : 0;
  const maxLTV = Math.max(...Object.values(ltvMap), 1);

  return {
    available_wallets: available.length,
    overlap_wallets: competitorWallets.length - available.length,
    score: Math.round((available.length / total) * 50 + (avgLTV / maxLTV) * 50)
  };
}

/**
 * Retention Play Score (0-100)
 * Competitors with high D1 but low D30 retention = opportunity to retain their churning users.
 */
export function scoreRetentionPlay(competitorResults = []) {
  return competitorResults
    .filter(r => r.metrics?.d1_rate > 30 && r.metrics?.d30_rate < 15)
    .map(r => ({
      competitorId: r.competitorId,
      d1_rate: r.metrics.d1_rate,
      d30_rate: r.metrics.d30_rate,
      score: Math.round((r.metrics.d1_rate - r.metrics.d30_rate) * 1.5)
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Recalculate all opportunity scores for a contract.
 */
export function recalculate(contractId, userFunctions = [], userWallets = [], ltvMap = {}) {
  const competitors = findByContractId(contractId);
  const allResults = getAllResults();
  const competitorResults = competitors.map(c => allResults[c.id]).filter(Boolean);
  const competitorWallets = competitorResults.flatMap(r => r.wallets || []);

  return {
    featureGaps: scoreFeatureGap(userFunctions, competitorResults),
    userOverlap: scoreUserOverlap(userWallets, competitorWallets, ltvMap),
    retentionPlays: scoreRetentionPlay(competitorResults)
  };
}
