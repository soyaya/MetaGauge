/**
 * Chunk Manager - divides and processes data in chunks
 */

import { CHUNK_SIZE } from '../models/types.js';
import { ProgressiveStorageService } from '../../services/ProgressiveStorageService.js';

export class ChunkManager {
  constructor(fetcher, validator, wsManager = null) {
    this.fetcher = fetcher;
    this.validator = validator;
    this.wsManager = wsManager;
    this.progressiveStorage = new ProgressiveStorageService();
  }

  /**
   * Process chunks for block range with progressive storage
   */
  async processChunks(chainId, contractAddress, startBlock, endBlock, onProgress, options = {}) {
    const { analysisId, contractId, userId } = options;
    const chunks = this.divideIntoChunks(startBlock, endBlock);
    const results = [];
    let cumulativeMetrics = this.initializeMetrics();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progress = ((i + 1) / chunks.length) * 100;
      
      try {
        const chunkData = await this.processChunk(
          chainId, 
          contractAddress, 
          chunk,
          { analysisId, contractId, userId, progress }
        );
        
        // Validate boundary
        if (i > 0) {
          const validation = this.validator.validateChunkBoundary(chunks[i - 1], chunk);
          chunkData.validation = validation;
        }

        // Update metrics
        cumulativeMetrics = this.updateCumulativeMetrics(cumulativeMetrics, chunkData);
        
        results.push(chunkData);
        
        if (onProgress) {
          onProgress({
            chunk: i + 1,
            total: chunks.length,
            progress: ((i + 1) / chunks.length) * 100,
            metrics: cumulativeMetrics
          });
        }
      } catch (error) {
        chunk.status = 'failed';
        chunk.error = error.message;
        results.push(chunk);
      }
    }

    return { chunks: results, metrics: cumulativeMetrics };
  }

  /**
   * Process single chunk with progressive storage
   */
  async processChunk(chainId, contractAddress, chunk, options = {}) {
    const { analysisId, contractId, userId, progress } = options;
    
    // 1. Fetch data from RPC
    const data = await this.fetcher.fetchContractData(
      chainId,
      contractAddress,
      chunk.startBlock,
      chunk.endBlock
    );

    // 2. Transform logs to transactions
    const transactions = this.transformLogsToTransactions(data.logs || []);
    
    // 3. Store transactions immediately (if analysisId provided)
    if (analysisId && contractId && transactions.length > 0) {
      await this.progressiveStorage.storeTransactions(
        analysisId,
        contractId,
        transactions
      );
    }
    
    // 4. Calculate and store metrics
    let metrics = null;
    if (analysisId) {
      metrics = await this.progressiveStorage.calculateAndStoreMetrics(
        analysisId,
        {
          ...chunk,
          transactions,
          transactionCount: transactions.length,
          endBlock: chunk.endBlock,
          progress: progress || 0
        }
      );
      
      // 5. Push update via WebSocket
      if (this.wsManager && userId) {
        const snapshot = await this.progressiveStorage.getMetricsSnapshot(analysisId);
        this.wsManager.emitMetrics(userId, {
          type: 'metrics_update',
          analysisId,
          metrics: snapshot,
          progress: progress || 0,
          blocksProcessed: chunk.endBlock,
          transactionsInChunk: transactions.length
        });
      }
    }

    return {
      ...chunk,
      status: 'completed',
      data,
      transactionCount: transactions.length,
      metrics,
      metrics: this.calculateChunkMetrics(data)
    };
  }

  /**
   * Divide range into chunks
   */
  divideIntoChunks(startBlock, endBlock) {
    const chunks = [];
    let current = startBlock;

    while (current <= endBlock) {
      const chunkEnd = Math.min(current + CHUNK_SIZE - 1, endBlock);
      chunks.push({
        startBlock: current,
        endBlock: chunkEnd,
        status: 'pending'
      });
      current = chunkEnd + 1;
    }

    return chunks;
  }

  /**
   * Calculate chunk metrics
   */
  calculateChunkMetrics(data) {
    return {
      logCount: data.logs?.length || 0,
      blocksCovered: data.blockRange.endBlock - data.blockRange.startBlock + 1
    };
  }

  /**
   * Initialize cumulative metrics
   */
  initializeMetrics() {
    return {
      totalLogs: 0,
      totalBlocks: 0,
      chunksProcessed: 0
    };
  }

  /**
   * Update cumulative metrics
   */
  updateCumulativeMetrics(cumulative, chunkData) {
    return {
      totalLogs: cumulative.totalLogs + (chunkData.metrics?.logCount || 0),
      totalBlocks: cumulative.totalBlocks + (chunkData.metrics?.blocksCovered || 0),
      chunksProcessed: cumulative.chunksProcessed + 1
    };
  }
  
  /**
   * Transform logs to transaction format
   */
  transformLogsToTransactions(logs) {
    return logs.map(log => ({
      blockNumber: log.blockNumber,
      hash: log.transactionHash,
      from: log.address,
      to: log.topics && log.topics[1] ? '0x' + log.topics[1].slice(26) : null,
      value: log.data || '0',
      gasUsed: 0,
      gasPrice: '0',
      status: true,
      timestamp: new Date(),
      eventName: log.topics && log.topics[0] ? log.topics[0] : null,
      eventData: log
    }));
  }
}
