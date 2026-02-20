/**
 * Competitive Intelligence Engine
 * 
 * Analyzes user behavior across protocols and generates competitive insights.
 * Tracks share of wallet, migration patterns, and competitive benchmarking.
 */
export class CompetitiveIntelligenceEngine {
  constructor() {
    this.protocolCategories = new Map();
  }

  /**
   * Analyze cross-protocol behavior
   * @param {Array<Object>} targetTransactions - Transactions for target contract
   * @param {Array<Object>} allTransactions - All transactions including competitors
   * @returns {Object} Cross-protocol analysis report
   */
  analyzeCrossProtocolBehavior(targetTransactions, allTransactions) {
    if (!Array.isArray(targetTransactions) || !Array.isArray(allTransactions)) {
      return this._emptyReport();
    }

    const targetContract = targetTransactions[0]?.contractAddress;
    if (!targetContract) {
      return this._emptyReport();
    }

    // Get all unique wallets from target
    const targetWallets = new Set(targetTransactions.map(tx => tx.wallet));
    
    // Analyze each wallet's protocol usage
    const walletProtocolUsage = this._analyzeWalletProtocolUsage(
      Array.from(targetWallets),
      allTransactions
    );

    // Calculate share of wallet metrics
    const shareOfWallet = this._calculateShareOfWallet(walletProtocolUsage, targetContract);
    
    // Identify protocols users interact with
    const protocolInteractions = this._identifyProtocolInteractions(
      walletProtocolUsage,
      targetContract
    );

    return {
      targetContract,
      totalWallets: targetWallets.size,
      shareOfWallet,
      protocolInteractions,
      walletProtocolUsage: Array.from(walletProtocolUsage.entries()).map(([wallet, usage]) => ({
        wallet,
        ...usage
      }))
    };
  }

  /**
   * Detect migration patterns
   * @param {Array<string>} wallets - Wallet addresses to analyze
   * @param {string} targetContract - Target contract address
   * @param {Array<string>} competitors - Competitor contract addresses
   * @param {Array<Object>} allTransactions - All transactions
   * @returns {Object} Migration analysis
   */
  detectMigrationPatterns(wallets, targetContract, competitors, allTransactions) {
    if (!Array.isArray(wallets) || wallets.length === 0) {
      return { migrations: [], summary: {} };
    }

    const migrations = [];
    const timeWindow = 30 * 24 * 60 * 60 * 1000; // 30 days

    for (const wallet of wallets) {
      const walletTxs = allTransactions
        .filter(tx => tx.wallet === wallet)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Analyze activity trends over time
      const targetActivity = this._calculateActivityTrend(
        walletTxs.filter(tx => tx.contractAddress === targetContract),
        timeWindow
      );

      for (const competitor of competitors) {
        const competitorActivity = this._calculateActivityTrend(
          walletTxs.filter(tx => tx.contractAddress === competitor),
          timeWindow
        );

        // Detect migration: decreasing target + increasing competitor
        if (targetActivity.trend === 'decreasing' && competitorActivity.trend === 'increasing') {
          migrations.push({
            wallet,
            from: targetContract,
            to: competitor,
            targetTrend: targetActivity,
            competitorTrend: competitorActivity,
            migrationScore: this._calculateMigrationScore(targetActivity, competitorActivity)
          });
        }
      }
    }

    // Calculate summary statistics
    const summary = {
      totalMigrations: migrations.length,
      migrationRate: wallets.length > 0 ? migrations.length / wallets.length : 0,
      topDestinations: this._getTopDestinations(migrations),
      averageMigrationScore: migrations.length > 0
        ? migrations.reduce((sum, m) => sum + m.migrationScore, 0) / migrations.length
        : 0
    };

    return { migrations, summary };
  }

