/**
 * Indexer configuration management
 */

export const INDEXER_CONFIG = {
  // Chunk processing
  chunkSize: parseInt(process.env.CHUNK_SIZE) || 200000,
  maxConcurrentChunks: parseInt(process.env.MAX_CONCURRENT_CHUNKS) || 1,
  
  // Polling
  pollingInterval: parseInt(process.env.POLLING_INTERVAL) || 30000,
  
  // Retry logic
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  retryDelayBase: parseInt(process.env.RETRY_DELAY_BASE) || 1000,
  
  // RPC settings
  rpcTimeout: parseInt(process.env.RPC_TIMEOUT) || 30000,
  rpcMaxRetries: parseInt(process.env.RPC_MAX_RETRIES) || 3,
  
  // Health monitoring
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000,
  
  // Storage
  batchWriteSize: parseInt(process.env.BATCH_WRITE_SIZE) || 100,
  
  // Circuit breaker
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
  circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000
};

/**
 * Get indexer configuration
 * @returns {Object}
 */
export function getIndexerConfig() {
  return { ...INDEXER_CONFIG };
}

/**
 * Update indexer configuration
 * @param {Object} updates 
 */
export function updateIndexerConfig(updates) {
  Object.assign(INDEXER_CONFIG, updates);
}
