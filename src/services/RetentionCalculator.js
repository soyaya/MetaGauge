/**
 * Retention Calculator
 * 
 * Calculates cohort-based retention and identifies churned users.
 * Groups users by first interaction date and tracks return rates over time.
 */
export class RetentionCalculator {
  constructor() {
    this.cohorts = new Map();
  }

  /**
   * Calculate cohort retention rates
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {number} cohortPeriodDays - Days to group cohorts (default: 7 for weekly)
   * @returns {Array<Object>} Cohort retention data
   */
  calculateCohortRetention(transactions, cohortPeriodDays = 7) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    // Group users by first interaction date
    const userFirstSeen = this._getUserFirstSeen(transactions);
    const cohorts = this._groupIntoCohorts(userFirstSeen, cohortPeriodDays);
    
    // Calculate retention for each cohort
    const cohortRetention = [];
    
    for (const [cohortKey, users] of cohorts) {
      const cohortStartDate = new Date(cohortKey);
      const retention = this._calculateRetentionForCohort(
        users,
        cohortStartDate,
        transactions
      );
      
      cohortRetention.push({
        cohortStartDate,
        cohortSize: users.size,
        users: Array.from(users),
        retention
      });
    }
    
    // Sort by cohort start date
    cohortRetention.sort((a, b) => a.cohortStartDate.getTime() - b.cohortStartDate.getTime());
    
