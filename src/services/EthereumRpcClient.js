/**
 * Ethereum RPC Client
 * Optimized client for Ethereum's JSON-RPC API with chunked fetching
 * Multi-Chain RPC Integration - Compatible with MultiChainContractIndexer
 */

import { RpcCache } from './RpcCache.js';
import { RpcRequestQueue } from './RpcRequestQueue.js';
import { RpcErrorTracker } from './RpcErrorTracker.js';
import { RpcRetryHelper } from './RpcRetryHelper.js';

export class EthereumRpcClient {
  constructor(rpcUrls, options = {}) {
    this.rpcUrls = Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls];
    this.currentRpcIndex = 0;
    this.config = {
      timeout: 30000,
      retries: 2,
      tier: 'free',
      ...options
    };
    this.requestId = 1;
    this.cache = new RpcCache(60000);
    this.queue = new RpcRequestQueue(this.config.tier);
    this.errorTracker = new RpcErrorTracker();
    this.blockTimestampCache = new Map();
    // API key for gateway RPC (set via ETHEREUM_RPC_API_KEY env var)
    this.apiKey = process.env.ETHEREUM_RPC_API_KEY || null;
  }

  setTier(tier) {
    this.config.tier = tier;
    this.queue.setTier(tier);
  }

  async _makeRpcCall(method, params = [], timeout = this.config.timeout) {
    // Check cache first (skip for filter methods)
    if (!method.includes('Filter')) {
      const cached = this.cache.get(method, params);
      if (cached) return cached;
    }

    return this.queue.enqueue(async () => {
      // Direct RPC call with failover (no RobustProvider)
      const payload = {
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId++
      };

      let delay = 500; // Initial delay in ms

      for (let attempt = 0; attempt <= this.config.retries; attempt++) {
        // Add exponential backoff delay before retry (skip first attempt)
        if (attempt > 0) {
          await RpcRetryHelper.sleep(delay);
          delay = Math.min(delay * 2, 5000); // Max 5 seconds
        }

        for (let rpcIndex = 0; rpcIndex < this.rpcUrls.length; rpcIndex++) {
          const rpcUrl = this.rpcUrls[(this.currentRpcIndex + rpcIndex) % this.rpcUrls.length];
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
            const response = await fetch(rpcUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && rpcUrl.includes('thebuidl.xyz') ? { 'x-api-key': this.apiKey } : {}),
              },
              body: JSON.stringify(payload),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Normalise gateway wrapper: { status, result: { jsonrpc, result, id }, message }
            // The actual RPC result is nested at data.result.result
            if (data.status === 'success' && data.result?.jsonrpc === '2.0') {
              // Unwrap — treat as standard JSON-RPC from here
              data.result = data.result.result;
              data.error  = data.result?.error ?? null;
            }
            
            if (data.error) {
              // Handle specific filter errors - suppress and return empty results
              if (data.error.message && data.error.message.includes('filter not found')) {
                console.warn(`Filter error suppressed for ${method}: ${data.error.message}`);
                if (method === 'eth_getFilterChanges' || method === 'eth_uninstallFilter') {
                  return [];
                }
                if (method === 'eth_newFilter' || method === 'eth_newBlockFilter' || method === 'eth_newPendingTransactionFilter') {
                  return '0x0'; // Return dummy filter ID
                }
              }
              
              throw new Error(`RPC Error: ${data.error.message || data.error}`);
            }

          // Cache successful response
          if (!method.includes('Filter')) {
            this.cache.set(method, params, data.result);
          }
          return data.result;
        } catch (error) {
          clearTimeout(timeoutId);
          
          // Log network errors as info instead of error
          if (RpcRetryHelper.isRetryableError(error)) {
            console.info(`ℹ️ RPC connection issue (attempt ${attempt + 1}/${this.config.retries + 1}): ${error.message}`);
          }
          
          this.errorTracker.track(error, { rpcUrl, method, params, attempt });
          
          if (rpcIndex === this.rpcUrls.length - 1 && attempt === this.config.retries) {
            throw error;
          }
        }
      }
    }
    });
  }

  async getBlockNumber() {
    const result = await this._makeRpcCall('eth_blockNumber', [], 10000);
    // Standard JSON-RPC returns hex string; gateway may return { blockNumber: "decimal" }
    if (result && typeof result === 'object' && result.blockNumber) {
      return parseInt(result.blockNumber, 10);
    }
    return parseInt(result, 16);
  }

  async getBlock(blockNumber) {
    const blockHex = typeof blockNumber === 'number' ? '0x' + blockNumber.toString(16) : blockNumber;
    return await this._makeRpcCall('eth_getBlockByNumber', [blockHex, true]);
  }

  async _getBlockTimestamp(blockNumber) {
    // Check cache first
    if (this.blockTimestampCache.has(blockNumber)) {
      return this.blockTimestampCache.get(blockNumber);
    }

    try {
      const block = await this.getBlock(blockNumber);
      const timestamp = parseInt(block.timestamp, 16);
      this.blockTimestampCache.set(blockNumber, timestamp);
      return timestamp;
    } catch (error) {
      this.errorTracker.track(error, { method: '_getBlockTimestamp', blockNumber });
      
      // Estimate timestamp based on average block time (12 seconds for Ethereum)
      const currentBlock = await this.getBlockNumber().catch(() => blockNumber);
      const currentTime = Math.floor(Date.now() / 1000);
      const blockDiff = currentBlock - blockNumber;
      const estimatedTimestamp = currentTime - (blockDiff * 12);
      
      this.blockTimestampCache.set(blockNumber, estimatedTimestamp);
      return estimatedTimestamp;
    }
  }

  async getTransactionReceipt(txHash) {
    return await this._makeRpcCall('eth_getTransactionReceipt', [txHash]);
  }

  /**
   * Optimized transaction fetching for Ethereum - focuses on events first
   */
  async getTransactionsByAddress(contractAddress, fromBlock, toBlock, progressCallback = null) {
    const transactions = [];
    const events = [];
    const totalBlocks = toBlock - fromBlock + 1;
    
    console.log(`   📦 Ethereum analysis: ${totalBlocks} blocks for contract ${contractAddress}`);
    
    try {
      // Step 1: Fetch contract events in chunks (prevents timeout on high-activity contracts)
      console.log(`   📋 Fetching contract events from blocks ${fromBlock}-${toBlock}...`);
      
      const CHUNK_SIZE = 1000; // Reduced to 1000 blocks for faster fetching
      const allLogs = [];
      
      for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
        
        const chunkLogs = await this._makeRpcCall('eth_getLogs', [{
          fromBlock: '0x' + start.toString(16),
          toBlock: '0x' + end.toString(16),
          address: contractAddress
        }]);
        
        allLogs.push(...chunkLogs);
        
        const progress = ((start - fromBlock) / totalBlocks * 100).toFixed(1);
        console.log(`   📦 Chunk ${start}-${end}: ${chunkLogs.length} events (${progress}% complete, total: ${allLogs.length})`);
        
        // Call progress callback if provided
        if (progressCallback) {
          await progressCallback(parseFloat(progress) / 100, allLogs.length);
        }
      }
      
      console.log(`   📋 Found ${allLogs.length} contract events total`);
      
      // Process events
      for (const log of allLogs) {
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
      }
      
      // Step 2: Get unique transaction hashes from events
      const eventTxHashes = new Set(allLogs.map(log => log.transactionHash));
      console.log(`   🔗 Found ${eventTxHashes.size} unique transactions from events`);
      
      // Hard cap at 50 transactions for historical fetch
      const maxTransactions = 50;
      const txHashArray = Array.from(eventTxHashes);
      const limitedTxHashes = txHashArray.slice(0, maxTransactions);
      if (limitedTxHashes.length < txHashArray.length) {
        console.log(`   ⚠️ Limiting to ${maxTransactions} historical transactions`);
      }
      
      // Step 3: Batch fetch transaction details
      const batchSize = 15;
      
      console.log(`   📦 Processing ${limitedTxHashes.length} transactions in batches of ${batchSize}...`);
      
      for (let i = 0; i < limitedTxHashes.length; i += batchSize) {
        const batch = limitedTxHashes.slice(i, i + batchSize);
        const batchPromises = batch.map(async (txHash) => {
          try {
            const [tx, receipt] = await Promise.all([
              this._makeRpcCall('eth_getTransactionByHash', [txHash]),
              this.getTransactionReceipt(txHash)
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
                blockTimestamp: await this._getBlockTimestamp(parseInt(tx.blockNumber, 16)),
                status: receipt?.status === '0x1' || receipt?.status === 1,
                chain: 'ethereum',
                nonce: parseInt(tx.nonce, 16),
                type: parseInt(tx.type || '0x0', 16),
                maxFeePerGas: tx.maxFeePerGas || null,
                maxPriorityFeePerGas: tx.maxPriorityFeePerGas || null,
                source: 'event',
                events: events.filter(e => e.transactionHash === txHash)
              };
            }
          } catch (txError) {
            console.warn(`   ⚠️  Failed to fetch transaction ${txHash}: ${txError.message}`);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        transactions.push(...batchResults.filter(tx => tx !== null));
        
        const processedCount = Math.min(i + batchSize, limitedTxHashes.length);
        console.log(`   📊 Progress: ${processedCount}/${limitedTxHashes.length} transactions processed`);
        
        // Call progress callback for transaction processing (50-80% range)
        if (progressCallback) {
          const txProgress = processedCount / limitedTxHashes.length;
          const overallProgress = 0.5 + (txProgress * 0.3); // 50% to 80%
          await progressCallback(overallProgress, events.length);
        }
      }
      
      // Step 4: Limited direct transaction scanning (only for small ranges)
      let directTxCount = 0;
      if (eventTxHashes.size === 0 && totalBlocks <= 50) {
        console.log(`   🔍 No events found, scanning ${totalBlocks} blocks for direct transactions...`);
        
        for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
          try {
            const block = await this.getBlock(blockNum);
            
            if (block && block.transactions) {
              for (const tx of block.transactions) {
                const isToContract = tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase();
                const isFromContract = tx.from && tx.from.toLowerCase() === contractAddress.toLowerCase();
                
                if (isToContract || isFromContract) {
                  const receipt = await this.getTransactionReceipt(tx.hash);
                  
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
                    chain: 'ethereum',
                    nonce: parseInt(tx.nonce, 16),
                    type: parseInt(tx.type || '0x0', 16),
                    maxFeePerGas: tx.maxFeePerGas || null,
                    maxPriorityFeePerGas: tx.maxPriorityFeePerGas || null,
                    source: isToContract ? 'to_contract' : 'from_contract',
                    events: []
                  });
                  directTxCount++;
                }
              }
            }
          } catch (blockError) {
            console.warn(`   ⚠️  Failed to process block ${blockNum}: ${blockError.message}`);
          }
          
          const progress = ((blockNum - fromBlock + 1) / totalBlocks * 100).toFixed(1);
          console.log(`   📊 Progress: ${progress}% (${blockNum}/${toBlock})`);
        }
      } else if (totalBlocks > 50) {
        console.log(`   ⚠️  Skipping direct transaction scan for ${totalBlocks} blocks (too many blocks, use events only)`);
      }
      
      console.log(`   ✅ Ethereum analysis complete:`);
      console.log(`      📋 Events: ${events.length}`);
      console.log(`      🔗 Event transactions: ${eventTxHashes.size}`);
      console.log(`      📤 Direct transactions: ${directTxCount}`);
      console.log(`      📊 Total transactions: ${transactions.length}`);
      
      return {
        transactions,
        events,
        summary: {
          totalTransactions: transactions.length,
          eventTransactions: eventTxHashes.size,
          directTransactions: directTxCount,
          totalEvents: events.length,
          blocksScanned: totalBlocks
        }
      };
      
    } catch (error) {
      console.error(`   ❌ Error in Ethereum analysis: ${error.message}`);
      throw error;
    }
  }

  async batchGetTransactions(txHashes) {
    const transactions = [];
    const batchSize = 15; // Ethereum can handle larger batches
    
    for (let i = 0; i < txHashes.length; i += batchSize) {
      const batch = txHashes.slice(i, i + batchSize);
      const batchPromises = batch.map(async (txHash) => {
        try {
          const tx = await this._makeRpcCall('eth_getTransactionByHash', [txHash]);
          return tx;
        } catch (error) {
          console.warn(`Failed to fetch transaction ${txHash}: ${error.message}`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      transactions.push(...batchResults.filter(tx => tx !== null));
    }
    
    return transactions;
  }

  /**
   * Test connection to Ethereum RPC
   */
  async testConnection() {
    try {
      await this._makeRpcCall('eth_blockNumber', [], 5000);
      return true;
    } catch (error) {
      console.error(`Ethereum RPC test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get chain info
   */
  getChain() {
    return 'ethereum';
  }

  /**
   * Get RPC URL (returns first URL for compatibility)
   */
  getRpcUrl() {
    return this.rpcUrls[0];
  }

  /**
   * Get all RPC URLs
   */
  getRpcUrls() {
    return this.rpcUrls;
  }

  /**
   * Get chain ID
   */
  async getChainId() {
    const result = await this._makeRpcCall('eth_chainId', [], 5000);
    return parseInt(result, 16);
  }

  /**
   * Get network version
   */
  async getNetworkVersion() {
    return await this._makeRpcCall('net_version', [], 5000);
  }

  /**
   * Create an event listener that handles filter errors gracefully
   * @param {Object} filter - Event filter
   * @param {Function} callback - Event callback
   * @returns {Function} Cleanup function
   */
  createEventListener(filter, callback) {
    return this.robustProvider.createRobustEventListener(filter, callback);
  }

  /**
   * Get provider statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return this.robustProvider.getStats();
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return this.errorTracker.getStats();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.blockTimestampCache.clear();
  }

  /**
   * Get chain info
   */
  getChain() {
    return 'ethereum';
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    if (this.robustProvider) {
      await this.robustProvider.destroy();
    }
  }
}

export default EthereumRpcClient;