/**
 * MetricsCalculator
 * Calculates all metrics from stored transaction data.
 * Used by enhanced-metrics routes and auto-calculation on startup.
 */

import { AnalysisStorage } from '../database/index.js';

export class MetricsCalculator {
  // ── Static helpers ──────────────────────────────────────────────────────────

  static empty() {
    return {
      totalTransactions: 0, uniqueUsers: 0, totalValue: '0',
      avgGasUsed: 0, successRate: '0.00', failureRate: '0.00',
      volume: '0', dau: 0, gasEfficiency: 0,
    };
  }

  /**
   * Calculate core metrics from a transaction array
   */
  static calculate(transactions = []) {
    if (!transactions.length) return this.empty();

    const uniqueUsers = new Set(transactions.map(tx => tx.from).filter(Boolean)).size;

    let totalValue = BigInt(0);
    let totalGas   = BigInt(0);
    for (const tx of transactions) {
      try { totalValue += BigInt(tx.value   || '0'); } catch {}
      try { totalGas   += BigInt(tx.gasUsed || '0'); } catch {}
    }

    const successful = transactions.filter(tx => tx.status === true || tx.status === 1).length;
    const failed     = transactions.length - successful;
    const avgGas     = transactions.length ? Number(totalGas / BigInt(transactions.length)) : 0;

    return {
      totalTransactions: transactions.length,
      uniqueUsers,
      totalValue:  totalValue.toString(),
      avgGasUsed:  avgGas,
      successRate: transactions.length ? ((successful / transactions.length) * 100).toFixed(2) : '0.00',
      failureRate: transactions.length ? ((failed    / transactions.length) * 100).toFixed(2) : '0.00',
      volume:      totalValue.toString(),
      dau:         uniqueUsers,
      gasEfficiency: avgGas,
    };
  }

  // ── Instance method (used by enhanced-metrics.js) ───────────────────────────

  /**
   * Full metrics calculation from an analysis record.
   * Returns { defiMetrics, userBehavior, gasAnalysis, summary, lastUpdated }
   */
  calculateAllMetrics(analysis) {
    const txs     = analysis.results?.target?.transactions || [];
    const core    = MetricsCalculator.calculate(txs);
    const blockRange = analysis.results?.target?.summary?.blockRange
                    || analysis.metadata?.blockRange
                    || null;

    // ── DeFi metrics ──────────────────────────────────────────────────────────
    const defiMetrics = {
      transactions:          core.totalTransactions,
      uniqueUsers:           core.uniqueUsers,
      dau:                   core.uniqueUsers,
      totalValue:            core.totalValue,
      volume:                core.volume,
      avgGasUsed:            core.avgGasUsed,
      gasEfficiency:         core.gasEfficiency,
      successRate:           parseFloat(core.successRate),
      failureRate:           parseFloat(core.failureRate),
      // DeFi-specific (calculated if data available, else 0)
      tvl:                   0,
      transactionVolume24h:  0,
      fees24h:               0,
      revenue24h:            0,
      mau:                   0,
      activeUsers:           core.uniqueUsers,
      newUsers:              0,
      liquidityUtilization:  0,
      volumeToTvlRatio:      0,
    };

    // ── User behaviour ────────────────────────────────────────────────────────
    const fromCounts = {};
    for (const tx of txs) {
      if (tx.from) fromCounts[tx.from] = (fromCounts[tx.from] || 0) + 1;
    }
    const counts      = Object.values(fromCounts);
    const totalCalls  = counts.reduce((s, c) => s + c, 0);
    const whaleCount  = counts.filter(c => c >= 10).length;
    const botCount    = counts.filter(c => c >= 50).length;

    const userBehavior = {
      whaleRatio:         core.uniqueUsers ? (whaleCount / core.uniqueUsers) : 0,
      botActivity:        core.uniqueUsers ? (botCount   / core.uniqueUsers) : 0,
      retentionRate:      0,
      churnRate:          0,
      engagementScore:    totalCalls && core.uniqueUsers ? (totalCalls / core.uniqueUsers) : 0,
      avgTransactionsPerUser: core.uniqueUsers ? (core.totalTransactions / core.uniqueUsers) : 0,
      interactionPatterns: {},
      eventEngagement:    {},
      contractLoyalty:    {},
    };

    // ── Gas analysis ──────────────────────────────────────────────────────────
    const gasCosts = txs.map(tx => {
      try { return Number(BigInt(tx.gasUsed || '0') * BigInt(tx.gasPrice || '0')); } catch { return 0; }
    }).filter(v => v > 0);

    const gasAnalysis = {
      avgGasUsed:    core.avgGasUsed,
      totalGasCost:  gasCosts.reduce((s, v) => s + v, 0).toString(),
      avgGasCost:    gasCosts.length ? (gasCosts.reduce((s, v) => s + v, 0) / gasCosts.length) : 0,
      minGasUsed:    txs.length ? Math.min(...txs.map(tx => { try { return Number(BigInt(tx.gasUsed || '0')); } catch { return 0; } })) : 0,
      maxGasUsed:    txs.length ? Math.max(...txs.map(tx => { try { return Number(BigInt(tx.gasUsed || '0')); } catch { return 0; } })) : 0,
    };

    // ── Summary ───────────────────────────────────────────────────────────────
    const summary = {
      totalTransactions: core.totalTransactions,
      uniqueUsers:       core.uniqueUsers,
      successRate:       parseFloat(core.successRate),
      failureRate:       parseFloat(core.failureRate),
      blockRange,
      lastLiveUpdate:    analysis.metadata?.lastLiveUpdate || null,
    };

    return {
      defiMetrics,
      userBehavior,
      gasAnalysis,
      summary,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ── Batch recalculation ───────────────────────────────────────────────────

  static async recalculateAll() {
    const analyses = await AnalysisStorage.findAll();
    const calc = new MetricsCalculator();
    let updated = 0;

    for (const analysis of analyses) {
      if (analysis.status !== 'completed') continue;
      const txs = analysis.results?.target?.transactions || [];
      if (!txs.length) continue;

      const allMetrics = calc.calculateAllMetrics(analysis);

      await AnalysisStorage.update(analysis.id, {
        results: {
          ...analysis.results,
          target: {
            ...analysis.results.target,
            metrics:    allMetrics.defiMetrics,
            behavior:   allMetrics.userBehavior,
            gasAnalysis: allMetrics.gasAnalysis,
            fullReport: allMetrics,
          },
        },
      });
      updated++;
    }

    console.log(`✅ Recalculated metrics for ${updated} analyses`);
    return updated;
  }
}

export default MetricsCalculator;
