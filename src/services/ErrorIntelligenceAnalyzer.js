/**
 * Transaction Error Intelligence Analyzer
 * 
 * Analyzes transaction failures to identify patterns and issues:
 * - Failure grouping by function signature with trend analysis
 * - Comparison of successful vs failed transaction characteristics
 * - Systematic failure detection (>10% failure rate + increasing)
 * - User failure sequence tracking
 * - Out-of-gas error detection and gas limit recommendations
 */
export class ErrorIntelligenceAnalyzer {
  constructor() {
    this.systematicFailureThreshold = 0.1; // 10% failure rate
    this.outOfGasMargin = 1.2; // Recommend 20% more gas
  }

  /**
   * Analyze transaction errors and failures
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Error intelligence analysis
   */
  analyzeErrors(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    const failuresByFunction = this._groupFailuresByFunction(transactions);
    const successVsFailure = this._compareSuccessVsFailure(transactions);
    const systematicFailures = this.detectSystematicFailures(failuresByFunction);
    const userFailureSequences = this._trackUserFailureSequences(transactions);
    const outOfGasErrors = this._detectOutOfGasErrors(transactions);

    return {
      failuresByFunction,
      successVsFailure,
      systematicFailures,
      userFailureSequences,
      outOfGasErrors,
      summary: {
        totalTransactions: transactions.length,
        totalFailures: transactions.filter(tx => !tx.success).length,
        overallFailureRate: this._calculateFailureRate(transactions),
        systematicFailureCount: systematicFailures.length,
        outOfGasCount: outOfGasErrors.length
      }
    };
  }

  /**
   * Detect systematic failures (>10% failure rate + increasing)
   * @param {Array<Object>} failuresByFunction - Failure data by function
   * @returns {Array<Object>} Systematic failures
   */
  detectSystematicFailures(failuresByFunction) {
    const systematicFailures = [];

    for (const funcData of failuresByFunction) {
      const failureRate = funcData.failureRate;
      const trend = funcData.trend;

      // Systematic if failure rate > 10% AND increasing
      if (failureRate > this.systematicFailureThreshold && trend === 'increasing') {
        systematicFailures.push({
          functionName: funcData.functionName,
          failureRate,
          failureCount: funcData.failureCount,
          totalAttempts: funcData.totalAttempts,
          trend,
          recentFailureRate: funcData.recentFailureRate,
          severity: this._calculateSeverity(failureRate, funcData.failureCount)
        });
      }
    }

    // Sort by severity (highest first)
    systematicFailures.sort((a, b) => b.severity - a.severity);

    return systematicFailures;
  }

  /**
   * Group failures by function signature with trend analysis
   * @private
   */
  _groupFailuresByFunction(transactions) {
    const functionMap = new Map();

    // Group all transactions by function
    for (const tx of transactions) {
      const func = tx.functionName;
      
      if (!functionMap.has(func)) {
        functionMap.set(func, {
          functionName: func,
          totalAttempts: 0,
          failureCount: 0,
          successCount: 0,
          transactions: []
        });
      }

      const funcData = functionMap.get(func);
      funcData.totalAttempts++;
      funcData.transactions.push(tx);
      
      if (tx.success) {
        funcData.successCount++;
      } else {
        funcData.failureCount++;
      }
    }

    // Calculate failure rates and trends
    const results = [];
    
    for (const [func, data] of functionMap) {
      const failureRate = data.totalAttempts > 0 
        ? data.failureCount / data.totalAttempts 
        : 0;

      // Calculate trend (compare recent vs historical)
      const trend = this._calculateTrend(data.transactions);
      const recentFailureRate = this._calculateRecentFailureRate(data.transactions);

      results.push({
        functionName: func,
        totalAttempts: data.totalAttempts,
        failureCount: data.failureCount,
        successCount: data.successCount,
        failureRate,
        recentFailureRate,
        trend
      });
    }

    // Sort by failure count (highest first)
    results.sort((a, b) => b.failureCount - a.failureCount);

    return results;
  }

  /**
   * Compare successful vs failed transaction characteristics
   * @private
   */
  _compareSuccessVsFailure(transactions) {
    const successful = transactions.filter(tx => tx.success);
    const failed = transactions.filter(tx => !tx.success);

    if (successful.length === 0 || failed.length === 0) {
      return null;
    }

    // Compare gas limits
    const successGasAvg = this._calculateAverage(successful.map(tx => tx.gasUsed));
    const failedGasAvg = this._calculateAverage(failed.map(tx => tx.gasUsed));

    // Compare gas prices
    const successGasPriceAvg = this._calculateAverage(successful.map(tx => tx.gasPrice));
    const failedGasPriceAvg = this._calculateAverage(failed.map(tx => tx.gasPrice));

    // Compare transaction values
    const successValueAvg = this._calculateAverage(successful.map(tx => tx.valueEth));
    const failedValueAvg = this._calculateAverage(failed.map(tx => tx.valueEth));

    return {
      gasUsed: {
        successful: successGasAvg,
        failed: failedGasAvg,
        difference: successGasAvg - failedGasAvg,
        percentDifference: failedGasAvg > 0 
          ? ((successGasAvg - failedGasAvg) / failedGasAvg) * 100 
          : 0
      },
      gasPrice: {
        successful: successGasPriceAvg,
        failed: failedGasPriceAvg,
        difference: successGasPriceAvg - failedGasPriceAvg,
        percentDifference: failedGasPriceAvg > 0 
          ? ((successGasPriceAvg - failedGasPriceAvg) / failedGasPriceAvg) * 100 
          : 0
      },
      value: {
        successful: successValueAvg,
        failed: failedValueAvg,
        difference: successValueAvg - failedValueAvg,
        percentDifference: failedValueAvg > 0 
          ? ((successValueAvg - failedValueAvg) / failedValueAvg) * 100 
          : 0
      }
    };
  }

