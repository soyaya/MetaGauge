/**
 * Real-time Metrics Synchronizer
 * Multi-Chain RPC Integration - Task 9
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { EventEmitter } from 'events';

/**
 * Real-time metrics synchronization service with continuous updates
 * Provides 60-second update cycles, anomaly detection, and cached aggregations
 */
export class MetricsSynchronizer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Update intervals
      updateIntervalMs: config.updateIntervalMs || 60000, // 60 seconds
      blockConfirmationDelay: config.blockConfirmationDelay || 12000, // 12 seconds
      
      // Anomaly detection
      anomalyThreshold: config.anomalyThreshold || 2.5, // Standard deviations
      anomalyWindowSize: config.anomalyWindowSize || 20, // Data points
      
      // Caching
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      maxCacheSize: config.maxCacheSize || 1000,
      
      // Backfill settings
      backfillEnabled: config.backfillEnabled !== false,
      maxBackfillHours: config.maxBackfillHours || 24,
      
      ...config
    };
    
    // Internal state
    this.isRunning = false;
    this.updateTimer = null;
    this.metricsCache = new Map();
    this.historicalData = new Map();
    this.anomalies = [];
    this.lastUpdateTime = null;
    
    // Metrics calculators (injected)
    this.defiCalculator = null;
    this.behaviorAnalyzer = null;
    this.patternEngine = null;
    
    // Performance tracking
    this.updateStats = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      averageUpdateTime: 0,
      lastError: null
    };
  }

  /**
   * Initialize synchronizer with metrics calculators
   * @param {Object} calculators - Object containing calculator instances
   */
  initialize(calculators) {
    this.defiCalculator = calculators.defiCalculator;
    this.behaviorAnalyzer = calculators.behaviorAnalyzer;
    this.patternEngine = calculators.patternEngine;
    
    console.log('📊 Metrics Synchronizer initialized');
    this.emit('initialized');
  }

  /**
   * Start real-time metrics synchronization
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Metrics synchronizer already running');
      return;
    }
    
    console.log(`🚀 Starting real-time metrics synchronization (${this.config.updateIntervalMs}ms intervals)`);
    
    this.isRunning = true;
    this.lastUpdateTime = new Date();
    
    // Initial update
    this._performUpdate();
    
    // Schedule regular updates
    this.updateTimer = setInterval(() => {
      this._performUpdate();
    }, this.config.updateIntervalMs);
    
    this.emit('started');
  }

  /**
   * Stop metrics synchronization
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Metrics synchronizer not running');
      return;
    }
    
    console.log('🛑 Stopping metrics synchronization');
    
    this.isRunning = false;
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    this.emit('stopped');
  }

  /**
   * Perform metrics update cycle
   * @private
   */
  async _performUpdate() {
    const updateStart = Date.now();
    
    try {
      console.log('🔄 Performing metrics update...');
      
      this.updateStats.totalUpdates++;
      
      // 1. Calculate current metrics
      const currentMetrics = await this._calculateCurrentMetrics();
      
      // 2. Detect anomalies
      const anomalies = this._detectAnomalies(currentMetrics);
      
      // 3. Update cache
      this._updateCache(currentMetrics);
      
      // 4. Store historical data
      this._storeHistoricalData(currentMetrics);
      
      // 5. Trigger backfill if needed
      if (this.config.backfillEnabled) {
        await this._performBackfillIfNeeded();
      }
      
      // Update performance stats
      const updateTime = Date.now() - updateStart;
      this._updatePerformanceStats(updateTime, true);
      
      // Emit events
      this.emit('metricsUpdated', {
        metrics: currentMetrics,
        anomalies,
        updateTime,
        timestamp: new Date().toISOString()
      });
      
      if (anomalies.length > 0) {
        this.emit('anomaliesDetected', anomalies);
      }
      
      console.log(`✅ Metrics update completed in ${updateTime}ms`);
      
    } catch (error) {
      console.error('❌ Metrics update failed:', error.message);
      
      this.updateStats.failedUpdates++;
      this.updateStats.lastError = error.message;
      
      this._updatePerformanceStats(Date.now() - updateStart, false);
      
      this.emit('updateError', error);
    }
    
    this.lastUpdateTime = new Date();
  }

  /**
   * Calculate current metrics from all analyzers
   * @private
   */
  async _calculateCurrentMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      defi: null,
      behavior: null,
      patterns: null
    };
    
    // DeFi metrics
    if (this.defiCalculator) {
      try {
        const defiMetrics = this.defiCalculator.calculateAllMetrics();
        metrics.defi = {
          dau: defiMetrics.activity.dau,
          mau: defiMetrics.activity.mau,
          tvl: defiMetrics.financial.tvl,
          volume: defiMetrics.activity.transactionVolume,
          revenue: defiMetrics.financial.protocolRevenue,
          successRate: defiMetrics.performance.functionSuccessRate
        };
      } catch (error) {
        console.warn('⚠️ DeFi metrics calculation failed:', error.message);
      }
    }
    
    // Behavior metrics
    if (this.behaviorAnalyzer) {
      try {
        const behaviorSummary = this.behaviorAnalyzer.getBehaviorSummary();
        if (!behaviorSummary.error) {
          metrics.behavior = {
            totalUsers: behaviorSummary.totalUsers,
            transactionFrequency: behaviorSummary.transactionFrequency,
            riskTolerance: behaviorSummary.riskTolerance,
            protocolLoyalty: behaviorSummary.protocolLoyalty,
            botActivity: behaviorSummary.botActivity
          };
        }
      } catch (error) {
        console.warn('⚠️ Behavior metrics calculation failed:', error.message);
      }
    }
    
    // Pattern metrics
    if (this.patternEngine) {
      try {
        const patternSummary = this.patternEngine.getPatternSummary();
        if (!patternSummary.error) {
          metrics.patterns = {
            patternsDetected: patternSummary.patternsDetected,
            seasonalActivity: patternSummary.seasonalActivity,
            marketResponsive: patternSummary.marketResponsive,
            churnRisk: patternSummary.churnRisk,
            confidence: patternSummary.confidence
          };
        }
      } catch (error) {
        console.warn('⚠️ Pattern metrics calculation failed:', error.message);
      }
    }
    
    return metrics;
  }

  /**
   * Detect anomalies in current metrics
   * @private
   */
  _detectAnomalies(currentMetrics) {
    const anomalies = [];
    const timestamp = new Date().toISOString();
    
    // Get historical data for comparison
    const historicalMetrics = this._getRecentHistoricalData(this.config.anomalyWindowSize);
    
    if (historicalMetrics.length < 5) {
      return anomalies; // Need minimum data for anomaly detection
    }
    
    // Check DeFi metrics anomalies
    if (currentMetrics.defi) {
      const defiAnomalies = this._detectMetricAnomalies(
        'defi',
        currentMetrics.defi,
        historicalMetrics.map(h => h.defi).filter(Boolean)
      );
      anomalies.push(...defiAnomalies);
    }
    
    // Check behavior metrics anomalies
    if (currentMetrics.behavior) {
      const behaviorAnomalies = this._detectMetricAnomalies(
        'behavior',
        currentMetrics.behavior,
        historicalMetrics.map(h => h.behavior).filter(Boolean)
      );
      anomalies.push(...behaviorAnomalies);
    }
    
    // Add timestamp to all anomalies
    anomalies.forEach(anomaly => {
      anomaly.detectedAt = timestamp;
    });
    
    // Store anomalies
    this.anomalies.push(...anomalies);
    
    // Limit anomaly history
    if (this.anomalies.length > 100) {
      this.anomalies = this.anomalies.slice(-100);
    }
    
    return anomalies;
  }

  /**
   * Detect anomalies in specific metric category
   * @private
   */
  _detectMetricAnomalies(category, currentValues, historicalValues) {
    const anomalies = [];
    
    if (historicalValues.length === 0) return anomalies;
    
    Object.keys(currentValues).forEach(metric => {
      const current = currentValues[metric];
      const historical = historicalValues.map(h => h[metric]).filter(v => v !== null && v !== undefined);
      
      if (historical.length < 3 || typeof current !== 'number') return;
      
      const mean = historical.reduce((sum, val) => sum + val, 0) / historical.length;
      const variance = historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historical.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        const zScore = Math.abs(current - mean) / stdDev;
        
        if (zScore > this.config.anomalyThreshold) {
          anomalies.push({
            category,
            metric,
            currentValue: current,
            expectedValue: mean,
            zScore: Math.round(zScore * 100) / 100,
            severity: zScore > 3 ? 'high' : 'medium',
            description: `${category}.${metric} is ${zScore.toFixed(2)} standard deviations from normal`
          });
        }
      }
    });
    
    return anomalies;
  }

  /**
   * Update metrics cache
   * @private
   */
  _updateCache(metrics) {
    if (!this.config.cacheEnabled) return;
    
    const cacheKey = 'current_metrics';
    const cacheEntry = {
      data: metrics,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL
    };
    
    this.metricsCache.set(cacheKey, cacheEntry);
    
    // Clean expired cache entries
    this._cleanExpiredCache();
  }

  /**
   * Store historical metrics data
   * @private
   */
  _storeHistoricalData(metrics) {
    const timestamp = Date.now();
    const historicalEntry = {
      ...metrics,
      storedAt: timestamp
    };
    
    // Store with timestamp key
    this.historicalData.set(timestamp, historicalEntry);
    
    // Limit historical data size
    const maxEntries = (this.config.maxBackfillHours * 60 * 60 * 1000) / this.config.updateIntervalMs;
    
    if (this.historicalData.size > maxEntries) {
      const oldestKey = Math.min(...this.historicalData.keys());
      this.historicalData.delete(oldestKey);
    }
  }

  /**
   * Perform backfill for missing historical data
   * @private
   */
  async _performBackfillIfNeeded() {
    const now = Date.now();
    const backfillThreshold = now - (this.config.maxBackfillHours * 60 * 60 * 1000);
    
    // Check for gaps in historical data
    const timestamps = Array.from(this.historicalData.keys()).sort();
    const gaps = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i-1];
      if (gap > this.config.updateIntervalMs * 2) { // Significant gap
        gaps.push({
          start: timestamps[i-1],
          end: timestamps[i],
          duration: gap
        });
      }
    }
    
    if (gaps.length > 0) {
      console.log(`🔄 Backfilling ${gaps.length} data gaps...`);
      
      // For now, just log the gaps - actual backfill would require historical blockchain data
      gaps.forEach(gap => {
        console.log(`   Gap: ${new Date(gap.start).toISOString()} to ${new Date(gap.end).toISOString()} (${Math.round(gap.duration / 60000)} minutes)`);
      });
      
      this.emit('backfillCompleted', { gaps });
    }
  }

  /**
   * Get cached metrics
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  getCachedMetrics(key = 'current_metrics') {
    if (!this.config.cacheEnabled) return null;
    
    const entry = this.metricsCache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.metricsCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Get recent historical data
   * @param {number} count - Number of recent entries
   * @returns {Array} Historical data points
   */
  _getRecentHistoricalData(count) {
    const timestamps = Array.from(this.historicalData.keys()).sort().slice(-count);
    return timestamps.map(ts => this.historicalData.get(ts));
  }

  /**
   * Clean expired cache entries
   * @private
   */
  _cleanExpiredCache() {
    const now = Date.now();
    
    for (const [key, entry] of this.metricsCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.metricsCache.delete(key);
      }
    }
    
    // Limit cache size
    if (this.metricsCache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.metricsCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, entries.length - this.config.maxCacheSize);
      toDelete.forEach(([key]) => this.metricsCache.delete(key));
    }
  }

  /**
   * Update performance statistics
   * @private
   */
  _updatePerformanceStats(updateTime, success) {
    if (success) {
      this.updateStats.successfulUpdates++;
      
      // Update average update time
      const totalSuccessful = this.updateStats.successfulUpdates;
      this.updateStats.averageUpdateTime = 
        ((this.updateStats.averageUpdateTime * (totalSuccessful - 1)) + updateTime) / totalSuccessful;
    }
  }

  /**
   * Get synchronizer status and statistics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime?.toISOString(),
      updateInterval: this.config.updateIntervalMs,
      statistics: {
        ...this.updateStats,
        averageUpdateTime: Math.round(this.updateStats.averageUpdateTime)
      },
      cache: {
        enabled: this.config.cacheEnabled,
        size: this.metricsCache.size,
        ttl: this.config.cacheTTL
      },
      historical: {
        dataPoints: this.historicalData.size,
        oldestEntry: this.historicalData.size > 0 ? 
          new Date(Math.min(...this.historicalData.keys())).toISOString() : null
      },
      anomalies: {
        total: this.anomalies.length,
        recent: this.anomalies.filter(a => 
          Date.now() - new Date(a.detectedAt).getTime() < 3600000 // Last hour
        ).length
      }
    };
  }

  /**
   * Get recent anomalies
   * @param {number} hours - Hours to look back
   * @returns {Array} Recent anomalies
   */
  getRecentAnomalies(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return this.anomalies.filter(anomaly => 
      new Date(anomaly.detectedAt).getTime() > cutoff
    ).sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
  }

  /**
   * Force immediate metrics update
   * @returns {Promise} Update promise
   */
  async forceUpdate() {
    console.log('🔄 Forcing immediate metrics update...');
    await this._performUpdate();
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.metricsCache.clear();
    console.log('🗑️ Metrics cache cleared');
    this.emit('cacheCleared');
  }

  /**
   * Export historical data
   * @param {number} hours - Hours of data to export
   * @returns {Array} Historical data
   */
  exportHistoricalData(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return Array.from(this.historicalData.entries())
      .filter(([timestamp]) => timestamp > cutoff)
      .map(([timestamp, data]) => ({
        timestamp: new Date(timestamp).toISOString(),
        ...data
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
}
