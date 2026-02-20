/**
 * Chunk Manager - divides and processes data in chunks
 */

import { CHUNK_SIZE } from '../models/types.js';

export class ChunkManager {
  constructor(fetcher, validator) {
    this.fetcher = fetcher;
    this.validator = validator;
  }

  /**
   * Process chunks for block range
   */
  async processChunks(chainId, contractAddress, startBlock, endBlock, onProgress) {
    const chunks = this.divideIntoChunks(startBlock, endBlock);
    const results = [];
    let cumulativeMetrics = this.initializeMetrics();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const chunkData = await this.processChunk(chainId, contractAddress, chunk);
        
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
   * Process single chunk
   */
  async processChunk(chainId, contractAddress, chunk) {
    const data = await this.fetcher.fetchContractData(
      chainId,
      contractAddress,
      chunk.startBlock,
      chunk.endBlock
    );

    return {
      ...chunk,
      status: 'completed',
      data,
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
}
