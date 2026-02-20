/**
 * Performance Optimization Engine
 * Multi-Chain RPC Integration - Task 15
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { Pool } from 'pg';
import { errorHandler } from './ErrorHandler.js';

/**
 * Database performance optimization with connection pooling and bulk operations
 */
export class DatabaseOptimizer {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'zcash_analytics',
      user: config.user || process.env.DB_USER || 'zcash_user',
      password: config.password || process.env.DB_PASSWORD || 'zcash_password',
      
      // Pool settings
      max: config.maxConnections || 20,
      min: config.minConnections || 5,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 10000,
      
      // Bulk operation settings
      batchSize: config.batchSize || 1000,
      maxBulkSize: config.maxBulkSize || 10000,
      
      ...config
    };
    
    this.pool = new Pool(this.config);
    this.bulkQueue = new Map();
    this.processingBulk = false;
    
    this._initializeOptimizations();
  }

  /**
   * Initialize performance optimizations
   */
  _initializeOptimizations() {
    // Create indexes for common queries
    this._createIndexes();
    
    // Start bulk processing
    setInterval(() => this._processBulkQueue(), 5000);
    
    errorHandler.info('Database optimizer initialized', {
      poolSize: this.config.max,
      batchSize: this.config.batchSize
    });
  }

  /**
   * Execute optimized query with connection pooling
   */
  async query(sql, params = []) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert with optimization
   */
  async bulkInsert(table, data, options = {}) {
    if (!Array.isArray(data) || data.length === 0) return;
    
    const { immediate = false } = options;
    
    if (immediate || data.length >= this.config.batchSize) {
      return await this._executeBulkInsert(table, data);
    }
    
    // Queue for batch processing
    if (!this.bulkQueue.has(table)) {
      this.bulkQueue.set(table, []);
    }
    
    this.bulkQueue.get(table).push(...data);
    
    // Process if queue is full
    if (this.bulkQueue.get(table).length >= this.config.batchSize) {
      await this._processBulkForTable(table);
    }
  }

  /**
   * Optimized transaction processing
   */
  async processTransactions(transactions) {
    const chunks = this._chunkArray(transactions, this.config.batchSize);
    const results = [];
    
    for (const chunk of chunks) {
      const processed = await this._processTransactionChunk(chunk);
      results.push(...processed);
    }
    
    return results;
  }

  /**
   * Optimized metrics calculation with parallel processing
   */
  async calculateMetricsParallel(contracts, timeRange) {
    const promises = contracts.map(contract => 
      this._calculateContractMetrics(contract, timeRange)
    );
    
    return await Promise.all(promises);
  }

  /**
   * Create database indexes for performance
   */
  async _createIndexes() {
    const indexes = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_contract ON transactions(contract_address)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user ON transactions(user_address)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_contract_time ON defi_metrics(contract_address, timestamp)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_behavior_address ON user_behavior(address)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patterns_type_time ON patterns(pattern_type, timestamp)'
    ];
    
    for (const indexSql of indexes) {
      try {
        await this.query(indexSql);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          errorHandler.warn('Index creation failed', { sql: indexSql, error: error.message });
        }
      }
    }
  }

  /**
   * Execute bulk insert operation
   */
  async _executeBulkInsert(table, data) {
    if (data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    const values = data.map(row => 
      columns.map(col => row[col])
    );
    
    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');
    
    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;
    
    const flatValues = values.flat();
    
    try {
      const result = await this.query(sql, flatValues);
      errorHandler.debug(`Bulk inserted ${data.length} records into ${table}`);
      return result;
    } catch (error) {
      errorHandler.error('Bulk insert failed', { table, count: data.length, error: error.message });
      throw error;
    }
  }

  /**
   * Process bulk queue for specific table
   */
  async _processBulkForTable(table) {
    const data = this.bulkQueue.get(table) || [];
    if (data.length === 0) return;
    
    this.bulkQueue.set(table, []);
    
    const chunks = this._chunkArray(data, this.config.maxBulkSize);
    
    for (const chunk of chunks) {
      await this._executeBulkInsert(table, chunk);
    }
  }

  /**
   * Process entire bulk queue
   */
  async _processBulkQueue() {
    if (this.processingBulk) return;
    
    this.processingBulk = true;
    
    try {
      for (const table of this.bulkQueue.keys()) {
        await this._processBulkForTable(table);
      }
    } finally {
      this.processingBulk = false;
    }
  }

  /**
   * Process transaction chunk with optimization
   */
  async _processTransactionChunk(transactions) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      
      for (const tx of transactions) {
        const processed = await this._processTransaction(client, tx);
        results.push(processed);
      }
      
      await client.query('COMMIT');
      return results;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process single transaction
   */
  async _processTransaction(client, transaction) {
    // Insert transaction
    const txResult = await client.query(`
      INSERT INTO transactions (hash, block_number, from_address, to_address, value, gas_used, timestamp, chain)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (hash) DO NOTHING
      RETURNING id
    `, [
      transaction.hash,
      transaction.blockNumber,
      transaction.from,
      transaction.to,
      transaction.value,
      transaction.gasUsed,
      new Date(transaction.timestamp),
      transaction.chain
    ]);
    
    return { id: txResult.rows[0]?.id, processed: true };
  }

  /**
   * Calculate metrics for single contract
   */
  async _calculateContractMetrics(contract, timeRange) {
    const sql = `
      SELECT 
        COUNT(*) as transaction_count,
        SUM(CAST(value AS NUMERIC)) as total_volume,
        AVG(CAST(value AS NUMERIC)) as avg_value,
        COUNT(DISTINCT from_address) as unique_users,
        AVG(gas_used) as avg_gas
      FROM transactions 
      WHERE contract_address = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
    `;
    
    const result = await this.query(sql, [
      contract,
      new Date(timeRange.start),
      new Date(timeRange.end)
    ]);
    
    return {
      contract,
      metrics: result.rows[0],
      calculatedAt: new Date()
    };
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      queueSize: Array.from(this.bulkQueue.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this._processBulkQueue();
    await this.pool.end();
    errorHandler.info('Database optimizer cleanup completed');
  }
}

/**
 * Memory and CPU optimization utilities
 */
export class ResourceOptimizer {
  constructor() {
    this.cache = new Map();
    this.workers = [];
    this.monitoring = false;
  }

  /**
   * Optimize memory usage
   */
  optimizeMemory() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear old cache entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > 300000) { // 5 minutes
        this.cache.delete(key);
      }
    }
    
    return process.memoryUsage();
  }

  /**
   * Process data in parallel chunks
   */
  async processParallel(data, processor, concurrency = 4) {
    const chunks = this._chunkArray(data, Math.ceil(data.length / concurrency));
    
    const promises = chunks.map(chunk => 
      Promise.resolve(processor(chunk))
    );
    
    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Memoized function execution
   */
  memoize(fn, keyGenerator) {
    return (...args) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (this.cache.has(key)) {
        return this.cache.get(key).value;
      }
      
      const result = fn(...args);
      this.cache.set(key, {
        value: result,
        timestamp: Date.now()
      });
      
      return result;
    };
  }

  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export optimizers
export const dbOptimizer = new DatabaseOptimizer();
export const resourceOptimizer = new ResourceOptimizer();
