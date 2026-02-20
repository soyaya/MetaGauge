/**
 * Lisk RPC Client
 * EVM-compatible client for Lisk blockchain with RWA/DePIN focus
 * Multi-Chain RPC Integration - Task 2
 */

import fetch from 'node-fetch';

export class LiskRpcClient {
  constructor(rpcUrl) {
    this.rpcUrl = rpcUrl;
    this.chain = 'lisk';
    this.requestId = 1;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    };
    this.timeouts = {
      transaction: 30000,
      block: 10000
    };
  }

  /**
   * Make a JSON-RPC call to Lisk
   * @private
   */
  async _makeRpcCall(method, params = [], timeout = 10000) {
    const payload = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: this.requestId++
    };

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      return data.result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Lisk RPC call timed out after ${timeout}ms`);
      }
      throw new Error(`Lisk RPC call failed: ${error.message}`);
    }
  }

  /**
   * Get current block number
   * @returns {Promise<number>} Current block number
   */
  async getBlockNumber() {
    const result = await this._makeRpcCall('eth_blockNumber', [], 10000);
    return parseInt(result, 16);
  }

  /**
   * Get block by number with transactions
   * @param {number} blockNumber - Block number
   * @returns {Promise<Object>} Block data with transactions
   */
  async getBlock(blockNumber) {
    const blockNumberHex = '0x' + blockNumber.toString(16);
    return await this._makeRpcCall('eth_getBlockByNumber', [blockNumberHex, true]);
  }

  /**
   * Get transaction by hash
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction data
   */
  async getTransaction(txHash) {
    return await this._makeRpcCall('eth_getTransactionByHash', [txHash]);
  }

  /**
   * Get transaction receipt
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction receipt
   */
  async getTransactionReceipt(txHash) {
    return await this._makeRpcCall('eth_getTransactionReceipt', [txHash]);
  }

  /**
   * Get transactions by contract address
   * @param {string} contractAddress - Contract address
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number
   * @returns {Promise<Array>} Array of transactions
   */
  async getTransactionsByAddress(contractAddress, fromBlock, toBlock) {
    const transactions = [];
    const events = [];
    const totalBlocks = toBlock - fromBlock + 1;
    let processedBlocks = 0;
    
    console.log(`   📦 Processing ${totalBlocks} blocks for contract analysis (with events)...`);
    
    try {
      // Process blocks in larger batches for better performance (100-200 blocks)
      const batchSize = 150; // Increased from 50 to 150 blocks per batch
      
      for (let batchStart = fromBlock; batchStart <= toBlock; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, toBlock);
        const batchTransactions = [];
        const batchEvents = [];
        
        // Fetch events for this batch using eth_getLogs
        try {
          const logs = await this._makeRpcCall('eth_getLogs', [{
            fromBlock: '0x' + batchStart.toString(16),
            toBlock: '0x' + batchEnd.toString(16),
            address: contractAddress
          }]);
          
          if (logs && logs.length > 0) {
            console.log(`   📋 Found ${logs.length} events in blocks ${batchStart}-${batchEnd}`);
            
            for (const log of logs) {
              batchEvents.push({
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
          }
        } catch (eventError) {
          console.warn(`   ⚠️  Failed to fetch events for blocks ${batchStart}-${batchEnd}: ${eventError.message}`);
        }
        
        // Process batch
        for (let blockNum = batchStart; blockNum <= batchEnd; blockNum++) {
          try {
            const block = await this.getBlock(blockNum);
            
            if (block && block.transactions) {
              for (const tx of block.transactions) {
                // Check if transaction involves the contract (to/from or events)
                const isContractTransaction = 
                  (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) ||
                  (tx.from && tx.from.toLowerCase() === contractAddress.toLowerCase()) ||
                  batchEvents.some(event => event.transactionHash === tx.hash);
                
                if (isContractTransaction) {
                  // Get transaction receipt for gas and event information
                  const receipt = await this.getTransactionReceipt(tx.hash);
                  
                  // Get account balance if this is a transfer
                  let accountBalance = null;
                  if (tx.from) {
                    try {
                      const balance = await this._makeRpcCall('eth_getBalance', [tx.from, '0x' + blockNum.toString(16)]);
                      accountBalance = balance;
                    } catch (balanceError) {
                      // Balance fetch failed, continue without it
                    }
                  }
                  
                  batchTransactions.push({
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
                    // Additional data
                    accountBalance: accountBalance,
                    logs: receipt?.logs || [],
                    contractAddress: receipt?.contractAddress || null,
                    cumulativeGasUsed: receipt?.cumulativeGasUsed || '0',
                    effectiveGasPrice: receipt?.effectiveGasPrice || tx.gasPrice || '0',
                    // Event data
                    events: batchEvents.filter(event => event.transactionHash === tx.hash)
                  });
                }
              }
            }
            
            processedBlocks++;
            
            // Progress update every 100 blocks
            if (processedBlocks % 100 === 0) {
              const progress = ((processedBlocks / totalBlocks) * 100).toFixed(1);
              console.log(`   📊 Progress: ${progress}% (${processedBlocks}/${totalBlocks} blocks, ${transactions.length} transactions found)`);
            }
          } catch (blockError) {
            console.warn(`   ⚠️  Failed to process block ${blockNum}: ${blockError.message}`);
            processedBlocks++;
          }
        }
        
        // Add batch data to main arrays
        transactions.push(...batchTransactions);
        events.push(...batchEvents);
        
        // Small delay between batches to avoid overwhelming the RPC
        if (batchStart + batchSize <= toBlock) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`   ✅ Completed processing ${totalBlocks} blocks, found ${transactions.length} transactions`);
      
    } catch (error) {
      console.error('Error fetching Lisk transactions:', error.message);
      throw error;
    }
    
    return transactions;
  }

  /**
   * Batch get transactions
   * @param {Array<string>} txHashes - Array of transaction hashes
   * @returns {Promise<Array>} Array of transactions
   */
  async batchGetTransactions(txHashes) {
    const transactions = [];
    
    // Process in smaller batches to avoid overwhelming the RPC
    const batchSize = 10;
    for (let i = 0; i < txHashes.length; i += batchSize) {
      const batch = txHashes.slice(i, i + batchSize);
      const promises = batch.map(hash => this.getTransaction(hash));
      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          transactions.push(result.value);
        } else {
          console.warn(`Failed to fetch transaction ${batch[index]}: ${result.reason}`);
        }
      });
    }
    
    return transactions;
  }

  /**
   * Retry operation with exponential backoff
   * @private
   */
  async _retryOperation(operation, operationName) {
    let lastError;
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryConfig.maxRetries - 1) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );
          
          console.warn(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`${operationName} failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Test connection to Lisk RPC
   * @returns {Promise<boolean>} True if connection is successful
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
   * Get chain info
   * @returns {string} Chain name
   */
  getChain() {
    return 'lisk';
  }

  /**
   * Get RPC URL
   * @returns {string} RPC URL
   */
  getRpcUrl() {
    return this.rpcUrl;
  }
}

export default LiskRpcClient;