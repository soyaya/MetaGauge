/**
 * Starknet RPC Client
 * Specialized client for Starknet's JSON-RPC API
 * Multi-Chain RPC Integration - Task 2
 */

import fetch from 'node-fetch';
import { RpcCache } from './RpcCache.js';
import { RpcRequestQueue } from './RpcRequestQueue.js';
import { RpcErrorTracker } from './RpcErrorTracker.js';

export class StarknetRpcClient {
  constructor(rpcUrls, config = {}) {
    this.rpcUrls = Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls];
    this.currentRpcIndex = 0;
    this.config = {
      timeout: 30000,
      retries: 2,
      tier: 'free',
      ...config
    };
    this.requestId = 1;
    this.cache = new RpcCache(60000);
    this.queue = new RpcRequestQueue(this.config.tier);
    this.errorTracker = new RpcErrorTracker();
    this.blockTimestampCache = new Map();
  }

  setTier(tier) {
    this.config.tier = tier;
    this.queue.setTier(tier);
  }

  /**
   * Make a JSON-RPC call to Starknet with failover support
   * @private
   */
  async _makeRpcCall(method, params = [], timeout = this.config.timeout) {
    // Check cache first
    const cached = this.cache.get(method, params);
    if (cached) return cached;

    return this.queue.enqueue(async () => {
      const payload = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: this.requestId++
      };

      for (let attempt = 0; attempt <= this.config.retries; attempt++) {
        for (let rpcIndex = 0; rpcIndex < this.rpcUrls.length; rpcIndex++) {
          const rpcUrl = this.rpcUrls[(this.currentRpcIndex + rpcIndex) % this.rpcUrls.length];
          
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
              throw new Error(`RPC Error: ${data.error.message} (Code: ${data.error.code})`);
            }

            // Cache successful response
            this.cache.set(method, params, data.result);
            return data.result;
          } catch (error) {
            this.errorTracker.track(error, { rpcUrl, method, params, attempt });
            
            if (rpcIndex === this.rpcUrls.length - 1 && attempt === this.config.retries) {
              if (error.name === 'AbortError') {
                throw new Error(`Starknet RPC call timed out after ${timeout}ms`);
              }
              throw new Error(`Starknet RPC call failed: ${error.message}`);
            }
          }
        }
      }
    });
  }

  /**
   * Get current block number
   */
  async getBlockNumber() {
    return await this._makeRpcCall('starknet_blockNumber');
  }

  /**
   * Get block by number
   */
  async getBlock(blockNumber) {
    const blockId = typeof blockNumber === 'number' ? 
      { block_number: blockNumber } : 
      blockNumber;
    
    return await this._makeRpcCall('starknet_getBlockWithTxs', [blockId]);
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash) {
    return await this._makeRpcCall('starknet_getTransactionByHash', [txHash]);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash) {
    return await this._makeRpcCall('starknet_getTransactionReceipt', [txHash]);
  }

  /**
   * Get events for a contract address using starknet_getEvents
   * This is the efficient way to fetch contract interactions
   */
  async getEvents(contractAddress, fromBlock, toBlock, chunkSize = 1000) {
    const filter = {
      from_block: { block_number: fromBlock },
      to_block: { block_number: toBlock },
      address: contractAddress,
      chunk_size: chunkSize
    };

    return await this._makeRpcCall('starknet_getEvents', [filter]);
  }

  /**
   * Get transactions by contract address using event-based approach (EFFICIENT)
   * This replaces the inefficient block-by-block scanning
   */
  async getTransactionsByAddress(contractAddress, fromBlock, toBlock) {
    const transactions = [];
    const events = [];
    
    try {
      console.log(`   📋 Fetching Starknet events for contract ${contractAddress}`);
      console.log(`   📊 Block range: ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
      
      // Step 1: Fetch events efficiently using starknet_getEvents
      let continuationToken = null;
      let totalEvents = 0;
      
      do {
        const filter = {
          from_block: { block_number: fromBlock },
          to_block: { block_number: toBlock },
          address: contractAddress,
          chunk_size: 1000
        };
        
        if (continuationToken) {
          filter.continuation_token = continuationToken;
        }
        
        const eventResult = await this._makeRpcCall('starknet_getEvents', [filter]);
        
        if (eventResult && eventResult.events) {
          totalEvents += eventResult.events.length;
          
          // Process events
          for (const event of eventResult.events) {
            events.push({
              address: event.from_address,
              keys: event.keys,
              data: event.data,
              blockNumber: event.block_number,
              transactionHash: event.transaction_hash,
              blockHash: event.block_hash,
              removed: false
            });
          }
          
          continuationToken = eventResult.continuation_token;
        } else {
          break;
        }
      } while (continuationToken);
      
      console.log(`   📋 Found ${totalEvents} contract events`);
      
      // Step 2: Get unique transaction hashes from events
      const eventTxHashes = new Set(events.map(event => event.transactionHash));
      console.log(`   🔗 Found ${eventTxHashes.size} unique transactions from events`);
      
      // Step 3: Batch fetch transaction details
      if (eventTxHashes.size > 0) {
        const txHashArray = Array.from(eventTxHashes);
        // Use tier-based batch sizes for optimal performance
        const batchSize = this.config.tier === 'enterprise' ? 10 : 
                          this.config.tier === 'pro' ? 8 : 5;
        
        console.log(`   📦 Processing ${txHashArray.length} transactions in batches of ${batchSize}...`);
        
        for (let i = 0; i < txHashArray.length; i += batchSize) {
          const batch = txHashArray.slice(i, i + batchSize);
          const batchPromises = batch.map(async (txHash) => {
            try {
              const [tx, receipt] = await Promise.all([
                this.getTransaction(txHash),
                this.getTransactionReceipt(txHash)
              ]);
              
              if (tx) {
                return {
                  hash: tx.transaction_hash,
                  from: tx.sender_address,
                  to: tx.contract_address || contractAddress,
                  value: '0', // Starknet doesn't have ETH value transfers in the same way
                  gasPrice: '0',
                  gasUsed: receipt?.actual_fee || '0',
                  gasLimit: tx.max_fee || '0',
                  input: JSON.stringify(tx.calldata || []),
                  blockNumber: parseInt(tx.block_number || '0'),
                  blockTimestamp: await this._getBlockTimestamp(parseInt(tx.block_number || '0')),
                  status: receipt?.status === 'ACCEPTED_ON_L2' || receipt?.status === 'ACCEPTED_ON_L1',
                  chain: 'starknet',
                  nonce: tx.nonce,
                  type: tx.type,
                  version: tx.version,
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
          
          console.log(`   📊 Progress: ${Math.min(i + batchSize, txHashArray.length)}/${txHashArray.length} transactions processed`);
        }
      }
      
      return {
        transactions,
        events,
        summary: {
          totalTransactions: transactions.length,
          eventTransactions: eventTxHashes.size,
          directTransactions: 0,
          totalEvents: events.length,
          blocksScanned: toBlock - fromBlock + 1
        },
        method: 'starknet-event-based'
      };
      
    } catch (error) {
      console.error('Error fetching Starknet events:', error.message);
      
      // Fallback to limited block scanning only if event fetching completely fails
      console.log('   🔄 Falling back to limited block scan (last resort)');
      return await this._fallbackBlockScan(contractAddress, fromBlock, toBlock);
    }
  }

  /**
   * Fallback block scanning (limited and only as last resort)
   * @private
   */
  async _fallbackBlockScan(contractAddress, fromBlock, toBlock) {
    const transactions = [];
    const maxBlocksToScan = 20; // Very limited fallback
    const actualToBlock = Math.min(toBlock, fromBlock + maxBlocksToScan - 1);
    
    console.log(`   📦 Limited fallback scan: ${actualToBlock - fromBlock + 1} blocks`);
    
    try {
      // Get blocks in range and filter transactions
      for (let blockNum = fromBlock; blockNum <= actualToBlock; blockNum++) {
        const block = await this.getBlock(blockNum);
        
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            // Check if transaction involves the contract
            if (tx.contract_address === contractAddress || 
                (tx.calldata && tx.calldata.includes(contractAddress))) {
              
              const receipt = await this.getTransactionReceipt(tx.transaction_hash);
              
              transactions.push({
                hash: tx.transaction_hash,
                from: tx.sender_address,
                to: tx.contract_address,
                value: '0',
                gasPrice: '0',
                gasUsed: receipt?.actual_fee || '0',
                gasLimit: tx.max_fee || '0',
                input: JSON.stringify(tx.calldata || []),
                blockNumber: blockNum,
                blockTimestamp: block.timestamp,
                status: receipt?.status === 'ACCEPTED_ON_L2' || receipt?.status === 'ACCEPTED_ON_L1',
                chain: 'starknet',
                nonce: tx.nonce,
                type: tx.type,
                version: tx.version,
                source: 'fallback-block-scan'
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Fallback block scan also failed:', error.message);
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
  async _getBlockTimestamp(blockNumber) {
    // Check cache first
    if (this.blockTimestampCache.has(blockNumber)) {
      return this.blockTimestampCache.get(blockNumber);
    }

    try {
      const block = await this.getBlock(blockNumber);
      const timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
      this.blockTimestampCache.set(blockNumber, timestamp);
      return timestamp;
    } catch (error) {
      this.errorTracker.track(error, { method: '_getBlockTimestamp', blockNumber });
      
      // Estimate timestamp based on average block time (6 seconds for Starknet)
      const currentBlock = await this.getBlockNumber().catch(() => blockNumber);
      const currentTime = Math.floor(Date.now() / 1000);
      const blockDiff = currentBlock - blockNumber;
      const estimatedTimestamp = currentTime - (blockDiff * 6);
      
      this.blockTimestampCache.set(blockNumber, estimatedTimestamp);
      return estimatedTimestamp;
    }
  }

  /**
   * Get transactions by contract address (LEGACY - replaced by event-based approach above)
   * @deprecated Use the new event-based getTransactionsByAddress method instead
   */
  async getTransactionsByAddressLegacy(contractAddress, fromBlock, toBlock) {
    const transactions = [];
    
    try {
      // Get blocks in range and filter transactions
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        const block = await this.getBlock(blockNum);
        
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            // Check if transaction involves the contract
            if (tx.contract_address === contractAddress || 
                (tx.calldata && tx.calldata.includes(contractAddress))) {
              
              const receipt = await this.getTransactionReceipt(tx.transaction_hash);
              
              transactions.push({
                hash: tx.transaction_hash,
                from: tx.sender_address,
                to: tx.contract_address,
                value: '0', // Starknet doesn't have ETH value transfers in the same way
                gasPrice: '0',
                gasUsed: receipt?.actual_fee || '0',
                gasLimit: tx.max_fee || '0',
                input: JSON.stringify(tx.calldata || []),
                blockNumber: blockNum,
                blockTimestamp: block.timestamp,
                status: receipt?.status === 'ACCEPTED_ON_L2' || receipt?.status === 'ACCEPTED_ON_L1',
                chain: 'starknet',
                nonce: tx.nonce,
                type: tx.type,
                version: tx.version
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Starknet transactions (legacy):', error.message);
      throw error;
    }
    
    return transactions;
  }

  /**
   * Batch get transactions (simplified for Starknet)
   */
  async batchGetTransactions(txHashes) {
    const transactions = [];
    
    // Process in smaller batches to avoid overwhelming the RPC
    const batchSize = 5;
    for (let i = 0; i < txHashes.length; i += batchSize) {
      const batch = txHashes.slice(i, i + batchSize);
      const promises = batch.map(hash => this.getTransaction(hash));
      const results = await Promise.all(promises);
      transactions.push(...results);
    }
    
    return transactions;
  }

  /**
   * Test connection to Starknet RPC
   */
  async testConnection() {
    try {
      // Use shorter timeout for connection test
      await this._makeRpcCall('starknet_blockNumber', [], 5000);
      return true;
    } catch (error) {
      console.error(`Starknet RPC test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get chain info
   */
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

  getChain() {
    return 'starknet';
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
}

export default StarknetRpcClient;