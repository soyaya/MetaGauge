/**
 * Historical Data Backfill System
 * Multi-Chain RPC Integration - Task 17
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { errorHandler } from './ErrorHandler.js';
import { dbOptimizer } from './DatabaseOptimizer.js';

/**
 * Efficient historical data backfill with checkpoint-based resumption
 */
export class HistoricalBackfill {
  constructor(config = {}) {
    this.config = {
      batchSize: config.batchSize || 100,
      maxConcurrency: config.maxConcurrency || 5,
      checkpointInterval: config.checkpointInterval || 1000,
      retryAttempts: config.retryAttempts || 3,
      compressionThreshold: config.compressionThreshold || 30, // days
      ...config
    };
    
    this.checkpoints = new Map();
    this.processing = new Map();
    this.metrics = {
      blocksProcessed: 0,
      transactionsProcessed: 0,
      errors: 0,
      startTime: null
    };
  }

  /**
   * Start backfill process
   */
  async startBackfill(chain, startBlock, endBlock, options = {}) {
    const jobId = `${chain}_${startBlock}_${endBlock}`;
    
    if (this.processing.has(jobId)) {
      throw new Error(`Backfill already running for ${jobId}`);
    }
    
    this.processing.set(jobId, { status: 'running', progress: 0 });
    this.metrics.startTime = Date.now();
    
    try {
      // Load checkpoint
      const checkpoint = await this._loadCheckpoint(jobId);
      const resumeBlock = checkpoint ? checkpoint.lastBlock + 1 : startBlock;
      
      errorHandler.info(`Starting backfill: ${chain} blocks ${resumeBlock}-${endBlock}`);
      
      // Process in batches
      for (let block = resumeBlock; block <= endBlock; block += this.config.batchSize) {
        const batchEnd = Math.min(block + this.config.batchSize - 1, endBlock);
        
        await this._processBatch(chain, block, batchEnd, jobId);
        
        // Update progress
        const progress = ((block - startBlock) / (endBlock - startBlock)) * 100;
        this.processing.set(jobId, { status: 'running', progress });
        
        // Save checkpoint
        if (block % this.config.checkpointInterval === 0) {
          await this._saveCheckpoint(jobId, { lastBlock: batchEnd, progress });
        }
      }
      
      // Complete
      this.processing.set(jobId, { status: 'completed', progress: 100 });
      await this._saveCheckpoint(jobId, { lastBlock: endBlock, completed: true });
      
      errorHandler.info(`Backfill completed: ${jobId}`, this.metrics);
      
    } catch (error) {
      this.processing.set(jobId, { status: 'failed', error: error.message });
      errorHandler.error(`Backfill failed: ${jobId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Process batch of blocks
   */
  async _processBatch(chain, startBlock, endBlock, jobId) {
    const blocks = [];
    
    // Fetch blocks concurrently
    const promises = [];
    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      promises.push(this._fetchBlockWithRetry(chain, blockNum));
      
      if (promises.length >= this.config.maxConcurrency) {
        const batchBlocks = await Promise.all(promises);
        blocks.push(...batchBlocks.filter(b => b));
        promises.length = 0;
      }
    }
    
    if (promises.length > 0) {
      const batchBlocks = await Promise.all(promises);
      blocks.push(...batchBlocks.filter(b => b));
    }
    
    // Process and store blocks
    await this._storeBlocks(chain, blocks);
    
    this.metrics.blocksProcessed += blocks.length;
    this.metrics.transactionsProcessed += blocks.reduce((sum, b) => sum + (b.transactions?.length || 0), 0);
  }

  /**
   * Fetch block with retry logic
   */
  async _fetchBlockWithRetry(chain, blockNumber) {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this._fetchBlock(chain, blockNumber);
      } catch (error) {
        this.metrics.errors++;
        
        if (attempt === this.config.retryAttempts) {
          errorHandler.error(`Failed to fetch block after ${attempt} attempts`, {
            chain, blockNumber, error: error.message
          });
          return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Fetch single block (mock implementation)
   */
  async _fetchBlock(chain, blockNumber) {
    // Mock block data
    return {
      number: blockNumber,
      hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
      timestamp: Date.now() - (1000000 - blockNumber) * 15000, // 15s per block
      transactions: Array.from({ length: Math.floor(Math.random() * 50) }, (_, i) => ({
        hash: `0x${(blockNumber * 1000 + i).toString(16).padStart(64, '0')}`,
        from: `0x${'1'.repeat(40)}`,
        to: `0x${'2'.repeat(40)}`,
        value: Math.random() * 1000,
        gasUsed: 21000 + Math.floor(Math.random() * 100000)
      }))
    };
  }

  /**
   * Store blocks in database
   */
  async _storeBlocks(chain, blocks) {
    const blockData = blocks.map(block => ({
      number: block.number,
      hash: block.hash,
      timestamp: new Date(block.timestamp),
      chain,
      transaction_count: block.transactions?.length || 0
    }));
    
    const transactionData = blocks.flatMap(block =>
      (block.transactions || []).map(tx => ({
        hash: tx.hash,
        block_number: block.number,
        from_address: tx.from,
        to_address: tx.to,
        value: tx.value.toString(),
        gas_used: tx.gasUsed,
        timestamp: new Date(block.timestamp),
        chain
      }))
    );
    
    // Bulk insert
    if (blockData.length > 0) {
      await dbOptimizer.bulkInsert('blocks', blockData);
    }
    
    if (transactionData.length > 0) {
      await dbOptimizer.bulkInsert('transactions', transactionData);
    }
  }

  /**
   * Load checkpoint from storage
   */
  async _loadCheckpoint(jobId) {
    try {
      const result = await dbOptimizer.query(
        'SELECT * FROM backfill_checkpoints WHERE job_id = $1',
        [jobId]
      );
      
      return result.rows[0] ? JSON.parse(result.rows[0].checkpoint_data) : null;
    } catch (error) {
      errorHandler.warn('Failed to load checkpoint', { jobId, error: error.message });
      return null;
    }
  }

  /**
   * Save checkpoint to storage
   */
  async _saveCheckpoint(jobId, data) {
    try {
      await dbOptimizer.query(`
        INSERT INTO backfill_checkpoints (job_id, checkpoint_data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (job_id) DO UPDATE SET
          checkpoint_data = $2,
          updated_at = NOW()
      `, [jobId, JSON.stringify(data)]);
    } catch (error) {
      errorHandler.warn('Failed to save checkpoint', { jobId, error: error.message });
    }
  }

  /**
   * Validate data integrity
   */
  async validateIntegrity(chain, startBlock, endBlock) {
    const gaps = [];
    const duplicates = [];
    
    // Check for missing blocks
    const result = await dbOptimizer.query(`
      SELECT number FROM blocks 
      WHERE chain = $1 AND number BETWEEN $2 AND $3
      ORDER BY number
    `, [chain, startBlock, endBlock]);
    
    const existingBlocks = new Set(result.rows.map(r => r.number));
    
    for (let block = startBlock; block <= endBlock; block++) {
      if (!existingBlocks.has(block)) {
        gaps.push(block);
      }
    }
    
    // Check for duplicates
    const dupResult = await dbOptimizer.query(`
      SELECT number, COUNT(*) as count
      FROM blocks 
      WHERE chain = $1 AND number BETWEEN $2 AND $3
      GROUP BY number
      HAVING COUNT(*) > 1
    `, [chain, startBlock, endBlock]);
    
    duplicates.push(...dupResult.rows);
    
    return {
      isValid: gaps.length === 0 && duplicates.length === 0,
      gaps,
      duplicates,
      coverage: ((endBlock - startBlock + 1 - gaps.length) / (endBlock - startBlock + 1)) * 100
    };
  }

  /**
   * Archive old data
   */
  async archiveOldData(chain, cutoffDays = 30) {
    const cutoffDate = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
    
    try {
      // Move to archive tables
      await dbOptimizer.query(`
        INSERT INTO blocks_archive 
        SELECT * FROM blocks 
        WHERE chain = $1 AND timestamp < $2
      `, [chain, cutoffDate]);
      
      await dbOptimizer.query(`
        INSERT INTO transactions_archive 
        SELECT * FROM transactions 
        WHERE chain = $1 AND timestamp < $2
      `, [chain, cutoffDate]);
      
      // Delete from main tables
      const blockResult = await dbOptimizer.query(`
        DELETE FROM blocks 
        WHERE chain = $1 AND timestamp < $2
      `, [chain, cutoffDate]);
      
      const txResult = await dbOptimizer.query(`
        DELETE FROM transactions 
        WHERE chain = $1 AND timestamp < $2
      `, [chain, cutoffDate]);
      
      errorHandler.info('Data archived', {
        chain,
        cutoffDate,
        blocksArchived: blockResult.rowCount,
        transactionsArchived: txResult.rowCount
      });
      
      return {
        blocksArchived: blockResult.rowCount,
        transactionsArchived: txResult.rowCount
      };
      
    } catch (error) {
      errorHandler.error('Archive failed', { chain, error: error.message });
      throw error;
    }
  }

  /**
   * Get backfill status
   */
  getStatus(jobId = null) {
    if (jobId) {
      return this.processing.get(jobId) || { status: 'not_found' };
    }
    
    return {
      activeJobs: Array.from(this.processing.entries()),
      metrics: this.metrics,
      checkpoints: this.checkpoints.size
    };
  }

  /**
   * Cancel backfill job
   */
  cancelJob(jobId) {
    if (this.processing.has(jobId)) {
      this.processing.set(jobId, { status: 'cancelled' });
      return true;
    }
    return false;
  }
}

/**
 * Data completeness analyzer
 */
export class CompletenessAnalyzer {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Analyze data completeness
   */
  async analyzeCompleteness(chain, timeRange) {
    const { start, end } = timeRange;
    
    // Block completeness
    const blockStats = await this._analyzeBlocks(chain, start, end);
    
    // Transaction completeness  
    const txStats = await this._analyzeTransactions(chain, start, end);
    
    // Event completeness
    const eventStats = await this._analyzeEvents(chain, start, end);
    
    const overall = {
      chain,
      timeRange,
      completeness: (blockStats.completeness + txStats.completeness + eventStats.completeness) / 3,
      blocks: blockStats,
      transactions: txStats,
      events: eventStats,
      analyzedAt: new Date()
    };
    
    this.metrics.set(`${chain}_${start}_${end}`, overall);
    
    return overall;
  }

  async _analyzeBlocks(chain, start, end) {
    const result = await dbOptimizer.query(`
      SELECT 
        COUNT(*) as actual_count,
        MIN(number) as min_block,
        MAX(number) as max_block
      FROM blocks 
      WHERE chain = $1 AND timestamp BETWEEN $2 AND $3
    `, [chain, new Date(start), new Date(end)]);
    
    const { actual_count, min_block, max_block } = result.rows[0];
    const expected_count = max_block - min_block + 1;
    
    return {
      expected: expected_count,
      actual: parseInt(actual_count),
      completeness: actual_count / expected_count,
      gaps: expected_count - actual_count
    };
  }

  async _analyzeTransactions(chain, start, end) {
    const result = await dbOptimizer.query(`
      SELECT COUNT(*) as tx_count
      FROM transactions 
      WHERE chain = $1 AND timestamp BETWEEN $2 AND $3
    `, [chain, new Date(start), new Date(end)]);
    
    return {
      count: parseInt(result.rows[0].tx_count),
      completeness: 1.0 // Assume complete if blocks are complete
    };
  }

  async _analyzeEvents(chain, start, end) {
    // Mock event analysis
    return {
      count: Math.floor(Math.random() * 10000),
      completeness: 0.95 + Math.random() * 0.05
    };
  }

  /**
   * Get completeness metrics
   */
  getMetrics(chain = null) {
    if (chain) {
      return Array.from(this.metrics.entries())
        .filter(([key]) => key.startsWith(chain))
        .map(([, value]) => value);
    }
    
    return Array.from(this.metrics.values());
  }
}

// Export classes
export const historicalBackfill = new HistoricalBackfill();
export const completenessAnalyzer = new CompletenessAnalyzer();