  /**
   * Track user failure sequences
   * @private
   */
  _trackUserFailureSequences(transactions) {
    const walletMap = new Map();

    // Group by wallet
    for (const tx of transactions) {
      const wallet = tx.wallet.toLowerCase();
      
      if (!walletMap.has(wallet)) {
        walletMap.set(wallet, []);
      }
      
      walletMap.get(wallet).push(tx);
    }

    const sequences = [];

    // Analyze each wallet's failure patterns
    for (const [wallet, txs] of walletMap) {
      const sortedTxs = [...txs].sort((a, b) => a.timestamp - b.timestamp);
      const failures = sortedTxs.filter(tx => !tx.success);

      if (failures.length >= 2) {
        // Look for consecutive failures
        let consecutiveFailures = [];
        
        for (let i = 0; i < sortedTxs.length; i++) {
          if (!sortedTxs[i].success) {
            consecutiveFailures.push(sortedTxs[i]);
          } else if (consecutiveFailures.length >= 2) {
            // Record the sequence
            sequences.push({
              wallet,
              failureCount: consecutiveFailures.length,
              functions: consecutiveFailures.map(tx => tx.functionName),
              firstFailure: consecutiveFailures[0].timestamp,
              lastFailure: consecutiveFailures[consecutiveFailures.length - 1].timestamp
            });
            consecutiveFailures = [];
          } else {
            consecutiveFailures = [];
          }
        }

        // Check if sequence extends to end
        if (consecutiveFailures.length >= 2) {
          sequences.push({
            wallet,
            failureCount: consecutiveFailures.length,
            functions: consecutiveFailures.map(tx => tx.functionName),
            firstFailure: consecutiveFailures[0].timestamp,
            lastFailure: consecutiveFailures[consecutiveFailures.length - 1].timestamp
          });
        }
      }
    }

    // Sort by failure count (highest first)
    sequences.sort((a, b) => b.failureCount - a.failureCount);

    return sequences.slice(0, 50); // Top 50
  }

  /**
   * Detect out-of-gas errors and recommend gas limits
   * @private
   */
  _detectOutOfGasErrors(transactions) {
    const outOfGasErrors = [];
    const functionGasUsage = new Map();

    // Collect gas usage by function
    for (const tx of transactions) {
      const func = tx.functionName;
      
      if (!functionGasUsage.has(func)) {
        functionGasUsage.set(func, {
          successful: [],
          failed: []
        });
      }

      const usage = functionGasUsage.get(func);
      if (tx.success) {
        usage.successful.push(tx.gasUsed);
      } else {
        usage.failed.push(tx.gasUsed);
      }
    }

    // Analyze each function
    for (const [func, usage] of functionGasUsage) {
      if (usage.failed.length > 0 && usage.successful.length > 0) {
        const avgSuccessGas = this._calculateAverage(usage.successful);
        const maxSuccessGas = Math.max(...usage.successful);
        const avgFailedGas = this._calculateAverage(usage.failed);

        // Likely out-of-gas if failed transactions used less gas
        if (avgFailedGas < avgSuccessGas * 0.9) {
          const recommendedGas = Math.ceil(maxSuccessGas * this.outOfGasMargin);
          
          outOfGasErrors.push({
            functionName: func,
            failureCount: usage.failed.length,
            averageSuccessfulGas: avgSuccessGas,
            averageFailedGas: avgFailedGas,
            recommendedGasLimit: recommendedGas,
            description: `Failed transactions used ${((avgFailedGas / avgSuccessGas) * 100).toFixed(1)}% of successful gas`
          });
        }
      }
    }

    return outOfGasErrors;
  }

  /**
   * Calculate trend (increasing, decreasing, stable)
   * @private
   */
  _calculateTrend(transactions) {
    if (transactions.length < 4) return 'stable';

    // Sort by timestamp
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    
    // Split into two halves
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    // Calculate failure rates
    const firstHalfFailureRate = this._calculateFailureRate(firstHalf);
    const secondHalfFailureRate = this._calculateFailureRate(secondHalf);

    // Determine trend
    const difference = secondHalfFailureRate - firstHalfFailureRate;
    
    if (difference > 0.05) return 'increasing';
    if (difference < -0.05) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate recent failure rate (last 25% of transactions)
   * @private
   */
  _calculateRecentFailureRate(transactions) {
    if (transactions.length === 0) return 0;

    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const recentCount = Math.max(1, Math.floor(sorted.length * 0.25));
    const recent = sorted.slice(-recentCount);

    return this._calculateFailureRate(recent);
  }

  /**
   * Calculate failure rate
   * @private
   */
  _calculateFailureRate(transactions) {
    if (transactions.length === 0) return 0;
    
    const failures = transactions.filter(tx => !tx.success).length;
    return failures / transactions.length;
  }

  /**
   * Calculate severity score
   * @private
   */
  _calculateSeverity(failureRate, failureCount) {
    // Severity based on both rate and absolute count
    const rateSeverity = failureRate * 50; // 0-50 points
    const countSeverity = Math.min(50, failureCount / 10); // 0-50 points
    
    return rateSeverity + countSeverity;
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
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      failuresByFunction: [],
      successVsFailure: null,
      systematicFailures: [],
      userFailureSequences: [],
      outOfGasErrors: [],
      summary: {
        totalTransactions: 0,
        totalFailures: 0,
        overallFailureRate: 0,
        systematicFailureCount: 0,
        outOfGasCount: 0
      }
    };
  }
}

export default ErrorIntelligenceAnalyzer;
