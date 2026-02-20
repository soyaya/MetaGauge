/**
 * Robust Provider Wrapper
 * Wraps ethers.js providers to handle filter errors gracefully
 * Prevents "filter not found" errors by using alternative approaches
 */

import { ethers } from 'ethers';
import { FilterManager } from './FilterManager.js';

export class RobustProvider {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.filterManager = new FilterManager(provider, options);
    this.config = {
      usePolling: options.usePolling || false,
      pollingInterval: options.pollingInterval || 4000,
      maxBlockRange: options.maxBlockRange || 2000,
      ...options
    };
    
    this.eventListeners = new Map();
    this.isDestroyed = false;
    
    // Wrap provider methods
    this._wrapProviderMethods();
  }

  /**
   * Wrap provider methods to handle filter errors
   * @private
   */
  _wrapProviderMethods() {
    // Wrap the on method to handle event subscriptions
    const originalOn = this.provider.on?.bind(this.provider);
    if (originalOn) {
      this.provider.on = (eventName, listener) => {
        if (typeof eventName === 'object' && eventName.address) {
          // This is a filter object, use our robust event handling
          return this.createRobustEventListener(eventName, listener);
        }
        // For other events (like 'block'), use original method
        return originalOn(eventName, listener);
      };
    }

    // Wrap removeListener
    const originalRemoveListener = this.provider.removeListener?.bind(this.provider);
    if (originalRemoveListener) {
      this.provider.removeListener = (eventName, listener) => {
        if (typeof eventName === 'object' && eventName.address) {
          return this.removeRobustEventListener(eventName, listener);
        }
        return originalRemoveListener(eventName, listener);
      };
    }
  }

  /**
   * Create a robust event listener that doesn't use persistent filters
   * @param {Object} filter - Event filter
   * @param {Function} listener - Event callback
   * @returns {Function} Cleanup function
   */
  createRobustEventListener(filter, listener) {
    const listenerId = `${filter.address}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert filter to eth_getLogs format
    const logFilter = {
      address: filter.address,
      topics: filter.topics || [],
      fromBlock: 'latest'
    };
    
    let lastCheckedBlock = null;
    let isActive = true;
    let pollTimeout = null;
    
    const poll = async () => {
      if (!isActive || this.isDestroyed) return;
      
      try {
        const currentBlock = await this.provider.getBlockNumber();
        
        if (lastCheckedBlock === null) {
          lastCheckedBlock = currentBlock;
          // For first poll, only check recent blocks to avoid overwhelming
          logFilter.fromBlock = '0x' + Math.max(0, currentBlock - 10).toString(16);
        } else if (currentBlock > lastCheckedBlock) {
          logFilter.fromBlock = '0x' + (lastCheckedBlock + 1).toString(16);
        } else {
          // No new blocks, schedule next poll
          if (isActive) {
            pollTimeout = setTimeout(poll, this.config.pollingInterval);
          }
          return;
        }
        
        logFilter.toBlock = '0x' + currentBlock.toString(16);
        
        // Limit block range to prevent RPC timeouts
        const fromBlockNum = parseInt(logFilter.fromBlock, 16);
        const toBlockNum = parseInt(logFilter.toBlock, 16);
        
        if (toBlockNum - fromBlockNum > this.config.maxBlockRange) {
          logFilter.fromBlock = '0x' + (toBlockNum - this.config.maxBlockRange).toString(16);
        }
        
        const logs = await this.provider.send('eth_getLogs', [logFilter]);
        
        // Process logs
        for (const log of logs) {
          if (isActive) {
            // Convert log to ethers.js format
            const ethersLog = {
              ...log,
              blockNumber: parseInt(log.blockNumber, 16),
              transactionIndex: parseInt(log.transactionIndex, 16),
              logIndex: parseInt(log.logIndex, 16),
              removed: log.removed || false
            };
            
            try {
              listener(ethersLog);
            } catch (error) {
              console.error(`Event listener error: ${error.message}`);
            }
          }
        }
        
        lastCheckedBlock = currentBlock;
      } catch (error) {
        console.error(`Polling error for ${filter.address}: ${error.message}`);
        
        // If it's a filter-related error, we can continue polling
        if (!error.message.includes('filter not found')) {
          // For other errors, wait a bit longer before retrying
          if (isActive) {
            pollTimeout = setTimeout(poll, this.config.pollingInterval * 2);
          }
          return;
        }
      }
      
      // Schedule next poll
      if (isActive) {
        pollTimeout = setTimeout(poll, this.config.pollingInterval);
      }
    };
    
    // Start polling
    poll();
    
    // Store cleanup function
    const cleanup = () => {
      isActive = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
      this.eventListeners.delete(listenerId);
    };
    
    this.eventListeners.set(listenerId, {
      filter,
      listener,
      cleanup
    });
    
    return cleanup;
  }

  /**
   * Remove a robust event listener
   * @param {Object} filter - Event filter
   * @param {Function} listener - Event callback
   */
  removeRobustEventListener(filter, listener) {
    for (const [listenerId, eventListener] of this.eventListeners.entries()) {
      if (eventListener.filter.address === filter.address && 
          eventListener.listener === listener) {
        eventListener.cleanup();
        return true;
      }
    }
    return false;
  }

  /**
   * Get logs with automatic chunking for large block ranges
   * @param {Object} filter - Log filter
   * @returns {Promise<Array>} Logs
   */
  async getLogs(filter) {
    const fromBlock = typeof filter.fromBlock === 'string' ? 
      parseInt(filter.fromBlock, 16) : filter.fromBlock;
    const toBlock = typeof filter.toBlock === 'string' ? 
      parseInt(filter.toBlock, 16) : filter.toBlock;
    
    const blockRange = toBlock - fromBlock + 1;
    
    // If range is small, make single request
    if (blockRange <= this.config.maxBlockRange) {
      try {
        return await this.provider.send('eth_getLogs', [filter]);
      } catch (error) {
        if (error.message.includes('filter not found')) {
          // Retry with fresh request
          return await this.provider.send('eth_getLogs', [filter]);
        }
        throw error;
      }
    }
    
    // For large ranges, chunk the requests
    console.log(`Chunking large log request: ${blockRange} blocks`);
    const allLogs = [];
    
    for (let start = fromBlock; start <= toBlock; start += this.config.maxBlockRange) {
      const end = Math.min(start + this.config.maxBlockRange - 1, toBlock);
      
      const chunkFilter = {
        ...filter,
        fromBlock: '0x' + start.toString(16),
        toBlock: '0x' + end.toString(16)
      };
      
      try {
        const logs = await this.provider.send('eth_getLogs', [chunkFilter]);
        allLogs.push(...logs);
        
        // Small delay between chunks to avoid rate limiting
        if (end < toBlock) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.warn(`Failed to get logs for blocks ${start}-${end}: ${error.message}`);
        
        // Continue with other chunks
        if (!error.message.includes('timeout') && !error.message.includes('rate limit')) {
          throw error;
        }
      }
    }
    
    return allLogs;
  }

  /**
   * Proxy all other provider methods
   */
  getBlockNumber() {
    return this.provider.getBlockNumber();
  }

  getBlock(blockHashOrBlockTag, includeTransactions) {
    return this.provider.getBlock(blockHashOrBlockTag, includeTransactions);
  }

  getTransaction(transactionHash) {
    return this.provider.getTransaction(transactionHash);
  }

  getTransactionReceipt(transactionHash) {
    return this.provider.getTransactionReceipt(transactionHash);
  }

  send(method, params) {
    // Intercept filter-related methods
    if (method === 'eth_getFilterChanges') {
      console.warn('eth_getFilterChanges intercepted - using robust alternative');
      return Promise.resolve([]);
    }
    
    if (method === 'eth_newFilter' || method === 'eth_newBlockFilter' || method === 'eth_newPendingTransactionFilter') {
      console.warn(`${method} intercepted - using robust alternative`);
      return Promise.resolve('0x0'); // Return dummy filter ID
    }
    
    if (method === 'eth_getLogs') {
      return this.getLogs(params[0]);
    }
    
    return this.provider.send(method, params);
  }

  /**
   * Get provider statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      activeEventListeners: this.eventListeners.size,
      filterManagerStats: this.filterManager.getStats(),
      isDestroyed: this.isDestroyed
    };
  }

  /**
   * Destroy the provider and cleanup resources
   */
  async destroy() {
    this.isDestroyed = true;
    
    // Cleanup all event listeners
    for (const eventListener of this.eventListeners.values()) {
      eventListener.cleanup();
    }
    this.eventListeners.clear();
    
    // Destroy filter manager
    await this.filterManager.destroy();
  }
}

/**
 * Create a robust provider wrapper
 * @param {string|ethers.Provider} providerOrUrl - Provider or RPC URL
 * @param {Object} options - Configuration options
 * @returns {RobustProvider} Wrapped provider
 */
export function createRobustProvider(providerOrUrl, options = {}) {
  let provider;
  
  if (typeof providerOrUrl === 'string') {
    provider = new ethers.JsonRpcProvider(providerOrUrl);
  } else {
    provider = providerOrUrl;
  }
  
  return new RobustProvider(provider, options);
}