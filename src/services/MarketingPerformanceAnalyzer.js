/**
 * Marketing Performance Analyzer
 * 
 * Analyzes marketing and user acquisition metrics including:
 * - New user counts (daily, weekly, monthly)
 * - Acquisition quality (% with 2+ transactions in 7 days)
 * - Viral growth detection (>20% week-over-week)
 * - Lifetime value by acquisition cohort
 * - Campaign performance comparison
 */
export class MarketingPerformanceAnalyzer {
  constructor() {
    this.viralGrowthThreshold = 0.2; // 20% week-over-week growth
    this.qualityThreshold = 2; // 2+ transactions in 7 days
    this.qualityWindowDays = 7;
  }

  /**
   * Analyze all marketing performance metrics
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {Object} campaignPeriods - Optional campaign periods for comparison
   * @returns {Object} Marketing performance analysis
   */
  analyzeMarketingPerformance(transactions, campaignPeriods = null) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    const newUserCounts = this.calculateNewUserCounts(transactions);
    const acquisitionQuality = this.calculateAcquisitionQuality(transactions);
    const viralGrowth = this.detectViralGrowth(transactions);
    const lifetimeValue = this._calculateLifetimeValueByCohort(transactions);
    const campaignComparison = campaignPeriods 
      ? this._compareCampaignPerformance(transactions, campaignPeriods)
      : null;

