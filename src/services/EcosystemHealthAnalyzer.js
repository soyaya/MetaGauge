/**
 * Ecosystem Health Analyzer
 * 
 * Analyzes the target contract's health relative to the overall ecosystem:
 * - Market share (% of category transactions and users)
 * - Benchmarking against category medians
 * - Market share trends over time
 * - Network effects (correlation between users and volume)
 * - Performance relative to ecosystem-wide changes
 */
export class EcosystemHealthAnalyzer {
  constructor() {
    // Configuration can be added here if needed
  }

  /**
   * Analyze ecosystem health
   * @param {Object} targetMetrics - Target contract metrics
   * @param {Array<Object>} categoryMetrics - Metrics for all contracts in category
   * @param {Object} historicalData - Optional historical data for trend analysis
   * @returns {Object} Ecosystem health analysis
   */
  analyzeEcosystemHealth(targetMetrics, categoryMetrics, historicalData = null) {
    if (!targetMetrics || !Array.isArray(categoryMetrics) || categoryMetrics.length === 0) {
      return this._getEmptyAnalysis();
    }

    const marketShare = this.calculateMarketShare(targetMetrics, categoryMetrics);
    const categoryBenchmarks = this._benchmarkAgainstCategory(targetMetrics, categoryMetrics);
    const marketShareTrends = historicalData 
      ? this._trackMarketShareTrends(historicalData)
      : null;
    const networkEffects = this._measureNetworkEffects(targetMetrics);
    const ecosystemComparison = this._compareToEcosystemChanges(targetMetrics, categoryMetrics, historicalData);

    return {
      marketShare,
      categoryBenchmarks,
      marketShareTrends,
      networkEffects,
      ecosystemComparison,
      summary: {
        marketSharePercentage: marketShare.transactionShare,
        positionInCategory: this._calculatePosition(targetMetrics, categoryMetrics),
        healthScore: this._calculateHealthScore(marketShare, categoryBenchmarks, networkEffects)
      }
    };
  }

  /**
   * Calculate market share (% of category transactions and users)
   * @param {Object} targetMetrics - Target contract metrics
   * @param {Array<Object>} categoryMetrics - Metrics for all contracts in category
   * @returns {Object} Market share metrics
   */
  calculateMarketShare(targetMetrics, categoryMetrics) {
    // Calculate total category metrics
    const totalTransactions = categoryMetrics.reduce((sum, m) => sum + (m.transactionCount || 0), 0);
    const totalUsers = categoryMetrics.reduce((sum, m) => sum + (m.userCount || 0), 0);
    const totalVolume = categoryMetrics.reduce((sum, m) => sum + (m.totalVolume || 0), 0);

    // Calculate target's share
    const targetTransactions = targetMetrics.transactionCount || 0;
    const targetUsers = targetMetrics.userCount || 0;
    const targetVolume = targetMetrics.totalVolume || 0;

    const transactionShare = totalTransactions > 0 ? (targetTransactions / totalTransactions) * 100 : 0;
    const userShare = totalUsers > 0 ? (targetUsers / totalUsers) * 100 : 0;
    const volumeShare = totalVolume > 0 ? (targetVolume / totalVolume) * 100 : 0;

    return {
      transactionShare,
      userShare,
      volumeShare,
      targetTransactions,
      totalTransactions,
      targetUsers,
      totalUsers,
      targetVolume,
      totalVolume
    };
  }

  /**
   * Benchmark against category medians
   * @private
   */
  _benchmarkAgainstCategory(targetMetrics, categoryMetrics) {
    const benchmarks = [];
    
    const metricsToCompare = [
      { key: 'retentionRate', name: 'Retention Rate', higherIsBetter: true },
      { key: 'transactionVolume', name: 'Transaction Volume', higherIsBetter: true },
      { key: 'gasEfficiency', name: 'Gas Efficiency', higherIsBetter: false },
      { key: 'averageSessionDuration', name: 'Average Session Duration', higherIsBetter: true }
    ];

    for (const metric of metricsToCompare) {
      const targetValue = targetMetrics[metric.key];
      
      if (targetValue === undefined) continue;

      // Calculate category median
      const values = categoryMetrics
        .map(m => m[metric.key])
        .filter(v => v !== undefined && v !== null);

      if (values.length === 0) continue;

      const median = this._calculateMedian(values);
      const percentile = this._calculatePercentile(targetValue, values);

      let performance = 'at median';
      if (metric.higherIsBetter) {
        if (targetValue > median) performance = 'above median';
        else if (targetValue < median) performance = 'below median';
      } else {
        if (targetValue < median) performance = 'above median';
        else if (targetValue > median) performance = 'below median';
      }

      benchmarks.push({
        metric: metric.name,
        targetValue,
        categoryMedian: median,
        percentile,
        performance,
        difference: ((targetValue - median) / median) * 100
      });
    }

    return benchmarks;
  }

  /**
   * Track market share trends over time
   * @private
   */
  _trackMarketShareTrends(historicalData) {
    if (!historicalData || !Array.isArray(historicalData.periods)) {
      return null;
    }

    const trends = [];
    
    for (let i = 1; i < historicalData.periods.length; i++) {
      const current = historicalData.periods[i];
      const previous = historicalData.periods[i - 1];

      const currentShare = current.marketShare || 0;
      const previousShare = previous.marketShare || 0;

      const change = currentShare - previousShare;
      const changePercentage = previousShare > 0 ? (change / previousShare) * 100 : 0;

      trends.push({
        period: current.period,
        marketShare: currentShare,
        previousMarketShare: previousShare,
        change,
        changePercentage,
        trend: change > 0 ? 'gaining' : change < 0 ? 'losing' : 'stable'
      });
    }

    // Calculate overall trend
    const firstShare = historicalData.periods[0].marketShare || 0;
    const lastShare = historicalData.periods[historicalData.periods.length - 1].marketShare || 0;
    const overallChange = lastShare - firstShare;
    const overallTrend = overallChange > 0 ? 'gaining' : overallChange < 0 ? 'losing' : 'stable';

    return {
      trends,
      overallTrend,
      overallChange,
      currentMarketShare: lastShare
    };
  }

