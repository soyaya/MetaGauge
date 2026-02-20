/**
 * RPC Client Pool with chain-specific endpoint management
 * Provides failover, load balancing, and health monitoring
 */

import { getChainConfig } from '../config/chains.js';
import { INDEXER_CONFIG } from '../config/indexer.js';

export class RPCClientPool {
  constructor() {
    this.endpoints = new Map(); // chainId -> endpoint[]
    this.endpointHealth = new Map(); // endpoint -> { healthy, lastCheck, failures }
    this.currentIndex = new Map(); // chainId -> current endpoint index
    this.healthCheckInterval = null;
  }

  /**
   * Initialize RPC endpoints for a chain
   */
  initializeChain(chainId) {
    const config = getChainConfig(chainId);
    
    if (!this.endpoints.has(chainId)) {
      this.endpoints.set(chainId, config.rpcEndpoints);
      this.currentIndex.set(chainId, 0);
      
      // Initialize health status for all endpoints
      config.rpcEndpoints.forEach(endpoint => {
        if (!this.endpointHealth.has(endpoint)) {
          this.endpointHealth.set(endpoint, {
            healthy: true,
            lastCheck: Date.now(),
            failures: 0,
            responseTime: 0
          });
        }
      });
    }
  }

  /**
   * Get healthy endpoint with round-robin load balancing
   */
  getHealthyEndpoint(chainId) {
    const endpoints = this.endpoints.get(chainId);
    if (!endpoints || endpoints.length === 0) {
      throw new Error(`No RPC endpoints configured for chain: ${chainId}`);
    }

    // Try to find healthy endpoint
    const startIndex = this.currentIndex.get(chainId) || 0;
    let attempts = 0;

    while (attempts < endpoints.length) {
      const index = (startIndex + attempts) % endpoints.length;
      const endpoint = endpoints[index];
      const health = this.endpointHealth.get(endpoint);

      if (health && health.healthy) {
        // Update index for next call (round-robin)
        this.currentIndex.set(chainId, (index + 1) % endpoints.length);
        return endpoint;
      }

      attempts++;
    }

    // All endpoints unhealthy, return first one anyway
    console.warn(`All RPC endpoints unhealthy for ${chainId}, using first endpoint`);
    return endpoints[0];
  }

  /**
   * Mark endpoint as unhealthy
   */
  markEndpointUnhealthy(endpoint, error) {
    const health = this.endpointHealth.get(endpoint);
    if (health) {
      health.failures++;
      
      // Mark unhealthy after threshold
      if (health.failures >= INDEXER_CONFIG.circuitBreakerThreshold) {
        health.healthy = false;
        console.warn(`Endpoint marked unhealthy: ${endpoint} (${health.failures} failures)`);
      }
    }
  }

  /**
   * Mark endpoint as healthy
   */
  markEndpointHealthy(endpoint, responseTime) {
    const health = this.endpointHealth.get(endpoint);
    if (health) {
      health.healthy = true;
      health.failures = 0;
      health.responseTime = responseTime;
      health.lastCheck = Date.now();
    }
  }

  /**
   * Start health check polling
   */
  startHealthChecks() {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, INDEXER_CONFIG.healthCheckInterval);
  }

  /**
   * Stop health check polling
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health checks on all endpoints
   */
  async performHealthChecks() {
    const checks = [];

    for (const [endpoint, health] of this.endpointHealth.entries()) {
      checks.push(this.checkEndpoint(endpoint, health));
    }

    await Promise.allSettled(checks);
  }

  /**
   * Check single endpoint health
   */
  async checkEndpoint(endpoint, health) {
    try {
      const startTime = Date.now();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const responseTime = Date.now() - startTime;
        this.markEndpointHealthy(endpoint, responseTime);
      } else {
        this.markEndpointUnhealthy(endpoint, new Error(`HTTP ${response.status}`));
      }
    } catch (error) {
      this.markEndpointUnhealthy(endpoint, error);
    }
  }

  /**
   * Get RPC health status
   */
  async checkRPCHealth() {
    const healthStatus = {};

    for (const [chainId, endpoints] of this.endpoints.entries()) {
      healthStatus[chainId] = {
        endpoints: endpoints.map(endpoint => {
          const health = this.endpointHealth.get(endpoint);
          return {
            url: endpoint,
            healthy: health?.healthy || false,
            failures: health?.failures || 0,
            responseTime: health?.responseTime || 0,
            lastCheck: health?.lastCheck || 0
          };
        }),
        healthyCount: endpoints.filter(e => this.endpointHealth.get(e)?.healthy).length,
        totalCount: endpoints.length
      };
    }

    return {
      healthy: Object.values(healthStatus).every(chain => chain.healthyCount > 0),
      chains: healthStatus
    };
  }
}
