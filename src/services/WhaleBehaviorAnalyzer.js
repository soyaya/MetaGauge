/**
 * Whale Behavior Analyzer
 * 
 * Analyzes high-value user (whale) behavior including:
 * - Whale identification (top 5% by transaction value)
 * - Separate retention curves for whales vs regular users
 * - Whale activity drop alerts (50%+ decrease)
 * - Whale influence measurement (% of total protocol value)
 * - Cross-protocol whale engagement comparison
 */
export class WhaleBehaviorAnalyzer {
  constructor() {
    this.whalePercentile = 0.95; // Top 5%
    this.activityDropThreshold = 0.5; // 50% decrease
    this.activityWindowDays = 30; // Compare last 30 days to previous 30
  }

  /**
   * Analyze all whale behavior metrics
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {Array<Object>} competitorTransactions - Optional competitor transactions
   * @returns {Object} Whale behavior analysis
   */
  analyzeWhaleBehavior(transactions, competitorTransactions = null) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    const whales = this.identifyWhales(transactions);
    const retentionComparison = this._calculateRetentionComparison(transactions, whales);
    const activityAlerts = this._detectActivityDrops(transactions, whales);
    const whaleInfluence = this._measureWhaleInfluence(transactions, whales);
    const crossProtocolComparison = competitorTransactions
      ? this._compareWhaleEngagement(transactions, competitorTransactions, whales)
      : null;