  /**
   * Measure network effects (correlation between users and volume)
   * @private
   */
  _measureNetworkEffects(targetMetrics) {
    const userCount = targetMetrics.userCount || 0;
    const transactionVolume = targetMetrics.transactionVolume || 0;
    const totalVolume = targetMetrics.totalVolume || 0;

    // Calculate metrics that indicate network effects
    const volumePerUser = userCount > 0 ? transactionVolume / userCount : 0;
    const valuePerUser = userCount > 0 ? totalVolume / userCount : 0;

    // Network effect strength: higher values per user indicate stronger network effects
    let networkStrength = 'weak';
    if (volumePerUser > 100) networkStrength = 'strong';
    else if (volumePerUser > 50) networkStrength = 'moderate';

    return {
      userCount,
      transactionVolume,
      totalVolume,
      volumePerUser,
      valuePerUser,
      networkStrength,
      description: `Each user generates ${volumePerUser.toFixed(2)} transactions on average`
    };
  }

  /**
   * Compare target performance to ecosystem-wide changes
   * @private
   */
  _compareToEcosystemChanges(targetMetrics, categoryMetrics, historicalData) {
    if (!historicalData || !historicalData.ecosystemChanges) {
      return null;
    }

    const ecosystemChange = historicalData.ecosystemChanges;
    const targetChange = historicalData.targetChanges || {};

    const comparisons = [];

    // Compare user growth
    if (ecosystemChange.userGrowth !== undefined && targetChange.userGrowth !== undefined) {
      const relative = targetChange.userGrowth - ecosystemChange.userGrowth;
      comparisons.push({
        metric: 'User Growth',
        targetChange: targetChange.userGrowth,
        ecosystemChange: ecosystemChange.userGrowth,
        relativePerformance: relative,
        outperforming: relative > 0
      });
    }

    // Compare volume growth
    if (ecosystemChange.volumeGrowth !== undefined && targetChange.volumeGrowth !== undefined) {
      const relative = targetChange.volumeGrowth - ecosystemChange.volumeGrowth;
      comparisons.push({
        metric: 'Volume Growth',
        targetChange: targetChange.volumeGrowth,
        ecosystemChange: ecosystemChange.volumeGrowth,
        relativePerformance: relative,
        outperforming: relative > 0
      });
    }

    // Calculate overall resilience
    const outperformingCount = comparisons.filter(c => c.outperforming).length;
    const resilience = comparisons.length > 0 
      ? (outperformingCount / comparisons.length) * 100 
      : 50;

    return {
      comparisons,
      resilience,
      description: resilience > 50 
        ? 'Target is outperforming ecosystem trends'
        : 'Target is underperforming ecosystem trends'
    };
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
   * Calculate percentile rank
   * @private
   */
  _calculatePercentile(value, values) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    
    if (index === -1) return 100;
    if (index === 0) return 0;
    
    return (index / sorted.length) * 100;
  }

  /**
   * Calculate position in category
   * @private
   */
  _calculatePosition(targetMetrics, categoryMetrics) {
    const targetVolume = targetMetrics.transactionVolume || 0;
    
    // Sort by volume
    const sorted = [...categoryMetrics].sort((a, b) => 
      (b.transactionVolume || 0) - (a.transactionVolume || 0)
    );

    const position = sorted.findIndex(m => 
      (m.transactionVolume || 0) <= targetVolume
    );

    return position === -1 ? sorted.length + 1 : position + 1;
  }

  /**
   * Calculate overall health score
   * @private
   */
  _calculateHealthScore(marketShare, categoryBenchmarks, networkEffects) {
    let score = 0;
    let factors = 0;

    // Market share contribution (0-40 points)
    if (marketShare.transactionShare !== undefined) {
      score += Math.min(marketShare.transactionShare * 4, 40);
      factors++;
    }

    // Benchmark performance (0-40 points)
    if (categoryBenchmarks.length > 0) {
      const aboveMedian = categoryBenchmarks.filter(b => b.performance === 'above median').length;
      const benchmarkScore = (aboveMedian / categoryBenchmarks.length) * 40;
      score += benchmarkScore;
      factors++;
    }

    // Network effects (0-20 points)
    if (networkEffects) {
      const networkScore = networkEffects.networkStrength === 'strong' ? 20 
        : networkEffects.networkStrength === 'moderate' ? 10 
        : 5;
      score += networkScore;
      factors++;
    }

    return factors > 0 ? score : 50; // Default to 50 if no data
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      marketShare: {
        transactionShare: 0,
        userShare: 0,
        volumeShare: 0,
        targetTransactions: 0,
        totalTransactions: 0,
        targetUsers: 0,
        totalUsers: 0,
        targetVolume: 0,
        totalVolume: 0
      },
      categoryBenchmarks: [],
      marketShareTrends: null,
      networkEffects: {
        userCount: 0,
        transactionVolume: 0,
        totalVolume: 0,
        volumePerUser: 0,
        valuePerUser: 0,
        networkStrength: 'weak',
        description: 'No data available'
      },
      ecosystemComparison: null,
      summary: {
        marketSharePercentage: 0,
        positionInCategory: 0,
        healthScore: 50
      }
    };
  }
}

export default EcosystemHealthAnalyzer;
