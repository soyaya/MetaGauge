/**
 * Smart Contract Fetcher with Multi-Provider Support
 * Multi-Chain RPC Integration - Task 2
 * Requirements: 1.1, 3.1, 4.1, 4.4
 */

import { RpcClientService } from './RpcClientService.js';
import { LiskRpcClient } from './LiskRpcClient.js';
import { StarknetRpcClient } from './StarknetRpcClient.js';
import { SmartRpcManager } from './SmartRpcManager.js';
import { EventEmitter } from 'events';

/**
 * Smart Contract Fetcher with multi-provider failover support
 * Supports Starknet, Ethereum, and Lisk with automatic failover between multiple RPC providers
 */
export class SmartContractFetcher extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      targetChain: config.targetChain || null, // Only initialize this chain
      maxRequestsPerSecond: config.maxRequestsPerSecond || 10,
      requestWindow: config.requestWindow || 1000,
      failoverTimeout: config.failoverTimeout || 60000,
      maxRetries: config.maxRetries || 3,
      healthCheckInterval: config.healthCheckInterval || 60000,
      enableWebSocket: config.enableWebSocket || false,
      wsReconnectDelay: config.wsReconnectDelay || 5000,
      ...config
    };
    
    // Smart RPC Manager
    this.rpcManager = null;
    
    // Provider configurations by chain
    this.providerConfigs = {
      ethereum: [
        {
          name: 'publicnode',
          url: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
          priority: 1,
          type: 'http'
        },
        {
          name: 'nownodes',
          url: process.env.ETHEREUM_RPC_URL_FALLBACK || 'https://eth.nownodes.io/2ca1a1a6-9040-4ca9-8727-33a186414a1f',
          priority: 2,
          type: 'http'
        }
      ],
      starknet: [
        {
          name: 'lava',
          url: process.env.STARKNET_RPC_URL1 || 'https://rpc.starknet.lava.build',
          priority: 1,
          type: 'http'
        },
        {
          name: 'publicnode',
          url: process.env.STARKNET_RPC_URL2 || 'https://starknet-rpc.publicnode.com',
          priority: 2,
          type: 'http'
        },
        {
          name: 'infura',
          url: process.env.STARKNET_RPC_URL3 || 'https://starknet-mainnet.infura.io/v3/52be4d01250949baa85cad00e7b955ab',
          priority: 3,
          type: 'http'
        }
      ],
      lisk: [
        {
          name: 'lisk-api',
          url: process.env.LISK_RPC_URL1 || 'https://rpc.api.lisk.com',
          priority: 1,
          type: 'http'
        },
        {
          name: 'drpc',
          url: process.env.LISK_RPC_URL2 || 'https://lisk.drpc.org',
          priority: 2,
          type: 'http'
        },
        {
          name: 'tenderly',
          url: process.env.LISK_RPC_URL3 || 'https://lisk.gateway.tenderly.co/2o3VKjmisQNOJIPlLrt6Ye',
          priority: 3,
          type: 'http',
          wsUrl: process.env.LISK_TENDERLY_WS || 'wss://lisk.gateway.tenderly.co/2o3VKjmisQNOJIPlLrt6Ye'
        },
        {
          name: 'moralis',
          url: process.env.LISK_RPC_URL4 || 'https://site1.moralis-nodes.com/lisk/7f6b7ac6edf2456fa240535cc2d8fc6e',
          priority: 4,
          type: 'http'
        }
      ]
    };
    
    // Initialize providers
    this.providers = {};
    this.providerHealth = {};
    this.requestQueue = [];
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.wsConnections = {};
    
    this._initializeProviders();
    this._startHealthChecks();
    this._startRateLimiter();
  }

  /**
   * Initialize RPC providers - only for target chain if specified
   * @private
   */
  _initializeProviders() {
    // If target chain specified, only initialize that chain
    if (this.config.targetChain) {
      console.log(`🎯 Chain Isolation: Initializing ONLY ${this.config.targetChain} providers`);
      const chainConfigs = this.providerConfigs[this.config.targetChain];
      if (chainConfigs) {
        this._initializeChainProviders(this.config.targetChain, chainConfigs);
        console.log(`✅ Initialized ${chainConfigs.length} providers for ${this.config.targetChain}`);
        console.log(`⚠️  Other chains (${Object.keys(this.providerConfigs).filter(c => c !== this.config.targetChain).join(', ')}) will NOT be initialized`);
      } else {
        console.warn(`⚠️  No config for ${this.config.targetChain}`);
      }
    } else {
      console.log(`🌐 Initializing all chain providers (no target chain specified)`);
      this._initializeAllChains();
    }
  }

  /**
   * Initialize all chain providers
   * @private
   */
  _initializeAllChains() {
    console.log(`🌐 Initializing all chain providers for dynamic analysis support`);
    for (const [chain, configs] of Object.entries(this.providerConfigs)) {
      this._initializeChainProviders(chain, configs);
    }
  }

  /**
   * Ensure providers are initialized for a specific chain
   * @param {string} chain - Chain name to ensure providers for
   * @private
   */
  _ensureChainProviders(chain) {
    const chainLower = chain.toLowerCase();
    
    // If providers already exist for this chain, return
    if (this.providers[chainLower] && this.providers[chainLower].length > 0) {
      return;
    }
    
    // Get configuration for this chain
    const chainConfigs = this.providerConfigs[chainLower];
    if (!chainConfigs) {
      throw new Error(`No provider configuration found for chain: ${chainLower}`);
    }
    
    console.log(`🔧 Dynamically initializing ${chainLower} providers for analysis`);
    this._initializeChainProviders(chainLower, chainConfigs);
  }

  /**
   * Initialize providers for a specific chain
   * @private
   */
  _initializeChainProviders(chain, configs) {
    this.providers[chain] = [];
    this.providerHealth[chain] = {};
    
    for (const config of configs) {
      try {
        let rpcClient;
        
        // Use specialized client based on chain
        if (chain === 'lisk') {
          rpcClient = new LiskRpcClient(config.url);
        } else if (chain === 'starknet') {
          rpcClient = new StarknetRpcClient(config.url);
        } else {
          // Use standard Ethereum-compatible client for other chains
          rpcClient = new RpcClientService(config.url, chain);
        }
        
        this.providers[chain].push({
          name: config.name,
          client: rpcClient,
          config: config,
          isHealthy: true,
          lastError: null,
          requestCount: 0,
          successCount: 0,
          failureCount: 0
        });
        
        this.providerHealth[chain][config.name] = {
          isHealthy: true,
          lastCheck: Date.now(),
          responseTime: 0,
          errorCount: 0
        };
        
        console.log(`✅ Initialized ${config.name} provider for ${chain}`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${config.name} provider for ${chain}:`, error.message);
      }
    }
    
    // Sort providers by priority
    this.providers[chain].sort((a, b) => a.config.priority - b.config.priority);
  }

  /**
   * Start periodic health checks for all providers
   * @private
   */
  _startHealthChecks() {
    setInterval(async () => {
      await this._performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all initialized providers
   * @private
   */
  async _performHealthChecks() {
    const initializedChains = Object.keys(this.providers);
    
    if (initializedChains.length === 0) {
      console.warn('⚠️ No providers initialized for health checks');
      return;
    }
    
    for (const chain of initializedChains) {
      const providers = this.providers[chain];
      if (!providers) continue;
      
      for (const provider of providers) {
        try {
          const startTime = Date.now();
          const isHealthy = await provider.client.testConnection();
          const responseTime = Date.now() - startTime;
          
          provider.isHealthy = isHealthy;
          this.providerHealth[chain][provider.name] = {
            isHealthy,
            lastCheck: Date.now(),
            responseTime,
            errorCount: isHealthy ? 0 : this.providerHealth[chain][provider.name].errorCount + 1
          };
          
          if (!isHealthy) {
            console.warn(`⚠️  Provider ${provider.name} for ${chain} is unhealthy`);
            this.emit('providerUnhealthy', { chain, provider: provider.name });
          }
        } catch (error) {
          provider.isHealthy = false;
          provider.lastError = error.message;
          this.providerHealth[chain][provider.name].errorCount++;
          
          console.error(`❌ Health check failed for ${provider.name} (${chain}):`, error.message);
        }
      }
    }
  }

  /**
   * Start rate limiter
   * @private
   */
  _startRateLimiter() {
    setInterval(() => {
      this.requestCount = 0;
      this._processQueue();
    }, this.config.requestWindow);
  }

  /**
   * Process queued requests
   * @private
   */
  _processQueue() {
    while (this.requestQueue.length > 0 && this.requestCount < this.config.maxRequestsPerSecond) {
      const { resolve, reject, operation } = this.requestQueue.shift();
      this.requestCount++;
      
      operation()
        .then(resolve)
        .catch(reject);
    }
  }

  /**
   * Execute operation with rate limiting
   * @private
   */
  async _executeWithRateLimit(operation) {
    return new Promise((resolve, reject) => {
      if (this.requestCount < this.config.maxRequestsPerSecond) {
        this.requestCount++;
        operation().then(resolve).catch(reject);
      } else {
        this.requestQueue.push({ resolve, reject, operation });
      }
    });
  }

  /**
   * Execute operation with provider failover (within same chain only)
   * @private
   */
  async _executeWithFailover(chain, operation, operationName) {
    const chainLower = chain.toLowerCase();
    
    // Ensure providers are initialized for this chain
    this._ensureChainProviders(chainLower);
    
    const providers = this.providers[chainLower];
    if (!providers || providers.length === 0) {
      throw new Error(`No providers configured for chain: ${chainLower}`);
    }
    
    console.log(`🔗 Executing ${operationName} on ${chainLower} chain only`);
    
    let lastError;
    
    // STRICT: Only use providers for the exact requested chain
    for (const provider of providers) {
      // Double-check provider belongs to correct chain
      if (!this._validateProviderChain(provider, chainLower)) {
        console.warn(`⚠️ Skipping ${provider.name} - not for ${chainLower} chain`);
        continue;
      }
      
      try {
        const startTime = Date.now();
        
        const result = await Promise.race([
          operation(provider.client),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.config.failoverTimeout)
          )
        ]);
        
        const duration = Date.now() - startTime;
        console.log(`✅ ${operationName} successful via ${provider.name} (${chainLower}) in ${duration}ms`);
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ ${operationName} failed via ${provider.name} (${chainLower}): ${error.message}`);
      }
    }
    
    throw new Error(`All ${chainLower} providers failed for ${operationName}: ${lastError?.message}`);
  }

  _validateProviderChain(provider, expectedChain) {
    const url = provider.config.url.toLowerCase();
    
    switch (expectedChain) {
      case 'lisk':
        return url.includes('lisk');
      case 'starknet':
        return url.includes('starknet');
      case 'ethereum':
        return url.includes('eth') || url.includes('ethereum');
      default:
        return false;
    }
  }

  /**
   * Fetch transactions for a contract address with enhanced error handling for smart search
   * @param {string} contractAddress - Contract address to fetch transactions for
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number
   * @param {string} chain - Blockchain network (starknet, lisk, ethereum)
   * @returns {Promise<Array>} Array of transactions
   */
  async fetchTransactions(contractAddress, fromBlock, toBlock, chain) {
    if (!contractAddress || !chain) {
      throw new Error('Contract address and chain are required');
    }
    
    return await this._executeWithRateLimit(async () => {
      return await this._executeWithFailover(
        chain.toLowerCase(),
        async (client) => {
          return await client.getTransactionsByAddress(contractAddress, fromBlock, toBlock);
        },
        'fetchTransactions'
      );
    });
  }

  /**
   * Enhanced transaction fetching with smart search optimizations
   * Includes better error handling and performance metrics for smart block range selector
   * @param {string} contractAddress - Contract address
   * @param {number} fromBlock - Starting block
   * @param {number} toBlock - Ending block  
   * @param {string} chain - Blockchain network
   * @param {Object} options - Additional options for smart search
   * @returns {Promise<Object>} Enhanced result with transactions and metadata
   */
  async fetchTransactionsEnhanced(contractAddress, fromBlock, toBlock, chain, options = {}) {
    const startTime = Date.now();
    
    try {
      const transactions = await this.fetchTransactions(contractAddress, fromBlock, toBlock, chain);
      const duration = Date.now() - startTime;
      
      return {
        transactions,
        metadata: {
          blockRange: { from: fromBlock, to: toBlock },
          totalBlocks: toBlock - fromBlock + 1,
          transactionCount: transactions.length,
          fetchTime: duration,
          chain: chain.toLowerCase(),
          success: true
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        transactions: [],
        metadata: {
          blockRange: { from: fromBlock, to: toBlock },
          totalBlocks: toBlock - fromBlock + 1,
          transactionCount: 0,
          fetchTime: duration,
          chain: chain.toLowerCase(),
          success: false,
          error: error.message
        }
      };
    }
  }

  /**
   * Get current block number
   * @param {string} chain - Blockchain network
   * @returns {Promise<number>} Current block number
   */
  async getCurrentBlockNumber(chain) {
    if (!chain) {
      throw new Error('Chain is required');
    }
    
    return await this._executeWithRateLimit(async () => {
      return await this._executeWithFailover(
        chain.toLowerCase(),
        async (client) => {
          return await client.getBlockNumber();
        },
        'getCurrentBlockNumber'
      );
    });
  }

  /**
   * Fetch transaction receipt
   * @param {string} txHash - Transaction hash
   * @param {string} chain - Blockchain network
   * @returns {Promise<Object>} Transaction receipt
   */
  async fetchTransactionReceipt(txHash, chain) {
    if (!txHash || !chain) {
      throw new Error('Transaction hash and chain are required');
    }
    
    return await this._executeWithRateLimit(async () => {
      return await this._executeWithFailover(
        chain.toLowerCase(),
        async (client) => {
          return await client.getTransactionReceipt(txHash);
        },
        'fetchTransactionReceipt'
      );
    });
  }

  /**
   * Get provider statistics
   * @returns {Object} Provider statistics
   */
  getProviderStats() {
    const stats = {};
    
    for (const [chain, providers] of Object.entries(this.providers)) {
      stats[chain] = {};
      
      for (const provider of providers) {
        stats[chain][provider.name] = {
          isHealthy: provider.isHealthy,
          requestCount: provider.requestCount,
          successCount: provider.successCount,
          failureCount: provider.failureCount,
          successRate: provider.requestCount > 0 ? 
            (provider.successCount / provider.requestCount * 100).toFixed(2) + '%' : '0%',
          lastError: provider.lastError,
          health: this.providerHealth[chain][provider.name]
        };
      }
    }
    
    return stats;
  }

  /**
   * Get supported chains
   * @returns {Array<string>} Array of supported chain names
   */
  getSupportedChains() {
    return Object.keys(this.providers);
  }

  /**
   * Test all providers for a chain
   * @param {string} chain - Blockchain network
   * @returns {Promise<Object>} Test results
   */
  async testProviders(chain) {
    const providers = this.providers[chain.toLowerCase()];
    if (!providers) {
      throw new Error(`No providers configured for chain: ${chain}`);
    }
    
    const results = {};
    
    for (const provider of providers) {
      try {
        const startTime = Date.now();
        const isHealthy = await provider.client.testConnection();
        const responseTime = Date.now() - startTime;
        
        results[provider.name] = {
          isHealthy,
          responseTime,
          error: null
        };
      } catch (error) {
        results[provider.name] = {
          isHealthy: false,
          responseTime: null,
          error: error.message
        };
      }
    }
    
    return results;
  }

  /**
   * Close all connections and cleanup
   */
  async close() {
    // Close WebSocket connections
    for (const [chain, ws] of Object.entries(this.wsConnections)) {
      if (ws && ws.close) {
        ws.close();
        console.log(`🔌 Closed WebSocket connection for ${chain}`);
      }
    }
    
    // Clear intervals and cleanup
    this.removeAllListeners();
    
    console.log('🔌 SmartContractFetcher closed');
  }
}

export default SmartContractFetcher;