/**
 * Smart Contract Upgrade Impact Analyzer
 * 
 * Analyzes the impact of smart contract upgrades including:
 * - Upgrade event detection (function signature or address changes)
 * - Before/after metrics comparison (30 days)
 * - User response measurement (activity changes)
 * - New function adoption rate tracking
 * - Upgrade-related issue detection (failure rates, churn)
 */
export class UpgradeImpactAnalyzer {
  constructor() {
    this.comparisonWindowDays = 30; // Compare 30 days before/after
    this.adoptionTrackingDays = 90; // Track adoption for 90 days
  }

  /**
   * Analyze upgrade impact
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {Array<Object>} upgradeEvents - Array of known upgrade events
   * @returns {Object} Upgrade impact analysis
   */
  analyzeUpgradeImpact(transactions, upgradeEvents = null) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    // Detect upgrades if not provided
    const detectedUpgrades = upgradeEvents || this.detectUpgradeEvents(transactions);
    
    if (detectedUpgrades.length === 0) {
      return this._getEmptyAnalysis();
    }

    const impactAnalyses = detectedUpgrades.map(upgrade => 
      this._analyzeUpgrade(transactions, upgrade)
    );

    return {
      upgrades: detectedUpgrades,
      impactAnalyses,
      summary: {
        totalUpgrades: detectedUpgrades.length,
        averageUserResponseRate: this._calculateAverageResponse(impactAnalyses),
        upgradesWithIssues: impactAnalyses.filter(a => a.issues.length > 0).length
      }
    };
  }

  /**
   * Detect upgrade events from transaction patterns
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Detected upgrade events
   */
  detectUpgradeEvents(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    const upgrades = [];
    
    // Sort transactions by timestamp
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    
    // Track function signatures over time
    const functionsByDay = new Map();
    
    for (const tx of sortedTxs) {
      const dayKey = tx.timestamp.toISOString().split('T')[0];
      
      if (!functionsByDay.has(dayKey)) {
        functionsByDay.set(dayKey, new Set());
      }
      
      functionsByDay.get(dayKey).add(tx.functionSignature);
    }

    // Convert to array and look for significant changes
    const days = Array.from(functionsByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    for (let i = 1; i < days.length; i++) {
      const [currentDay, currentFunctions] = days[i];
      const [previousDay, previousFunctions] = days[i - 1];
      
      // Check for new functions
      const newFunctions = Array.from(currentFunctions)
        .filter(f => !previousFunctions.has(f));
      
      // Check for removed functions
      const removedFunctions = Array.from(previousFunctions)
        .filter(f => !currentFunctions.has(f));

      // If significant changes detected, mark as potential upgrade
      if (newFunctions.length > 0 || removedFunctions.length > 0) {
        upgrades.push({
          date: new Date(currentDay),
          type: 'function_change',
          newFunctions,
          removedFunctions,
          detectionMethod: 'automatic'
        });
      }
    }

    // Filter to significant upgrades (avoid minor changes)
    return upgrades.filter(u => 
      u.newFunctions.length >= 1 || u.removedFunctions.length >= 2
    );
  }

  /**
   * Analyze a single upgrade
   * @private
   */
  _analyzeUpgrade(transactions, upgrade) {
    const upgradeDate = upgrade.date;
    const windowMs = this.comparisonWindowDays * 24 * 60 * 60 * 1000;

    // Split transactions into before/after periods
    const beforeStart = new Date(upgradeDate.getTime() - windowMs);
    const afterEnd = new Date(upgradeDate.getTime() + windowMs);

    const beforeTxs = transactions.filter(tx => 
      tx.timestamp >= beforeStart && tx.timestamp < upgradeDate
    );
    
    const afterTxs = transactions.filter(tx => 
      tx.timestamp >= upgradeDate && tx.timestamp < afterEnd
    );

    // Compare metrics
    const metricsComparison = this._compareMetrics(beforeTxs, afterTxs);
    
    // Measure user response
    const userResponse = this._measureUserResponse(beforeTxs, afterTxs);
    
    // Track new function adoption
    const adoption = this._trackFunctionAdoption(afterTxs, upgrade.newFunctions || []);
    
    // Detect issues
    const issues = this._detectUpgradeIssues(beforeTxs, afterTxs, metricsComparison);

    return {
      upgrade,
      metricsComparison,
      userResponse,
      adoption,
      issues,
      summary: {
        overallImpact: this._calculateOverallImpact(metricsComparison, userResponse),
        hasIssues: issues.length > 0,
        adoptionRate: adoption.overallAdoptionRate
      }
    };
  }

  /**
   * Compare metrics before and after upgrade
   * @private
   */
  _compareMetrics(beforeTxs, afterTxs) {
    const beforeMetrics = this._calculateMetrics(beforeTxs);
    const afterMetrics = this._calculateMetrics(afterTxs);

    return {
      before: beforeMetrics,
      after: afterMetrics,
      changes: {
        transactionCount: this._calculateChange(beforeMetrics.transactionCount, afterMetrics.transactionCount),
        uniqueUsers: this._calculateChange(beforeMetrics.uniqueUsers, afterMetrics.uniqueUsers),
        totalValue: this._calculateChange(beforeMetrics.totalValue, afterMetrics.totalValue),
        failureRate: this._calculateChange(beforeMetrics.failureRate, afterMetrics.failureRate),
        avgGasCost: this._calculateChange(beforeMetrics.avgGasCost, afterMetrics.avgGasCost)
      }
    };
  }

  /**
   * Calculate metrics for a set of transactions
   * @private
   */
  _calculateMetrics(transactions) {
    if (transactions.length === 0) {
      return {
        transactionCount: 0,
        uniqueUsers: 0,
        totalValue: 0,
        failureRate: 0,
        avgGasCost: 0
      };
    }

    const uniqueUsers = new Set(transactions.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase())).size;
    const totalValue = transactions.reduce((sum, tx) => sum + tx.valueEth, 0);
    const failedCount = transactions.filter(tx => !tx.success).length;
    const failureRate = failedCount / transactions.length;
    const avgGasCost = transactions.reduce((sum, tx) => sum + tx.gasCostEth, 0) / transactions.length;

    return {
      transactionCount: transactions.length,
      uniqueUsers,
      totalValue,
      failureRate,
      avgGasCost
    };
  }

  /**
   * Calculate percentage change
   * @private
   */
  _calculateChange(before, after) {
    if (before === 0) return after > 0 ? 100 : 0;
    return ((after - before) / before) * 100;
  }

  /**
   * Measure user response to upgrade
   * @private
   */
  _measureUserResponse(beforeTxs, afterTxs) {
    const beforeUsers = new Set(beforeTxs.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase()));
    const afterUsers = new Set(afterTxs.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase()));

    // Calculate user retention
    const retainedUsers = Array.from(beforeUsers).filter(u => afterUsers.has(u));
    const newUsers = Array.from(afterUsers).filter(u => !beforeUsers.has(u));
    const churnedUsers = Array.from(beforeUsers).filter(u => !afterUsers.has(u));

    const retentionRate = beforeUsers.size > 0 ? retainedUsers.length / beforeUsers.size : 0;
    const churnRate = beforeUsers.size > 0 ? churnedUsers.length / beforeUsers.size : 0;

    // Calculate activity changes for retained users
    const activityChanges = retainedUsers.map(walletAddr => {
      const beforeCount = beforeTxs.filter(tx => {
        const wallet = tx.from_address || tx.wallet;
        return wallet && wallet.toLowerCase() === walletAddr;
      }).length;
      const afterCount = afterTxs.filter(tx => {
        const wallet = tx.from_address || tx.wallet;
        return wallet && wallet.toLowerCase() === walletAddr;
      }).length;
      
      return {
        wallet: walletAddr,
        beforeCount,
        afterCount,
        change: this._calculateChange(beforeCount, afterCount)
      };
    });

    const avgActivityChange = activityChanges.length > 0
      ? activityChanges.reduce((sum, u) => sum + u.change, 0) / activityChanges.length
      : 0;

    return {
      retainedUsers: retainedUsers.length,
      newUsers: newUsers.length,
      churnedUsers: churnedUsers.length,
      retentionRate,
      churnRate,
      avgActivityChange,
      activityDistribution: {
        increased: activityChanges.filter(u => u.change > 10).length,
        stable: activityChanges.filter(u => u.change >= -10 && u.change <= 10).length,
        decreased: activityChanges.filter(u => u.change < -10).length
      }
    };
  }

  /**
   * Track new function adoption rates
   * @private
   */
  _trackFunctionAdoption(afterTxs, newFunctions) {
    if (newFunctions.length === 0) {
      return {
        newFunctions: [],
        overallAdoptionRate: 0
      };
    }

    const totalUsers = new Set(afterTxs.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase())).size;
    
    const adoptionByFunction = newFunctions.map(funcSig => {
      const funcTxs = afterTxs.filter(tx => tx.functionSignature === funcSig);
      const funcUsers = new Set(funcTxs.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase())).size;
      
      return {
        functionSignature: funcSig,
        transactionCount: funcTxs.length,
        uniqueUsers: funcUsers,
        adoptionRate: totalUsers > 0 ? funcUsers / totalUsers : 0,
        avgUsagePerUser: funcUsers > 0 ? funcTxs.length / funcUsers : 0
      };
    });

    const overallAdoptionRate = adoptionByFunction.length > 0
      ? adoptionByFunction.reduce((sum, f) => sum + f.adoptionRate, 0) / adoptionByFunction.length
      : 0;

    return {
      newFunctions: adoptionByFunction,
      overallAdoptionRate
    };
  }

  /**
   * Detect upgrade-related issues
   * @private
   */
  _detectUpgradeIssues(beforeTxs, afterTxs, metricsComparison) {
    const issues = [];

    // Check for failure rate increase
    if (metricsComparison.changes.failureRate > 50) {
      issues.push({
        type: 'failure_rate_increase',
        severity: 'high',
        description: `Failure rate increased by ${metricsComparison.changes.failureRate.toFixed(1)}%`,
        beforeValue: metricsComparison.before.failureRate,
        afterValue: metricsComparison.after.failureRate
      });
    }

    // Check for significant user churn
    const beforeUsers = new Set(beforeTxs.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase())).size;
    const afterUsers = new Set(afterTxs.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase())).size;
    const userChange = this._calculateChange(beforeUsers, afterUsers);
    
    if (userChange < -20) {
      issues.push({
        type: 'user_churn',
        severity: 'high',
        description: `User count decreased by ${Math.abs(userChange).toFixed(1)}%`,
        beforeValue: beforeUsers,
        afterValue: afterUsers
      });
    }

    // Check for transaction volume drop
    if (metricsComparison.changes.transactionCount < -30) {
      issues.push({
        type: 'volume_drop',
        severity: 'medium',
        description: `Transaction volume decreased by ${Math.abs(metricsComparison.changes.transactionCount).toFixed(1)}%`,
        beforeValue: metricsComparison.before.transactionCount,
        afterValue: metricsComparison.after.transactionCount
      });
    }

    // Check for gas cost spike
    if (metricsComparison.changes.avgGasCost > 50) {
      issues.push({
        type: 'gas_cost_spike',
        severity: 'medium',
        description: `Average gas cost increased by ${metricsComparison.changes.avgGasCost.toFixed(1)}%`,
        beforeValue: metricsComparison.before.avgGasCost,
        afterValue: metricsComparison.after.avgGasCost
      });
    }

    return issues;
  }

  /**
   * Calculate overall impact score
   * @private
   */
  _calculateOverallImpact(metricsComparison, userResponse) {
    // Positive factors
    let positiveScore = 0;
    if (metricsComparison.changes.transactionCount > 0) positiveScore += 20;
    if (metricsComparison.changes.uniqueUsers > 0) positiveScore += 20;
    if (metricsComparison.changes.totalValue > 0) positiveScore += 20;
    if (userResponse.avgActivityChange > 0) positiveScore += 20;
    if (userResponse.retentionRate > 0.8) positiveScore += 20;

    // Negative factors
    let negativeScore = 0;
    if (metricsComparison.changes.failureRate > 20) negativeScore += 30;
    if (userResponse.churnRate > 0.3) negativeScore += 30;
    if (metricsComparison.changes.transactionCount < -20) negativeScore += 20;
    if (metricsComparison.changes.avgGasCost > 30) negativeScore += 20;

    const netScore = positiveScore - negativeScore;

    if (netScore > 50) return 'very_positive';
    if (netScore > 20) return 'positive';
    if (netScore > -20) return 'neutral';
    if (netScore > -50) return 'negative';
    return 'very_negative';
  }

  /**
   * Calculate average user response rate
   * @private
   */
  _calculateAverageResponse(impactAnalyses) {
    if (impactAnalyses.length === 0) return 0;
    
    const avgRetention = impactAnalyses.reduce((sum, a) => 
      sum + a.userResponse.retentionRate, 0
    ) / impactAnalyses.length;

    return avgRetention;
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      upgrades: [],
      impactAnalyses: [],
      summary: {
        totalUpgrades: 0,
        averageUserResponseRate: 0,
        upgradesWithIssues: 0
      }
    };
  }
}

export default UpgradeImpactAnalyzer;
