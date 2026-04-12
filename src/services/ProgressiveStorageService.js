/**
 * Progressive Storage Service
 * Stores data and calculates metrics as RPC data arrives
 */

import { query } from '../api/database/postgres.js';

export class ProgressiveStorageService {
  
  /**
   * Store transactions as they arrive
   */
  async storeTransactions(analysisId, contractId, transactions) {
    if (!transactions || transactions.length === 0) return 0;
    
    const values = [];
    const placeholders = [];
    
    transactions.forEach((tx, i) => {
      const base = i * 13;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 
         $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, 
         $${base + 11}, $${base + 12}, $${base + 13})`
      );
      
      values.push(
        analysisId,
        contractId,
        tx.blockNumber || 0,
        tx.hash || tx.transactionHash || '',
        tx.from || tx.address || '',
        tx.to || null,
        tx.value || '0',
        tx.gasUsed || 0,
        tx.gasPrice || '0',
        tx.status !== false,
        tx.timestamp || new Date(),
        tx.eventName || null,
        tx.eventData ? JSON.stringify(tx.eventData) : null
      );
    });
    
    await query(`
      INSERT INTO blockchain_transactions (
        analysis_id, contract_id, block_number, transaction_hash,
        from_address, to_address, value, gas_used, gas_price,
        status, timestamp, event_name, event_data
      ) VALUES ${placeholders.join(',')}
    `, values);
    
    return transactions.length;
  }
  
  /**
   * Calculate and store metrics for current chunk
   */
  async calculateAndStoreMetrics(analysisId, chunkData) {
    const metrics = this.calculateChunkMetrics(chunkData);
    
    // Store individual metrics
    const metricEntries = Object.entries(metrics).filter(([_, value]) => 
      typeof value === 'number' || typeof value === 'string'
    );
    
    for (const [name, value] of metricEntries) {
      await query(`
        INSERT INTO realtime_metrics (
          analysis_id, metric_name, metric_value, 
          blocks_processed, transactions_processed
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        analysisId,
        name,
        typeof value === 'string' && value.length > 20 ? null : value,
        chunkData.endBlock || 0,
        chunkData.transactionCount || 0
      ]);
    }
    
    // Update aggregated snapshot
    await this.updateMetricsSnapshot(analysisId, metrics);
    
    return metrics;
  }
  
  /**
   * Update aggregated metrics snapshot
   */
  async updateMetricsSnapshot(analysisId, newMetrics) {
    const current = await query(
      'SELECT * FROM metrics_snapshot WHERE analysis_id = $1',
      [analysisId]
    );
    
    if (current.rows.length === 0) {
      // Create new snapshot
      await query(`
        INSERT INTO metrics_snapshot (
          analysis_id, unique_users, total_transactions,
          total_value, total_gas_used, success_rate,
          avg_gas_per_tx, blocks_processed, progress_percentage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        analysisId,
        newMetrics.uniqueUsers || 0,
        newMetrics.totalTransactions || 0,
        newMetrics.totalValue || '0',
        newMetrics.totalGasUsed || '0',
        newMetrics.successRate || 0,
        newMetrics.avgGasPerTx || 0,
        newMetrics.blocksProcessed || 0,
        newMetrics.progress || 0
      ]);
    } else {
      // Update existing snapshot
      const snapshot = current.rows[0];
      
      // Get unique users from database
      const uniqueUsersResult = await query(`
        SELECT COUNT(DISTINCT from_address) as count 
        FROM blockchain_transactions 
        WHERE analysis_id = $1
      `, [analysisId]);
      
      const totalUniqueUsers = parseInt(uniqueUsersResult.rows[0].count);
      
      await query(`
        UPDATE metrics_snapshot SET
          unique_users = $2,
          total_transactions = $3,
          total_value = $4,
          total_gas_used = $5,
          success_rate = $6,
          avg_gas_per_tx = $7,
          blocks_processed = $8,
          progress_percentage = $9
        WHERE analysis_id = $1
      `, [
        analysisId,
        totalUniqueUsers,
        (parseInt(snapshot.total_transactions) || 0) + (newMetrics.totalTransactions || 0),
        (BigInt(snapshot.total_value || 0) + BigInt(newMetrics.totalValue || 0)).toString(),
        (BigInt(snapshot.total_gas_used || 0) + BigInt(newMetrics.totalGasUsed || 0)).toString(),
        newMetrics.successRate || snapshot.success_rate,
        newMetrics.avgGasPerTx || snapshot.avg_gas_per_tx,
        newMetrics.blocksProcessed || snapshot.blocks_processed,
        newMetrics.progress || snapshot.progress_percentage
      ]);
    }
  }
  
  /**
   * Calculate metrics for chunk
   */
  calculateChunkMetrics(chunkData) {
    const transactions = chunkData.transactions || [];
    
    const uniqueUsers = new Set(transactions.map(tx => tx.from || tx.address)).size;
    const totalValue = transactions.reduce((sum, tx) => 
      sum + BigInt(tx.value || '0'), BigInt(0)
    );
    const totalGasUsed = transactions.reduce((sum, tx) => 
      sum + BigInt(tx.gasUsed || '0'), BigInt(0)
    );
    const successfulTxs = transactions.filter(tx => tx.status !== false).length;
    
    return {
      uniqueUsers,
      totalTransactions: transactions.length,
      totalValue: totalValue.toString(),
      totalGasUsed: totalGasUsed.toString(),
      successRate: transactions.length > 0 
        ? parseFloat((successfulTxs / transactions.length * 100).toFixed(2))
        : 0,
      avgGasPerTx: transactions.length > 0 
        ? Number(totalGasUsed / BigInt(transactions.length)) 
        : 0,
      blocksProcessed: chunkData.endBlock || 0,
      progress: chunkData.progress || 0
    };
  }
  
  /**
   * Get current metrics snapshot
   */
  async getMetricsSnapshot(analysisId) {
    const result = await query(
      'SELECT * FROM metrics_snapshot WHERE analysis_id = $1',
      [analysisId]
    );
    
    if (result.rows.length === 0) return null;
    
    const snapshot = result.rows[0];
    return {
      uniqueUsers: parseInt(snapshot.unique_users) || 0,
      totalTransactions: parseInt(snapshot.total_transactions) || 0,
      totalValue: snapshot.total_value?.toString() || '0',
      totalGasUsed: snapshot.total_gas_used?.toString() || '0',
      successRate: parseFloat(snapshot.success_rate) || 0,
      avgGasPerTx: parseFloat(snapshot.avg_gas_per_tx) || 0,
      avgValuePerTx: parseFloat(snapshot.avg_value_per_tx) || 0,
      blocksProcessed: parseInt(snapshot.blocks_processed) || 0,
      progress: parseFloat(snapshot.progress_percentage) || 0,
      updatedAt: snapshot.updated_at
    };
  }
}
