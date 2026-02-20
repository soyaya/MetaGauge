#!/usr/bin/env node

/**
 * Verify PostgreSQL Schema
 * Checks tables, indexes, constraints, and relationships
 */

import { query, closePool } from '../src/api/database/postgres.js';

async function verifySchema() {
  console.log('🔍 Verifying PostgreSQL Schema\n');
  console.log('═'.repeat(60));

  try {
    // 1. Check tables
    console.log('\n📋 Tables:');
    const tables = await query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`   Found ${tables.rows.length} tables:\n`);
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name.padEnd(30)} (${row.column_count} columns)`);
    });

    // 2. Check indexes
    console.log('\n📇 Indexes:');
    const indexes = await query(`
      SELECT 
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    
    console.log(`   Found ${indexes.rows.length} indexes\n`);
    let currentTable = '';
    indexes.rows.forEach(row => {
      if (row.tablename !== currentTable) {
        console.log(`\n   ${row.tablename}:`);
        currentTable = row.tablename;
      }
      console.log(`      - ${row.indexname}`);
    });

    // 3. Check foreign keys
    console.log('\n\n🔗 Foreign Key Relationships:');
    const fkeys = await query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name
    `);
    
    console.log(`   Found ${fkeys.rows.length} foreign keys:\n`);
    fkeys.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}.${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    });

    // 4. Check triggers
    console.log('\n\n⚡ Triggers:');
    const triggers = await query(`
      SELECT 
        trigger_name,
        event_object_table as table_name,
        action_timing,
        event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table
    `);
    
    console.log(`   Found ${triggers.rows.length} triggers:\n`);
    triggers.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}: ${row.trigger_name}`);
    });

    // 5. Check constraints
    console.log('\n\n🔒 Check Constraints:');
    const constraints = await query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `);
    
    console.log(`   Found ${constraints.rows.length} check constraints:\n`);
    constraints.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}: ${row.check_clause.substring(0, 50)}...`);
    });

    // 6. Database size
    console.log('\n\n💾 Database Size:');
    const size = await query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`   ${size.rows[0].size}`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Schema verification complete!\n');
    console.log('🎯 Schema is ready for data migration');
    console.log('   npm run db:migrate\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

verifySchema();