    return {
      newUserCounts,
      acquisitionQuality,
      viralGrowth,
      lifetimeValue,
      campaignComparison,
      summary: {
        totalNewUsers: newUserCounts.total,
        averageAcquisitionQuality: acquisitionQuality.overallQuality,
        viralGrowthPeriods: viralGrowth.length,
        averageLifetimeValue: lifetimeValue.averageLtv
      }
    };
  }

  /**
   * Calculate new user counts (daily, weekly, monthly)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} New user counts by period
   */
  calculateNewUserCounts(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        total: 0,
        daily: [],
        weekly: [],
        monthly: []
      };
    }

    // Find first transaction for each wallet
    const walletFirstSeen = new Map();
    
    for (const tx of transactions) {
      // Skip transactions without wallet address
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (!wallet) {
        console.warn('Transaction missing wallet/from_address in marketing analysis:', tx);
        continue;
      }
      
      const walletLower = wallet.toLowerCase();
      
      if (!walletFirstSeen.has(walletLower)) {
        walletFirstSeen.set(walletLower, tx.timestamp);
      } else {
        const currentFirst = walletFirstSeen.get(walletLower);
        if (tx.timestamp < currentFirst) {
          walletFirstSeen.set(walletLower, tx.timestamp);
        }
      }
    }

    // Group by day, week, month
    const dailyCounts = new Map();
    const weeklyCounts = new Map();
    const monthlyCounts = new Map();

    for (const [wallet, firstSeen] of walletFirstSeen) {
      // Skip invalid dates
      if (!firstSeen || isNaN(firstSeen.getTime())) {
        continue;
      }
      
      // Daily
      const dayKey = firstSeen.toISOString().split('T')[0];
      dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);

      // Weekly
      const weekKey = this._getWeekKey(firstSeen);
      weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);

      // Monthly
      const monthKey = `${firstSeen.getUTCFullYear()}-${String(firstSeen.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) || 0) + 1);
    }

    // Convert to arrays and sort
    const daily = Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, newUsers: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const weekly = Array.from(weeklyCounts.entries())
      .map(([week, count]) => ({ week, newUsers: count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const monthly = Array.from(monthlyCounts.entries())
      .map(([month, count]) => ({ month, newUsers: count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      total: walletFirstSeen.size,
      daily,
      weekly,
      monthly
    };
  }

  /**
   * Calculate acquisition quality (% with 2+ transactions in 7 days)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Acquisition quality metrics
   */
  calculateAcquisitionQuality(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        overallQuality: 0,
        qualityByPeriod: [],
        qualityUsers: 0,
        totalNewUsers: 0
      };
    }

    // Find first transaction for each wallet
    const walletFirstSeen = new Map();
    const walletTransactions = new Map();
    
    for (const tx of transactions) {
      // Skip transactions without wallet address
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (!wallet) {
        console.warn('Transaction missing wallet/from_address in acquisition quality analysis:', tx);
        continue;
      }
      
      const walletLower = wallet.toLowerCase();
      
      if (!walletFirstSeen.has(walletLower)) {
        walletFirstSeen.set(walletLower, tx.timestamp);
        walletTransactions.set(walletLower, []);
      } else {
        const currentFirst = walletFirstSeen.get(walletLower);
        if (tx.timestamp < currentFirst) {
          walletFirstSeen.set(walletLower, tx.timestamp);
        }
      }
      
      walletTransactions.get(walletLower).push(tx);
    }

    // Calculate quality for each user
    let qualityUsers = 0;
    const qualityByWeek = new Map();

    for (const [wallet, firstSeen] of walletFirstSeen) {
      const weekKey = this._getWeekKey(firstSeen);
      
      if (!qualityByWeek.has(weekKey)) {
        qualityByWeek.set(weekKey, { total: 0, quality: 0 });
      }
      
      qualityByWeek.get(weekKey).total++;

      // Count transactions within 7 days of first seen
      const txs = walletTransactions.get(wallet);
      const sevenDaysLater = new Date(firstSeen.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const txsInWindow = txs.filter(tx => 
        tx.timestamp >= firstSeen && tx.timestamp <= sevenDaysLater
      );

      if (txsInWindow.length >= this.qualityThreshold) {
        qualityUsers++;
        qualityByWeek.get(weekKey).quality++;
      }
    }

    // Calculate quality percentage by week
    const qualityByPeriod = Array.from(qualityByWeek.entries())
      .map(([week, stats]) => ({
        week,
        newUsers: stats.total,
        qualityUsers: stats.quality,
        qualityPercentage: stats.total > 0 ? stats.quality / stats.total : 0
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const overallQuality = walletFirstSeen.size > 0 
      ? qualityUsers / walletFirstSeen.size 
      : 0;

    return {
      overallQuality,
      qualityByPeriod,
      qualityUsers,
      totalNewUsers: walletFirstSeen.size
    };
  }

  /**
   * Detect viral growth (>20% week-over-week)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Periods with viral growth
   */
  detectViralGrowth(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    const newUserCounts = this.calculateNewUserCounts(transactions);
    const viralPeriods = [];

    // Check week-over-week growth
    for (let i = 1; i < newUserCounts.weekly.length; i++) {
      const currentWeek = newUserCounts.weekly[i];
      const previousWeek = newUserCounts.weekly[i - 1];

      if (previousWeek.newUsers === 0) continue;

      const growthRate = (currentWeek.newUsers - previousWeek.newUsers) / previousWeek.newUsers;

      if (growthRate > this.viralGrowthThreshold) {
        viralPeriods.push({
          week: currentWeek.week,
          previousWeek: previousWeek.week,
          currentNewUsers: currentWeek.newUsers,
          previousNewUsers: previousWeek.newUsers,
          growthRate,
          growthPercentage: growthRate * 100
        });
      }
    }

    return viralPeriods;
  }

  /**
   * Calculate lifetime value by acquisition cohort
   * @private
   */
  _calculateLifetimeValueByCohort(transactions) {
    if (transactions.length === 0) {
      return {
        cohorts: [],
        averageLtv: 0
      };
    }

    // Find first transaction for each wallet
    const walletFirstSeen = new Map();
    const walletValue = new Map();
    
    for (const tx of transactions) {
      // Skip transactions without wallet address
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (!wallet) {
        console.warn('Transaction missing wallet/from_address in lifetime value analysis:', tx);
        continue;
      }
      
      const walletLower = wallet.toLowerCase();
      
      if (!walletFirstSeen.has(walletLower)) {
        walletFirstSeen.set(walletLower, tx.timestamp);
        walletValue.set(walletLower, 0);
      } else {
        const currentFirst = walletFirstSeen.get(walletLower);
        if (tx.timestamp < currentFirst) {
          walletFirstSeen.set(walletLower, tx.timestamp);
        }
      }
      
      // Accumulate value (ETH + gas)
      const value = (tx.value_eth || 0) + (tx.gas_cost_eth || 0);
      walletValue.set(walletLower, (walletValue.get(walletLower) || 0) + value);
    }

    // Group by acquisition month
    const cohortLtv = new Map();

    for (const [wallet, firstSeen] of walletFirstSeen) {
      const monthKey = `${firstSeen.getUTCFullYear()}-${String(firstSeen.getUTCMonth() + 1).padStart(2, '0')}`;
      
      if (!cohortLtv.has(monthKey)) {
        cohortLtv.set(monthKey, {
          users: [],
          totalValue: 0
        });
      }
      
      const value = walletValue.get(wallet);
      cohortLtv.get(monthKey).users.push(value);
      cohortLtv.get(monthKey).totalValue += value;
    }

    // Calculate average LTV per cohort
    const cohorts = Array.from(cohortLtv.entries())
      .map(([month, data]) => ({
        month,
        userCount: data.users.length,
        totalLifetimeValue: data.totalValue,
        averageLifetimeValue: data.users.length > 0 ? data.totalValue / data.users.length : 0,
        medianLifetimeValue: this._calculateMedian(data.users)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const totalValue = cohorts.reduce((sum, c) => sum + c.totalLifetimeValue, 0);
    const totalUsers = cohorts.reduce((sum, c) => sum + c.userCount, 0);
    const averageLtv = totalUsers > 0 ? totalValue / totalUsers : 0;

    return {
      cohorts,
      averageLtv
    };
  }

  /**
   * Compare metrics before/during/after campaign periods
   * @private
   */
  _compareCampaignPerformance(transactions, campaignPeriods) {
    const results = [];

    for (const campaign of campaignPeriods) {
      const { name, startDate, endDate } = campaign;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const duration = (end - start) / (1000 * 60 * 60 * 24); // days

      // Define before/during/after periods
      const beforeStart = new Date(start.getTime() - duration * 24 * 60 * 60 * 1000);
      const afterEnd = new Date(end.getTime() + duration * 24 * 60 * 60 * 1000);

      // Filter transactions by period
      const beforeTxs = transactions.filter(tx => tx.timestamp >= beforeStart && tx.timestamp < start);
      const duringTxs = transactions.filter(tx => tx.timestamp >= start && tx.timestamp <= end);
      const afterTxs = transactions.filter(tx => tx.timestamp > end && tx.timestamp <= afterEnd);

      // Calculate metrics for each period
      const beforeMetrics = this._calculatePeriodMetrics(beforeTxs);
      const duringMetrics = this._calculatePeriodMetrics(duringTxs);
      const afterMetrics = this._calculatePeriodMetrics(afterTxs);

      results.push({
        campaignName: name,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        before: beforeMetrics,
        during: duringMetrics,
        after: afterMetrics,
        impact: {
          newUserIncrease: duringMetrics.newUsers - beforeMetrics.newUsers,
          newUserIncreasePercentage: beforeMetrics.newUsers > 0 
            ? ((duringMetrics.newUsers - beforeMetrics.newUsers) / beforeMetrics.newUsers) * 100
            : 0,
          sustained: afterMetrics.newUsers > beforeMetrics.newUsers
        }
      });
    }

    return results;
  }

  /**
   * Calculate metrics for a specific period
   * @private
   */
  _calculatePeriodMetrics(transactions) {
    if (transactions.length === 0) {
      return {
        newUsers: 0,
        totalTransactions: 0,
        totalValue: 0
      };
    }

    const uniqueWallets = new Set();
    let totalValue = 0;

    for (const tx of transactions) {
      // Skip transactions without wallet address
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (wallet) {
        uniqueWallets.add(wallet.toLowerCase());
      }
      
      totalValue += (tx.value_eth || 0) + (tx.gas_cost_eth || 0);
    }

    return {
      newUsers: uniqueWallets.size,
      totalTransactions: transactions.length,
      totalValue
    };
  }

  /**
   * Get week key for a date (ISO week)
   * @private
   */
  _getWeekKey(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  /**
   * Calculate median of an array
   * @private
   */
  _calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      newUserCounts: {
        total: 0,
        daily: [],
        weekly: [],
        monthly: []
      },
      acquisitionQuality: {
        overallQuality: 0,
        qualityByPeriod: [],
        qualityUsers: 0,
        totalNewUsers: 0
      },
      viralGrowth: [],
      lifetimeValue: {
        cohorts: [],
        averageLtv: 0
      },
      campaignComparison: null,
      summary: {
        totalNewUsers: 0,
        averageAcquisitionQuality: 0,
        viralGrowthPeriods: 0,
        averageLifetimeValue: 0
      }
    };
  }
}

export default MarketingPerformanceAnalyzer;
