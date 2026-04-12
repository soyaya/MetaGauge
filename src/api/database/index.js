/**
 * Database initialization and connection management
 * Supports both PostgreSQL and file-based storage
 */

import dotenv from 'dotenv';
dotenv.config();

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'file';

let UserStorage, ContractStorage, AnalysisStorage, ChatSessionStorage, ChatMessageStorage, MetricsStorage, LivePollStorage, MetricsHistoryStorage;

// Set storage based on database type
if (DATABASE_TYPE === 'postgres') {
  console.log('🔄 Loading PostgreSQL storage...');
  const pgStorage = await import('./postgresStorage.js');
  UserStorage = pgStorage.PostgresUserStorage;
  ContractStorage = pgStorage.PostgresContractStorage;
  AnalysisStorage = pgStorage.PostgresAnalysisStorage;
  ChatSessionStorage = pgStorage.PostgresChatSessionStorage;
  ChatMessageStorage = pgStorage.PostgresChatMessageStorage;
  console.log('✅ PostgreSQL storage loaded');
} else {
  const fileStorage = await import('./fileStorage.js');
  UserStorage = fileStorage.UserStorage;
  ContractStorage = fileStorage.ContractStorage;
  AnalysisStorage = fileStorage.AnalysisStorage;
  ChatSessionStorage = fileStorage.ChatSessionStorage;
  ChatMessageStorage = fileStorage.ChatMessageStorage;
  MetricsStorage = fileStorage.MetricsStorage;
  LivePollStorage = fileStorage.LivePollStorage;
  MetricsHistoryStorage = fileStorage.MetricsHistoryStorage;
  console.log('✅ Using file-based storage');
}

export { UserStorage, ContractStorage, AnalysisStorage, ChatSessionStorage, ChatMessageStorage, MetricsStorage, LivePollStorage, MetricsHistoryStorage };

export async function initializeDatabase() {
  if (DATABASE_TYPE === 'postgres') {
    try {
      const { testConnection } = await import('./postgres.js');
      const connected = await testConnection();
      if (!connected) throw new Error('PostgreSQL connection failed');
      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  } else {
    const { initializeStorage } = await import('./fileStorage.js');
    return initializeStorage();
  }
}

/**
 * Get database connection
 */
export async function getDatabase() {
  if (DATABASE_TYPE === 'postgres') {
    const { getPool } = await import('./postgres.js');
    return getPool();
  }
  return null; // File storage doesn't use connections
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (DATABASE_TYPE === 'postgres') {
    const { closePool } = await import('./postgres.js');
    await closePool();
    console.log('✅ Database closed');
  }
}

export default {
  initialize: initializeDatabase,
  getConnection: getDatabase,
  close: closeDatabase
};