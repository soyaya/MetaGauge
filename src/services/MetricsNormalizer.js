/**
 * Metrics Normalizer
 * Ensures metrics always have valid values for display
 */

export class MetricsNormalizer {
  /**
   * Normalize DeFi metrics with safe defaults
   */
  static normalizeDeFiMetrics(metrics) {
    if (!metrics || metrics.error) {
      return this.getDefaultDeFiMetrics();
    }

    return {
      // Financial metrics
      tvl: this.safeNumber(metrics.tvl, 0),
      transactionVolume24h: this.safeNumber(metrics.transactionVolume24h, 0),
      fees24h: this.safeNumber(metrics.fees24h, 0),
      revenue24h: this.safeNumber(metrics.revenue24h, 0),
      
      // Activity metrics
      dau: this.safeNumber(metrics.dau, 0),
      mau: this.safeNumber(metrics.mau, 0),
      activeUsers: this.safeNumber(metrics.activeUsers, 0),
      newUsers: this.safeNumber(metrics.newUsers, 0),
      
      // Performance metrics
      liquidityUtilization: this.safeNumber(metrics.liquidityUtilization, 0),
      gasEfficiency: this.safeNumber(metrics.gasEfficiency, 0),
      successRate: this.safeNumber(metrics.successRate, 0),
      avgGasUsed: this.safeNumber(metrics.avgGasUsed, 0),
      
      // Ratios
      volumeToTvlRatio: this.safeNumber(metrics.volumeToTvlRatio, 0),
      borrowingRate: this.safeNumber(metrics.borrowingRate, 0),
      lendingRate: this.safeNumber(metrics.lendingRate, 0),
      
      // Additional metrics
      eventDrivenVolume: this.safeNumber(metrics.eventDrivenVolume, 0),
      interactionComplexity: this.safeNumber(metrics.interactionComplexity, 0),
      contractUtilization: this.safeNumber(metrics.contractUtilization, 0)
    };
  }

  /**
   * Normalize user behavior metrics
   */
  static normalizeUserBehavior(behavior) {
    if (!behavior) {
      return this.getDefaultUserBehavior();
    }

    return {
      whaleRatio: this.safeNumber(behavior.whaleRatio, 0),
      botActivity: this.safeNumber(behavior.botActivity, 0),
      retentionRate: this.safeNumber(behavior.retentionRate, 0),
      churnRate: this.safeNumber(behavior.churnRate, 0),
      engagementScore: this.safeNumber(behavior.engagementScore, 0),
      interactionPatterns: behavior.interactionPatterns || {},
      eventEngagement: behavior.eventEngagement || {},
      contractLoyalty: behavior.contractLoyalty || {}
    };
  }

  /**
   * Safe number conversion
   */
  static safeNumber(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
  }

  /**
   * Default DeFi metrics
   */
  static getDefaultDeFiMetrics() {
    return {
      tvl: 0,
      transactionVolume24h: 0,
      fees24h: 0,
      revenue24h: 0,
      dau: 0,
      mau: 0,
      activeUsers: 0,
      newUsers: 0,
      liquidityUtilization: 0,
      gasEfficiency: 0,
      successRate: 0,
      avgGasUsed: 0,
      volumeToTvlRatio: 0,
      borrowingRate: 0,
      lendingRate: 0,
      eventDrivenVolume: 0,
      interactionComplexity: 0,
      contractUtilization: 0
    };
  }

  /**
   * Default user behavior
   */
  static getDefaultUserBehavior() {
    return {
      whaleRatio: 0,
      botActivity: 0,
      retentionRate: 0,
      churnRate: 0,
      engagementScore: 0,
      interactionPatterns: {},
      eventEngagement: {},
      contractLoyalty: {}
    };
  }
}
