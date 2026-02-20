/**
 * Temporal Pattern Analyzer
 * 
 * Analyzes temporal patterns in transaction activity including:
 * - Activity by hour of day and day of week
 * - Activity bursts (statistical anomalies)
 * - User consistency metrics
 * - Growth trends (WoW, MoM)
 * - Bot activity detection
 */
export class TemporalPatternAnalyzer {
  constructor() {
    this.hoursInDay = 24;
    this.daysInWeek = 7;
  }

  /**
   * Analyze all temporal patterns
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Temporal pattern analysis
   */
  analyzeTemporalPatterns(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    const hourlyDistribution = this._aggregateByHourOfDay(transactions);
    const dailyDistribution = this._aggregateByDayOfWeek(transactions);
    const activityBursts = this.detectActivityBursts(transactions);
    const userConsistency = this._calculateUserConsistency(transactions);
    const growthTrends = this._calculateGrowthTrends(transactions);
    const botActivity = this.detectBotActivity(transactions);

    return {
      hourlyDistribution,
      dailyDistribution,
      activityBursts,
      userConsistency,
      growthTrends,
      botActivity
    };
  }

  /**
   * Aggregate transactions by hour of day (0-23)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Hourly distribution
   */
  aggregateByHourOfDay(transactions) {
    return this._aggregateByHourOfDay(transactions);
  }

  /**
   * Aggregate transactions by day of week (0=Sunday, 6=Saturday)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Daily distribution
   */
  aggregateByDayOfWeek(transactions) {
    return this._aggregateByDayOfWeek(transactions);
  }

  /**
   * Detect activity bursts (volume > mean + 2*stddev)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Detected bursts
   */
  detectActivityBursts(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    // Group transactions by day
    const dailyVolumes = this._groupTransactionsByDay(transactions);
    
    // Calculate mean and standard deviation
    const volumes = Array.from(dailyVolumes.values()).map(txs => txs.length);
    const mean = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const variance = volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length;
    const stddev = Math.sqrt(variance);
    
    // Identify bursts (volume > mean + 2*stddev)
    const threshold = mean + 2 * stddev;
    const bursts = [];

    for (const [date, txs] of dailyVolumes) {
      const volume = txs.length;
      if (volume > threshold) {
        const uniqueUsers = new Set(txs.map(tx => tx.wallet)).size;
        const totalValue = txs.reduce((sum, tx) => sum + tx.valueEth, 0);
        
        bursts.push({
          date,
          volume,
          threshold,
          mean,
          stddev,
          deviationsAboveMean: (volume - mean) / stddev,
          uniqueUsers,
          totalValueEth: totalValue,
          averageValueEth: totalValue / volume
        });
      }
    }

    // Sort by date
    bursts.sort((a, b) => new Date(a.date) - new Date(b.date));

    return bursts;
  }

  /**
   * Calculate unique active days and hours per wallet
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} User consistency metrics
   */
  calculateUserConsistency(transactions) {
    return this._calculateUserConsistency(transactions);
  }

  /**
   * Track week-over-week and month-over-month growth
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Growth trends
   */
  calculateGrowthTrends(transactions) {
    return this._calculateGrowthTrends(transactions);
  }