  /**
   * Benchmark performance against competitors
   * @param {Object} targetMetrics - Target contract metrics
   * @param {Array<Object>} competitorMetrics - Array of competitor metrics
   * @returns {Object} Benchmark report
   */
  benchmarkPerformance(targetMetrics, competitorMetrics) {
    if (!targetMetrics || !Array.isArray(competitorMetrics)) {
      return { comparisons: [], rankings: {} };
    }

    const metrics = ['transactionVolume', 'uniqueUsers', 'gasEfficiency', 'successRate'];
    const comparisons = [];

    for (const metric of metrics) {
      const targetValue = targetMetrics[metric] || 0;
      const competitorValues = competitorMetrics.map(c => c[metric] || 0);
      
      const comparison = {
        metric,
        targetValue,
        competitorMedian: this._calculateMedian(competitorValues),
        competitorAverage: this._calculateAverage(competitorValues),
        competitorMin: Math.min(...competitorValues),
        competitorMax: Math.max(...competitorValues),
        percentile: this._calculatePercentile(targetValue, competitorValues)
      };

      comparison.performance = this._classifyPerformance(comparison.percentile);
      comparisons.push(comparison);
    }

    // Calculate overall rankings
    const rankings = this._calculateRankings(targetMetrics, competitorMetrics);

    return { comparisons, rankings };
  }

  /**
   * Categorize protocol by type
   * @param {string} contractAddress - Contract address
   * @param {string} category - Category (DEX, lending, NFT, etc.)
   */
  categorizeProtocol(contractAddress, category) {
    this.protocolCategories.set(contractAddress.toLowerCase(), category);
  }

  /**
   * Get protocol category
   * @param {string} contractAddress - Contract address
   * @returns {string} Category or 'unknown'
   */
  getProtocolCategory(contractAddress) {
    return this.protocolCategories.get(contractAddress.toLowerCase()) || 'unknown';
  }

  /**
   * Analyze wallet protocol usage
   * @private
   */
  _analyzeWalletProtocolUsage(wallets, allTransactions) {
    const walletUsage = new Map();

    for (const wallet of wallets) {
      const walletTxs = allTransactions.filter(tx => tx.wallet === wallet);
      
      // Group by protocol
      const protocolStats = new Map();
      let totalTxs = 0;
      let totalGas = 0;

      for (const tx of walletTxs) {
        const protocol = tx.contractAddress;
        
        if (!protocolStats.has(protocol)) {
          protocolStats.set(protocol, {
            transactions: 0,
            gasSpent: 0,
            valueTransacted: 0
          });
        }

        const stats = protocolStats.get(protocol);
        stats.transactions++;
        stats.gasSpent += tx.gasCostEth || 0;
        stats.valueTransacted += tx.valueEth || 0;

        totalTxs++;
        totalGas += tx.gasCostEth || 0;
      }

      // Calculate percentages
      const protocols = Array.from(protocolStats.entries()).map(([protocol, stats]) => ({
        protocol,
        transactions: stats.transactions,
        transactionShare: totalTxs > 0 ? stats.transactions / totalTxs : 0,
        gasSpent: stats.gasSpent,
        gasShare: totalGas > 0 ? stats.gasSpent / totalGas : 0,
        valueTransacted: stats.valueTransacted
      }));

      walletUsage.set(wallet, {
        totalTransactions: totalTxs,
        totalGasSpent: totalGas,
        protocols
      });
    }

    return walletUsage;
  }

  /**
   * Calculate share of wallet metrics
   * @private
   */
  _calculateShareOfWallet(walletProtocolUsage, targetContract) {
    let totalTargetTxs = 0;
    let totalAllTxs = 0;
    let totalTargetGas = 0;
    let totalAllGas = 0;

    for (const [wallet, usage] of walletProtocolUsage) {
      totalAllTxs += usage.totalTransactions;
      totalAllGas += usage.totalGasSpent;

      const targetProtocol = usage.protocols.find(p => p.protocol === targetContract);
      if (targetProtocol) {
        totalTargetTxs += targetProtocol.transactions;
        totalTargetGas += targetProtocol.gasSpent;
      }
    }

    return {
      transactionShare: totalAllTxs > 0 ? totalTargetTxs / totalAllTxs : 0,
      gasShare: totalAllGas > 0 ? totalTargetGas / totalAllGas : 0,
      transactionSharePercentage: totalAllTxs > 0 ? (totalTargetTxs / totalAllTxs) * 100 : 0,
      gasSharePercentage: totalAllGas > 0 ? (totalTargetGas / totalAllGas) * 100 : 0
    };
  }

