/**
 * Contract Interaction Fetcher
 * Fetches data by contract interactions (events, calls) instead of block scanning
 * More efficient and targeted approach for contract analysis
 */

import { EventEmitter } from 'events';
import { LiskRpcClient } from './LiskRpcClient.js';
import { StarknetRpcClient } from './StarknetRpcClient.js';
import { RpcClientService } from './RpcClientService.js';

export class ContractInteractionFetcher extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxRequestsPerSecond: config.maxRequestsPerSecond || 10,
      requestWindow: config.requestWindow || 1000,
      failoverTimeout: config.failoverTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      batchSize: config.batchSize || 50,
      maxEventsPerQuery: config.maxEventsPerQuery || 10000,
      ...config
    };
    
    // Provider configurations
    this.providerConfigs = {
      ethereum: [
        {
          name: 'publicnode',
          url: 'https://ethereum-rpc.publicnode.com',
          priority: 1
        },
        {
          name: 'nownodes',
          url: process.env.ETHEREUM_RPC_URL || 'https://eth.nownodes.io/2ca1a1a6-9040-4ca9-8727-33a186414a1f',
          priority: 2
        }
      ],
      starknet: [
        {
          name: 'lava',
          url: process.env.STARKNET_RPC_URL1 || 'https://rpc.starknet.lava.build',
          priority: 1
        },
        {
          name: 'publicnode',
          url: process.env.STARKNET_RPC_URL2 || 'https://starknet-rpc.publicnode.com',
          priority: 2
        }
      ],
      lisk: [
        {
          name: 'lisk-api',
          url: process.env.LISK_RPC_URL1 || 'https://rpc.api.lisk.com',
          priority: 1
        },
        {
          name: 'drpc',
          url: process.env.LISK_RPC_URL2 || 'https://lisk.drpc.org',
          priority: 2
        }
      ]
    };
    
    this.providers = {};
    this.requestCount = 0;
    this.requestQueue = [];
    
    this._initializeProviders();
    this._startRateLimiter();
  }

  /**
   * Timeout wrapper for RPC operations
   * @private
   */
  _withTimeout(promise, timeoutMs, operation = 'operation') {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Initialize RPC providers
   * @private
   */
  _initializeProviders() {
    const analyzeChainOnly = process.env.ANALYZE_CHAIN_ONLY === 'true';
    const targetChain = process.env.CONTRACT_CHAIN?.toLowerCase();
    
    if (analyzeChainOnly && targetChain) {
      console.log(`🔒 Contract interaction mode - only initializing ${targetChain} providers`);
      this._initializeChainProviders(targetChain, this.providerConfigs[targetChain]);
    } else {
      console.log(`🌐 Multi-chain contract interaction mode - initializing all providers`);
      for (const [chain, configs] of Object.entries(this.providerConfigs)) {
        this._initializeChainProviders(chain, configs);
      }
    }
  }

  /**
   * Initialize providers for a specific chain
   * @private
   */
  _initializeChainProviders(chain, configs) {
    if (!configs) {
      console.warn(`⚠️ No provider configuration found for chain: ${chain}`);
      return;
    }
    
    this.providers[chain] = [];
    
    for (const config of configs) {
      try {
        let rpcClient;
        
        if (chain === 'lisk') {
          rpcClient = new LiskRpcClient(config.url);
        } else if (chain === 'starknet') {
          rpcClient = new StarknetRpcClient(config.url);
        } else {
          rpcClient = new RpcClientService(config.url, chain);
        }
        
        this.providers[chain].push({
          name: config.name,
          client: rpcClient,
          config: config,
          isHealthy: true,
          requestCount: 0,
          successCount: 0,
          failureCount: 0
        });
        
        console.log(`✅ Initialized ${config.name} provider for ${chain} (interaction mode)`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${config.name} provider for ${chain}:`, error.message);
      }
    }
    
    this.providers[chain].sort((a, b) => a.config.priority - b.config.priority);
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
   * Execute operation with provider failover
   * @private
   */
  async _executeWithFailover(chain, operation, operationName) {
    const providers = this.providers[chain];
    if (!providers || providers.length === 0) {
      throw new Error(`No providers configured for chain: ${chain}`);
    }
    
    console.log(`🎯 Executing ${operationName} on ${chain} (interaction-based)`);
    
    let lastError;
    
    for (const provider of providers) {
      try {
        provider.requestCount++;
        const startTime = Date.now();
        
        const result = await Promise.race([
          operation(provider.client),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.config.failoverTimeout)
          )
        ]);
        
        provider.successCount++;
        const duration = Date.now() - startTime;
        console.log(`✅ ${operationName} successful via ${provider.name} (${chain}) in ${duration}ms`);
        return result;
        
      } catch (error) {
        provider.failureCount++;
        lastError = error;
        console.warn(`⚠️ ${operationName} failed via ${provider.name} (${chain}): ${error.message}`);
      }
    }
    
    throw new Error(`All ${chain} providers failed for ${operationName}: ${lastError?.message}`);
  }

  /**
   * Fetch contract interactions by events and direct calls
   * More efficient than block scanning
   * @param {string} contractAddress - Contract address
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number
   * @param {string} chain - Blockchain network
   * @returns {Promise<Object>} Contract interactions data
   */
  async fetchContractInteractions(contractAddress, fromBlock, toBlock, chain) {
    if (!contractAddress || !chain) {
      throw new Error('Contract address and chain are required');
    }
    
    console.log(`🎯 Fetching contract interactions for ${contractAddress} on ${chain}`);
    console.log(`   📊 Block range: ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
    
    const FETCH_TIMEOUT = 2 * 60 * 1000; // 2 minutes timeout
    
    return await this._executeWithRateLimit(async () => {
      return await this._withTimeout(
        this._executeWithFailover(
          chain.toLowerCase(),
          async (client) => {
          // Use the optimized method from LiskRpcClient if available
          if (client.getTransactionsByAddress && typeof client.getTransactionsByAddress === 'function') {
            const result = await client.getTransactionsByAddress(contractAddress, fromBlock, toBlock);
            
            // If result has the new structure with events and summary
            if (result && typeof result === 'object' && result.transactions && result.events) {
              return {
                transactions: result.transactions || [],
                events: result.events || [],
                summary: result.summary || {
                  totalTransactions: result.transactions?.length || 0,
                  totalEvents: result.events?.length || 0,
                  blocksScanned: toBlock - fromBlock + 1
                },
                method: 'interaction-based'
              };
            }
            
            // Legacy format - convert to new structure
            return {
              transactions: Array.isArray(result) ? result : [],
              events: [],
              summary: {
                totalTransactions: Array.isArray(result) ? result.length : 0,
                totalEvents: 0,
                blocksScanned: toBlock - fromBlock + 1
              },
              method: 'legacy-block-scan'
            };
          }
          
          // Fallback to event-based fetching for other chains
          return await this._fetchByEvents(client, contractAddress, fromBlock, toBlock, chain);
        },
        'fetchContractInteractions'
      ),
      FETCH_TIMEOUT,
      'Contract interaction fetching'
    );
  });
  }

  /**
   * Fetch contract data by events (for chains that don't support optimized interaction fetching)
   * @private
   */
  async _fetchByEvents(client, contractAddress, fromBlock, toBlock, chain) {
    console.log(`   📋 Using event-based fetching for ${chain}`);
    
    const events = [];
    const transactions = [];
    const transactionHashes = new Set();
    
    try {
      // Fetch contract events
      const logs = await client._makeRpcCall('eth_getLogs', [{
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + toBlock.toString(16),
        address: contractAddress
      }]);
      
      console.log(`   📋 Found ${logs.length} events`);
        
        // Process events
        for (const log of logs) {
          events.push({
            address: log.address,
            topics: log.topics,
            data: log.data,
            blockNumber: parseInt(log.blockNumber, 16),
            transactionHash: log.transactionHash,
            transactionIndex: parseInt(log.transactionIndex, 16),
            blockHash: log.blockHash,
            logIndex: parseInt(log.logIndex, 16),
            removed: log.removed || false
          });
          
          transactionHashes.add(log.transactionHash);
        }
        
        // Fetch transaction details for events
        console.log(`   🔗 Fetching ${transactionHashes.size} unique transactions from events`);
        
        const batchSize = this.config.batchSize;
        const txHashArray = Array.from(transactionHashes);
        
        for (let i = 0; i < txHashArray.length; i += batchSize) {
          const batch = txHashArray.slice(i, i + batchSize);
          const batchPromises = batch.map(async (txHash) => {
            try {
              const [tx, receipt] = await Promise.all([
                client._makeRpcCall('eth_getTransactionByHash', [txHash]),
                client._makeRpcCall('eth_getTransactionReceipt', [txHash])
              ]);
              
              if (tx) {
                return {
                  hash: tx.hash,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value || '0',
                  gasPrice: tx.gasPrice || '0',
                  gasUsed: receipt?.gasUsed || '0',
                  gasLimit: tx.gas || '0',
                  input: tx.input || '0x',
                  blockNumber: parseInt(tx.blockNumber, 16),
                  blockTimestamp: await this._getBlockTimestamp(client, parseInt(tx.blockNumber, 16)),
                  status: receipt?.status === '0x1' || receipt?.status === 1,
                  chain: chain,
                  nonce: parseInt(tx.nonce, 16),
                  type: parseInt(tx.type || '0x0', 16),
                  source: 'event',
                  events: events.filter(e => e.transactionHash === txHash)
                };
              }
            } catch (error) {
              console.warn(`   ⚠️ Failed to fetch transaction ${txHash}: ${error.message}`);
              return null;
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          transactions.push(...batchResults.filter(tx => tx !== null));
        }
      
      return {
        transactions,
        events,
        summary: {
          totalTransactions: transactions.length,
          eventTransactions: transactionHashes.size,
          directTransactions: 0,
          totalEvents: events.length,
          blocksScanned: toBlock - fromBlock + 1
        },
        method: 'event-based'
      };
      
    } catch (error) {
      console.error(`   ❌ Event-based fetching failed: ${error.message}`);
      // Fallback to limited block scanning
      return await this._fallbackBlockScan(client, contractAddress, fromBlock, toBlock);
    }
  }

  /**
   * Fallback to limited block scanning when event fetching fails
   * @private
   */
  async _fallbackBlockScan(client, contractAddress, fromBlock, toBlock) {
    console.log(`   🔄 Falling back to limited block scan`);
    
    const transactions = [];
    const maxBlocksToScan = 100; // Limit fallback scanning
    const actualToBlock = Math.min(toBlock, fromBlock + maxBlocksToScan - 1);
    
    console.log(`   📦 Scanning ${actualToBlock - fromBlock + 1} blocks (limited fallback)`);
    
    for (let blockNum = fromBlock; blockNum <= actualToBlock; blockNum++) {
      try {
        const block = await client.getBlock(blockNum);
        
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            const isToContract = tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase();
            const isFromContract = tx.from && tx.from.toLowerCase() === contractAddress.toLowerCase();
            
            if (isToContract || isFromContract) {
              const receipt = await client.getTransactionReceipt(tx.hash);
              
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value || '0',
                gasPrice: tx.gasPrice || '0',
                gasUsed: receipt?.gasUsed || '0',
                gasLimit: tx.gas || '0',
                input: tx.input || '0x',
                blockNumber: parseInt(tx.blockNumber, 16),
                blockTimestamp: parseInt(block.timestamp, 16),
                status: receipt?.status === '0x1' || receipt?.status === 1,
                chain: client.getChain ? client.getChain() : 'unknown',
                nonce: parseInt(tx.nonce, 16),
                type: parseInt(tx.type || '0x0', 16),
                source: isToContract ? 'to_contract' : 'from_contract',
                events: []
              });
            }
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to process block ${blockNum}: ${error.message}`);
      }
    }
    
    return {
      transactions,
      events: [],
      summary: {
        totalTransactions: transactions.length,
        eventTransactions: 0,
        directTransactions: transactions.length,
        totalEvents: 0,
        blocksScanned: actualToBlock - fromBlock + 1
      },
      method: 'fallback-block-scan'
    };
  }

  /**
   * Get block timestamp
   * @private
   */
  async _getBlockTimestamp(client, blockNumber) {
    try {
      const block = await client.getBlock(blockNumber);
      return parseInt(block.timestamp, 16);
    } catch (error) {
      console.warn(`Failed to get timestamp for block ${blockNumber}: ${error.message}`);
      return Math.floor(Date.now() / 1000);
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
   * Fetch specific contract events by topics
   * @param {string} contractAddress - Contract address
   * @param {Array} topics - Event topics to filter
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number
   * @param {string} chain - Blockchain network
   * @returns {Promise<Array>} Array of events
   */
  async fetchContractEvents(contractAddress, topics, fromBlock, toBlock, chain) {
    if (!contractAddress || !chain) {
      throw new Error('Contract address and chain are required');
    }
    
    return await this._executeWithRateLimit(async () => {
      return await this._executeWithFailover(
        chain.toLowerCase(),
        async (client) => {
          const filter = {
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: '0x' + toBlock.toString(16),
            address: contractAddress
          };
          
          if (topics && topics.length > 0) {
            filter.topics = topics;
          }
          
          const logs = await client._makeRpcCall('eth_getLogs', [filter]);
          
          return logs.map(log => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
            blockNumber: parseInt(log.blockNumber, 16),
            transactionHash: log.transactionHash,
            transactionIndex: parseInt(log.transactionIndex, 16),
            blockHash: log.blockHash,
            logIndex: parseInt(log.logIndex, 16),
            removed: log.removed || false
          }));
        },
        'fetchContractEvents'
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
            (provider.successCount / provider.requestCount * 100).toFixed(2) + '%' : '0%'
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
   * Close all connections and cleanup
   */
  async close() {
    this.removeAllListeners();
    console.log('🔌 ContractInteractionFetcher closed');
  }
}

export default ContractInteractionFetcher;