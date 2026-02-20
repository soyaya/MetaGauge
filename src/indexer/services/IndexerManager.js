/**
 * Indexer Manager - manages multiple indexer sessions
 */

import { StreamingIndexer } from './StreamingIndexer.js';

export class IndexerManager {
  constructor(components) {
    this.components = components;
    this.activeIndexers = new Map(); // userId -> StreamingIndexer
    this.isShuttingDown = false;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(timeout = 30000) {
    console.log('🛑 Starting graceful shutdown...');
    this.isShuttingDown = true;

    const shutdownPromises = [];
    
    // Stop accepting new requests (already done by setting flag)
    
    // Wait for active indexers to complete current chunks
    for (const [userId, indexer] of this.activeIndexers.entries()) {
      shutdownPromises.push(
        this.shutdownIndexer(userId, indexer, timeout)
      );
    }

    await Promise.allSettled(shutdownPromises);

    // Stop health checks
    this.components.rpcPool.stopHealthChecks();

    console.log('✅ Graceful shutdown complete');
  }

  /**
   * Shutdown single indexer
   */
  async shutdownIndexer(userId, indexer, timeout) {
    try {
      // Pause indexer
      indexer.pause();
      
      // Save state
      await this.saveIndexerState(userId, indexer);
      
      // Stop indexer
      indexer.stop();
      
      console.log(`✅ Saved state for user: ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to shutdown indexer for ${userId}:`, error.message);
    }
  }

  /**
   * Start indexing for user
   */
  async startIndexing(userId, contractAddress, chainId, subscriptionTier) {
    // Check if shutting down
    if (this.isShuttingDown) {
      throw new Error('System is shutting down, not accepting new requests');
    }

    // Check if already running
    if (this.activeIndexers.has(userId)) {
      throw new Error('Indexing already running for this user');
    }

    // Initialize chain if not already done
    this.components.rpcPool.initializeChain(chainId);

    // Try to restore from saved state
    const savedState = await this.loadIndexerState(userId);
    
    // Create and initialize indexer
    const indexer = new StreamingIndexer(userId, contractAddress, chainId, this.components);
    
    if (savedState && savedState.contractAddress === contractAddress) {
      // Restore state
      Object.assign(indexer, savedState);
      console.log(`Restored indexer state for ${userId}`);
    } else {
      await indexer.initialize(subscriptionTier);
    }
    
    // Start indexing
    await indexer.start();
    
    // Store in active sessions
    this.activeIndexers.set(userId, indexer);

    return indexer;
  }

  /**
   * Stop indexing for user
   */
  stopIndexing(userId) {
    const indexer = this.activeIndexers.get(userId);
    if (indexer) {
      indexer.stop();
      
      // Save state before removing
      this.saveIndexerState(userId, indexer);
      
      this.activeIndexers.delete(userId);
      return true;
    }
    return false;
  }

  /**
   * Save indexer state
   */
  async saveIndexerState(userId, indexer) {
    try {
      const state = {
        userId: indexer.userId,
        contractAddress: indexer.contractAddress,
        chainId: indexer.chainId,
        status: indexer.status,
        subscriptionTier: indexer.subscriptionTier,
        deploymentBlock: indexer.deploymentBlock,
        startBlock: indexer.startBlock,
        currentBlock: indexer.currentBlock,
        targetBlock: indexer.targetBlock,
        savedAt: new Date().toISOString()
      };

      await this.components.storage.writeJSON(`indexer-${userId}.json`, state);
    } catch (error) {
      console.error('Failed to save indexer state:', error);
    }
  }

  /**
   * Load indexer state
   */
  async loadIndexerState(userId) {
    try {
      return await this.components.storage.readJSON(`indexer-${userId}.json`);
    } catch (error) {
      return null;
    }
  }

  /**
   * Pause indexing
   */
  pauseIndexing(userId) {
    const indexer = this.activeIndexers.get(userId);
    if (indexer) {
      indexer.pause();
      return true;
    }
    return false;
  }

  /**
   * Resume indexing
   */
  resumeIndexing(userId) {
    const indexer = this.activeIndexers.get(userId);
    if (indexer) {
      indexer.resume();
      return true;
    }
    return false;
  }

  /**
   * Get indexing status
   */
  getIndexingStatus(userId) {
    const indexer = this.activeIndexers.get(userId);
    if (!indexer) {
      return { active: false };
    }

    return {
      active: true,
      status: indexer.status,
      progress: indexer.getProgress(),
      currentBlock: indexer.currentBlock,
      targetBlock: indexer.targetBlock
    };
  }

  /**
   * Get active indexers
   */
  getActiveIndexers() {
    return Array.from(this.activeIndexers.entries()).map(([userId, indexer]) => ({
      userId,
      status: indexer.status,
      progress: indexer.getProgress()
    }));
  }
}
