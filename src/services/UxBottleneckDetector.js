/**
 * UX Bottleneck Detector
 * 
 * Identifies friction points in user transaction flows including:
 * - Transaction completion times (session duration)
 * - Bottlenecks (function pairs with high abandonment)
 * - Failed transaction patterns
 * - Time-to-first-success for new users
 * - UX quality grading (A-F)
 */
export class UxBottleneckDetector {
  constructor(uxGradeThresholds = null) {
    // Default UX grade thresholds
    this.uxGradeThresholds = uxGradeThresholds || {
      A: { completionRate: 0.9, failureRate: 0.05, avgTimeMinutes: 10 },
      B: { completionRate: 0.8, failureRate: 0.1, avgTimeMinutes: 20 },
      C: { completionRate: 0.7, failureRate: 0.15, avgTimeMinutes: 30 },
      D: { completionRate: 0.6, failureRate: 0.2, avgTimeMinutes: 45 },
      F: { completionRate: 0, failureRate: 1, avgTimeMinutes: Infinity }
    };
    
    this.bottleneckThreshold = 0.3; // 30% abandonment rate
  }

  /**
   * Analyze all UX bottlenecks and metrics
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} UX bottleneck analysis
   */
  analyzeUxBottlenecks(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    const sessionDurations = this.calculateSessionDurations(transactions);
    const bottlenecks = this.detectBottlenecks(transactions);
    const failurePatterns = this._analyzeFailurePatterns(transactions);
    const timeToFirstSuccess = this._calculateTimeToFirstSuccess(transactions);
    const uxGrade = this.gradeUxQuality(transactions);

    return {
      sessionDurations,
      bottlenecks,
      failurePatterns,
      timeToFirstSuccess,
      uxGrade,
      summary: {
        totalSessions: sessionDurations.sessions.length,
        averageSessionDuration: sessionDurations.averageDuration,
        bottleneckCount: bottlenecks.length,
        overallCompletionRate: this._calculateCompletionRate(transactions),
        overallFailureRate: this._calculateFailureRate(transactions)
      }
    };
  }

