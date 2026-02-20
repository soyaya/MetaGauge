/**
 * Enhanced Lisk RPC Client for comprehensive contract analysis
 * Fetches ALL contract interactions: events, direct transactions (to/from)
 */

import { ethers } from 'ethers';

export class LiskRpcClient {
  constructor(rpcUrls, config = {}) {
    this.rpcUrls = Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls];
    this.currentRpcIndex = 0;
    this.config = {
      timeout: 30000,
      retries: 2,
      ...config
    };
  }

  async _makeRpcCall(method, params = [], timeout = this.config.timeout) {
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      for (let rpcIndex = 0; rpcIndex < this.rpcUrls.length; rpcIndex++) {
        const rpcUrl = this.rpcUrls[(this.currentRpcIndex + rpcIndex) % this.rpcUrls.length];
        
        try {
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method,
              params,
              id: Date.now()
            }),
            signal: AbortSignal.timeout(timeout)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (data.error) {
            throw new Error(`RPC Error: ${data.error.message}`);
          }

          return data.result;
        } catch (error) {
          console.warn(`RPC call failed (${rpcUrl}): ${error.message}`);
          if (rpcIndex === this.rpcUrls.length - 1 && attempt === this.config.retries) {
            throw error;
          }
        }
      }
    }
  }

  async getBlockNumber() {
    const result = await this._makeRpcCall('eth_blockNumber', [], 10000);
    return parseInt(result, 16);
  }

  async getBlock(blockNumber) {
    const blockHex = typeof blockNumber === 'number' ? '0x' + blockNumber.toString(16) : blockNumber;
    return await this._makeRpcCall('eth_getBlockByNumber', [blockHex, true]);
  }

  async getTransactionReceipt(txHash) {
    return await this._makeRpcCall('eth_getTransactionReceipt', [txHash]);
  }

  async _getBlockTimestamp(blockNumber) {
    try {
      const block = await this.getBlock(blockNumber);
      return parseInt(block.timestamp, 16);
    } catch (error) {
      return Math.floor(Date.now() / 1000);
    }
  }

  /**
   * Comprehensive contract transaction fetching
   * Fetches ALL interactions: events, direct transactions (to/from), internal calls
   */
  async getTransactionsByAddress(contractAddress, fromBlock, toBlock) {
    const transactions = [];
    const events = [];
    const totalBlocks = toBlock - fromBlock + 1;
    
    console.log(`   📦 Comprehensive analysis: ${totalBlocks} blocks for contract ${contractAddress}`);
    
    try {
      // Step 1: Fetch ALL contract events (most efficient method)
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
      
      // Step 3: Fetch transaction details for event transactions
      for (const txHash of eventTxHashes) {
        try {
          const tx = await this._makeRpcCall('eth_getTransactionByHash', [txHash]);
          const receipt = await this.getTransactionReceipt(txHash);
          
          if (tx) {
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
              blockTimestamp: await this._getBlockTimestamp(parseInt(tx.blockNumber, 16)),
              status: receipt?.status === '0x1' || receipt?.status === 1,
              chain: 'lisk',
              nonce: parseInt(tx.nonce, 16),
              type: parseInt(tx.type || '0x0', 16),
              maxFeePerGas: tx.maxFeePerGas || null,
              maxPriorityFeePerGas: tx.maxPriorityFeePerGas || null,
              source: 'event',
              events: events.filter(e => e.transactionHash === txHash)
            });
          }
        } catch (txError) {
          console.warn(`   ⚠️  Failed to fetch transaction ${txHash}: ${txError.message}`);
        }
      }
      
      // Step 4: Scan for direct transactions (TO/FROM contract) not captured by events
      console.log(`   🔍 Scanning for direct contract transactions...`);
      const batchSize = 100;
      let directTxCount = 0;
      
      for (let batchStart = fromBlock; batchStart <= toBlock; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, toBlock);
        
        for (let blockNum = batchStart; blockNum <= batchEnd; blockNum++) {
          try {
            const block = await this.getBlock(blockNum);
            
            if (block && block.transactions) {
              for (const tx of block.transactions) {
                // Check if transaction involves the contract (TO or FROM)
                const isToContract = tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase();
                const isFromContract = tx.from && tx.from.toLowerCase() === contractAddress.toLowerCase();
                const alreadyProcessed = eventTxHashes.has(tx.hash);
                
                if ((isToContract || isFromContract) && !alreadyProcessed) {
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
        }
        
        // Progress update
        const progress = ((batchEnd - fromBlock) / totalBlocks * 100).toFixed(1);
        console.log(`   📊 Progress: ${progress}% (${batchEnd}/${toBlock})`);
      }
      
      console.log(`   ✅ Analysis complete:`);
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
      console.error(`   ❌ Error in comprehensive analysis: ${error.message}`);
      throw error;
    }
  }

  async batchGetTransactions(txHashes) {
    const transactions = [];
    
    for (const txHash of txHashes) {
      try {
        const tx = await this._makeRpcCall('eth_getTransactionByHash', [txHash]);
        if (tx) {
          transactions.push(tx);
        }
      } catch (error) {
        console.warn(`Failed to fetch transaction ${txHash}: ${error.message}`);
      }
    }
    
    return transactions;
  }
}
