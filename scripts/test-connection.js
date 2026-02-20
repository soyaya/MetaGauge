#!/usr/bin/env node

/**
 * Test PostgreSQL Connection
 * Verifies database connectivity and configuration
 */

import { testConnection, query, closePool } from '../src/api/database/postgres.js';

async function runTests() {
  console.log('🧪 Testing PostgreSQL Connection\n');
  console.log('═'.repeat(50));

  try {
    // Test 1: Basic connection
    console.log('\n📡 Test 1: Basic Connection');
    const connected = await testConnection();
    
    if (!connected) {
      throw new Error('Connection test failed');
    }

    // Test 2: Query execution
    console.log('\n📊 Test 2: Query Execution');
    const result = await query('SELECT 1 + 1 as sum, $1 as message', ['Hello PostgreSQL']);
    console.log('✅ Query successful');
    console.log('   Result:', result.rows[0]);

    // Test 3: Database info
    console.log('\n📋 Test 3: Database Information');
    const dbInfo = await query(`
      SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as host,
        inet_server_port() as port
    `);
    console.log('✅ Database info retrieved');
    console.log('   Database:', dbInfo.rows[0].database);
    console.log('   User:', dbInfo.rows[0].user);
    console.log('   Host:', dbInfo.rows[0].host || 'localhost');
    console.log('   Port:', dbInfo.rows[0].port);

    // Test 4: Check extensions
    console.log('\n🔌 Test 4: Available Extensions');
    const extensions = await query(`
      SELECT extname, extversion 
      FROM pg_extension 
      ORDER BY extname
    `);
    console.log('✅ Extensions found:', extensions.rows.length);
    extensions.rows.forEach(ext => {
      console.log(`   - ${ext.extname} (v${ext.extversion})`);
    });

    console.log('\n' + '═'.repeat(50));
    console.log('✅ All tests passed!\n');
    console.log('🚀 Ready to create schema');
    console.log('   Run: node scripts/create-schema.js\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check .env configuration');
    console.error('   2. Verify PostgreSQL is running');
    console.error('   3. Run setup script: node scripts/setup-database.js');
    process.exit(1);
  } finally {
    await closePool();
  }
}

runTests();
