/**
 * Multi-Chain Contract Indexer
 * Unified indexing-based contract interaction system for Lisk, Ethereum, and Starknet
 * Focuses on efficient event-based indexing with fallback mechanisms
 */

import { EventEmitter } from 'events';
import { LiskRpcClient } from './LiskRpcClient.js';
import { EthereumRpcClient } from './EthereumRpcClient.js';
import { StarknetRpcClient } from './StarknetRpcClient.js';

export class MultiChainContractIndexer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 5,
      requestTimeout: config.requestTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      batchSize: config.batchSize || 20,
      indexingMode: config.indexingMode || 'events-first', // 'events-first', 'hybrid', 'full-scan'
      ...config
    };
    
    // Chain configurations with multiple RPC endpoints
    this.chainConfigs = {
      lisk: {
        name: 'Lisk',
        rpcUrls: [
          process.env.LISK_RPC_URL1 || 'https://rpc.api.lisk.com',
          process.env.LISK_RPC_URL2 || 'https://lisk.drpc.org',
          process.env.LISK_RPC_URL3 || 'https://lisk.gateway.tenderly.co/2o3VKjmisQNOJIPlLrt6Ye',
          process.env.LISK_RPC_URL4 || 'https://site1.moralis-nodes.com/lisk/7f6b7ac6edf2456fa240535cc2d8fc6e'
        ],
        clientClass: LiskRpcClient,
        type: 'evm',
        chainId: 1135
      },
      ethereum: {
        name: 'Ethereum',
        rpcUrls: [
          process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
          process.env.ETHEREUM_RPC_URL_FALLBACK || 'https://eth.nownodes.io/2ca1a1a6-9040-4ca9-8727-33a186414a1f'
        ],
        clientClass: EthereumRpcClient,
        type: 'evm',
        chainId: 1
      },
      starknet: {
        name: 'Starknet',
        rpcUrls: [
          process.env.STARKNET_RPC_URL1 || 'https://rpc.starknet.lava.build',
          process.env.STARKNET_RPC_URL2 || 'https://starknet-rpc.publicnode.com',
          process.env.STARKNET_RPC_URL3 || 'https://starknet-mainnet.infura.io/v3/52be4d01250949baa85cad00e7b955ab'
        ],
        clientClass: StarknetRpcClient,
        type: 'cairo',
        chainId: 'SN_MAIN'
      }
    };
    
    this.clients = {};
    this.activeClients = {};
    this.requestQueue = [];
    this.stats = {};
    
    this._initializeClients();
  }

  /**
   * Initialize RPC clients for all chains
   * @private
   */
  _initializeClients() {
    console.log('🚀 Initializing Multi-Chain Contract Indexer...');
    
    for (const [chainName, config] of Object.entries(this.chainConfigs)) {
      this.clients[chainName] = [];
      this.stats[chainName] = {
        requests: 0,
        successes: 0,
        failures: 0,
        avgResponseTime: 0
      };
      
      // Initialize multiple clients per chain for failover
      config.rpcUrls.forEach((rpcUrl, index) => {
        try {
          const client = new config.clientClass(rpcUrl, {
            timeout: this.config.requestTimeout,
            retries: this.config.maxRetries
          });
          
          this.clients[chainName].push({
            client,
            rpcUrl,
            priority: index,
            isHealthy: true,
            lastUsed: 0,
            responseTime: 0,
            successCount: 0,
            failureCount: 0
          });
          
          console.log(`✅ Initialized ${config.name} client #${index + 1}: ${rpcUrl}`);
        } catch (error) {
          console.error(`❌ Failed to initialize ${config.name} client #${index + 1}: ${error.message}`);
        }
      });
      
      // Set the first healthy client as active
      const healthyClient = this.clients[chainName].find(c => c.isHealthy);
      if (healthyClient) {
        this.activeClients[chainName] = healthyClient;
        console.log(`🎯 Active ${config.name} client: ${healthyClient.rpcUrl}`);
      }
    }
  }

  /**
   * Get the best available client for a chain
   * @private
   */
  _getBestClient(chainName) {
    const clients = this.clients[chainName];
    if (!clients || clients.length === 0) {
      throw new Error(`No clients available for chain: ${chainName}`);
    }
    
    // Sort by health, success rate, and response time
    const sortedClients = clients
      .filter(c => c.isHealthy)
      .sort((a, b) => {
        const aSuccessRate = a.successCount / (a.successCount + a.failureCount) || 0;
        const bSuccessRate = b.successCount / (b.successCount + b.failureCount) || 0;
        
        if (aSuccessRate !== bSuccessRate) return bSuccessRate - aSuccessRate;
        return a.responseTime - b.responseTime;
      });
    
    if (sortedClients.length === 0) {
      throw new Error(`No healthy clients available for chain: ${chainName}`);
    }
    
    return sortedClients[0];
  }

  /**
   * Execute operation with automatic failover
   * @private
   */
  async _executeWithFailover(chainName, operation, operationName) {
    const clients = this.clients[chainName];
    if (!clients || clients.length === 0) {
      throw new Error(`No clients configured for chain: ${chainName}`);
    }
    
    let lastError;
    
    // Try each client in order of preference
    for (const clientInfo of clients.filter(c => c.isHealthy)) {
      const startTime = Date.now();
      
      try {
        this.stats[chainName].requests++;
        clientInfo.lastUsed = Date.now();
        
        const result = await Promise.race([
          operation(clientInfo.client),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.config.requestTimeout)
          )
        ]);
        
        const responseTime = Date.now() - startTime;
        clientInfo.responseTime = responseTime;
        clientInfo.successCount++;
        this.stats[chainName].successes++;
        
        console.log(`✅ ${operationName} successful on ${chainName} via ${clientInfo.rpcUrl} (${responseTime}ms)`);
        return result;
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        clientInfo.failureCount++;
        this.stats[chainName].failures++;
        lastError = error;
        
        console.warn(`⚠️ ${operationName} failed on ${chainName} via ${clientInfo.rpcUrl}: ${error.message}`);
        
        // Mark client as unhealthy if it fails too often
        if (clientInfo.failureCount > 3 && clientInfo.failureCount > clientInfo.successCount) {
          clientInfo.isHealthy = false;
          console.warn(`🚫 Marking ${chainName} client as unhealthy: ${clientInfo.rpcUrl}`);
        }
      }
    }
    
    throw new Error(`All ${chainName} clients failed for ${operationName}: ${lastError?.message}`);
  }

  /**
   * Index contract interactions using events-first approach
   * @param {string} contractAddress - Contract address to index
   * @param {number} fromBlock - Starting block number
   * @param {number} toBlock - Ending block number
   * @param {string} chainName - Chain name (lisk, ethereum, starknet)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Indexed contract data
   */
  async indexContractInteractions(contractAddress, fromBlock, toBlock, chainName, options = {}) {
    if (!contractAddress || !chainName) {
      throw new Error('Contract address and chain name are required');
    }
    
    const chain = chainName.toLowerCase();
    const chainConfig = this.chainConfigs[chain];
    
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }
    
    console.log(`🎯 Indexing contract interactions for ${contractAddress} on ${chainConfig.name}`);
    console.log(`   📊 Block range: ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
    console.log(`   🔧 Mode: ${this.config.indexingMode}`);
    
    const startTime = Date.now();
    
    try {
      let result;
      
      if (chainConfig.type === 'evm') {
        result = await this._indexEVMContract(contractAddress, fromBlock, toBlock, chain, options);
      } else if (chainConfig.type === 'cairo') {
        result = await this._indexStarknetContract(contractAddress, fromBlock, toBlock, chain, options);
      } else {
        throw new Error(`Unsupported chain type: ${chainConfig.type}`);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Indexing complete for ${chainConfig.name} in ${duration}ms`);
      console.log(`   📋 Events: ${result.events?.length || 0}`);
      console.log(`   🔗 Transactions: ${result.transactions?.length || 0}`);
      console.log(`   📊 Method: ${result.method}`);
      
      return {
        ...result,
        chainName: chainConfig.name,
        chainType: chainConfig.type,
        contractAddress,
        blockRange: { fromBlock, toBlock },
        indexingDuration: duration,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Failed to index ${chainConfig.name} contract: ${error.message}`);
      throw error;
    }
  }

  /**
   * Index EVM-compatible contract (Lisk, Ethereum)
   * @private
   */
  async _indexEVMContract(contractAddress, fromBlock, toBlock, chainName, options) {
    return await this._executeWithFailover(
      chainName,
      async (client) => {
        const transactions = [];
        const events = [];
        const totalBlocks = toBlock - fromBlock + 1;
        
        // Step 1: Fetch contract events (most efficient for EVM chains)
        console.log(`   📋 Fetching contract events...`);
        
        try {
          const logs = await client._makeRpcCall('eth_getLogs', [{
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: '0x' + toBlock.toString(16),
            address: contractAddress
          }]);
          
          console.log(`   📋 Found ${logs.length} contract events`);
          
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
              removed: log.removed || false,
              decoded: this._decodeEventLog(log, options.abi)
            });
          }
          
          // Step 2: Get unique transaction hashes from events
          const eventTxHashes = new Set(logs.map(log => log.transactionHash));
          console.log(`   🔗 Found ${eventTxHashes.size} unique transactions from events`);
          
          // Step 3: Batch fetch transaction details
          if (eventTxHashes.size > 0) {
            const txHashArray = Array.from(eventTxHashes);
            const batchSize = chainName === 'ethereum' ? 15 : 10; // Ethereum can handle larger batches
            
            for (let i = 0; i < txHashArray.length; i += batchSize) {
              const batch = txHashArray.slice(i, i + batchSize);
              const batchPromises = batch.map(async (txHash) => {
                try {
                  const [tx, receipt] = await Promise.all([
                    client._makeRpcCall('eth_getTransactionByHash', [txHash]),
                    client._makeRpcCall('eth_getTransactionReceipt', [txHash])
                  ]);
                  
                  if (tx) {
                    const blockTimestamp = await this._getBlockTimestamp(client, parseInt(tx.blockNumber, 16));
                    
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
                      blockTimestamp,
                      status: receipt?.status === '0x1' || receipt?.status === 1,
                      chain: chainName,
                      nonce: parseInt(tx.nonce, 16),
                      type: parseInt(tx.type || '0x0', 16),
                      maxFeePerGas: tx.maxFeePerGas || null,
                      maxPriorityFeePerGas: tx.maxPriorityFeePerGas || null,
                      source: 'event',
                      events: events.filter(e => e.transactionHash === txHash),
                      decodedInput: this._decodeTransactionInput(tx.input, options.abi)
                    };
                  }
                } catch (txError) {
                  console.warn(`   ⚠️ Failed to fetch transaction ${txHash}: ${txError.message}`);
                  return null;
                }
              });
              
              const batchResults = await Promise.all(batchPromises);
              transactions.push(...batchResults.filter(tx => tx !== null));
              
              console.log(`   📊 Progress: ${Math.min(i + batchSize, txHashArray.length)}/${txHashArray.length} transactions processed`);
            }
          }
          
          // Step 4: Direct transaction scanning (only if needed and feasible)
          let directTxCount = 0;
          if (this.config.indexingMode === 'hybrid' && eventTxHashes.size === 0 && totalBlocks <= 50) {
            console.log(`   🔍 No events found, scanning ${totalBlocks} blocks for direct transactions...`);
            directTxCount = await this._scanDirectTransactions(client, contractAddress, fromBlock, toBlock, chainName, transactions);
          }
          
          return {
            transactions,
            events,
            summary: {
              totalTransactions: transactions.length,
              eventTransactions: eventTxHashes.size,
              directTransactions: directTxCount,
              totalEvents: events.length,
              blocksScanned: totalBlocks,
              eventsIndexed: true,
              directScanPerformed: directTxCount > 0
            },
            method: eventTxHashes.size > 0 ? 'events-first' : (directTxCount > 0 ? 'direct-scan' : 'no-interactions')
          };
          
        } catch (error) {
          console.error(`   ❌ Event indexing failed: ${error.message}`);
          
          // Fallback to limited direct scanning
          if (totalBlocks <= 100) {
            console.log(`   🔄 Falling back to direct transaction scanning...`);
            const directTransactions = [];
            const directTxCount = await this._scanDirectTransactions(client, contractAddress, fromBlock, toBlock, chainName, directTransactions);
            
            return {
              transactions: directTransactions,
              events: [],
              summary: {
                totalTransactions: directTransactions.length,
                eventTransactions: 0,
                directTransactions: directTxCount,
                totalEvents: 0,
                blocksScanned: totalBlocks,
                eventsIndexed: false,
                directScanPerformed: true
              },
              method: 'fallback-direct-scan'
            };
          } else {
            throw new Error(`Event indexing failed and block range too large for direct scan: ${error.message}`);
          }
        }
      },
      'indexEVMContract'
    );
  }

  /**
   * Index Starknet contract
   * @private
   */
  async _indexStarknetContract(contractAddress, fromBlock, toBlock, chainName, options) {
    return await this._executeWithFailover(
      chainName,
      async (client) => {
        const transactions = [];
        const events = [];
        const totalBlocks = toBlock - fromBlock + 1;
        
        console.log(`   📦 Starknet contract indexing (${totalBlocks} blocks)`);
        
        // Starknet uses a different approach - scan blocks for contract interactions
        for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
          try {
            const block = await client.getBlock(blockNum);
            
            if (block && block.transactions) {
              for (const tx of block.transactions) {
                // Check if transaction involves the contract
                const isContractInteraction = 
                  tx.contract_address === contractAddress ||
                  (tx.calldata && tx.calldata.some(data => data === contractAddress)) ||
                  (tx.sender_address === contractAddress);
                
                if (isContractInteraction) {
                  try {
                    const receipt = await client.getTransactionReceipt(tx.transaction_hash);
                    
                    transactions.push({
                      hash: tx.transaction_hash,
                      from: tx.sender_address,
                      to: tx.contract_address,
                      value: '0', // Starknet doesn't have ETH value transfers like EVM
                      gasPrice: '0',
                      gasUsed: receipt?.actual_fee || '0',
                      gasLimit: tx.max_fee || '0',
                      input: JSON.stringify(tx.calldata || []),
                      blockNumber: blockNum,
                      blockTimestamp: block.timestamp,
                      status: receipt?.status === 'ACCEPTED_ON_L2' || receipt?.status === 'ACCEPTED_ON_L1',
                      chain: chainName,
                      nonce: tx.nonce,
                      type: tx.type,
                      version: tx.version,
                      source: 'direct',
                      events: [],
                      starknetSpecific: {
                        entryPointSelector: tx.entry_point_selector,
                        calldata: tx.calldata,
                        signature: tx.signature
                      }
                    });
                    
                    // Extract events from receipt if available
                    if (receipt && receipt.events) {
                      for (const event of receipt.events) {
                        events.push({
                          address: event.from_address,
                          keys: event.keys,
                          data: event.data,
                          blockNumber: blockNum,
                          transactionHash: tx.transaction_hash,
                          eventIndex: events.length
                        });
                      }
                    }
                  } catch (receiptError) {
                    console.warn(`   ⚠️ Failed to get receipt for ${tx.transaction_hash}: ${receiptError.message}`);
                  }
                }
              }
            }
          } catch (blockError) {
            console.warn(`   ⚠️ Failed to process block ${blockNum}: ${blockError.message}`);
          }
          
          if (blockNum % 10 === 0) {
            const progress = ((blockNum - fromBlock + 1) / totalBlocks * 100).toFixed(1);
            console.log(`   📊 Progress: ${progress}% (${blockNum}/${toBlock})`);
          }
        }
        
        return {
          transactions,
          events,
          summary: {
            totalTransactions: transactions.length,
            eventTransactions: 0,
            directTransactions: transactions.length,
            totalEvents: events.length,
            blocksScanned: totalBlocks,
            eventsIndexed: false,
            directScanPerformed: true
          },
          method: 'starknet-block-scan'
        };
      },
      'indexStarknetContract'
    );
  }

  /**
   * Scan for direct transactions (fallback method)
   * @private
   */
  async _scanDirectTransactions(client, contractAddress, fromBlock, toBlock, chainName, transactions) {
    let directTxCount = 0;
    const maxBlocksToScan = Math.min(toBlock - fromBlock + 1, 50);
    const startBlock = Math.max(fromBlock, toBlock - maxBlocksToScan + 1);
    
    for (let blockNum = startBlock; blockNum <= toBlock; blockNum++) {
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
                chain: chainName,
                nonce: parseInt(tx.nonce, 16),
                type: parseInt(tx.type || '0x0', 16),
                source: isToContract ? 'to_contract' : 'from_contract',
                events: []
              });
              directTxCount++;
            }
          }
        }
      } catch (blockError) {
        console.warn(`   ⚠️ Failed to process block ${blockNum}: ${blockError.message}`);
      }
    }
    
    return directTxCount;
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
   * Decode event log (placeholder - would need ABI)
   * @private
   */
  _decodeEventLog(log, abi) {
    // This would require ABI decoding logic
    // For now, return basic structure
    return {
      signature: log.topics[0],
      raw: {
        topics: log.topics,
        data: log.data
      }
    };
  }

  /**
   * Decode transaction input (placeholder - would need ABI)
   * @private
   */
  _decodeTransactionInput(input, abi) {
    // This would require ABI decoding logic
    // For now, return basic structure
    if (!input || input === '0x') return null;
    
    return {
      methodId: input.slice(0, 10),
      raw: input
    };
  }

  /**
   * Get current block number for a chain
   * @param {string} chainName - Chain name
   * @returns {Promise<number>} Current block number
   */
  async getCurrentBlockNumber(chainName) {
    const chain = chainName.toLowerCase();
    
    return await this._executeWithFailover(
      chain,
      async (client) => {
        return await client.getBlockNumber();
      },
      'getCurrentBlockNumber'
    );
  }

  /**
   * Test all chain connections
   * @returns {Promise<Object>} Connection test results
   */
  async testAllConnections() {
    const results = {};
    
    for (const [chainName, config] of Object.entries(this.chainConfigs)) {
      results[chainName] = {
        name: config.name,
        clients: []
      };
      
      for (const clientInfo of this.clients[chainName]) {
        try {
          const startTime = Date.now();
          const blockNumber = await clientInfo.client.getBlockNumber();
          const responseTime = Date.now() - startTime;
          
          results[chainName].clients.push({
            rpcUrl: clientInfo.rpcUrl,
            status: 'healthy',
            blockNumber,
            responseTime: `${responseTime}ms`
          });
        } catch (error) {
          results[chainName].clients.push({
            rpcUrl: clientInfo.rpcUrl,
            status: 'unhealthy',
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Get indexer statistics
   * @returns {Object} Indexer statistics
   */
  getStats() {
    return {
      chains: Object.keys(this.chainConfigs),
      stats: this.stats,
      config: this.config,
      activeClients: Object.keys(this.activeClients)
    };
  }

  /**
   * Get supported chains
   * @returns {Array<string>} Supported chain names
   */
  getSupportedChains() {
    return Object.keys(this.chainConfigs);
  }
}

export default MultiChainContractIndexer;