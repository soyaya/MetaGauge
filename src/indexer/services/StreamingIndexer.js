/**
 * Streaming Indexer - main indexer with lifecycle management
 */

import { SUBSCRIPTION_TIERS, POLLING_INTERVAL } from '../models/types.js';
import { calculateBlocksForDays } from '../config/chains.js';

export class StreamingIndexer {
  constructor(userId, contractAddress, chainId, components) {
    this.userId = userId;
    this.contractAddress = contractAddress;
    this.chainId = chainId;
    this.status = 'pending';
    this.components = components; // { storage, rpcPool, fetcher, deploymentFinder, chunkManager }
    this.pollingInterval = null;
  }

  /**
   * Initialize indexer
   */
  async initialize(subscriptionTier) {
    this.subscriptionTier = subscriptionTier;
    
    // Find deployment block
    this.deploymentBlock = await this.components.deploymentFinder.findDeploymentBlock(
      this.chainId,
      this.contractAddress
    );

    // Determine start block based on subscription
    this.startBlock = this.determineStartBlock(subscriptionTier);
    this.status = 'initialized';
  }

  /**
   * Start indexing
   */
  async start() {
    this.status = 'running';
    
    // Process historical data
    await this.processHistoricalData();
    
    // Start continuous polling
    this.startContinuousPolling();
  }

  /**
   * Stop indexing
   */
  stop() {
    this.status = 'stopped';
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Pause indexing
   */
  pause() {
    this.status = 'paused';
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Resume indexing
   */
  resume() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.startContinuousPolling();
    }
  }

  /**
   * Get progress
   */
  getProgress() {
    if (!this.currentBlock || !this.targetBlock) return 0;
    return ((this.currentBlock - this.startBlock) / (this.targetBlock - this.startBlock)) * 100;
  }

  /**
   * Determine start block based on subscription tier
   */
  determineStartBlock(tier) {
    const tierConfig = SUBSCRIPTION_TIERS[tier.toUpperCase()];
    if (!tierConfig) return this.deploymentBlock;

    const blocksBack = calculateBlocksForDays(this.chainId, tierConfig.historicalDays);
    const calculatedStart = this.currentBlock - blocksBack;

    return Math.max(calculatedStart, this.deploymentBlock);
  }

  /**
   * Process historical data
   */
  async processHistoricalData() {
    const endpoint = this.components.rpcPool.getHealthyEndpoint(this.chainId);
    const provider = this.components.fetcher.getProvider(this.chainId, endpoint);
    
    this.currentBlock = await provider.getBlockNumber();
    this.targetBlock = this.currentBlock;

    const result = await this.components.chunkManager.processChunks(
      this.chainId,
      this.contractAddress,
      this.startBlock,
      this.targetBlock,
      (progress) => this.onProgress(progress)
    );

    this.historicalData = result;
  }

  /**
   * Start continuous polling
   */
  startContinuousPolling() {
    this.pollingInterval = setInterval(async () => {
      await this.handleNewBlock();
    }, POLLING_INTERVAL);
  }

  /**
   * Handle new block
   */
  async handleNewBlock() {
    try {
      const endpoint = this.components.rpcPool.getHealthyEndpoint(this.chainId);
      const provider = this.components.fetcher.getProvider(this.chainId, endpoint);
      const latestBlock = await provider.getBlockNumber();

      if (latestBlock > this.currentBlock) {
        // Process new blocks
        await this.components.chunkManager.processChunk(
          this.chainId,
          this.contractAddress,
          { startBlock: this.currentBlock + 1, endBlock: latestBlock }
        );
        this.currentBlock = latestBlock;
      }
    } catch (error) {
      console.error('Error handling new block:', error);
    }
  }

  /**
   * Progress callback
   */
  onProgress(progress) {
    // Emit via WebSocket if available
    if (this.components.wsManager) {
      this.components.wsManager.emitProgress(this.userId, {
        chunk: progress.chunk,
        total: progress.total,
        progress: progress.progress,
        currentBlock: this.currentBlock,
        targetBlock: this.targetBlock,
        metrics: progress.metrics
      });
    }
  }
}
