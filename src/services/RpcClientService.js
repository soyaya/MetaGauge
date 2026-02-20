import { ethers } from 'ethers';

/**
 * RPC Client Service
 * Communicates with blockchain nodes via NowNodes RPC to fetch transaction data
 */
export class RpcClientService {
  /**
   * @param {string} rpcUrl - RPC endpoint URL
   * @param {string} chain - Chain name (ethereum, polygon, starknet, etc.)
   */
  constructor(rpcUrl, chain) {
    this.rpcUrl = rpcUrl;
    this.chain = chain.toLowerCase();
    this.provider = null;
    this.retryConfig = {
      maxRetries: 5,      // Increased from 3 to 5 retries
      baseDelay: 2000,    // 2 seconds (increased from 1s)
      maxDelay: 30000     // 30 seconds (increased from 10s)
    };
    this.timeouts = {
      transaction: 60000, // 60 seconds (increased from 30s)
      block: 30000,       // 30 seconds (increased from 10s)
      default: 45000      // 45 seconds for general operations
    };
    
    this._initializeProvider();
  }

  /**
   * Initialize the provider based on chain type
   * @private
   */
  _initializeProvider() {
    try {
      if (this.chain === 'starknet') {
        // Starknet uses different RPC format
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl, null, { staticNetwork: true });
      } else {
        // Ethereum, Polygon, Base, Arbitrum, Optimism use standard JSON-RPC
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl, null, { staticNetwork: true });
      }
    } catch (error) {
      throw new Error(`Failed to initialize provider for ${this.chain}: ${error.message}`);
    }
  }

  /**
   * Get current block number
   * @returns {Promise<number>} Current block number
   */
  async getBlockNumber() {
    return await this._retryOperation(async () => {
      if (this.chain === 'starknet') {
        // Starknet uses different RPC method
        const result = await this.provider.send('starknet_blockNumber', []);
        return parseInt(result, 16); // Convert hex to decimal
      } else {
        // Ethereum-compatible chains
        const blockNumber = await this.provider.getBlockNumber();
        return blockNumber;
      }
    }, 'getBlockNumber');
  }

  /**
   * Get transactions by contract address using interaction-based fetching (events first)
   * @param {string} address - Contract address
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number
   * @returns {Promise<Array>} Array of transactions
   */
  async getTransactionsByAddress(address, fromBlock, toBlock) {
    return await this._retryOperation(async () => {
      const transactions = [];
      const events = [];
      const totalBlocks = toBlock - fromBlock + 1;
      
      console.log(`   📦 ${this.chain} analysis: ${totalBlocks} blocks for contract ${address}`);
      
      try {
        // Step 1: Fetch contract events (most efficient approach)
        console.log(`   📋 Fetching contract events from blocks ${fromBlock}-${toBlock}...`);
        
        let allLogs = [];
        try {
          // Try to get logs using eth_getLogs (works for Ethereum-compatible chains)
          const logsResult = await this.provider.send('eth_getLogs', [{
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: '0x' + toBlock.toString(16),
            address: address
          }]);
          allLogs = logsResult || [];
        } catch (logsError) {
          console.log(`   ⚠️  eth_getLogs not supported, falling back to block scanning`);
          allLogs = [];
        }
        
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
        if (eventTxHashes.size > 0) {
          const batchSize = 10; // Conservative batch size for generic chains
          const txHashArray = Array.from(eventTxHashes);
          
          for (let i = 0; i < txHashArray.length; i += batchSize) {
            const batch = txHashArray.slice(i, i + batchSize);
            const batchPromises = batch.map(async (txHash) => {
              try {
                const tx = await this.provider.getTransaction(txHash);
                const receipt = await this.provider.getTransactionReceipt(txHash);
                
                if (tx) {
                  const block = await this.provider.getBlock(tx.blockNumber);
                  return await this._formatTransaction(tx, block, receipt, events.filter(e => e.transactionHash === txHash));
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
        
        // Step 4: Limited direct transaction scanning (only for small ranges or when no events)
        let directTxCount = 0;
        if (eventTxHashes.size === 0 && totalBlocks <= 100) {
          console.log(`   🔍 No events found, scanning ${totalBlocks} blocks for direct transactions...`);
          
          // Fetch transactions in smaller batches to avoid overwhelming the RPC
          const blockBatchSize = 50;
          
          for (let block = fromBlock; block <= toBlock; block += blockBatchSize) {
            const endBlock = Math.min(block + blockBatchSize - 1, toBlock);
            
            // Get block range
            const blockPromises = [];
            for (let b = block; b <= endBlock; b++) {
              blockPromises.push(this.provider.getBlock(b, true));
            }
            
            const blocks = await Promise.all(blockPromises);
            
            // Filter transactions to/from the address
            for (const blockData of blocks) {
              if (blockData && blockData.transactions) {
                for (const tx of blockData.transactions) {
                  const isToContract = tx.to && tx.to.toLowerCase() === address.toLowerCase();
                  const isFromContract = tx.from && tx.from.toLowerCase() === address.toLowerCase();
                  
                  if (isToContract || isFromContract) {
                    const receipt = await this.provider.getTransactionReceipt(tx.hash);
                    transactions.push(await this._formatTransaction(tx, blockData, receipt, []));
                    directTxCount++;
                  }
                }
              }
            }
            
            const progress = ((endBlock - fromBlock + 1) / totalBlocks * 100).toFixed(1);
            console.log(`   📊 Progress: ${progress}% (${endBlock}/${toBlock})`);
          }
        } else if (totalBlocks > 100) {
          console.log(`   ⚠️  Skipping direct transaction scan for ${totalBlocks} blocks (too many blocks, use events only)`);
        }
        
        console.log(`   ✅ ${this.chain} analysis complete:`);
        console.log(`      📋 Events: ${events.length}`);
        console.log(`      🔗 Event transactions: ${eventTxHashes.size}`);
        console.log(`      📤 Direct transactions: ${directTxCount}`);
        console.log(`      📊 Total transactions: ${transactions.length}`);
        
        return transactions;
        
      } catch (error) {
        console.error(`   ❌ Error in ${this.chain} analysis: ${error.message}`);
        throw error;
      }
    }, 'getTransactionsByAddress', this.timeouts.transaction);
  }

  /**
   * Get transaction receipt
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction receipt
   */
  async getTransactionReceipt(txHash) {
    return await this._retryOperation(async () => {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    }, 'getTransactionReceipt');
  }

  /**
   * Get block by number
   * @param {number} blockNumber - Block number
   * @returns {Promise<Object>} Block data
   */
  async getBlock(blockNumber) {
    return await this._retryOperation(async () => {
      const block = await this.provider.getBlock(blockNumber);
      return block;
    }, 'getBlock', this.timeouts.block);
  }

  /**
   * Batch get transactions by hashes
   * @param {Array<string>} txHashes - Array of transaction hashes
   * @returns {Promise<Array>} Array of transactions
   */
  async batchGetTransactions(txHashes) {
    return await this._retryOperation(async () => {
      const batchSize = 10; // Process 10 at a time
      const results = [];
      
      for (let i = 0; i < txHashes.length; i += batchSize) {
        const batch = txHashes.slice(i, i + batchSize);
        const promises = batch.map(hash => this.provider.getTransaction(hash));
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }
      
      return results;
    }, 'batchGetTransactions', this.timeouts.transaction);
  }

  /**
   * Format transaction data to standard format
   * @private
   */
  async _formatTransaction(tx, blockData, receipt = null, events = []) {
    // Get receipt if not provided
    if (!receipt) {
      receipt = await this.getTransactionReceipt(tx.hash);
    }
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value ? tx.value.toString() : '0',
      gasPrice: tx.gasPrice ? tx.gasPrice.toString() : '0',
      gasUsed: receipt ? receipt.gasUsed.toString() : '0',
      gasLimit: tx.gasLimit ? tx.gasLimit.toString() : '0',
      input: tx.data || '0x',
      blockNumber: tx.blockNumber,
      blockTimestamp: blockData.timestamp,
      status: receipt ? receipt.status === 1 : false,
      chain: this.chain,
      nonce: tx.nonce,
      events: events || []
    };
  }

  /**
   * Retry operation with exponential backoff and jitter
   * @private
   */
  async _retryOperation(operation, operationName, timeout = null) {
    let lastError;
    const effectiveTimeout = timeout || this.timeouts.default;
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        // Apply timeout for all operations
        return await this._withTimeout(operation(), effectiveTimeout);
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (this._isNonRetryableError(error)) {
          console.error(`[RPC ${this.chain}] Non-retryable error in ${operationName}: ${error.message}`);
          throw error;
        }
        
        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxRetries - 1) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter to avoid thundering herd
        const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Random jitter up to 1 second
        const delay = Math.min(exponentialDelay + jitter, this.retryConfig.maxDelay);
        
        console.warn(
          `[RPC ${this.chain}] ${operationName} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries}): ${error.message}. Retrying in ${Math.round(delay)}ms...`
        );
        
        await this._sleep(delay);
      }
    }
    
    throw new Error(
      `[RPC ${this.chain}] ${operationName} failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`
    );
  }

  /**
   * Check if error should not be retried
   * @private
   */
  _isNonRetryableError(error) {
    const nonRetryableMessages = [
      'invalid address',
      'invalid argument',
      'missing argument',
      'invalid block number'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return nonRetryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Execute operation with timeout
   * @private
   */
  async _withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Sleep for specified milliseconds
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get chain name
   * @returns {string} Chain name
   */
  getChain() {
    return this.chain;
  }

  /**
   * Get RPC URL
   * @returns {string} RPC URL
   */
  getRpcUrl() {
    return this.rpcUrl;
  }

  /**
   * Test connection to RPC endpoint
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      if (this.chain === 'starknet') {
        // Test Starknet-specific method
        await this.provider.send('starknet_blockNumber', []);
      } else {
        // Test Ethereum-compatible method
        await this.getBlockNumber();
      }
      return true;
    } catch (error) {
      console.error(`[RPC ${this.chain}] Connection test failed: ${error.message}`);
      return false;
    }
  }
}

export default RpcClientService;
