/**
 * Comprehensive health monitoring
 */

export class HealthMonitor {
  constructor(components) {
    this.components = components;
    this.healthHistory = [];
    this.monitoringInterval = null;
    this.alerts = [];
  }

  /**
   * Start health monitoring
   */
  startMonitoring(interval = 30000) {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, interval);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      components: {}
    };

    // Check RPC pool
    health.components.rpc = await this.checkRPCHealth();
    
    // Check file storage
    health.components.storage = await this.checkStorageHealth();
    
    // Check indexer manager
    health.components.indexer = this.checkIndexerHealth();
    
    // Check WebSocket
    if (this.components.wsManager) {
      health.components.websocket = this.checkWebSocketHealth();
    }

    // Determine overall health
    const unhealthy = Object.values(health.components).some(c => !c.healthy);
    health.overall = unhealthy ? 'degraded' : 'healthy';

    // Store in history
    this.healthHistory.push(health);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    // Check for alerts
    this.checkAlerts(health);

    return health;
  }

  /**
   * Check RPC health
   */
  async checkRPCHealth() {
    try {
      const rpcHealth = await this.components.rpcPool.checkRPCHealth();
      return {
        healthy: rpcHealth.healthy,
        chains: rpcHealth.chains,
        details: 'RPC endpoints operational'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Check storage health
   */
  async checkStorageHealth() {
    try {
      const storageHealth = await this.components.storage.checkHealth();
      return {
        healthy: storageHealth.healthy,
        freeSpace: storageHealth.freeSpacePercent,
        warning: storageHealth.warning
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Check indexer health
   */
  checkIndexerHealth() {
    const activeIndexers = this.components.indexerManager?.getActiveIndexers() || [];
    
    return {
      healthy: true,
      activeCount: activeIndexers.length,
      details: `${activeIndexers.length} active indexing sessions`
    };
  }

  /**
   * Check WebSocket health
   */
  checkWebSocketHealth() {
    const clientCount = this.components.wsManager?.clients.size || 0;
    
    return {
      healthy: true,
      connectedClients: clientCount,
      details: `${clientCount} WebSocket connections`
    };
  }

  /**
   * Check for alerts
   */
  checkAlerts(health) {
    // Low disk space alert
    if (health.components.storage?.freeSpace < 10) {
      this.addAlert('warning', 'Low disk space', health.components.storage);
    }

    // RPC unhealthy alert
    if (!health.components.rpc?.healthy) {
      this.addAlert('error', 'RPC endpoints unhealthy', health.components.rpc);
    }

    // Overall degraded alert
    if (health.overall === 'degraded') {
      this.addAlert('warning', 'System health degraded', health);
    }
  }

  /**
   * Add alert
   */
  addAlert(level, message, data) {
    const alert = {
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.alerts.push(alert);
    console.warn(`🚨 [${level.toUpperCase()}] ${message}`);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
  }

  /**
   * Get current health
   */
  async getCurrentHealth() {
    return await this.performHealthCheck();
  }

  /**
   * Get health history
   */
  getHealthHistory() {
    return this.healthHistory;
  }

  /**
   * Get alerts
   */
  getAlerts() {
    return this.alerts;
  }

  /**
   * Get detailed health report
   */
  async getDetailedHealth() {
    const current = await this.getCurrentHealth();
    
    return {
      current,
      history: this.healthHistory.slice(-10),
      alerts: this.alerts.slice(-10),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}
