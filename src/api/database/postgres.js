/**
 * PostgreSQL Database Connection Pool
 * Manages database connections with automatic reconnection
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration — parse DATABASE_URL manually to handle special chars in password
function buildConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const cfg = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    };
    console.log('🔍 PG config — host:', cfg.host, 'port:', cfg.port, 'user:', cfg.user, 'db:', cfg.database);
    return cfg;
  }
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'metagauge',
    user: process.env.POSTGRES_USER || 'metagauge_user',
    password: process.env.POSTGRES_PASSWORD,
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}
const config = buildConfig();

// Create connection pool
let pool = null;

/**
 * Get database pool instance
 */
export function getPool() {
  if (!pool) {
    pool = new Pool(config);
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
    
    // Log successful connection
    pool.on('connect', () => {
      console.log('✅ PostgreSQL client connected');
    });
  }
  
  return pool;
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Database connection successful');
    console.log('   Time:', result.rows[0].now);
    console.log('   Version:', result.rows[0].version.split(' ')[0], result.rows[0].version.split(' ')[1]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Execute a query with automatic error handling
 */
export async function query(text, params = []) {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1 second)
    if (duration > 1000) {
      console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    // Postgres code 22P02 = invalid_text_representation (e.g. a malformed UUID
    // in a WHERE clause, such as a route param a client passed as-is). For SELECTs
    // this means "no row could possibly match" — treat it as an empty result
    // rather than a 500, matching what nearly every findById-style caller wants.
    // Writes (INSERT/UPDATE/DELETE) still throw, since a malformed value there is a real bug.
    if (error.code === '22P02' && /^\s*(select|with)\b/i.test(text)) {
      console.warn('⚠️  Invalid input for query (treated as no match):', error.message);
      return { rows: [], rowCount: 0 };
    }
    console.error('Database query error:', error.message);
    console.error('Query:', text);
    throw error;
  }
}

/**
 * Execute a transaction
 */
export async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close all database connections
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database pool closed');
  }
}

// Export pool for direct access if needed
export { pool };

export default {
  getPool,
  testConnection,
  query,
  transaction,
  closePool
};