  /**
   * Calculate transaction completion times (session durations)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Session duration statistics
   */
  calculateSessionDurations(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        sessions: [],
        averageDuration: 0,
        medianDuration: 0,
        minDuration: 0,
        maxDuration: 0
      };
    }

    // Group transactions by wallet
    const walletTransactions = this._groupByWallet(transactions);
    const sessions = [];

    for (const [wallet, txs] of walletTransactions) {
      // Filter out transactions with invalid timestamps and normalize them
      const validTxs = txs.filter(tx => {
        const timestamp = this._normalizeTimestamp(tx);
        return timestamp && !isNaN(timestamp.getTime());
      }).map(tx => ({
        ...tx,
        timestamp: this._normalizeTimestamp(tx)
      }));
      
      if (validTxs.length === 0) continue;
      
      // Sort by timestamp
      const sortedTxs = [...validTxs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      if (sortedTxs.length === 0) continue;

      // Calculate session duration (first to last transaction)
      const firstTx = sortedTxs[0];
      const lastTx = sortedTxs[sortedTxs.length - 1];
      const durationMs = lastTx.timestamp.getTime() - firstTx.timestamp.getTime();
      const durationMinutes = durationMs / (1000 * 60);

      sessions.push({
        wallet,
        firstTransaction: firstTx.timestamp,
        lastTransaction: lastTx.timestamp,
        durationMs,
        durationMinutes,
        transactionCount: sortedTxs.length,
        successfulTransactions: sortedTxs.filter(tx => tx.success || tx.status).length,
        failedTransactions: sortedTxs.filter(tx => !(tx.success || tx.status)).length
      });
    }

    // Calculate statistics
    const durations = sessions.map(s => s.durationMinutes);
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration = sortedDurations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : 0;

    return {
      sessions,
      averageDuration,
      medianDuration,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0
    };
  }

  /**
   * Detect bottlenecks (function pairs with >30% abandonment)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Detected bottlenecks
   */
  detectBottlenecks(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    // Group transactions by wallet to analyze sequences
    const walletTransactions = this._groupByWallet(transactions);
    const functionPairs = new Map(); // Map of "funcA->funcB" to stats
    const functionStarts = new Map(); // Track how many times each function was called

    // First pass: count all function calls
    for (const tx of transactions) {
      const func = tx.functionName || this._extractFunctionName(tx);
      functionStarts.set(func, (functionStarts.get(func) || 0) + 1);
    }

    // Second pass: analyze sequences
    for (const [wallet, txs] of walletTransactions) {
      // Normalize timestamps and sort
      const sortedTxs = [...txs].map(tx => ({
        ...tx,
        timestamp: this._normalizeTimestamp(tx),
        functionName: tx.functionName || this._extractFunctionName(tx)
      })).filter(tx => tx.timestamp && !isNaN(tx.timestamp.getTime()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Analyze consecutive function pairs
      for (let i = 0; i < sortedTxs.length - 1; i++) {
        const fromFunc = sortedTxs[i].functionName;
        const toFunc = sortedTxs[i + 1].functionName;
        const pairKey = `${fromFunc}->${toFunc}`;
        
        if (!functionPairs.has(pairKey)) {
          functionPairs.set(pairKey, {
            fromFunction: fromFunc,
            toFunction: toFunc,
            completedCount: 0,
            wallets: new Set()
          });
        }
        
        const pair = functionPairs.get(pairKey);
        pair.completedCount++;
        pair.wallets.add(wallet);
      }
    }

    // Calculate abandonment rates for all observed pairs
    const bottlenecks = [];
    const epsilon = 0.0001; // Tolerance for floating point comparison
    
    for (const [pairKey, stats] of functionPairs) {
      const fromCount = functionStarts.get(stats.fromFunction) || 0;
      
      if (fromCount === 0) continue;
      
      // Completion rate = how many times this specific transition happened / total times from function was called
      const completionRate = stats.completedCount / fromCount;
      const abandonmentRate = 1 - completionRate;
      
      // Only flag as bottleneck if abandonment rate EXCEEDS threshold (not equals)
      // Use epsilon for floating point comparison
      if (abandonmentRate > this.bottleneckThreshold + epsilon) {
        bottlenecks.push({
          fromFunction: stats.fromFunction,
          toFunction: stats.toFunction,
          abandonmentRate,
          completionRate,
          totalStarted: fromCount,
          completed: stats.completedCount,
          abandoned: fromCount - stats.completedCount,
          affectedUsers: stats.wallets.size
        });
      }
    }

    // Sort by abandonment rate (highest first)
    bottlenecks.sort((a, b) => b.abandonmentRate - a.abandonmentRate);

    return bottlenecks;
  }

  /**
   * Grade UX quality (A-F) based on metrics
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} UX grade and metrics
   */
  gradeUxQuality(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        grade: 'F',
        completionRate: 0,
        failureRate: 0,
        averageTransactionTime: 0,
        bottleneckCount: 0
      };
    }

    const completionRate = this._calculateCompletionRate(transactions);
    const failureRate = this._calculateFailureRate(transactions);
    const sessionDurations = this.calculateSessionDurations(transactions);
    const avgTimeMinutes = sessionDurations.averageDuration;
    const bottlenecks = this.detectBottlenecks(transactions);

    // Determine grade based on thresholds
    let grade = 'F';
    
    for (const [gradeLevel, thresholds] of Object.entries(this.uxGradeThresholds)) {
      if (gradeLevel === 'F') continue; // Skip F, it's the default
      
      if (completionRate >= thresholds.completionRate &&
          failureRate <= thresholds.failureRate &&
          avgTimeMinutes <= thresholds.avgTimeMinutes) {
        grade = gradeLevel;
        break; // Take the first (best) grade that matches
      }
    }

    return {
      grade,
      completionRate,
      failureRate,
      averageTransactionTime: avgTimeMinutes,
      bottleneckCount: bottlenecks.length,
      metrics: {
        totalTransactions: transactions.length,
        successfulTransactions: transactions.filter(tx => tx.success || tx.status).length,
        failedTransactions: transactions.filter(tx => !(tx.success || tx.status)).length,
        uniqueUsers: new Set(transactions.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet))).size
      }
    };
  }

  /**
   * Analyze failed transaction patterns
   * @private
   */
  _analyzeFailurePatterns(transactions) {
    const failedTxs = transactions.filter(tx => !(tx.success || tx.status));
    
    if (failedTxs.length === 0) {
      return {
        totalFailures: 0,
        failuresByFunction: [],
        failureSequences: []
      };
    }

    // Group failures by function
    const failuresByFunction = new Map();
    
    for (const tx of failedTxs) {
      const func = tx.functionName || this._extractFunctionName(tx);
      
      if (!failuresByFunction.has(func)) {
        failuresByFunction.set(func, {
          functionName: func,
          failureCount: 0,
          totalAttempts: 0,
          failureRate: 0
        });
      }
      
      failuresByFunction.get(func).failureCount++;
    }

    // Calculate total attempts per function
    for (const tx of transactions) {
      const func = tx.functionName || this._extractFunctionName(tx);
      
      if (failuresByFunction.has(func)) {
        failuresByFunction.get(func).totalAttempts++;
      }
    }

    // Calculate failure rates
    const failureFunctionStats = Array.from(failuresByFunction.values()).map(stats => ({
      ...stats,
      failureRate: stats.totalAttempts > 0 ? stats.failureCount / stats.totalAttempts : 0
    }));

    // Sort by failure count
    failureFunctionStats.sort((a, b) => b.failureCount - a.failureCount);

    // Analyze failure sequences (users who failed multiple times)
    const walletFailures = this._groupByWallet(failedTxs);
    const failureSequences = [];

    for (const [wallet, txs] of walletFailures) {
      if (txs.length >= 2) {
        const sortedTxs = [...txs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        failureSequences.push({
          wallet,
          failureCount: txs.length,
          functions: sortedTxs.map(tx => tx.functionName || this._extractFunctionName(tx)),
          firstFailure: sortedTxs[0].timestamp,
          lastFailure: sortedTxs[sortedTxs.length - 1].timestamp
        });
      }
    }

    // Sort by failure count
    failureSequences.sort((a, b) => b.failureCount - a.failureCount);

    return {
      totalFailures: failedTxs.length,
      failuresByFunction: failureFunctionStats,
      failureSequences: failureSequences.slice(0, 50) // Top 50
    };
  }

  /**
   * Calculate time-to-first-success for new users
   * @private
   */
  _calculateTimeToFirstSuccess(transactions) {
    const walletTransactions = this._groupByWallet(transactions);
    const timeToSuccess = [];

    for (const [wallet, txs] of walletTransactions) {
      const sortedTxs = [...txs].map(tx => ({
        ...tx,
        timestamp: this._normalizeTimestamp(tx),
        success: tx.success || tx.status
      })).filter(tx => tx.timestamp && !isNaN(tx.timestamp.getTime()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      if (sortedTxs.length === 0) continue;

      const firstTx = sortedTxs[0];
      const firstSuccess = sortedTxs.find(tx => tx.success);

      if (firstSuccess) {
        const timeMs = firstSuccess.timestamp.getTime() - firstTx.timestamp.getTime();
        const timeMinutes = timeMs / (1000 * 60);
        
        timeToSuccess.push({
          wallet,
          firstTransaction: firstTx.timestamp,
          firstSuccess: firstSuccess.timestamp,
          timeToSuccessMs: timeMs,
          timeToSuccessMinutes: timeMinutes,
          attemptsBeforeSuccess: sortedTxs.indexOf(firstSuccess) + 1
        });
      }
    }

    const times = timeToSuccess.map(t => t.timeToSuccessMinutes);
    const averageTime = times.length > 0 
      ? times.reduce((sum, t) => sum + t, 0) / times.length 
      : 0;

    return {
      users: timeToSuccess,
      averageTimeToSuccessMinutes: averageTime,
      medianTimeToSuccessMinutes: times.length > 0 
        ? [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)]
        : 0,
      usersWithSuccess: timeToSuccess.length,
      totalUsers: walletTransactions.size
    };
  }

  /**
   * Calculate completion rate
   * @private
   */
  _calculateCompletionRate(transactions) {
    if (transactions.length === 0) return 0;
    
    // Group by wallet and check if they completed a full flow
    const walletTransactions = this._groupByWallet(transactions);
    let completedUsers = 0;

    for (const [wallet, txs] of walletTransactions) {
      // Consider a user "completed" if they have at least one successful transaction
      const hasSuccess = txs.some(tx => tx.success || tx.status);
      if (hasSuccess) {
        completedUsers++;
      }
    }

    return completedUsers / walletTransactions.size;
  }

  /**
   * Calculate failure rate
   * @private
   */
  _calculateFailureRate(transactions) {
    if (transactions.length === 0) return 0;
    
    const failedCount = transactions.filter(tx => !(tx.success || tx.status)).length;
    return failedCount / transactions.length;
  }

  /**
   * Group transactions by wallet
   * @private
   */
  _groupByWallet(transactions) {
    const walletMap = new Map();

    for (const tx of transactions) {
      // Handle cases where from_address might be null/undefined
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (!wallet) {
        console.warn('Transaction missing wallet/from_address:', tx);
        continue;
      }
      
      const walletLower = wallet.toLowerCase();
      
      if (!walletMap.has(walletLower)) {
        walletMap.set(walletLower, []);
      }
      
      walletMap.get(walletLower).push(tx);
    }

    return walletMap;
  }

  /**
   * Get unique function names from transactions
   * @private
   */
  _getUniqueFunctions(transactions) {
    return [...new Set(transactions.map(tx => tx.functionName))];
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      sessionDurations: {
        sessions: [],
        averageDuration: 0,
        medianDuration: 0,
        minDuration: 0,
        maxDuration: 0
      },
      bottlenecks: [],
      failurePatterns: {
        totalFailures: 0,
        failuresByFunction: [],
        failureSequences: []
      },
      timeToFirstSuccess: {
        users: [],
        averageTimeToSuccessMinutes: 0,
        medianTimeToSuccessMinutes: 0,
        usersWithSuccess: 0,
        totalUsers: 0
      },
      uxGrade: {
        grade: 'F',
        completionRate: 0,
        failureRate: 0,
        averageTransactionTime: 0,
        bottleneckCount: 0
      },
      summary: {
        totalSessions: 0,
        averageSessionDuration: 0,
        bottleneckCount: 0,
        overallCompletionRate: 0,
        overallFailureRate: 0
      }
    };
  }

  /**
   * Normalize timestamp to Date object
   * @private
   */
  _normalizeTimestamp(tx) {
    // Try different timestamp fields
    const timestamp = tx.timestamp || tx.block_timestamp || tx.blockTimestamp;
    
    if (!timestamp) return null;
    
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    
    if (typeof timestamp === 'number') {
      // Handle both seconds and milliseconds
      const date = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  }

  /**
   * Extract function name from transaction
   * @private
   */
  _extractFunctionName(tx) {
    if (tx.functionName) return tx.functionName;
    if (tx.function_name) return tx.function_name;
    if (tx.method_id) return tx.method_id;
    if (tx.methodId) return tx.methodId;
    return 'unknown';
  }
}

export default UxBottleneckDetector;
