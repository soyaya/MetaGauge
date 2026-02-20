/**
 * Performance Monitor and Optimization Engine
 * Multi-Chain RPC Integration - Task 12
 * Requirements: 3.1, 4.1, 5.1
 */

import { EventEmitter } from 'events';
import { errorHandler } from './ErrorHandler.js';

/**
 * Performance monitoring and optimization system
 * Tracks metrics, identifies bottlenecks, and implements optimizations
 */
export class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Monitoring settings
      metricsInterval: config.metricsInterval || 5000, // 5 seconds
      alertThresholds: {
        responseTime: config.responseTimeThreshold || 5000, // 5 seconds
        errorRate: config.errorRateThreshold || 0.1, // 10%
        memoryUsage: config.memoryThreshold || 0.8, // 80%
        cpuUsage: config.cpuThreshold || 0.8, // 80%
        ...config.alertThresholds
      },
      
      // Optimization settings
      cacheSize: config.cacheSize || 1000,
      cacheTtl: config.cacheTtl || 300000, // 5 minutes
      batchSize: config.batchSize || 100,
      concurrencyLimit: config.concurrencyLimit || 10,
      
      ...config
    };
    
    // Performance metrics
    this.metrics = {
      requests: new Map(), // Request tracking
      responses: new Map(), // Response time tracking
      errors: new Map(), // Error tracking
      cache: new Map(), // Cache performance
      system: {}, // System metrics
      custom: new Map() // Custom metrics
    };
    
    // Optimization components
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.requestQueue = [];
    this.activeRequests = new Set();
    this.batchProcessor = null;
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    this._initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   * @private
   */
  _initializeMonitoring() {
    // Start system metrics collection
    this.startMonitoring();
    
    // Set up batch processing
    this._initializeBatchProcessor();
    
    errorHandler.info('Performance monitor initialized', {
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(() => {
      this._collectSystemMetrics();
      this._checkAlerts();
      this._optimizePerformance();
    }, this.config.metricsInterval);
    
    errorHandler.info('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    errorHandler.info('Performance monitoring stopped');
  }

  /**
   * Track request performance
   * @param {string} requestId - Unique request identifier
   * @param {Object} metadata - Request metadata
   */
  startRequest(requestId, metadata = {}) {
    const startTime = Date.now();
    
    this.metrics.requests.set(requestId, {
      startTime,
      metadata,
      status: 'active'
    });
    
    this.activeRequests.add(requestId);
    
    errorHandler.debug('Request started', { requestId, metadata });
  }

  /**
   * Complete request tracking
   * @param {string} requestId - Request identifier
   * @param {Object} result - Request result
   */
  endRequest(requestId, result = {}) {
    const request = this.metrics.requests.get(requestId);
    
    if (!request) {
      errorHandler.warn('Request not found for completion', { requestId });
      return;
    }
    
    const endTime = Date.now();
    const responseTime = endTime - request.startTime;
    
    // Update request metrics
    this.metrics.requests.set(requestId, {
      ...request,
      endTime,
      responseTime,
      result,
      status: 'completed'
    });
    
    // Track response time
    const operation = request.metadata.operation || 'unknown';
    if (!this.metrics.responses.has(operation)) {
      this.metrics.responses.set(operation, []);
    }
    
    this.metrics.responses.get(operation).push({
      timestamp: endTime,
      responseTime,
      success: !result.error
    });
    
    // Keep only recent response times (last 1000)
    const responses = this.metrics.responses.get(operation);
    if (responses.length > 1000) {
      responses.splice(0, responses.length - 1000);
    }
    
    this.activeRequests.delete(requestId);
    
    errorHandler.debug('Request completed', {
      requestId,
      responseTime,
      operation
    });
    
    // Emit performance event
    this.emit('requestCompleted', {
      requestId,
      responseTime,
      operation,
      success: !result.error
    });
  }

  /**
   * Track error occurrence
   * @param {string} operation - Operation that failed
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  trackError(operation, error, context = {}) {
    const timestamp = Date.now();
    
    if (!this.metrics.errors.has(operation)) {
      this.metrics.errors.set(operation, []);
    }
    
    this.metrics.errors.get(operation).push({
      timestamp,
      error: error.message,
      stack: error.stack,
      context
    });
    
    // Keep only recent errors (last 500)
    const errors = this.metrics.errors.get(operation);
    if (errors.length > 500) {
      errors.splice(0, errors.length - 500);
    }
    
    errorHandler.debug('Error tracked', {
      operation,
      error: error.message,
      context
    });
    
    // Emit error event
    this.emit('errorTracked', {
      operation,
      error: error.message,
      context,
      timestamp
    });
  }

  /**
   * Get cached result
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    const timestamp = this.cacheTimestamps.get(key);
    
    if (!cached || !timestamp) {
      this._trackCacheMetric('miss');
      return null;
    }
    
    // Check TTL
    if (Date.now() - timestamp > this.config.cacheTtl) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      this._trackCacheMetric('expired');
      return null;
    }
    
    this._trackCacheMetric('hit');
    return cached;
  }

  /**
   * Store result in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  setCache(key, value) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
    
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
    
    this._trackCacheMetric('set');
  }

  /**
   * Add request to batch queue
   * @param {Object} request - Request to batch
   * @returns {Promise} Request result
   */
  addToBatch(request) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        ...request,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Execute operation with concurrency control
   * @param {Function} operation - Operation to execute
   * @param {string} operationId - Operation identifier
   * @returns {Promise} Operation result
   */
  async executeWithConcurrencyControl(operation, operationId) {
    // Wait if at concurrency limit
    while (this.activeRequests.size >= this.config.concurrencyLimit) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const requestId = `${operationId}_${Date.now()}_${Math.random()}`;
    
    try {
      this.startRequest(requestId, { operation: operationId });
      
      const result = await operation();
      
      this.endRequest(requestId, { success: true });
      
      return result;
      
    } catch (error) {
      this.endRequest(requestId, { error: error.message });
      this.trackError(operationId, error);
      
      throw error;
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Calculate response time statistics
    const responseStats = {};
    this.metrics.responses.forEach((responses, operation) => {
      const recentResponses = responses.filter(r => r.timestamp > oneMinuteAgo);
      
      if (recentResponses.length > 0) {
        const times = recentResponses.map(r => r.responseTime);
        const successCount = recentResponses.filter(r => r.success).length;
        
        responseStats[operation] = {
          count: recentResponses.length,
          avgResponseTime: times.reduce((a, b) => a + b, 0) / times.length,
          minResponseTime: Math.min(...times),
          maxResponseTime: Math.max(...times),
          successRate: successCount / recentResponses.length,
          errorRate: 1 - (successCount / recentResponses.length)
        };
      }
    });
    
    // Calculate error statistics
    const errorStats = {};
    this.metrics.errors.forEach((errors, operation) => {
      const recentErrors = errors.filter(e => e.timestamp > oneMinuteAgo);
      errorStats[operation] = {
        count: recentErrors.length,
        rate: recentErrors.length / 60 // errors per second
      };
    });
    
    // Cache statistics
    const cacheStats = this.metrics.cache.get('stats') || {
      hits: 0,
      misses: 0,
      sets: 0,
      expired: 0
    };
    
    const totalCacheRequests = cacheStats.hits + cacheStats.misses;
    const cacheHitRate = totalCacheRequests > 0 ? cacheStats.hits / totalCacheRequests : 0;
    
    return {
      timestamp: now,
      system: this.metrics.system,
      responses: responseStats,
      errors: errorStats,
      cache: {
        ...cacheStats,
        hitRate: cacheHitRate,
        size: this.cache.size,
        maxSize: this.config.cacheSize
      },
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      custom: Object.fromEntries(this.metrics.custom)
    };
  }

  /**
   * Add custom metric
   * @param {string} name - Metric name
   * @param {any} value - Metric value
   */
  addCustomMetric(name, value) {
    this.metrics.custom.set(name, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Get performance recommendations
   * @returns {Array} Performance recommendations
   */
  getRecommendations() {
    const metrics = this.getMetrics();
    const recommendations = [];
    
    // Response time recommendations
    Object.entries(metrics.responses).forEach(([operation, stats]) => {
      if (stats.avgResponseTime > this.config.alertThresholds.responseTime) {
        recommendations.push({
          type: 'performance',
          severity: 'high',
          operation,
          issue: 'High response time',
          recommendation: 'Consider caching, optimization, or scaling',
          metric: `${stats.avgResponseTime}ms average response time`
        });
      }
      
      if (stats.errorRate > this.config.alertThresholds.errorRate) {
        recommendations.push({
          type: 'reliability',
          severity: 'high',
          operation,
          issue: 'High error rate',
          recommendation: 'Investigate error causes and implement retry logic',
          metric: `${(stats.errorRate * 100).toFixed(1)}% error rate`
        });
      }
    });
    
    // Cache recommendations
    if (metrics.cache.hitRate < 0.5 && metrics.cache.size > 0) {
      recommendations.push({
        type: 'caching',
        severity: 'medium',
        issue: 'Low cache hit rate',
        recommendation: 'Review cache keys and TTL settings',
        metric: `${(metrics.cache.hitRate * 100).toFixed(1)}% hit rate`
      });
    }
    
    // System recommendations
    if (metrics.system.memoryUsage > this.config.alertThresholds.memoryUsage) {
      recommendations.push({
        type: 'system',
        severity: 'high',
        issue: 'High memory usage',
        recommendation: 'Consider memory optimization or scaling',
        metric: `${(metrics.system.memoryUsage * 100).toFixed(1)}% memory usage`
      });
    }
    
    return recommendations;
  }

  // Private methods
  _collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    
    this.metrics.system = {
      timestamp: Date.now(),
      memoryUsage: usedMemory / totalMemory,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      uptime: process.uptime(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };
  }

  _checkAlerts() {
    const metrics = this.getMetrics();
    
    // Check response time alerts
    Object.entries(metrics.responses).forEach(([operation, stats]) => {
      if (stats.avgResponseTime > this.config.alertThresholds.responseTime) {
        this.emit('alert', {
          type: 'responseTime',
          operation,
          value: stats.avgResponseTime,
          threshold: this.config.alertThresholds.responseTime
        });
      }
      
      if (stats.errorRate > this.config.alertThresholds.errorRate) {
        this.emit('alert', {
          type: 'errorRate',
          operation,
          value: stats.errorRate,
          threshold: this.config.alertThresholds.errorRate
        });
      }
    });
    
    // Check system alerts
    if (metrics.system.memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.emit('alert', {
        type: 'memoryUsage',
        value: metrics.system.memoryUsage,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }
  }

  _optimizePerformance() {
    // Clean up old metrics
    this._cleanupOldMetrics();
    
    // Optimize cache
    this._optimizeCache();
    
    // Process batch queue
    this._processBatchQueue();
  }

  _cleanupOldMetrics() {
    const oneHourAgo = Date.now() - 3600000;
    
    // Clean up old requests
    this.metrics.requests.forEach((request, requestId) => {
      if (request.endTime && request.endTime < oneHourAgo) {
        this.metrics.requests.delete(requestId);
      }
    });
  }

  _optimizeCache() {
    // Remove expired cache entries
    const now = Date.now();
    
    this.cacheTimestamps.forEach((timestamp, key) => {
      if (now - timestamp > this.config.cacheTtl) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    });
  }

  _initializeBatchProcessor() {
    this.batchProcessor = setInterval(() => {
      this._processBatchQueue();
    }, 100); // Process every 100ms
  }

  _processBatchQueue() {
    if (this.requestQueue.length === 0) return;
    
    const batchSize = Math.min(this.config.batchSize, this.requestQueue.length);
    const batch = this.requestQueue.splice(0, batchSize);
    
    // Group by operation type
    const groupedBatch = {};
    batch.forEach(request => {
      const operation = request.operation || 'default';
      if (!groupedBatch[operation]) {
        groupedBatch[operation] = [];
      }
      groupedBatch[operation].push(request);
    });
    
    // Process each group
    Object.entries(groupedBatch).forEach(([operation, requests]) => {
      this._processBatchGroup(operation, requests);
    });
  }

  async _processBatchGroup(operation, requests) {
    try {
      // Execute batch operation
      const results = await this._executeBatchOperation(operation, requests);
      
      // Resolve individual requests
      requests.forEach((request, index) => {
        const result = results[index];
        if (result.error) {
          request.reject(new Error(result.error));
        } else {
          request.resolve(result.data);
        }
      });
      
    } catch (error) {
      // Reject all requests in batch
      requests.forEach(request => {
        request.reject(error);
      });
      
      errorHandler.error('Batch processing failed', {
        operation,
        batchSize: requests.length,
        error: error.message
      });
    }
  }

  async _executeBatchOperation(operation, requests) {
    // Placeholder for batch operation logic
    // In real implementation, would optimize based on operation type
    
    return requests.map(request => ({
      data: `Batch result for ${request.id || 'unknown'}`,
      error: null
    }));
  }

  _trackCacheMetric(type) {
    const stats = this.metrics.cache.get('stats') || {
      hits: 0,
      misses: 0,
      sets: 0,
      expired: 0
    };
    
    stats[type] = (stats[type] || 0) + 1;
    this.metrics.cache.set('stats', stats);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopMonitoring();
    
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
      this.batchProcessor = null;
    }
    
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.requestQueue.length = 0;
    this.activeRequests.clear();
    
    errorHandler.info('Performance monitor cleanup completed');
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
