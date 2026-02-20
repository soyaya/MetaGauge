import { ethers } from 'ethers';
import { RpcCache } from './RpcCache.js';
import { RpcRequestQueue } from './RpcRequestQueue.js';
import { RpcErrorTracker } from './RpcErrorTracker.js';

export class LiskRpcClient {
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

  async _makeRpcCall(method, params = [], timeout = this.config.timeout) {
    // Check cache first
    const cached = this.cache.get(method, params);
    if (cached) return cached;

    return this.queue.enqueue(async () => {
      const payload = {
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId++
      };

      for (let attempt = 0; attempt <= this.config.retries; attempt++) {
        for (let rpcIndex = 0; rpcIndex < this.rpcUrls.length; rpcIndex++) {
          const rpcUrl = this.rpcUrls[(this.currentRpcIndex + rpcIndex) % this.rpcUrls.length];
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
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
              throw new Error(`RPC Error: ${data.error.message || data.error}`);
            }

            // Cache successful response
            this.cache.set(method, params, data.result);
            return data.result;
          } catch (error) {
            clearTimeout(timeoutId);
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
      
      // Estimate timestamp based on average block time (2 seconds for Lisk)
      const currentBlock = await this.getBlockNumber().catch(() => blockNumber);
      const currentTime = Math.floor(Date.now() / 1000);
      const blockDiff = currentBlock - blockNumber;
      const estimatedTimestamp = currentTime - (blockDiff * 2);
      
      this.blockTimestampCache.set(blockNumber, estimatedTimestamp);
      return estimatedTimestamp;
    }
  }

  async getTransactionReceipt(txHash) {
    return await this._makeRpcCall('eth_getTransactionReceipt', [txHash]);
  }

  /**
   * Optimized transaction fetching - focuses on events first, minimal block scanning
   */
  async getTransactionsByAddress(contractAddress, fromBlock, toBlock) {
    const transactions = [];
    const events = [];
    const totalBlocks = toBlock - fromBlock + 1;
    
    console.log(`   📦 Optimized analysis: ${totalBlocks} blocks for contract ${contractAddress}`);
    
    try {
      // Step 1: Fetch contract events (most efficient)
      console.log(`   📋 Fetching contract events from blocks ${fromBlock}-${toBlock}...`);
      const allLogs = await this._makeRpcCall('eth_getLogs', [{
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + toBlock.toString(16),
        address: contractAddress
      }]);
      
      console.log(`   📋 Found ${allLogs.length} contract events`);
      
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
      
      // Step 3: Batch fetch transaction details for event transactions
      // Use tier-based batch sizes for optimal performance
      const batchSize = this.config.tier === 'enterprise' ? 20 : 
                        this.config.tier === 'pro' ? 15 : 10;
      const txHashArray = Array.from(eventTxHashes);
      
      console.log(`   📦 Processing ${txHashArray.length} transactions in batches of ${batchSize}...`);
      
      for (let i = 0; i < txHashArray.length; i += batchSize) {
        const batch = txHashArray.slice(i, i + batchSize);
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
                chain: 'lisk',
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
        
        console.log(`   📊 Progress: ${Math.min(i + batchSize, txHashArray.length)}/${txHashArray.length} transactions processed`);
      }
      
      // Step 4: Quick check for direct transactions (only if no events found)
      let directTxCount = 0;
      if (eventTxHashes.size === 0 && totalBlocks <= 100) {
        console.log(`   🔍 No events found, scanning ${totalBlocks} blocks for direct transactions...`);
        
        // Only scan a limited number of recent blocks for direct transactions
        const scanBlocks = Math.min(totalBlocks, 50);
        const startBlock = Math.max(fromBlock, toBlock - scanBlocks + 1);
        
        for (let blockNum = startBlock; blockNum <= toBlock; blockNum++) {
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
                    chain: 'lisk',
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
          
          const progress = ((blockNum - startBlock + 1) / scanBlocks * 100).toFixed(1);
          console.log(`   📊 Progress: ${progress}% (${blockNum}/${toBlock})`);
        }
      } else if (totalBlocks > 100) {
        console.log(`   ⚠️  Skipping direct transaction scan for ${totalBlocks} blocks (too many blocks, use events only)`);
      }
      
      console.log(`   ✅ Analysis complete:`);
      console.log(`      📋 Events: ${events.length}`);
      console.log(`      🔗 Event transactions: ${eventTxHashes.size}`);
      console.log(`      📤 Direct transactions: ${directTxCount}`);
      console.log(`      📊 Total transactions: ${transactions.length}`);
      
      // Return just the transactions array for compatibility
      return transactions;
      
    } catch (error) {
      console.error(`   ❌ Error in optimized analysis: ${error.message}`);
      throw error;
    }
  }

  async batchGetTransactions(txHashes) {
    const transactions = [];
    const batchSize = 10;
    
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
   * Test connection to Lisk RPC
   */
  async testConnection() {
    try {
      await this._makeRpcCall('eth_blockNumber', [], 5000);
      return true;
    } catch (error) {
      console.error(`Lisk RPC test failed: ${error.message}`);
      return false;
    }
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
    return 'lisk';
  }

  /**
   * Get RPC URL
   */
  getRpcUrl() {
    return this.rpcUrl;
  }
}