  /**
   * Flag potential bot activity (transactions within 5 minutes)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Suspected bot wallets
   */
  detectBotActivity(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    const botThresholdMs = 5 * 60 * 1000; // 5 minutes in milliseconds
    const walletTransactions = this._groupByWallet(transactions);
    const suspectedBots = [];

    for (const [wallet, txs] of walletTransactions) {
      // Sort by timestamp
      const sortedTxs = [...txs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Look for rapid sequences
      let rapidSequences = 0;
      let maxSequenceLength = 0;
      let currentSequence = 1;
      
      for (let i = 1; i < sortedTxs.length; i++) {
        const timeDiff = sortedTxs[i].timestamp.getTime() - sortedTxs[i - 1].timestamp.getTime();
        
        if (timeDiff <= botThresholdMs) {
          rapidSequences++;
          currentSequence++;
          maxSequenceLength = Math.max(maxSequenceLength, currentSequence);
        } else {
          currentSequence = 1;
        }
      }

      // Flag if more than 20% of transactions are in rapid sequences
      const rapidPercentage = sortedTxs.length > 1 ? rapidSequences / (sortedTxs.length - 1) : 0;
      
      if (rapidPercentage > 0.2 || maxSequenceLength >= 5) {
        suspectedBots.push({
          wallet,
          totalTransactions: sortedTxs.length,
          rapidSequences,
          rapidPercentage,
          maxSequenceLength,
          averageTimeBetweenTxs: this._calculateAverageTimeBetween(sortedTxs),
          confidence: this._calculateBotConfidence(rapidPercentage, maxSequenceLength, sortedTxs.length)
        });
      }
    }

    // Sort by confidence
    suspectedBots.sort((a, b) => b.confidence - a.confidence);

    return suspectedBots;
  }

  /**
   * Aggregate transactions by hour of day
   * @private
   */
  _aggregateByHourOfDay(transactions) {
    const hourlyBuckets = new Array(24).fill(0).map((_, hour) => ({
      hour,
      transactionCount: 0,
      uniqueUsers: new Set(),
      totalValueEth: 0
    }));

    for (const tx of transactions) {
      // Skip transactions with invalid timestamps
      if (!tx.timestamp || isNaN(tx.timestamp.getTime())) {
        continue;
      }
      
      const hour = tx.timestamp.getUTCHours();
      hourlyBuckets[hour].transactionCount++;
      hourlyBuckets[hour].uniqueUsers.add(tx.wallet);
      hourlyBuckets[hour].totalValueEth += tx.valueEth;
    }

    // Convert Sets to counts
    return hourlyBuckets.map(bucket => ({
      hour: bucket.hour,
      transactionCount: bucket.transactionCount,
      uniqueUsers: bucket.uniqueUsers.size,
      totalValueEth: bucket.totalValueEth,
      averageValueEth: bucket.transactionCount > 0 ? bucket.totalValueEth / bucket.transactionCount : 0
    }));
  }

  /**
   * Aggregate transactions by day of week
   * @private
   */
  _aggregateByDayOfWeek(transactions) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyBuckets = new Array(7).fill(0).map((_, day) => ({
      day,
      dayName: dayNames[day],
      transactionCount: 0,
      uniqueUsers: new Set(),
      totalValueEth: 0
    }));

    for (const tx of transactions) {
      // Skip transactions with invalid timestamps
      if (!tx.timestamp || isNaN(tx.timestamp.getTime())) {
        continue;
      }
      
      const day = tx.timestamp.getUTCDay();
      dailyBuckets[day].transactionCount++;
      dailyBuckets[day].uniqueUsers.add(tx.wallet);
      dailyBuckets[day].totalValueEth += tx.valueEth;
    }

    // Convert Sets to counts
    return dailyBuckets.map(bucket => ({
      day: bucket.day,
      dayName: bucket.dayName,
      transactionCount: bucket.transactionCount,
      uniqueUsers: bucket.uniqueUsers.size,
      totalValueEth: bucket.totalValueEth,
      averageValueEth: bucket.transactionCount > 0 ? bucket.totalValueEth / bucket.transactionCount : 0
    }));
  }

  /**
   * Group transactions by day
   * @private
   */
  _groupTransactionsByDay(transactions) {
    const dailyMap = new Map();

    for (const tx of transactions) {
      // Skip transactions with invalid timestamps
      if (!tx.timestamp || isNaN(tx.timestamp.getTime())) {
        continue;
      }
      
      const dateKey = tx.timestamp.toISOString().split('T')[0];
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      
      dailyMap.get(dateKey).push(tx);
    }

    return dailyMap;
  }

  /**
   * Group transactions by wallet
   * @private
   */
  _groupByWallet(transactions) {
    const walletMap = new Map();

    for (const tx of transactions) {
      const wallet = tx.wallet.toLowerCase();
      
      if (!walletMap.has(wallet)) {
        walletMap.set(wallet, []);
      }
      
      walletMap.get(wallet).push(tx);
    }

    return walletMap;
  }

  /**
   * Calculate user consistency metrics
   * @private
   */
  _calculateUserConsistency(transactions) {
    const walletTransactions = this._groupByWallet(transactions);
    const consistencyMetrics = [];

    for (const [wallet, txs] of walletTransactions) {
      const uniqueDays = new Set();
      const uniqueHours = new Set();

      for (const tx of txs) {
        const dateKey = tx.timestamp.toISOString().split('T')[0];
        uniqueDays.add(dateKey);
        
        const hourKey = `${dateKey}-${tx.timestamp.getUTCHours()}`;
        uniqueHours.add(hourKey);
      }

      consistencyMetrics.push({
        wallet,
        totalTransactions: txs.length,
        uniqueActiveDays: uniqueDays.size,
        uniqueActiveHours: uniqueHours.size,
        averageTransactionsPerDay: uniqueDays.size > 0 ? txs.length / uniqueDays.size : 0
      });
    }

    // Calculate aggregates
    const totalUsers = consistencyMetrics.length;
    const avgActiveDays = totalUsers > 0 
      ? consistencyMetrics.reduce((sum, m) => sum + m.uniqueActiveDays, 0) / totalUsers 
      : 0;
    const avgActiveHours = totalUsers > 0 
      ? consistencyMetrics.reduce((sum, m) => sum + m.uniqueActiveHours, 0) / totalUsers 
      : 0;

    return {
      totalUsers,
      averageActiveDaysPerUser: avgActiveDays,
      averageActiveHoursPerUser: avgActiveHours,
      userMetrics: consistencyMetrics.sort((a, b) => b.uniqueActiveDays - a.uniqueActiveDays).slice(0, 100) // Top 100
    };
  }

