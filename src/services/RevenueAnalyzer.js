/**
 * Protocol Revenue Analyzer
 * 
 * Analyzes protocol revenue metrics including:
 * - Total protocol revenue from fees
 * - Revenue per user per month
 * - Month-over-month revenue growth and seasonality
 * - Revenue efficiency benchmarking against competitors
 * - Future revenue projections using historical trends
 */
export class RevenueAnalyzer {
  constructor() {
    this.monthsForProjection = 3; // Project 3 months ahead
    this.seasonalityWindowMonths = 12; // Look back 12 months for seasonality
  }

  /**
   * Analyze all revenue metrics
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {Object} feeStructure - Fee structure configuration
   * @param {Array<Object>} competitorData - Optional competitor revenue data
   * @returns {Object} Revenue analysis
   */
  analyzeRevenue(transactions, feeStructure = null, competitorData = null) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    const totalRevenue = this.calculateTotalRevenue(transactions, feeStructure);
    const revenuePerUser = this._calculateRevenuePerUser(transactions, feeStructure);
    const growthMetrics = this._calculateGrowthMetrics(transactions, feeStructure);
    const seasonality = this._analyzeSeasonality(transactions, feeStructure);
    const efficiency = competitorData 
      ? this._benchmarkEfficiency(transactions, feeStructure, competitorData)
      : null;
    const projections = this._projectFutureRevenue(transactions, feeStructure);

