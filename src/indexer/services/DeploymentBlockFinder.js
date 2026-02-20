/**
 * Deployment Block Finder
 * Discovers contract deployment block using multiple strategies
 */

import { ethers } from 'ethers';

export class DeploymentBlockFinder {
  constructor(rpcClientPool, smartContractFetcher) {
    this.rpcClientPool = rpcClientPool;
    this.fetcher = smartContractFetcher;
    this.cache = new Map(); // contractAddress -> deploymentBlock
  }

  /**
   * Find deployment block using multiple strategies
   */
  async findDeploymentBlock(chainId, contractAddress) {
    const cacheKey = `${chainId}-${contractAddress}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Try block explorer API first (fast)
    try {
      const block = await this.tryBlockExplorerAPI(chainId, contractAddress);
      if (block) {
        this.cacheDeploymentBlock(cacheKey, block);
        return block;
      }
    } catch (error) {
      console.warn('Block explorer API failed:', error.message);
    }

    // Fallback to binary search
    const block = await this.binarySearchDeployment(chainId, contractAddress);
    this.cacheDeploymentBlock(cacheKey, block);
    return block;
  }

  /**
   * Try to get deployment block from block explorer API
   */
  async tryBlockExplorerAPI(chainId, contractAddress) {
    // This is a placeholder - implement actual API calls per chain
    return null;
  }

  /**
   * Binary search for deployment block
   */
  async binarySearchDeployment(chainId, contractAddress) {
    const endpoint = this.rpcClientPool.getHealthyEndpoint(chainId);
    const provider = this.fetcher.getProvider(chainId, endpoint);

    // Get current block
    const currentBlock = await provider.getBlockNumber();

    // Check if contract exists at current block
    const code = await provider.getCode(contractAddress, currentBlock);
    if (code === '0x') {
      throw new Error('Contract not found at current block');
    }

    // Handle recent deployments (last 100 blocks)
    if (currentBlock < 100) {
      return 0;
    }

    let left = 0;
    let right = currentBlock;
    let deploymentBlock = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      try {
        const codeAtMid = await provider.getCode(contractAddress, mid);
        
        if (codeAtMid === '0x') {
          // Contract doesn't exist at mid, search right
          left = mid + 1;
        } else {
          // Contract exists at mid, search left for earlier deployment
          deploymentBlock = mid;
          right = mid - 1;
        }
      } catch (error) {
        console.warn(`Error checking block ${mid}:`, error.message);
        // On error, try moving right
        left = mid + 1;
      }
    }

    return deploymentBlock;
  }

  /**
   * Cache deployment block
   */
  cacheDeploymentBlock(cacheKey, block) {
    this.cache.set(cacheKey, block);
  }

  /**
   * Get cached deployment block
   */
  getCachedDeploymentBlock(chainId, contractAddress) {
    const cacheKey = `${chainId}-${contractAddress}`;
    return this.cache.get(cacheKey) || null;
  }
}