  /**
   * Calculate growth trends
   * @private
   */
  _calculateGrowthTrends(transactions) {
    if (transactions.length === 0) {
      return {
        weekOverWeek: [],
        monthOverMonth: [],
        overallGrowthRate: 0
      };
    }

    // Group by week and month
    const weeklyData = this._groupByWeek(transactions);
    const monthlyData = this._groupByMonth(transactions);

    // Calculate week-over-week growth
    const weekOverWeek = this._calculatePeriodGrowth(weeklyData, 'week');
    
    // Calculate month-over-month growth
    const monthOverMonth = this._calculatePeriodGrowth(monthlyData, 'month');

    // Calculate overall growth rate
    const sortedWeeks = Array.from(weeklyData.keys()).sort();
    let overallGrowthRate = 0;
    
    if (sortedWeeks.length >= 2) {
      const firstWeek = weeklyData.get(sortedWeeks[0]);
      const lastWeek = weeklyData.get(sortedWeeks[sortedWeeks.length - 1]);
      const firstUsers = new Set(firstWeek.map(tx => tx.wallet)).size;
      const lastUsers = new Set(lastWeek.map(tx => tx.wallet)).size;
      
      if (firstUsers > 0) {
        overallGrowthRate = ((lastUsers - firstUsers) / firstUsers) * 100;
      }
    }

    return {
      weekOverWeek,
      monthOverMonth,
      overallGrowthRate
    };
  }

  /**
   * Group transactions by week
   * @private
   */
  _groupByWeek(transactions) {
    const weeklyMap = new Map();

    for (const tx of transactions) {
      const weekKey = this._getWeekKey(tx.timestamp);
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, []);
      }
      
      weeklyMap.get(weekKey).push(tx);
    }

    return weeklyMap;
  }

  /**
   * Group transactions by month
   * @private
   */
  _groupByMonth(transactions) {
    const monthlyMap = new Map();

    for (const tx of transactions) {
      const monthKey = `${tx.timestamp.getUTCFullYear()}-${String(tx.timestamp.getUTCMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, []);
      }
      
      monthlyMap.get(monthKey).push(tx);
    }

    return monthlyMap;
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
   * Calculate period-over-period growth
   * @private
   */
  _calculatePeriodGrowth(periodData, periodType) {
    const sortedPeriods = Array.from(periodData.keys()).sort();
    const growth = [];

    for (let i = 1; i < sortedPeriods.length; i++) {
      const currentPeriod = sortedPeriods[i];
      const previousPeriod = sortedPeriods[i - 1];
      
      const currentTxs = periodData.get(currentPeriod);
      const previousTxs = periodData.get(previousPeriod);
      
      const currentUsers = new Set(currentTxs.map(tx => tx.wallet)).size;
      const previousUsers = new Set(previousTxs.map(tx => tx.wallet)).size;
      
      const currentVolume = currentTxs.length;
      const previousVolume = previousTxs.length;
      
      const userGrowth = previousUsers > 0 
        ? ((currentUsers - previousUsers) / previousUsers) * 100 
        : 0;
      
      const volumeGrowth = previousVolume > 0 
        ? ((currentVolume - previousVolume) / previousVolume) * 100 
        : 0;

      growth.push({
        period: currentPeriod,
        previousPeriod,
        currentUsers,
        previousUsers,
        userGrowth,
        currentVolume,
        previousVolume,
        volumeGrowth
      });
    }

    return growth;
  }

  /**
   * Calculate average time between transactions
   * @private
   */
  _calculateAverageTimeBetween(sortedTxs) {
    if (sortedTxs.length < 2) {
      return 0;
    }

    let totalTime = 0;
    for (let i = 1; i < sortedTxs.length; i++) {
      totalTime += sortedTxs[i].timestamp.getTime() - sortedTxs[i - 1].timestamp.getTime();
    }

    return totalTime / (sortedTxs.length - 1);
  }

  /**
   * Calculate bot confidence score (0-100)
   * @private
   */
  _calculateBotConfidence(rapidPercentage, maxSequenceLength, totalTxs) {
    // Higher confidence for:
    // - Higher percentage of rapid transactions
    // - Longer sequences of rapid transactions
    // - More total transactions (more data = more confidence)
    
    const rapidScore = rapidPercentage * 50; // 0-50 points
    const sequenceScore = Math.min(maxSequenceLength / 10, 1) * 30; // 0-30 points
    const volumeScore = Math.min(totalTxs / 100, 1) * 20; // 0-20 points
    
    return Math.round(rapidScore + sequenceScore + volumeScore);
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      hourlyDistribution: new Array(24).fill(0).map((_, hour) => ({
        hour,
        transactionCount: 0,
        uniqueUsers: 0,
        totalValueEth: 0,
        averageValueEth: 0
      })),
      dailyDistribution: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, day) => ({
        day,
        dayName,
        transactionCount: 0,
        uniqueUsers: 0,
        totalValueEth: 0,
        averageValueEth: 0
      })),
      activityBursts: [],
      userConsistency: {
        totalUsers: 0,
        averageActiveDaysPerUser: 0,
        averageActiveHoursPerUser: 0,
        userMetrics: []
      },
      growthTrends: {
        weekOverWeek: [],
        monthOverMonth: [],
        overallGrowthRate: 0
      },
      botActivity: []
    };
  }
}

export default TemporalPatternAnalyzer;
