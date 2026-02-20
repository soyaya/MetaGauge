/**
 * Monitoring and Alerting System
 * Multi-Chain RPC Integration - Task 16
 */

import { EventEmitter } from 'events';
import { errorHandler } from './ErrorHandler.js';

/**
 * Comprehensive monitoring and alerting system
 */
export class MonitoringSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Monitoring intervals
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      metricsInterval: config.metricsInterval || 60000, // 1 minute
      
      // Alert thresholds
      rpcFailureThreshold: config.rpcFailureThreshold || 5,
      backlogThreshold: config.backlogThreshold || 1000,
      responseTimeThreshold: config.responseTimeThreshold || 5000,
      errorRateThreshold: config.errorRateThreshold || 0.1,
      
      // Alert channels
      alertChannels: config.alertChannels || ['console', 'webhook'],
      webhookUrl: config.webhookUrl,
      
      ...config
    };
    
    // Monitoring state
    this.providers = new Map();
    this.metrics = {
      rpcHealth: new Map(),
      processingBacklog: 0,
      errorCounts: new Map(),
      responseTimes: new Map(),
      alerts: []
    };
    
    this.isMonitoring = false;
    this.intervals = [];
    
    this._initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  _initializeMonitoring() {
    this.startMonitoring();
    
    errorHandler.info('Monitoring system initialized', {
      healthCheckInterval: this.config.healthCheckInterval,
      alertChannels: this.config.alertChannels
    });
  }

  /**
   * Register RPC provider for monitoring
   */
  registerProvider(name, provider) {
    this.providers.set(name, {
      provider,
      lastCheck: null,
      status: 'unknown',
      consecutiveFailures: 0,
      responseTime: 0
    });
    
    errorHandler.info(`RPC provider registered for monitoring: ${name}`);
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Health check interval
    const healthInterval = setInterval(() => {
      this._performHealthChecks();
    }, this.config.healthCheckInterval);
    
    // Metrics collection interval
    const metricsInterval = setInterval(() => {
      this._collectMetrics();
      this._checkAlerts();
    }, this.config.metricsInterval);
    
    this.intervals.push(healthInterval, metricsInterval);
    
    errorHandler.info('Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    errorHandler.info('Monitoring stopped');
  }

  /**
   * Update processing backlog
   */
  updateBacklog(count) {
    this.metrics.processingBacklog = count;
    
    if (count > this.config.backlogThreshold) {
      this._triggerAlert('backlog', {
        current: count,
        threshold: this.config.backlogThreshold,
        severity: 'high'
      });
    }
  }

  /**
   * Record RPC response time
   */
  recordResponseTime(provider, responseTime) {
    if (!this.metrics.responseTimes.has(provider)) {
      this.metrics.responseTimes.set(provider, []);
    }
    
    const times = this.metrics.responseTimes.get(provider);
    times.push({ time: responseTime, timestamp: Date.now() });
    
    // Keep only recent times (last 100)
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
    
    // Check threshold
    if (responseTime > this.config.responseTimeThreshold) {
      this._triggerAlert('response_time', {
        provider,
        responseTime,
        threshold: this.config.responseTimeThreshold,
        severity: 'medium'
      });
    }
  }

  /**
   * Record error
   */
  recordError(provider, error) {
    const key = `${provider}_${error.type || 'unknown'}`;
    
    if (!this.metrics.errorCounts.has(key)) {
      this.metrics.errorCounts.set(key, []);
    }
    
    this.metrics.errorCounts.get(key).push({
      timestamp: Date.now(),
      message: error.message
    });
    
    // Calculate error rate
    const errors = this.metrics.errorCounts.get(key);
    const recentErrors = errors.filter(e => 
      Date.now() - e.timestamp < 300000 // Last 5 minutes
    );
    
    const errorRate = recentErrors.length / 300; // Errors per second
    
    if (errorRate > this.config.errorRateThreshold) {
      this._triggerAlert('error_rate', {
        provider,
        errorRate,
        threshold: this.config.errorRateThreshold,
        severity: 'high'
      });
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    const providerStatus = {};
    
    this.providers.forEach((info, name) => {
      providerStatus[name] = {
        status: info.status,
        lastCheck: info.lastCheck,
        consecutiveFailures: info.consecutiveFailures,
        responseTime: info.responseTime
      };
    });
    
    return {
      isMonitoring: this.isMonitoring,
      providers: providerStatus,
      metrics: {
        processingBacklog: this.metrics.processingBacklog,
        totalAlerts: this.metrics.alerts.length,
        recentAlerts: this.metrics.alerts.slice(-10)
      }
    };
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    const summary = {
      overall: 'healthy',
      providers: {},
      issues: []
    };
    
    // Check provider health
    this.providers.forEach((info, name) => {
      summary.providers[name] = info.status;
      
      if (info.status !== 'healthy') {
        summary.overall = 'degraded';
        summary.issues.push(`Provider ${name} is ${info.status}`);
      }
    });
    
    // Check backlog
    if (this.metrics.processingBacklog > this.config.backlogThreshold) {
      summary.overall = 'degraded';
      summary.issues.push(`High processing backlog: ${this.metrics.processingBacklog}`);
    }
    
    // Check recent alerts
    const recentAlerts = this.metrics.alerts.filter(alert => 
      Date.now() - alert.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentAlerts.length > 5) {
      summary.overall = 'critical';
      summary.issues.push(`High alert frequency: ${recentAlerts.length} in 5 minutes`);
    }
    
    return summary;
  }

  // Private methods
  async _performHealthChecks() {
    for (const [name, info] of this.providers.entries()) {
      try {
        const startTime = Date.now();
        
        // Perform health check (mock implementation)
        await this._checkProviderHealth(info.provider);
        
        const responseTime = Date.now() - startTime;
        
        // Update provider status
        this.providers.set(name, {
          ...info,
          status: 'healthy',
          lastCheck: new Date(),
          consecutiveFailures: 0,
          responseTime
        });
        
        this.recordResponseTime(name, responseTime);
        
      } catch (error) {
        const consecutiveFailures = info.consecutiveFailures + 1;
        
        this.providers.set(name, {
          ...info,
          status: consecutiveFailures >= this.config.rpcFailureThreshold ? 'failed' : 'degraded',
          lastCheck: new Date(),
          consecutiveFailures
        });
        
        this.recordError(name, error);
        
        if (consecutiveFailures >= this.config.rpcFailureThreshold) {
          this._triggerAlert('provider_failure', {
            provider: name,
            consecutiveFailures,
            error: error.message,
            severity: 'critical'
          });
        }
      }
    }
  }

  async _checkProviderHealth(provider) {
    // Mock health check - in real implementation would call provider.getBlockNumber() etc.
    if (Math.random() < 0.1) { // 10% failure rate for testing
      throw new Error('Provider health check failed');
    }
    
    // Simulate response time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }

  _collectMetrics() {
    // Collect system metrics
    const memUsage = process.memoryUsage();
    
    this.emit('metrics', {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      providers: this.providers.size,
      backlog: this.metrics.processingBacklog,
      uptime: process.uptime()
    });
  }

  _checkAlerts() {
    // Clean up old alerts (keep last 1000)
    if (this.metrics.alerts.length > 1000) {
      this.metrics.alerts.splice(0, this.metrics.alerts.length - 1000);
    }
    
    // Emit alert summary
    const recentAlerts = this.metrics.alerts.filter(alert => 
      Date.now() - alert.timestamp < 3600000 // Last hour
    );
    
    if (recentAlerts.length > 0) {
      this.emit('alertSummary', {
        total: recentAlerts.length,
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        high: recentAlerts.filter(a => a.severity === 'high').length,
        medium: recentAlerts.filter(a => a.severity === 'medium').length
      });
    }
  }

  _triggerAlert(type, details) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random()}`,
      type,
      timestamp: Date.now(),
      severity: details.severity || 'medium',
      details,
      acknowledged: false
    };
    
    this.metrics.alerts.push(alert);
    
    // Send to alert channels
    this._sendAlert(alert);
    
    // Emit alert event
    this.emit('alert', alert);
    
    errorHandler.warn(`Alert triggered: ${type}`, details);
  }

  _sendAlert(alert) {
    this.config.alertChannels.forEach(channel => {
      switch (channel) {
        case 'console':
          console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.type}`, alert.details);
          break;
          
        case 'webhook':
          if (this.config.webhookUrl) {
            this._sendWebhookAlert(alert);
          }
          break;
      }
    });
  }

  async _sendWebhookAlert(alert) {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_type: alert.type,
          severity: alert.severity,
          timestamp: alert.timestamp,
          details: alert.details
        })
      });
      
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
      
    } catch (error) {
      errorHandler.error('Webhook alert failed', { error: error.message });
    }
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.metrics.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      
      errorHandler.info(`Alert acknowledged: ${alertId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopMonitoring();
    this.providers.clear();
    this.metrics.alerts = [];
    
    errorHandler.info('Monitoring system cleanup completed');
  }
}

// Export monitoring system
export const monitoringSystem = new MonitoringSystem();