    return cohortRetention;
  }

  /**
   * Identify churned users (no activity for threshold days)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {number} churnThresholdDays - Days of inactivity to consider churned (default: 30)
   * @returns {Array<Object>} Churned user data
   */
  identifyChurnedUsers(transactions, churnThresholdDays = 30) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    const now = new Date();
    const churnThresholdMs = churnThresholdDays * 24 * 60 * 60 * 1000;
    
    // Get last seen date for each user
    const userLastSeen = this._getUserLastSeen(transactions);
    const userFirstSeen = this._getUserFirstSeen(transactions);
    
    const churnedUsers = [];
    
    for (const [wallet, lastSeenDate] of userLastSeen) {
      const daysSinceLastSeen = (now.getTime() - lastSeenDate.getTime()) / (24 * 60 * 60 * 1000);
      
      if (daysSinceLastSeen > churnThresholdDays) {
        const firstSeenDate = userFirstSeen.get(wallet);
        const lifetimeDays = (lastSeenDate.getTime() - firstSeenDate.getTime()) / (24 * 60 * 60 * 1000);
        
        // Count user's transactions
        const userTxs = transactions.filter(tx => tx.wallet === wallet);
        
        churnedUsers.push({
          wallet,
          firstSeen: firstSeenDate,
          lastSeen: lastSeenDate,
          daysSinceLastSeen,
          lifetimeDays,
          totalTransactions: userTxs.length,
          churnedAt: new Date(lastSeenDate.getTime() + churnThresholdMs)
        });
      }
    }
    
    // Sort by days since last seen (most churned first)
    churnedUsers.sort((a, b) => b.daysSinceLastSeen - a.daysSinceLastSeen);
    
    return churnedUsers;
  }

  /**
   * Calculate retention curves for cohort comparison
   * @param {Array<Object>} cohorts - Array of cohort retention data
   * @returns {Array<Object>} Retention curve data
   */
  calculateRetentionCurves(cohorts) {
    if (!Array.isArray(cohorts) || cohorts.length === 0) {
      return [];
    }

    const curves = cohorts.map(cohort => ({
      cohortStartDate: cohort.cohortStartDate,
      cohortSize: cohort.cohortSize,
      curve: [
        { day: 0, retention: 1.0, retainedUsers: cohort.cohortSize },
        { day: 7, retention: cohort.retention.day7, retainedUsers: Math.round(cohort.cohortSize * cohort.retention.day7) },
        { day: 14, retention: cohort.retention.day14, retainedUsers: Math.round(cohort.cohortSize * cohort.retention.day14) },
        { day: 30, retention: cohort.retention.day30, retainedUsers: Math.round(cohort.cohortSize * cohort.retention.day30) },
        { day: 60, retention: cohort.retention.day60, retainedUsers: Math.round(cohort.cohortSize * cohort.retention.day60) },
        { day: 90, retention: cohort.retention.day90, retainedUsers: Math.round(cohort.cohortSize * cohort.retention.day90) }
      ]
    }));

    return curves;
  }

  /**
   * Detect reactivation events (churned users returning)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {number} churnThresholdDays - Days of inactivity to consider churned
   * @returns {Array<Object>} Reactivation events
   */
  detectReactivations(transactions, churnThresholdDays = 30) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    // Group transactions by wallet
    const walletTransactions = new Map();
    for (const tx of transactions) {
      if (!walletTransactions.has(tx.wallet)) {
        walletTransactions.set(tx.wallet, []);
      }
      walletTransactions.get(tx.wallet).push(tx);
    }

    const reactivations = [];
    const churnThresholdMs = churnThresholdDays * 24 * 60 * 60 * 1000;

    for (const [wallet, txs] of walletTransactions) {
      // Sort by timestamp
      const sortedTxs = [...txs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Look for gaps larger than churn threshold
      for (let i = 1; i < sortedTxs.length; i++) {
        const gap = sortedTxs[i].timestamp.getTime() - sortedTxs[i - 1].timestamp.getTime();
        const gapDays = gap / (24 * 60 * 60 * 1000);
        
        if (gapDays > churnThresholdDays) {
          reactivations.push({
            wallet,
            churnedAfter: sortedTxs[i - 1].timestamp,
            reactivatedAt: sortedTxs[i].timestamp,
            gapDays,
            transactionsBeforeChurn: i,
            transactionsAfterReactivation: sortedTxs.length - i
          });
        }
      }
    }

    return reactivations;
  }

  /**
   * Get first seen date for each user
   * @private
   */
  _getUserFirstSeen(transactions) {
    const userFirstSeen = new Map();
    
    for (const tx of transactions) {
      const wallet = tx.wallet;
      const currentFirst = userFirstSeen.get(wallet);
      
      if (!currentFirst || tx.timestamp < currentFirst) {
        userFirstSeen.set(wallet, tx.timestamp);
      }
    }
    
    return userFirstSeen;
  }

  /**
   * Get last seen date for each user
   * @private
   */
  _getUserLastSeen(transactions) {
    const userLastSeen = new Map();
    
    for (const tx of transactions) {
      const wallet = tx.wallet;
      const currentLast = userLastSeen.get(wallet);
      
      if (!currentLast || tx.timestamp > currentLast) {
        userLastSeen.set(wallet, tx.timestamp);
      }
    }
    
    return userLastSeen;
  }

  /**
   * Group users into cohorts by first interaction date
   * @private
   */
  _groupIntoCohorts(userFirstSeen, cohortPeriodDays) {
    const cohorts = new Map();
    const periodMs = cohortPeriodDays * 24 * 60 * 60 * 1000;
    
    for (const [wallet, firstSeen] of userFirstSeen) {
      // Skip invalid dates
      if (!firstSeen || isNaN(firstSeen.getTime())) {
        continue;
      }
      
      // Calculate cohort start date (beginning of period)
      const cohortStart = new Date(
        Math.floor(firstSeen.getTime() / periodMs) * periodMs
      );
      const cohortKey = cohortStart.toISOString();
      
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, new Set());
      }
      
      cohorts.get(cohortKey).add(wallet);
    }
    
    return cohorts;
  }

  /**
   * Calculate retention rates for a specific cohort
   * @private
   */
  _calculateRetentionForCohort(users, cohortStartDate, transactions) {
    const retentionWindows = [7, 14, 30, 60, 90];
    const retention = {};
    
    for (const window of retentionWindows) {
      const windowStart = new Date(cohortStartDate.getTime() + window * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day window
      
      let activeUsers = 0;
      
      for (const wallet of users) {
        // Check if user had any transactions in the window
        const hasActivity = transactions.some(tx => 
          tx.wallet === wallet &&
          tx.timestamp >= windowStart &&
          tx.timestamp < windowEnd
        );
        
        if (hasActivity) {
          activeUsers++;
        }
      }
      
      retention[`day${window}`] = users.size > 0 ? activeUsers / users.size : 0;
    }
    
    return retention;
  }

  /**
   * Calculate average retention across all cohorts
   * @param {Array<Object>} cohorts - Array of cohort retention data
   * @returns {Object} Average retention rates
   */
  calculateAverageRetention(cohorts) {
    if (!Array.isArray(cohorts) || cohorts.length === 0) {
      return {
        day7: 0,
        day14: 0,
        day30: 0,
        day60: 0,
        day90: 0
      };
    }

    const windows = ['day7', 'day14', 'day30', 'day60', 'day90'];
    const averages = {};
    
    for (const window of windows) {
      const sum = cohorts.reduce((acc, cohort) => acc + cohort.retention[window], 0);
      averages[window] = sum / cohorts.length;
    }
    
    return averages;
  }

  /**
   * Compare retention between two cohorts
   * @param {Object} cohort1 - First cohort
   * @param {Object} cohort2 - Second cohort
   * @returns {Object} Comparison data
   */
  compareCohorts(cohort1, cohort2) {
    const windows = ['day7', 'day14', 'day30', 'day60', 'day90'];
    const comparison = {
      cohort1Date: cohort1.cohortStartDate,
      cohort2Date: cohort2.cohortStartDate,
      differences: {}
    };
    
    for (const window of windows) {
      const diff = cohort2.retention[window] - cohort1.retention[window];
      const percentChange = cohort1.retention[window] > 0 
        ? (diff / cohort1.retention[window]) * 100 
        : 0;
      
      comparison.differences[window] = {
        absolute: diff,
        percentChange,
        cohort1: cohort1.retention[window],
        cohort2: cohort2.retention[window]
      };
    }
    
    return comparison;
  }
}

export default RetentionCalculator;
