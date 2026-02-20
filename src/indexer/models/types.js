/**
 * Core data models for streaming indexer
 */

/**
 * @typedef {Object} ChunkState
 * @property {number} startBlock
 * @property {number} endBlock
 * @property {'pending'|'processing'|'completed'|'failed'} status
 * @property {number} progress
 * @property {Object} metrics
 * @property {string} [error]
 * @property {number} retryCount
 * @property {Date} startedAt
 * @property {Date} [completedAt]
 */

/**
 * @typedef {Object} IndexerSession
 * @property {string} userId
 * @property {string} contractAddress
 * @property {string} chainId
 * @property {'pending'|'running'|'paused'|'completed'|'failed'} status
 * @property {number} startBlock
 * @property {number} currentBlock
 * @property {number} targetBlock
 * @property {ChunkState[]} chunks
 * @property {Object} cumulativeMetrics
 * @property {Date} createdAt
 * @property {Date} [pausedAt]
 * @property {Date} [completedAt]
 */

/**
 * @typedef {Object} WebSocketMessage
 * @property {'progress'|'error'|'completion'|'metrics'} type
 * @property {string} userId
 * @property {Object} data
 * @property {Date} timestamp
 */

/**
 * @typedef {Object} SubscriptionTier
 * @property {string} name
 * @property {number} historicalDays
 * @property {boolean} continuousSync
 * @property {number} maxContracts
 */

export const SUBSCRIPTION_TIERS = {
  FREE: { 
    tier: 0,
    name: 'Free', 
    historicalDays: 7, 
    continuousSync: false, 
    maxContracts: 1 
  },
  STARTER: { 
    tier: 1,
    name: 'Starter', 
    historicalDays: 30, 
    continuousSync: true, 
    maxContracts: 3 
  },
  PRO: { 
    tier: 2,
    name: 'Pro', 
    historicalDays: 90, 
    continuousSync: true, 
    maxContracts: 10 
  },
  ENTERPRISE: { 
    tier: 3,
    name: 'Enterprise', 
    historicalDays: -1, // All history from deployment
    continuousSync: true, 
    maxContracts: -1 // Unlimited
  }
};

export const BLOCKS_PER_DAY = {
  ethereum: 7200,  // ~12 second blocks
  lisk: 7200,      // ~12 second blocks
  starknet: 14400  // ~6 second blocks
};

export const CHUNK_SIZE = 200000; // 200k blocks per chunk
export const POLLING_INTERVAL = 30000; // 30 seconds
export const MAX_RETRIES = 3;
export const RETRY_DELAY_BASE = 1000; // 1 second base for exponential backoff
