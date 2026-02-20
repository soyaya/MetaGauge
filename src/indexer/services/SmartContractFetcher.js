/**
 * Smart Contract Fetcher with RPC request methods
 * Handles contract data fetching with retry logic and ABI decoding
 */

import { ethers } from 'ethers';
import { INDEXER_CONFIG } from '../config/indexer.js';

export class SmartContractFetcher {
  constructor(rpcClientPool) {
    this.rpcClientPool = rpcClientPool;
    this.providers = new Map(); // chainId -> ethers.Provider
  }

  /**
   * Get or create provider for chain
   */
  getProvider(chainId, endpoint) {
    const key = `${chainId}-${endpoint}`;
    
    if (!this.providers.has(key)) {
      const provider = new ethers.JsonRpcProvider(endpoint, undefined, {
        staticNetwork: true,
        batchMaxCount: 1
      });
      this.providers.set(key, provider);
    }
    
    return this.providers.get(key);
  }

  /**
   * Fetch contract data for block range
   */
  async fetchContractData(chainId, contractAddress, startBlock, endBlock) {
    const endpoint = this.rpcClientPool.getHealthyEndpoint(chainId);
    const provider = this.getProvider(chainId, endpoint);

    let retries = 0;
    let lastError;

    while (retries < INDEXER_CONFIG.rpcMaxRetries) {
      try {
        const startTime = Date.now();

        // Fetch logs for the block range
        const logs = await provider.getLogs({
          address: contractAddress,
          fromBlock: startBlock,
          toBlock: endBlock
        });

        const responseTime = Date.now() - startTime;
        this.rpcClientPool.markEndpointHealthy(endpoint, responseTime);

        return { logs, blockRange: { startBlock, endBlock } };
      } catch (error) {
        lastError = error;
        retries++;
        
        this.rpcClientPool.markEndpointUnhealthy(endpoint, error);

        if (retries < INDEXER_CONFIG.rpcMaxRetries) {
          const delay = this.calculateBackoff(retries);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to fetch contract data after ${retries} retries: ${lastError.message}`);
  }

  /**
   * Call contract function with ABI
   */
  async callContractFunction(chainId, contractAddress, abi, functionName, params = []) {
    const endpoint = this.rpcClientPool.getHealthyEndpoint(chainId);
    const provider = this.getProvider(chainId, endpoint);

    let retries = 0;
    let lastError;

    while (retries < INDEXER_CONFIG.rpcMaxRetries) {
      try {
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const result = await contract[functionName](...params);
        
        this.rpcClientPool.markEndpointHealthy(endpoint, 0);
        return result;
      } catch (error) {
        lastError = error;
        retries++;
        
        this.rpcClientPool.markEndpointUnhealthy(endpoint, error);

        if (retries < INDEXER_CONFIG.rpcMaxRetries) {
          const delay = this.calculateBackoff(retries);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to call contract function after ${retries} retries: ${lastError.message}`);
  }

  /**
   * Decode contract response using ABI
   */
  decodeContractResponse(abi, data, topics) {
    try {
      const iface = new ethers.Interface(abi);
      
      if (topics && topics.length > 0) {
        // Decode event log
        const eventFragment = iface.getEvent(topics[0]);
        if (eventFragment) {
          return iface.decodeEventLog(eventFragment, data, topics);
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to decode contract response:', error.message);
      return null;
    }
  }

  /**
   * Normalize chain data
   */
  normalizeChainData(chainId, rawData) {
    return {
      chainId,
      logs: rawData.logs.map(log => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        logIndex: log.logIndex,
        removed: log.removed || false
      })),
      blockRange: rawData.blockRange
    };
  }

  /**
   * Validate contract data
   */
  validateContractData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data structure' };
    }

    if (!data.logs || !Array.isArray(data.logs)) {
      return { valid: false, error: 'Missing or invalid logs array' };
    }

    if (!data.blockRange || typeof data.blockRange !== 'object') {
      return { valid: false, error: 'Missing or invalid blockRange' };
    }

    return { valid: true };
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoff(retryCount) {
    return INDEXER_CONFIG.retryDelayBase * Math.pow(2, retryCount - 1);
  }
}
