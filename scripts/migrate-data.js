#!/usr/bin/env node

/**
 * Complete Data Migration Script
 * Migrates ALL data from JSON files to PostgreSQL
 * Covers: users, onboarding, preferences, contracts, competitors, RPC config, params, analyses
 */

import fs from 'fs/promises';
import path from 'path';
import { query, transaction, closePool } from '../src/api/database/postgres.js';

const DATA_DIR = './data';
const BACKUP_DIR = './data/backup';

// Migration statistics
const stats = {
  users: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  onboarding: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  preferences: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  contracts: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  competitors: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  rpcConfig: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  analysisParams: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  analyses: { total: 0, migrated: 0, skipped: 0, errors: 0 }
};

/**
 * Backup JSON files before migration
 */
async function backupData() {
  console.log('💾 Backing up JSON files...');
  
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
    await fs.mkdir(backupPath, { recursive: true });

    const files = ['users.json', 'contracts.json', 'analyses.json'];
    
    for (const file of files) {
      const sourcePath = path.join(DATA_DIR, file);
      const destPath = path.join(backupPath, file);
      
      try {
        await fs.copyFile(sourcePath, destPath);
        console.log(`   ✅ Backed up ${file}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.log(`   ⚠️  ${file} not found, skipping`);
        }
      }
    }
    
    console.log(`   ✅ Backup created: ${backupPath}\n`);
    return backupPath;
  } catch (error) {
    console.error('   ❌ Backup failed:', error.message);
    throw error;
  }
}

/**
 * Read JSON file safely
 */
async function readJsonFile(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`   ⚠️  ${filename} not found, skipping`);
      return [];
    }
    throw error;
  }
}

/**
 * Migrate users and related data
 */
async function migrateUsers(users) {
  console.log('\n👥 Migrating Users...');
  stats.users.total = users.length;

  for (const user of users) {
    try {
      // Check if user already exists
      const existing = await query('SELECT id FROM users WHERE id = $1', [user.id]);
      
      if (existing.rows.length > 0) {
        console.log(`   ⏭️  User ${user.email} already exists, skipping`);
        stats.users.skipped++;
        continue;
      }

      // Insert user
      await query(`
        INSERT INTO users (
          id, email, password, name, tier, api_key, is_active, email_verified,
          analysis_count, monthly_analysis_count, last_analysis, monthly_reset_date,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        user.id,
        user.email,
        user.password,
        user.name,
        user.tier || 'free',
        user.apiKey,
        user.isActive !== false,
        user.emailVerified || false,
        user.usage?.analysisCount || 0,
        user.usage?.monthlyAnalysisCount || 0,
        user.usage?.lastAnalysis || null,
        user.usage?.monthlyResetDate || new Date().toISOString(),
        user.createdAt || new Date().toISOString(),
        user.updatedAt || new Date().toISOString()
      ]);

      // Migrate onboarding data
      if (user.onboarding) {
        await migrateOnboarding(user.id, user.onboarding);
      }

      // Migrate preferences
      if (user.preferences) {
        await migratePreferences(user.id, user.preferences);
      }

      console.log(`   ✅ Migrated user: ${user.email}`);
      stats.users.migrated++;

    } catch (error) {
      console.error(`   ❌ Failed to migrate user ${user.email}:`, error.message);
      stats.users.errors++;
    }
  }
}

/**
 * Migrate user onboarding data
 */
