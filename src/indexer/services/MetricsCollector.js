/**
 * Performance metrics collection
 */

export class MetricsCollector {
  constructor() {
    this.metrics = {
      blocksProcessed: 0,
      chunksProcessed: 0,
      rpcRequests: 0,
      rpcFailures: 0,
      totalProcessingTime: 0,
      startTime: Date.now()
    };
    this.userMetrics = new Map(); // userId -> metrics
  }

  /**
   * Record blocks processed
   */
  recordBlocksProcessed(userId, count) {
    this.metrics.blocksProcessed += count;
    this.getUserMetrics(userId).blocksProcessed += count;
  }

  /**
   * Record chunk processed
   */
  recordChunkProcessed(userId, processingTime) {
    this.metrics.chunksProcessed++;
    this.metrics.totalProcessingTime += processingTime;
    
    const userMetrics = this.getUserMetrics(userId);
    userMetrics.chunksProcessed++;
    userMetrics.totalProcessingTime += processingTime;
  }

  /**
   * Record RPC request
   */
  recordRPCRequest(success, latency) {
    this.metrics.rpcRequests++;
    if (!success) this.metrics.rpcFailures++;
    
    if (!this.metrics.rpcLatencies) this.metrics.rpcLatencies = [];
    this.metrics.rpcLatencies.push(latency);
    
    // Keep only last 100
    if (this.metrics.rpcLatencies.length > 100) {
      this.metrics.rpcLatencies.shift();
    }
  }

  /**
   * Get user metrics
   */
  getUserMetrics(userId) {
    if (!this.userMetrics.has(userId)) {
      this.userMetrics.set(userId, {
        blocksProcessed: 0,
        chunksProcessed: 0,
        totalProcessingTime: 0,
        errors: 0
      });
    }
    return this.userMetrics.get(userId);
  }

  /**
   * Record error
   */
  recordError(userId) {
    this.getUserMetrics(userId).errors++;
  }

  /**
   * Get blocks per second
   */
  getBlocksPerSecond() {
    const elapsed = (Date.now() - this.metrics.startTime) / 1000;
    return (this.metrics.blocksProcessed / elapsed).toFixed(2);
  }

  /**
   * Get average chunk processing time
   */
  getAvgChunkTime() {
    if (this.metrics.chunksProcessed === 0) return 0;
    return (this.metrics.totalProcessingTime / this.metrics.chunksProcessed).toFixed(2);
  }

  /**
   * Get RPC success rate
   */
  getRPCSuccessRate() {
    if (this.metrics.rpcRequests === 0) return 100;
    return (((this.metrics.rpcRequests - this.metrics.rpcFailures) / this.metrics.rpcRequests) * 100).toFixed(2);
  }

  /**
   * Get average RPC latency
   */
  getAvgRPCLatency() {
    if (!this.metrics.rpcLatencies || this.metrics.rpcLatencies.length === 0) return 0;
    const sum = this.metrics.rpcLatencies.reduce((a, b) => a + b, 0);
    return (sum / this.metrics.rpcLatencies.length).toFixed(2);
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      blocksPerSecond: this.getBlocksPerSecond(),
      avgChunkTime: this.getAvgChunkTime(),
      rpcSuccessRate: this.getRPCSuccessRate(),
      avgRPCLatency: this.getAvgRPCLatency(),
      uptime: Date.now() - this.metrics.startTime
    };
  }

  /**
   * Get user statistics
   */
  getUserStats(userId) {
    return this.userMetrics.get(userId) || null;
  }
}
