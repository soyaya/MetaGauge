/**
 * Streaming Indexer - Main Export
 */

export { FileStorageManager } from './services/FileStorageManager.js';
export { RPCClientPool } from './services/RPCClientPool.js';
export { SmartContractFetcher } from './services/SmartContractFetcher.js';
export { DeploymentBlockFinder } from './services/DeploymentBlockFinder.js';
export { HorizontalValidator } from './services/HorizontalValidator.js';
export { ChunkManager } from './services/ChunkManager.js';
export { StreamingIndexer } from './services/StreamingIndexer.js';
export { IndexerManager } from './services/IndexerManager.js';

export * from './config/index.js';
export * from './models/types.js';

import { FileStorageManager } from './services/FileStorageManager.js';
import { RPCClientPool } from './services/RPCClientPool.js';
import { SmartContractFetcher } from './services/SmartContractFetcher.js';
import { DeploymentBlockFinder } from './services/DeploymentBlockFinder.js';
import { HorizontalValidator } from './services/HorizontalValidator.js';
import { ChunkManager } from './services/ChunkManager.js';
import { IndexerManager } from './services/IndexerManager.js';
import { Logger } from './services/Logger.js';
import { MetricsCollector } from './services/MetricsCollector.js';
import { RetryPolicy, CircuitBreaker } from './services/ErrorHandling.js';
import { AnomalyDetector, SubscriptionLimiter } from './services/Security.js';
import { HealthMonitor } from './services/HealthMonitor.js';

/**
 * Initialize streaming indexer system
 */
export async function initializeStreamingIndexer(dataDir = './data') {
  // Create logs directory
  await import('fs/promises').then(fs => fs.mkdir('logs', { recursive: true }));

  const storage = new FileStorageManager(dataDir);
  await storage.initialize();

  const rpcPool = new RPCClientPool();
  rpcPool.startHealthChecks();

  const fetcher = new SmartContractFetcher(rpcPool);
  const deploymentFinder = new DeploymentBlockFinder(rpcPool, fetcher);
  const validator = new HorizontalValidator();
  const chunkManager = new ChunkManager(fetcher, validator);
  
  // Initialize monitoring and security
  const metricsCollector = new MetricsCollector();
  const anomalyDetector = new AnomalyDetector();
  const subscriptionLimiter = new SubscriptionLimiter();

  const components = {
    storage,
    rpcPool,
    fetcher,
    deploymentFinder,
    validator,
    chunkManager,
    metricsCollector,
    anomalyDetector,
    subscriptionLimiter
  };

  const indexerManager = new IndexerManager(components);
  components.indexerManager = indexerManager;

  // Initialize health monitor
  const healthMonitor = new HealthMonitor(components);
  healthMonitor.startMonitoring();
  components.healthMonitor = healthMonitor;

  Logger.info('Streaming indexer initialized', {
    dataDir,
    components: Object.keys(components)
  });

  return { indexerManager, components };
}
