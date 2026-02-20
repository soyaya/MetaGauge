/**
 * Database initialization and connection management
 * Supports both PostgreSQL and file-based storage
 */

import dotenv from 'dotenv';
dotenv.config();

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'file';

// Import storage modules synchronously
import { UserStorage as FileUserStorage, ContractStorage as FileContractStorage, AnalysisStorage as FileAnalysisStorage } from './fileStorage.js';
import { ChatSessionStorage as FileChatSessionStorage, ChatMessageStorage as FileChatMessageStorage } from './chatStorage.js';

let UserStorage, ContractStorage, AnalysisStorage, ChatSessionStorage, ChatMessageStorage;

// Set storage based on database type
if (DATABASE_TYPE === 'postgres') {
  console.log('⚠️  PostgreSQL storage not yet loaded - will load on initialization');
  // These will be set during initializeDatabase()
} else {
  UserStorage = FileUserStorage;
  ContractStorage = FileContractStorage;
  AnalysisStorage = FileAnalysisStorage;
  ChatSessionStorage = FileChatSessionStorage;
  ChatMessageStorage = FileChatMessageStorage;
  console.log('✅ Using file-based storage');
}

export { UserStorage, ContractStorage, AnalysisStorage, ChatSessionStorage, ChatMessageStorage };

/**
 * Initialize database connection
 */
export async function initializeDatabase() {
  if (DATABASE_TYPE === 'postgres') {
    try {
      const { testConnection } = await import('./postgres.js');
      const connected = await testConnection();
      if (!connected) {
        throw new Error('PostgreSQL connection failed');
      }
      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  } else {
    // File storage doesn't need initialization
    return true;
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