    return {
      whales,
      retentionComparison,
      activityAlerts,
      whaleInfluence,
      crossProtocolComparison,
      summary: {
        totalWhales: whales.length,
        whaleRetention: retentionComparison.whale.retention30d,
        regularRetention: retentionComparison.regular.retention30d,
        whaleValuePercentage: whaleInfluence.valuePercentage,
        activeAlerts: activityAlerts.length
      }
    };
  }

  /**
   * Identify whales (top 5% by transaction value)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Whale user data
   */
  identifyWhales(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    // Calculate total value per wallet
    const walletValues = new Map();
    
    for (const tx of transactions) {
      const wallet = tx.wallet.toLowerCase();
      
      if (!walletValues.has(wallet)) {
        walletValues.set(wallet, {
          wallet,
          totalValue: 0,
          transactionCount: 0,
          firstTransaction: tx.timestamp,
          lastTransaction: tx.timestamp
        });
      }
      
      const walletData = walletValues.get(wallet);
      walletData.totalValue += tx.valueEth;
      walletData.transactionCount++;
      
      if (tx.timestamp < walletData.firstTransaction) {
        walletData.firstTransaction = tx.timestamp;
      }
      if (tx.timestamp > walletData.lastTransaction) {
        walletData.lastTransaction = tx.timestamp;
      }
    }

    // Sort by total value
    const sortedWallets = Array.from(walletValues.values())
      .sort((a, b) => b.totalValue - a.totalValue);

    // Get top 5%
    const whaleCount = Math.max(1, Math.ceil(sortedWallets.length * (1 - this.whalePercentile)));
    const whales = sortedWallets.slice(0, whaleCount);

    // Calculate threshold
    const whaleThreshold = whales.length > 0 ? whales[whales.length - 1].totalValue : 0;

    return whales.map(whale => ({
      ...whale,
      isWhale: true,
      whaleThreshold
    }));
  }

  /**
   * Calculate retention curves for whales vs regular users
   * @private
   */
  _calculateRetentionComparison(transactions, whales) {
    const whaleWallets = new Set(whales.map(w => w.wallet.toLowerCase()));
    
    // Separate transactions
    const whaleTxs = transactions.filter(tx => whaleWallets.has(tx.wallet.toLowerCase()));
    const regularTxs = transactions.filter(tx => !whaleWallets.has(tx.wallet.toLowerCase()));

    // Calculate retention for both groups
    const whaleRetention = this._calculateRetention(whaleTxs);
    const regularRetention = this._calculateRetention(regularTxs);

    return {
      whale: whaleRetention,
      regular: regularRetention,
      comparison: {
        retention7dDiff: whaleRetention.retention7d - regularRetention.retention7d,
        retention30dDiff: whaleRetention.retention30d - regularRetention.retention30d,
        retention90dDiff: whaleRetention.retention90d - regularRetention.retention90d
      }
    };
  }

  /**
   * Calculate retention metrics for a set of transactions
   * @private
   */
  _calculateRetention(transactions) {
    if (transactions.length === 0) {
      return {
        retention7d: 0,
        retention30d: 0,
        retention90d: 0,
        totalUsers: 0
      };
    }

    // Group by wallet
    const walletMap = new Map();
    
    for (const tx of transactions) {
      const wallet = tx.wallet.toLowerCase();
      
      if (!walletMap.has(wallet)) {
        walletMap.set(wallet, {
          firstSeen: tx.timestamp,
          lastSeen: tx.timestamp,
          transactions: []
        });
      }
      
      const walletData = walletMap.get(wallet);
      walletData.transactions.push(tx);
      
      if (tx.timestamp < walletData.firstSeen) {
        walletData.firstSeen = tx.timestamp;
      }
      if (tx.timestamp > walletData.lastSeen) {
        walletData.lastSeen = tx.timestamp;
      }
    }

    // Calculate retention
    const totalUsers = walletMap.size;
    let retained7d = 0;
    let retained30d = 0;
    let retained90d = 0;

    for (const [wallet, data] of walletMap) {
      const daysSinceFirst = (data.lastSeen - data.firstSeen) / (1000 * 60 * 60 * 24);
      
      if (daysSinceFirst >= 7) retained7d++;
      if (daysSinceFirst >= 30) retained30d++;
      if (daysSinceFirst >= 90) retained90d++;
    }

    return {
      retention7d: totalUsers > 0 ? retained7d / totalUsers : 0,
      retention30d: totalUsers > 0 ? retained30d / totalUsers : 0,
      retention90d: totalUsers > 0 ? retained90d / totalUsers : 0,
      totalUsers
    };
  }

  /**
   * Detect whale activity drops (50%+ decrease)
   * @private
   */
  _detectActivityDrops(transactions, whales) {
    const alerts = [];
    const now = new Date();
    const windowMs = this.activityWindowDays * 24 * 60 * 60 * 1000;

    for (const whale of whales) {
      const walletTxs = transactions
        .filter(tx => tx.wallet.toLowerCase() === whale.wallet.toLowerCase())
        .sort((a, b) => a.timestamp - b.timestamp);

      if (walletTxs.length < 2) continue;

      // Get recent and previous periods
      const recentStart = new Date(now.getTime() - windowMs);
      const previousStart = new Date(now.getTime() - 2 * windowMs);
      const previousEnd = recentStart;

      const recentTxs = walletTxs.filter(tx => tx.timestamp >= recentStart);
      const previousTxs = walletTxs.filter(tx => 
        tx.timestamp >= previousStart && tx.timestamp < previousEnd
      );

      if (previousTxs.length === 0) continue;

      // Calculate activity metrics
      const recentValue = recentTxs.reduce((sum, tx) => sum + tx.valueEth, 0);
      const previousValue = previousTxs.reduce((sum, tx) => sum + tx.valueEth, 0);
      
      const recentCount = recentTxs.length;
      const previousCount = previousTxs.length;

      // Check for drops
      const valueDrop = previousValue > 0 ? (previousValue - recentValue) / previousValue : 0;
      const countDrop = previousCount > 0 ? (previousCount - recentCount) / previousCount : 0;

      if (valueDrop >= this.activityDropThreshold || countDrop >= this.activityDropThreshold) {
        alerts.push({
          wallet: whale.wallet,
          alertType: 'activity_drop',
          severity: valueDrop > 0.75 || countDrop > 0.75 ? 'critical' : 'warning',
          metrics: {
            valueDrop: valueDrop * 100,
            countDrop: countDrop * 100,
            recentValue,
            previousValue,
            recentCount,
            previousCount
          },
          whaleData: {
            totalValue: whale.totalValue,
            transactionCount: whale.transactionCount
          }
        });
      }
    }

    // Sort by severity
    alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return b.metrics.valueDrop - a.metrics.valueDrop;
    });

    return alerts;
  }

  /**
   * Measure whale influence (% of total protocol value)
   * @private
   */
  _measureWhaleInfluence(transactions, whales) {
    const whaleWallets = new Set(whales.map(w => w.wallet.toLowerCase()));
    
    // Calculate totals
    const totalValue = transactions.reduce((sum, tx) => sum + tx.valueEth, 0);
    const totalTransactions = transactions.length;
    
    const whaleValue = transactions
      .filter(tx => whaleWallets.has(tx.wallet.toLowerCase()))
      .reduce((sum, tx) => sum + tx.valueEth, 0);
    
    const whaleTransactions = transactions
      .filter(tx => whaleWallets.has(tx.wallet.toLowerCase()))
      .length;

    return {
      valuePercentage: totalValue > 0 ? (whaleValue / totalValue) * 100 : 0,
      transactionPercentage: totalTransactions > 0 ? (whaleTransactions / totalTransactions) * 100 : 0,
      whaleValue,
      totalValue,
      whaleTransactions,
      totalTransactions,
      averageWhaleValue: whales.length > 0 ? whaleValue / whales.length : 0,
      averageRegularValue: (transactions.length - whaleTransactions) > 0
        ? (totalValue - whaleValue) / (transactions.length - whaleTransactions)
        : 0
    };
  }

  /**
   * Compare whale engagement across competitor protocols
   * @private
   */
  _compareWhaleEngagement(targetTxs, competitorTxs, whales) {
    const whaleWallets = new Set(whales.map(w => w.wallet.toLowerCase()));
    
    // Find whales in competitor transactions
    const competitorWhaleActivity = new Map();
    
    for (const tx of competitorTxs) {
      const wallet = tx.wallet.toLowerCase();
      
      if (whaleWallets.has(wallet)) {
        const protocol = tx.contractAddress.toLowerCase();
        
        if (!competitorWhaleActivity.has(protocol)) {
          competitorWhaleActivity.set(protocol, {
            protocol,
            whaleCount: new Set(),
            totalValue: 0,
            transactionCount: 0
          });
        }
        
        const activity = competitorWhaleActivity.get(protocol);
        activity.whaleCount.add(wallet);
        activity.totalValue += tx.valueEth;
        activity.transactionCount++;
      }
    }

    // Convert to array and calculate metrics
    const comparison = Array.from(competitorWhaleActivity.values()).map(activity => ({
      protocol: activity.protocol,
      whaleCount: activity.whaleCount.size,
      whalePercentage: (activity.whaleCount.size / whales.length) * 100,
      totalValue: activity.totalValue,
      transactionCount: activity.transactionCount,
      averageValuePerWhale: activity.whaleCount.size > 0 
        ? activity.totalValue / activity.whaleCount.size 
        : 0
    }));

    // Sort by whale count
    comparison.sort((a, b) => b.whaleCount - a.whaleCount);

    return {
      protocols: comparison,
      sharedWhales: comparison.reduce((sum, p) => sum + p.whaleCount, 0),
      exclusiveWhales: whales.length - comparison.reduce((sum, p) => sum + p.whaleCount, 0)
    };
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      whales: [],
      retentionComparison: {
        whale: { retention7d: 0, retention30d: 0, retention90d: 0, totalUsers: 0 },
        regular: { retention7d: 0, retention30d: 0, retention90d: 0, totalUsers: 0 },
        comparison: { retention7dDiff: 0, retention30dDiff: 0, retention90dDiff: 0 }
      },
      activityAlerts: [],
      whaleInfluence: {
        valuePercentage: 0,
        transactionPercentage: 0,
        whaleValue: 0,
        totalValue: 0,
        whaleTransactions: 0,
        totalTransactions: 0,
        averageWhaleValue: 0,
        averageRegularValue: 0
      },
      crossProtocolComparison: null,
      summary: {
        totalWhales: 0,
        whaleRetention: 0,
        regularRetention: 0,
        whaleValuePercentage: 0,
        activeAlerts: 0
      }
    };
  }
}

export default WhaleBehaviorAnalyzer;
