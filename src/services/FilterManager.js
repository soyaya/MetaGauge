/**
 * Filter Manager
 * Handles Ethereum event filters with automatic cleanup and error recovery
 * Prevents "filter not found" errors by managing filter lifecycle
 */

export class FilterManager {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.config = {
      filterTimeout: options.filterTimeout || 300000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      ...options
    };
    
    this.activeFilters = new Map();
    this.filterTimeouts = new Map();
    this.cleanupInterval = null;
    
    this._startCleanupTimer();
  }

  /**
   * Create a managed event filter
   * @param {Object} filterOptions - Filter configuration
   * @returns {Promise<string>} Filter ID
   */
  async createFilter(filterOptions) {
    try {
      // Use eth_getLogs instead of creating persistent filters for better reliability
      const logs = await this._makeRpcCall('eth_getLogs', [filterOptions]);
      
      // Create a pseudo-filter ID for tracking
      const filterId = `logs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store the filter configuration for potential re-use
      this.activeFilters.set(filterId, {
        options: filterOptions,
        logs: logs,
        created: Date.now(),
        type: 'logs'
      });
      
      return { filterId, logs };
    } catch (error) {
      console.warn(`Failed to create filter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get filter changes with automatic error recovery
   * @param {string} filterId - Filter ID
   * @returns {Promise<Array>} New logs
   */
  async getFilterChanges(filterId) {
    const filter = this.activeFilters.get(filterId);
    
    if (!filter) {
      console.warn(`Filter ${filterId} not found in active filters`);
      return [];
    }

    try {
      if (filter.type === 'logs') {
        // For logs-based filters, re-fetch with updated block range
        const currentBlock = await this.provider.getBlockNumber();
        const lastBlock = filter.lastCheckedBlock || filter.options.fromBlock;
        
        if (currentBlock > lastBlock) {
          const newLogs = await this._makeRpcCall('eth_getLogs', [{
            ...filter.options,
            fromBlock: '0x' + (lastBlock + 1).toString(16),
            toBlock: '0x' + currentBlock.toString(16)
          }]);
          
          // Update last checked block
          filter.lastCheckedBlock = currentBlock;
          
          return newLogs;
        }
        
        return [];
      }
      
      // For traditional filters (fallback)
      return await this._makeRpcCall('eth_getFilterChanges', [filterId]);
    } catch (error) {
      if (error.message.includes('filter not found')) {
        console.warn(`Filter ${filterId} expired, recreating...`);
        return await this._recreateFilter(filterId);
      }
      throw error;
    }
  }

  /**
   * Recreate an expired filter
   * @private
   */
  async _recreateFilter(filterId) {
    const filter = this.activeFilters.get(filterId);
    
    if (!filter) {
      return [];
    }

    try {
      // Get current block for updated range
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = filter.lastCheckedBlock || filter.options.fromBlock;
      
      const newLogs = await this._makeRpcCall('eth_getLogs', [{
        ...filter.options,
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + currentBlock.toString(16)
      }]);
      
      // Update filter info
      filter.lastCheckedBlock = currentBlock;
      filter.created = Date.now();
      
      return newLogs;
    } catch (error) {
      console.error(`Failed to recreate filter ${filterId}: ${error.message}`);
      this.removeFilter(filterId);
      return [];
    }
  }

  /**
   * Remove a filter
   * @param {string} filterId - Filter ID
   */
  async removeFilter(filterId) {
    try {
      const filter = this.activeFilters.get(filterId);
      
      if (filter && filter.type !== 'logs') {
        // Only try to uninstall actual RPC filters
        await this._makeRpcCall('eth_uninstallFilter', [filterId]);
      }
    } catch (error) {
      // Ignore errors when removing filters (they might already be expired)
      console.warn(`Failed to remove filter ${filterId}: ${error.message}`);
    } finally {
      this.activeFilters.delete(filterId);
      
      if (this.filterTimeouts.has(filterId)) {
        clearTimeout(this.filterTimeouts.get(filterId));
        this.filterTimeouts.delete(filterId);
      }
    }
  }

  /**
   * Create a robust event listener that handles filter errors
   * @param {Object} filterOptions - Filter configuration
   * @param {Function} callback - Event callback
   * @returns {Function} Cleanup function
   */
  createEventListener(filterOptions, callback) {
    let isActive = true;
    let pollInterval = null;
    
    const poll = async () => {
      if (!isActive) return;
      
      try {
        const result = await this.createFilter(filterOptions);
        const logs = result.logs;
        
        if (logs.length > 0) {
          for (const log of logs) {
            callback(log);
          }
        }
        
        // Update fromBlock for next poll
        if (logs.length > 0) {
          const lastBlock = Math.max(...logs.map(log => parseInt(log.blockNumber, 16)));
          filterOptions.fromBlock = '0x' + (lastBlock + 1).toString(16);
        }
      } catch (error) {
        console.error(`Event listener error: ${error.message}`);
      }
      
      if (isActive) {
        pollInterval = setTimeout(poll, 5000); // Poll every 5 seconds
      }
    };
    
    // Start polling
    poll();
    
    // Return cleanup function
    return () => {
      isActive = false;
      if (pollInterval) {
        clearTimeout(pollInterval);
      }
    };
  }

  /**
   * Make RPC call with retry logic
   * @private
   */
  async _makeRpcCall(method, params, retries = this.config.maxRetries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.provider.send(method, params);
        return result;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (attempt + 1)));
      }
    }
  }

  /**
   * Start automatic cleanup timer
   * @private
   */
  _startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [filterId, filter] of this.activeFilters.entries()) {
        if (now - filter.created > this.config.filterTimeout) {
          console.log(`Cleaning up expired filter: ${filterId}`);
          this.removeFilter(filterId);
        }
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Stop the filter manager and cleanup all resources
   */
  async destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Remove all active filters
    const filterIds = Array.from(this.activeFilters.keys());
    await Promise.all(filterIds.map(id => this.removeFilter(id)));
    
    this.activeFilters.clear();
    this.filterTimeouts.clear();
  }

  /**
   * Get statistics about active filters
   * @returns {Object} Filter statistics
   */
  getStats() {
    return {
      activeFilters: this.activeFilters.size,
      oldestFilter: this.activeFilters.size > 0 ? 
        Math.min(...Array.from(this.activeFilters.values()).map(f => f.created)) : null,
      filterTypes: Array.from(this.activeFilters.values()).reduce((acc, filter) => {
        acc[filter.type] = (acc[filter.type] || 0) + 1;
        return acc;
      }, {})
    };
  }
}