async function migrateOnboarding(userId, onboarding) {
  try {
    stats.onboarding.total++;

    const defaultContract = onboarding.defaultContract || {};
    
    await query(`
      INSERT INTO user_onboarding (
        user_id, completed, website, twitter, discord, telegram, logo,
        contract_address, contract_chain, contract_abi, contract_name,
        contract_purpose, contract_category, contract_start_date,
        is_indexed, indexing_progress, last_analysis_id, last_update,
        current_step, continuous_sync, has_errors, completion_reason,
        continuous_sync_stopped, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (user_id) DO NOTHING
    `, [
      userId,
      onboarding.completed || false,
      onboarding.socialLinks?.website || null,
      onboarding.socialLinks?.twitter || null,
      onboarding.socialLinks?.discord || null,
      onboarding.socialLinks?.telegram || null,
      onboarding.logo || null,
      defaultContract.address || null,
      defaultContract.chain || null,
      defaultContract.abi || null,
      defaultContract.name || null,
      defaultContract.purpose || null,
      defaultContract.category || null,
      defaultContract.startDate || null,
      defaultContract.isIndexed || false,
      defaultContract.indexingProgress || 0,
      defaultContract.lastAnalysisId || null,
      defaultContract.lastUpdate || null,
      defaultContract.currentStep || null,
      defaultContract.continuousSync || false,
      defaultContract.hasErrors || false,
      defaultContract.completionReason || null,
      defaultContract.continuousSyncStopped || null,
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    stats.onboarding.migrated++;
  } catch (error) {
    console.error(`      ⚠️  Onboarding migration failed:`, error.message);
    stats.onboarding.errors++;
  }
}

/**
 * Migrate user preferences
 */
async function migratePreferences(userId, preferences) {
  try {
    stats.preferences.total++;

    await query(`
      INSERT INTO user_preferences (
        user_id, email_notifications, analysis_notifications,
        default_chain, custom_settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO NOTHING
    `, [
      userId,
      preferences.notifications?.email !== false,
      preferences.notifications?.analysis !== false,
      preferences.defaultChain || 'ethereum',
      JSON.stringify(preferences.custom || {}),
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    stats.preferences.migrated++;
  } catch (error) {
    console.error(`      ⚠️  Preferences migration failed:`, error.message);
    stats.preferences.errors++;
  }
}

/**
 * Migrate contracts and related data
 */
async function migrateContracts(contracts) {
  console.log('\n📄 Migrating Contracts...');
  stats.contracts.total = contracts.length;

  for (const contract of contracts) {
    try {
      // Check if contract already exists
      const existing = await query('SELECT id FROM contracts WHERE id = $1', [contract.id]);
      
      if (existing.rows.length > 0) {
        console.log(`   ⏭️  Contract ${contract.name} already exists, skipping`);
        stats.contracts.skipped++;
        continue;
      }

      // Insert contract
      await query(`
        INSERT INTO contracts (
          id, user_id, name, description, target_address, target_chain,
          target_name, target_abi, tags, is_active, is_default,
          last_analyzed, analysis_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        contract.id,
        contract.userId,
        contract.name,
        contract.description || null,
        contract.targetContract?.address || contract.target_address,
        contract.targetContract?.chain || contract.target_chain,
        contract.targetContract?.name || contract.target_name,
        contract.targetContract?.abi || contract.target_abi,
        contract.tags || [],
        contract.isActive !== false,
        contract.isDefault || false,
        contract.lastAnalyzed || null,
        contract.analysisCount || 0,
        contract.createdAt || new Date().toISOString(),
        contract.updatedAt || new Date().toISOString()
      ]);

      // Migrate competitors
      if (contract.competitors && contract.competitors.length > 0) {
        await migrateCompetitors(contract.id, contract.competitors);
      }

      // Migrate RPC config
      if (contract.rpcConfig) {
        await migrateRpcConfig(contract.id, contract.rpcConfig);
      }

      // Migrate analysis params
      if (contract.analysisParams) {
        await migrateAnalysisParams(contract.id, contract.analysisParams);
      }

      console.log(`   ✅ Migrated contract: ${contract.name}`);
      stats.contracts.migrated++;

    } catch (error) {
      console.error(`   ❌ Failed to migrate contract ${contract.name}:`, error.message);
      stats.contracts.errors++;
    }
  }
}

/**
 * Migrate contract competitors
 */
async function migrateCompetitors(contractId, competitors) {
  for (const competitor of competitors) {
    try {
      stats.competitors.total++;

      await query(`
        INSERT INTO contract_competitors (
          contract_id, address, chain, name, abi, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        contractId,
        competitor.address,
        competitor.chain,
        competitor.name || null,
        competitor.abi || null,
        new Date().toISOString()
      ]);

      stats.competitors.migrated++;
    } catch (error) {
      console.error(`      ⚠️  Competitor migration failed:`, error.message);
      stats.competitors.errors++;
    }
  }
}

/**
 * Migrate RPC configuration
 */
async function migrateRpcConfig(contractId, rpcConfig) {
  for (const [chain, urls] of Object.entries(rpcConfig)) {
    try {
      stats.rpcConfig.total++;

      if (!urls || urls.length === 0) continue;

      await query(`
        INSERT INTO contract_rpc_config (
          contract_id, chain, rpc_urls, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        contractId,
        chain,
        urls,
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      stats.rpcConfig.migrated++;
    } catch (error) {
      console.error(`      ⚠️  RPC config migration failed for ${chain}:`, error.message);
      stats.rpcConfig.errors++;
    }
  }
}

/**
 * Migrate analysis parameters
 */
async function migrateAnalysisParams(contractId, params) {
  try {
    stats.analysisParams.total++;

    await query(`
      INSERT INTO contract_analysis_params (
        contract_id, block_range, whale_threshold, max_concurrent_requests,
        failover_timeout, max_retries, output_formats, custom_params,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (contract_id) DO NOTHING
    `, [
      contractId,
      params.blockRange || 1000,
      params.whaleThreshold || 10,
      params.maxConcurrentRequests || 10,
      params.failoverTimeout || 30000,
      params.maxRetries || 2,
      params.outputFormats || ['json', 'csv', 'markdown'],
      JSON.stringify(params.custom || {}),
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    stats.analysisParams.migrated++;
  } catch (error) {
    console.error(`      ⚠️  Analysis params migration failed:`, error.message);
    stats.analysisParams.errors++;
  }
}

/**
 * Migrate analyses
 */
async function migrateAnalyses(analyses) {
  console.log('\n📊 Migrating Analyses...');
  stats.analyses.total = analyses.length;

  for (const analysis of analyses) {
    try {
      // Check if analysis already exists
      const existing = await query('SELECT id FROM analyses WHERE id = $1', [analysis.id]);
      
      if (existing.rows.length > 0) {
        console.log(`   ⏭️  Analysis ${analysis.id} already exists, skipping`);
        stats.analyses.skipped++;
        continue;
      }

      await query(`
        INSERT INTO analyses (
          id, user_id, config_id, analysis_type, status, progress,
          results, metadata, error_message, has_errors, logs,
          completed_at, created_at, updated_at, last_update, current_step
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        analysis.id,
        analysis.userId,
        analysis.configId || null,
        analysis.analysisType || 'single',
        analysis.status || 'pending',
        analysis.progress || 0,
        analysis.results ? JSON.stringify(analysis.results) : null,
        analysis.metadata ? JSON.stringify(analysis.metadata) : '{}',
        analysis.errorMessage || null,
        analysis.hasErrors || false,
        analysis.logs || [],
        analysis.completedAt || null,
        analysis.createdAt || new Date().toISOString(),
        analysis.updatedAt || new Date().toISOString(),
        analysis.lastUpdate || null,
        analysis.currentStep || null
      ]);

      stats.analyses.migrated++;

    } catch (error) {
      console.error(`   ❌ Failed to migrate analysis ${analysis.id}:`, error.message);
      stats.analyses.errors++;
    }
  }
}

/**
 * Print migration statistics
 */
function printStats() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Migration Statistics\n');

  const categories = [
    'users', 'onboarding', 'preferences', 'contracts',
    'competitors', 'rpcConfig', 'analysisParams', 'analyses'
  ];

  let totalMigrated = 0;
  let totalErrors = 0;

  for (const category of categories) {
    const s = stats[category];
    if (s.total > 0) {
      console.log(`${category.padEnd(20)} Total: ${s.total}, Migrated: ${s.migrated}, Skipped: ${s.skipped}, Errors: ${s.errors}`);
      totalMigrated += s.migrated;
      totalErrors += s.errors;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Total Migrated: ${totalMigrated}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('═'.repeat(60));
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🔄 Starting Complete Data Migration\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: Backup
    await backupData();

    // Step 2: Read JSON files
    console.log('📖 Reading JSON files...');
    const users = await readJsonFile('users.json');
    const contracts = await readJsonFile('contracts.json');
    const analyses = await readJsonFile('analyses.json');
    console.log(`   ✅ Found ${users.length} users, ${contracts.length} contracts, ${analyses.length} analyses\n`);

    // Step 3: Migrate in transaction
    await transaction(async (client) => {
      // Migrate users (includes onboarding and preferences)
      if (users.length > 0) {
        await migrateUsers(users);
      }

      // Migrate contracts (includes competitors, RPC config, params)
      if (contracts.length > 0) {
        await migrateContracts(contracts);
      }

      // Migrate analyses
      if (analyses.length > 0) {
        await migrateAnalyses(analyses);
      }
    });

    // Step 4: Print statistics
    printStats();

    console.log('\n✅ Migration complete!\n');
    console.log('📝 Next step: Update code to use PostgreSQL');
    console.log('   See PHASE_3_COMPLETE.md for details\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n💡 Your data is safe in the backup folder');
    console.error('   Check the error and try again\n');
    process.exit(1);
  } finally {
    await closePool();
  }
}

migrate();