    return {
      totalRevenue,
      revenuePerUser,
      growthMetrics,
      seasonality,
      efficiency,
      projections,
      summary: {
        totalRevenue: totalRevenue.total,
        monthlyAverage: totalRevenue.monthlyAverage,
        revenuePerUserPerMonth: revenuePerUser.averagePerMonth,
        momGrowth: growthMetrics.currentMomGrowth,
        projectedNextMonth: projections.nextMonth
      }
    };
  }

  /**
   * Calculate total protocol revenue from fees
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {Object} feeStructure - Fee structure configuration
   * @returns {Object} Total revenue metrics
   */
  calculateTotalRevenue(transactions, feeStructure = null) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        total: 0,
        byMonth: [],
        byFunction: {},
        monthlyAverage: 0
      };
    }

    // Default fee structure if not provided
    const fees = feeStructure || {
      percentageFee: 0.003, // 0.3% default
      flatFee: 0,
      gasFeeShare: 0 // Protocol doesn't capture gas fees by default
    };

    // Calculate revenue by month
    const monthlyRevenue = new Map();
    const functionRevenue = new Map();

    for (const tx of transactions) {
      if (!tx.success) continue; // Only count successful transactions

      // Calculate fee for this transaction
      const fee = (tx.valueEth * fees.percentageFee) + 
                  fees.flatFee + 
                  (tx.gasCostEth * fees.gasFeeShare);

      // Group by month
      const monthKey = `${tx.timestamp.getFullYear()}-${String(tx.timestamp.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyRevenue.has(monthKey)) {
        monthlyRevenue.set(monthKey, {
          month: monthKey,
          revenue: 0,
          transactionCount: 0
        });
      }
      
      monthlyRevenue.get(monthKey).revenue += fee;
      monthlyRevenue.get(monthKey).transactionCount++;

      // Group by function
      if (!functionRevenue.has(tx.functionName)) {
        functionRevenue.set(tx.functionName, 0);
      }
      functionRevenue.set(tx.functionName, functionRevenue.get(tx.functionName) + fee);
    }

    // Convert to arrays and sort
    const byMonth = Array.from(monthlyRevenue.values())
      .sort((a, b) => a.month.localeCompare(b.month));

    const byFunction = Object.fromEntries(functionRevenue);

    const totalRevenue = byMonth.reduce((sum, m) => sum + m.revenue, 0);
    const monthlyAverage = byMonth.length > 0 ? totalRevenue / byMonth.length : 0;

    return {
      total: totalRevenue,
      byMonth,
      byFunction,
      monthlyAverage
    };
  }

  /**
   * Calculate revenue per user per month
   * @private
   */
  _calculateRevenuePerUser(transactions, feeStructure) {
    const revenueData = this.calculateTotalRevenue(transactions, feeStructure);
    
    // Count unique users per month
    const monthlyUsers = new Map();
    
    for (const tx of transactions) {
      const monthKey = `${tx.timestamp.getFullYear()}-${String(tx.timestamp.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyUsers.has(monthKey)) {
        monthlyUsers.set(monthKey, new Set());
      }
      
      // Skip transactions without wallet address
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (wallet) {
        monthlyUsers.get(monthKey).add(wallet.toLowerCase());
      }
    }

    // Calculate revenue per user for each month
    const perUserByMonth = revenueData.byMonth.map(monthData => {
      const users = monthlyUsers.get(monthData.month);
      const userCount = users ? users.size : 0;
      
      return {
        month: monthData.month,
        revenuePerUser: userCount > 0 ? monthData.revenue / userCount : 0,
        totalRevenue: monthData.revenue,
        userCount
      };
    });

    const averagePerMonth = perUserByMonth.length > 0
      ? perUserByMonth.reduce((sum, m) => sum + m.revenuePerUser, 0) / perUserByMonth.length
      : 0;

    return {
      perUserByMonth,
      averagePerMonth,
      totalUsers: new Set(transactions.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase())).size
    };
  }

  /**
   * Calculate month-over-month growth metrics
   * @private
   */
  _calculateGrowthMetrics(transactions, feeStructure) {
    const revenueData = this.calculateTotalRevenue(transactions, feeStructure);
    
    if (revenueData.byMonth.length < 2) {
      return {
        momGrowthRates: [],
        averageMomGrowth: 0,
        currentMomGrowth: 0,
        trend: 'insufficient_data'
      };
    }

    // Calculate month-over-month growth rates
    const momGrowthRates = [];
    
    for (let i = 1; i < revenueData.byMonth.length; i++) {
      const current = revenueData.byMonth[i];
      const previous = revenueData.byMonth[i - 1];
      
      const growthRate = previous.revenue > 0
        ? ((current.revenue - previous.revenue) / previous.revenue) * 100
        : 0;
      
      momGrowthRates.push({
        month: current.month,
        growthRate,
        revenue: current.revenue,
        previousRevenue: previous.revenue
      });
    }

    const averageMomGrowth = momGrowthRates.length > 0
      ? momGrowthRates.reduce((sum, m) => sum + m.growthRate, 0) / momGrowthRates.length
      : 0;

    const currentMomGrowth = momGrowthRates.length > 0
      ? momGrowthRates[momGrowthRates.length - 1].growthRate
      : 0;

    // Determine trend
    let trend = 'stable';
    if (momGrowthRates.length >= 3) {
      const recentGrowth = momGrowthRates.slice(-3);
      const avgRecent = recentGrowth.reduce((sum, m) => sum + m.growthRate, 0) / recentGrowth.length;
      
      if (avgRecent > 5) trend = 'growing';
      else if (avgRecent < -5) trend = 'declining';
    }

    return {
      momGrowthRates,
      averageMomGrowth,
      currentMomGrowth,
      trend
    };
  }

  /**
   * Analyze seasonality patterns
   * @private
   */
  _analyzeSeasonality(transactions, feeStructure) {
    const revenueData = this.calculateTotalRevenue(transactions, feeStructure);
    
    if (revenueData.byMonth.length < 6) {
      return {
        hasSeasonality: false,
        monthlyPatterns: [],
        peakMonth: null,
        lowMonth: null
      };
    }

    // Group by month of year (1-12)
    const monthlyPatterns = new Map();
    
    for (const monthData of revenueData.byMonth) {
      const monthNum = parseInt(monthData.month.split('-')[1]);
      
      if (!monthlyPatterns.has(monthNum)) {
        monthlyPatterns.set(monthNum, {
          month: monthNum,
          revenues: [],
          average: 0
        });
      }
      
      monthlyPatterns.get(monthNum).revenues.push(monthData.revenue);
    }

    // Calculate averages
    const patterns = Array.from(monthlyPatterns.values()).map(pattern => ({
      month: pattern.month,
      average: pattern.revenues.reduce((sum, r) => sum + r, 0) / pattern.revenues.length,
      count: pattern.revenues.length
    })).sort((a, b) => a.month - b.month);

    // Find peak and low months
    const peakMonth = patterns.reduce((max, p) => p.average > max.average ? p : max, patterns[0]);
    const lowMonth = patterns.reduce((min, p) => p.average < min.average ? p : min, patterns[0]);

    // Check if there's significant seasonality (>20% variance)
    const avgRevenue = patterns.reduce((sum, p) => sum + p.average, 0) / patterns.length;
    const variance = patterns.reduce((sum, p) => sum + Math.pow(p.average - avgRevenue, 2), 0) / patterns.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgRevenue > 0 ? (stdDev / avgRevenue) : 0;

    return {
      hasSeasonality: coefficientOfVariation > 0.2,
      monthlyPatterns: patterns,
      peakMonth,
      lowMonth,
      coefficientOfVariation
    };
  }

  /**
   * Benchmark revenue efficiency against competitors
   * @private
   */
  _benchmarkEfficiency(transactions, feeStructure, competitorData) {
    const ourRevenue = this.calculateTotalRevenue(transactions, feeStructure);
    const ourUsers = new Set(transactions.filter(tx => tx.from_address || tx.wallet).map(tx => (tx.from_address || tx.wallet).toLowerCase())).size;
    const ourRevenuePerUser = ourUsers > 0 ? ourRevenue.total / ourUsers : 0;
    const ourRevenuePerTx = transactions.length > 0 ? ourRevenue.total / transactions.length : 0;

    const benchmarks = competitorData.map(competitor => ({
      name: competitor.name,
      revenuePerUser: competitor.revenuePerUser || 0,
      revenuePerTx: competitor.revenuePerTx || 0,
      totalRevenue: competitor.totalRevenue || 0
    }));

    const avgCompetitorRevenuePerUser = benchmarks.length > 0
      ? benchmarks.reduce((sum, c) => sum + c.revenuePerUser, 0) / benchmarks.length
      : 0;

    const avgCompetitorRevenuePerTx = benchmarks.length > 0
      ? benchmarks.reduce((sum, c) => sum + c.revenuePerTx, 0) / benchmarks.length
      : 0;

    return {
      ourMetrics: {
        revenuePerUser: ourRevenuePerUser,
        revenuePerTx: ourRevenuePerTx,
        totalRevenue: ourRevenue.total
      },
      competitorBenchmarks: benchmarks,
      comparison: {
        revenuePerUserVsAvg: avgCompetitorRevenuePerUser > 0
          ? ((ourRevenuePerUser - avgCompetitorRevenuePerUser) / avgCompetitorRevenuePerUser) * 100
          : 0,
        revenuePerTxVsAvg: avgCompetitorRevenuePerTx > 0
          ? ((ourRevenuePerTx - avgCompetitorRevenuePerTx) / avgCompetitorRevenuePerTx) * 100
          : 0
      }
    };
  }

  /**
   * Project future revenue using historical trends
   * @private
   */
  _projectFutureRevenue(transactions, feeStructure) {
    const revenueData = this.calculateTotalRevenue(transactions, feeStructure);
    const growthMetrics = this._calculateGrowthMetrics(transactions, feeStructure);

    if (revenueData.byMonth.length < 3) {
      return {
        nextMonth: 0,
        next3Months: [],
        confidence: 'low',
        method: 'insufficient_data'
      };
    }

    // Use simple linear regression for projection
    const recentMonths = revenueData.byMonth.slice(-6); // Last 6 months
    const avgGrowthRate = growthMetrics.averageMomGrowth / 100;
    const lastMonthRevenue = recentMonths[recentMonths.length - 1].revenue;

    // Project next 3 months
    const projections = [];
    let projectedRevenue = lastMonthRevenue;

    for (let i = 1; i <= this.monthsForProjection; i++) {
      projectedRevenue = projectedRevenue * (1 + avgGrowthRate);
      projections.push({
        monthOffset: i,
        projectedRevenue,
        lowerBound: projectedRevenue * 0.8, // 20% confidence interval
        upperBound: projectedRevenue * 1.2
      });
    }

    // Determine confidence based on data consistency
    const revenueVariance = this._calculateVariance(recentMonths.map(m => m.revenue));
    const avgRevenue = recentMonths.reduce((sum, m) => sum + m.revenue, 0) / recentMonths.length;
    const cv = avgRevenue > 0 ? Math.sqrt(revenueVariance) / avgRevenue : 1;

    let confidence = 'medium';
    if (cv < 0.2) confidence = 'high';
    else if (cv > 0.5) confidence = 'low';

    return {
      nextMonth: projections[0].projectedRevenue,
      next3Months: projections,
      confidence,
      method: 'linear_growth',
      assumptions: {
        avgGrowthRate: avgGrowthRate * 100,
        baseRevenue: lastMonthRevenue,
        dataPoints: recentMonths.length
      }
    };
  }

  /**
   * Calculate variance
   * @private
   */
  _calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return variance;
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      totalRevenue: {
        total: 0,
        byMonth: [],
        byFunction: {},
        monthlyAverage: 0
      },
      revenuePerUser: {
        perUserByMonth: [],
        averagePerMonth: 0,
        totalUsers: 0
      },
      growthMetrics: {
        momGrowthRates: [],
        averageMomGrowth: 0,
        currentMomGrowth: 0,
        trend: 'insufficient_data'
      },
      seasonality: {
        hasSeasonality: false,
        monthlyPatterns: [],
        peakMonth: null,
        lowMonth: null
      },
      efficiency: null,
      projections: {
        nextMonth: 0,
        next3Months: [],
        confidence: 'low',
        method: 'insufficient_data'
      },
      summary: {
        totalRevenue: 0,
        monthlyAverage: 0,
        revenuePerUserPerMonth: 0,
        momGrowth: 0,
        projectedNextMonth: 0
      }
    };
  }
}

export default RevenueAnalyzer;
