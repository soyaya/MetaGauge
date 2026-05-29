/**
 * RiskDetector
 * Combines main app metrics + GitHub + deep on-chain checks into risk signals.
 */

import { OnChainRiskAnalyzer } from './OnChainRiskAnalyzer.js';

export class RiskDetector {
  /**
   * @param {object} traction   — from MainAppClient.getTraction()
   * @param {object} analysis   — from MainAppClient.getAnalysis()
   * @param {object} github     — from GitHubAnalyzer.analyze() (optional)
   * @param {object} onChain    — from OnChainRiskAnalyzer.analyze() (optional, pre-fetched)
   */
  static detect(traction, analysis, github = null, onChain = null) {
    const fr = analysis?.results?.target?.fullReport || {};
    const metrics = traction?.metrics || analysis?.results?.target?.metrics || {};
    const signals = [];

    // ── Main app metrics ──────────────────────────────────────────────────────

    const failureRate = fr.summary?.failureRate || metrics.failureRate || 0;
    if (failureRate > 30) signals.push(`High transaction failure rate: ${failureRate.toFixed(1)}%`);

    const churnRate = fr.retentionMetrics?.churnRate || 0;
    if (churnRate > 50) signals.push(`High churn rate: ${churnRate.toFixed(1)}%`);

    const botPct = fr.userQualityMetrics?.botPct || 0;
    if (botPct > 30) signals.push(`Elevated bot activity: ${botPct.toFixed(1)}% of wallets`);

    const d7 = fr.retentionMetrics?.d7Retention || 0;
    if (d7 > 0 && d7 < 10) signals.push(`Very low D7 retention: ${d7.toFixed(1)}%`);

    const txCount = metrics.transactions || 0;
    const userCount = metrics.uniqueUsers || 0;
    if (txCount > 100 && userCount > 0 && txCount / userCount > 50) {
      signals.push(`Possible wash trading: ${(txCount / userCount).toFixed(0)} txs per user`);
    }

    const bounceRate = fr.defiMetrics?.bounceRate || 0;
    if (bounceRate > 60) signals.push(`High bounce rate: ${bounceRate.toFixed(1)}%`);

    const recentTxs = fr.recentTransactions || metrics.recentTransactions || [];
    if (recentTxs.length === 0 && txCount > 0) {
      signals.push('No recent transaction activity detected');
    }

    // ── GitHub signals ────────────────────────────────────────────────────────

    if (github && !github.error) {
      if (github.isAbandoned) {
        signals.push(`Repository abandoned: last commit ${github.lastCommitDaysAgo} days ago`);
      }
      if (github.devHealthScore != null && github.devHealthScore < 20) {
        signals.push(`Very low developer activity (health score: ${github.devHealthScore}/100)`);
      }
      if (github.contributorCount === 1) {
        signals.push('Single contributor — bus factor risk');
      }
    }

    // ── Deep on-chain signals ─────────────────────────────────────────────────

    if (onChain && !onChain.error) {
      signals.push(...(onChain.signals || []));
    }

    return signals;
  }

  /**
   * Run deep on-chain analysis and return combined signals.
   * Call this when you want the full picture (slower — hits RPC).
   */
  static async detectWithOnChain(traction, analysis, github = null, contractAddress, chain) {
    const [onChain] = await Promise.allSettled([
      OnChainRiskAnalyzer.analyze(contractAddress, chain),
    ]);

    const onChainData = onChain.status === 'fulfilled' ? onChain.value : null;
    const signals = this.detect(traction, analysis, github, onChainData);

    return { signals, onChainDetails: onChainData?.details || null };
  }
}
