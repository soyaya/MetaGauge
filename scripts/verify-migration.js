#!/usr/bin/env node

/**
 * Verify Migrated Data
 * Compares JSON files with PostgreSQL data to ensure integrity
 */

import fs from 'fs/promises';
import path from 'path';
import { query, closePool } from '../src/api/database/postgres.js';

const DATA_DIR = './data';

async function readJsonFile(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function verifyMigration() {
  console.log('🔍 Verifying Migrated Data\n');
  console.log('═'.repeat(60));

  try {
    // Read JSON files
    const jsonUsers = await readJsonFile('users.json');
    const jsonContracts = await readJsonFile('contracts.json');
    const jsonAnalyses = await readJsonFile('analyses.json');

    // Query database
    const dbUsers = await query('SELECT COUNT(*) as count FROM users');
    const dbOnboarding = await query('SELECT COUNT(*) as count FROM user_onboarding');
    const dbPreferences = await query('SELECT COUNT(*) as count FROM user_preferences');
    const dbContracts = await query('SELECT COUNT(*) as count FROM contracts');
    const dbCompetitors = await query('SELECT COUNT(*) as count FROM contract_competitors');
    const dbRpcConfig = await query('SELECT COUNT(*) as count FROM contract_rpc_config');
    const dbAnalysisParams = await query('SELECT COUNT(*) as count FROM contract_analysis_params');
    const dbAnalyses = await query('SELECT COUNT(*) as count FROM analyses');

    console.log('\n📊 Data Counts:\n');
    console.log('Users:');
    console.log(`   JSON:       ${jsonUsers.length}`);
    console.log(`   PostgreSQL: ${dbUsers.rows[0].count}`);
    console.log(`   Status:     ${jsonUsers.length === parseInt(dbUsers.rows[0].count) ? '✅ Match' : '⚠️  Mismatch'}`);

    console.log('\nOnboarding:');
    console.log(`   Expected:   ${jsonUsers.length} (1 per user)`);
    console.log(`   PostgreSQL: ${dbOnboarding.rows[0].count}`);
    console.log(`   Status:     ${jsonUsers.length === parseInt(dbOnboarding.rows[0].count) ? '✅ Match' : '⚠️  Mismatch'}`);

    console.log('\nPreferences:');
    console.log(`   Expected:   ${jsonUsers.length} (1 per user)`);
    console.log(`   PostgreSQL: ${dbPreferences.rows[0].count}`);
    console.log(`   Status:     ${jsonUsers.length === parseInt(dbPreferences.rows[0].count) ? '✅ Match' : '⚠️  Mismatch'}`);

    console.log('\nContracts:');
    console.log(`   JSON:       ${jsonContracts.length}`);
    console.log(`   PostgreSQL: ${dbContracts.rows[0].count}`);
    console.log(`   Status:     ${jsonContracts.length === parseInt(dbContracts.rows[0].count) ? '✅ Match' : '⚠️  Mismatch'}`);

    console.log('\nAnalyses:');
    console.log(`   JSON:       ${jsonAnalyses.length}`);
    console.log(`   PostgreSQL: ${dbAnalyses.rows[0].count}`);
    console.log(`   Status:     ${jsonAnalyses.length === parseInt(dbAnalyses.rows[0].count) ? '✅ Match' : '⚠️  Mismatch'}`);

    // Sample data verification
    console.log('\n🔬 Sample Data Verification:\n');

    if (jsonUsers.length > 0) {
      const sampleUser = jsonUsers[0];
      const dbUser = await query('SELECT * FROM users WHERE id = $1', [sampleUser.id]);
      
      if (dbUser.rows.length > 0) {
        console.log('✅ Sample user found in database');
        console.log(`   Email: ${dbUser.rows[0].email}`);
        console.log(`   Name: ${dbUser.rows[0].name}`);
        console.log(`   Tier: ${dbUser.rows[0].tier}`);
      } else {
        console.log('⚠️  Sample user NOT found in database');
      }
    }

    // Check relationships
    console.log('\n🔗 Relationship Verification:\n');

    const orphanedOnboarding = await query(`
      SELECT COUNT(*) as count 
      FROM user_onboarding 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);
    console.log(`Orphaned onboarding records: ${orphanedOnboarding.rows[0].count} ${orphanedOnboarding.rows[0].count === '0' ? '✅' : '⚠️'}`);

    const orphanedContracts = await query(`
      SELECT COUNT(*) as count 
      FROM contracts 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);
    console.log(`Orphaned contracts: ${orphanedContracts.rows[0].count} ${orphanedContracts.rows[0].count === '0' ? '✅' : '⚠️'}`);

    const orphanedAnalyses = await query(`
      SELECT COUNT(*) as count 
      FROM analyses 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);
    console.log(`Orphaned analyses: ${orphanedAnalyses.rows[0].count} ${orphanedAnalyses.rows[0].count === '0' ? '✅' : '⚠️'}`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Verification complete!\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

verifyMigration();