  /**
   * Identify protocol interactions
   * @private
   */
  _identifyProtocolInteractions(walletProtocolUsage, targetContract) {
    const protocolCounts = new Map();

    for (const [wallet, usage] of walletProtocolUsage) {
      for (const protocol of usage.protocols) {
        if (protocol.protocol !== targetContract) {
          const current = protocolCounts.get(protocol.protocol) || {
            protocol: protocol.protocol,
            walletCount: 0,
            totalTransactions: 0,
            totalGasSpent: 0
          };

          current.walletCount++;
          current.totalTransactions += protocol.transactions;
          current.totalGasSpent += protocol.gasSpent;

          protocolCounts.set(protocol.protocol, current);
        }
      }
    }

    const interactions = Array.from(protocolCounts.values())
      .sort((a, b) => b.walletCount - a.walletCount);

    return interactions;
  }

  /**
   * Calculate activity trend
   * @private
   */
  _calculateActivityTrend(transactions, timeWindow) {
    if (transactions.length === 0) {
      return { trend: 'none', recentCount: 0, previousCount: 0, changeRate: 0 };
    }

    const now = new Date();
    const recentStart = new Date(now.getTime() - timeWindow);
    const previousStart = new Date(now.getTime() - 2 * timeWindow);

    const recentTxs = transactions.filter(tx => tx.timestamp >= recentStart);
    const previousTxs = transactions.filter(
      tx => tx.timestamp >= previousStart && tx.timestamp < recentStart
    );

    const recentCount = recentTxs.length;
    const previousCount = previousTxs.length;

    let trend = 'stable';
    let changeRate = 0;

    if (previousCount > 0) {
      changeRate = (recentCount - previousCount) / previousCount;
      if (changeRate > 0.2) trend = 'increasing';
      else if (changeRate < -0.2) trend = 'decreasing';
    } else if (recentCount > 0) {
      trend = 'increasing';
      changeRate = 1;
    }

    return { trend, recentCount, previousCount, changeRate };
  }

  /**
   * Calculate migration score
   * @private
   */
  _calculateMigrationScore(targetActivity, competitorActivity) {
    const targetDecline = Math.abs(targetActivity.changeRate);
    const competitorGrowth = competitorActivity.changeRate;
    
    return (targetDecline + competitorGrowth) / 2;
  }

  /**
   * Get top migration destinations
   * @private
   */
  _getTopDestinations(migrations) {
    const destinations = new Map();

    for (const migration of migrations) {
      const count = destinations.get(migration.to) || 0;
      destinations.set(migration.to, count + 1);
    }

    return Array.from(destinations.entries())
      .map(([protocol, count]) => ({ protocol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Calculate median
   * @private
   */
  _calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate average
   * @private
   */
  _calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile
   * @private
   */
  _calculatePercentile(value, values) {
    if (values.length === 0) return 50;
    const sorted = [...values, value].sort((a, b) => a - b);
    const index = sorted.indexOf(value);
    return (index / sorted.length) * 100;
  }

  /**
   * Classify performance based on percentile
   * @private
   */
  _classifyPerformance(percentile) {
    if (percentile >= 75) return 'excellent';
    if (percentile >= 50) return 'above_average';
    if (percentile >= 25) return 'below_average';
    return 'poor';
  }

  /**
   * Calculate rankings
   * @private
   */
  _calculateRankings(targetMetrics, competitorMetrics) {
    const allMetrics = [targetMetrics, ...competitorMetrics];
    const rankings = {};

    const metrics = ['transactionVolume', 'uniqueUsers', 'gasEfficiency', 'successRate'];
    
    for (const metric of metrics) {
      const sorted = allMetrics
        .map((m, i) => ({ value: m[metric] || 0, index: i }))
        .sort((a, b) => b.value - a.value);

      const targetRank = sorted.findIndex(m => m.index === 0) + 1;
      rankings[metric] = {
        rank: targetRank,
        total: allMetrics.length,
        percentile: ((allMetrics.length - targetRank) / allMetrics.length) * 100
      };
    }

    return rankings;
  }

  /**
   * Return empty report structure
   * @private
   */
  _emptyReport() {
    return {
      targetContract: null,
      totalWallets: 0,
      shareOfWallet: {
        transactionShare: 0,
        gasShare: 0,
        transactionSharePercentage: 0,
        gasSharePercentage: 0
      },
      protocolInteractions: [],
      walletProtocolUsage: []
    };
  }
}

export default CompetitiveIntelligenceEngine;
