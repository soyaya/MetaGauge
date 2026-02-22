/**
 * Parallel Block Fetcher
 * Fetches blocks in parallel batches
 */

export class ParallelBlockFetcher {
  constructor(provider, batchSize = 10) {
    this.provider = provider;
    this.batchSize = batchSize;
  }

  async fetchBlockRange(startBlock, endBlock) {
    const blocks = [];
    const promises = [];
    
    for (let i = startBlock; i <= endBlock; i += this.batchSize) {
      const batchEnd = Math.min(i + this.batchSize - 1, endBlock);
      promises.push(this.fetchBatch(i, batchEnd));
      
      // Process in chunks to avoid overwhelming RPC
      if (promises.length >= 5) {
        const results = await Promise.all(promises);
        blocks.push(...results.flat());
        promises.length = 0;
      }
    }
    
    if (promises.length > 0) {
      const results = await Promise.all(promises);
      blocks.push(...results.flat());
    }
    
    return blocks;
  }

  async fetchBatch(start, end) {
    const promises = [];
    for (let i = start; i <= end; i++) {
      promises.push(this.provider.getBlock(i));
    }
    return Promise.all(promises);
  }
}
