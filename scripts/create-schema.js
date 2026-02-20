#!/usr/bin/env node

/**
 * PostgreSQL Schema Creation Script
 * Creates all 10 tables with indexes, constraints, and triggers
 */

import { query, transaction, testConnection, closePool } from '../src/api/database/postgres.js';

const schema = {
  // 1. Users table
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'enterprise')),
      api_key VARCHAR(255) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      email_verified BOOLEAN DEFAULT false,
      analysis_count INTEGER DEFAULT 0,
      monthly_analysis_count INTEGER DEFAULT 0,
      last_analysis TIMESTAMP,
      monthly_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
    CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
  `,

  // 2. User Onboarding table
  user_onboarding: `
    CREATE TABLE IF NOT EXISTS user_onboarding (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      completed BOOLEAN DEFAULT false,
      website VARCHAR(500),
      twitter VARCHAR(255),
      discord VARCHAR(255),
      telegram VARCHAR(255),
      logo TEXT,
      contract_address VARCHAR(255),
      contract_chain VARCHAR(50),
      contract_abi TEXT,
      contract_name VARCHAR(255),
      contract_purpose TEXT,
      contract_category VARCHAR(100),
      contract_start_date DATE,
      is_indexed BOOLEAN DEFAULT false,
      indexing_progress INTEGER DEFAULT 0,
      last_analysis_id UUID,
      last_update TIMESTAMP,
      current_step VARCHAR(255),
      continuous_sync BOOLEAN DEFAULT false,
      has_errors BOOLEAN DEFAULT false,
      completion_reason VARCHAR(255),
      continuous_sync_stopped TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_onboarding_user ON user_onboarding(user_id);
    CREATE INDEX IF NOT EXISTS idx_onboarding_contract ON user_onboarding(contract_address, contract_chain);
  `,

  // 3. User Preferences table
  user_preferences: `
    CREATE TABLE IF NOT EXISTS user_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      email_notifications BOOLEAN DEFAULT true,
      analysis_notifications BOOLEAN DEFAULT true,
      default_chain VARCHAR(50) DEFAULT 'ethereum',
      custom_settings JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);
  `,

  // 4. Contracts table
  contracts: `
    CREATE TABLE IF NOT EXISTS contracts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      target_address VARCHAR(255) NOT NULL,
      target_chain VARCHAR(50) NOT NULL,
      target_name VARCHAR(255),
      target_abi TEXT,
      tags TEXT[],
      is_active BOOLEAN DEFAULT true,
      is_default BOOLEAN DEFAULT false,
      last_analyzed TIMESTAMP,
      analysis_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_address ON contracts(target_address, target_chain);
    CREATE INDEX IF NOT EXISTS idx_contracts_active ON contracts(is_active);
    CREATE INDEX IF NOT EXISTS idx_contracts_default ON contracts(user_id, is_default);
  `,

  // 5. Contract Competitors table
  contract_competitors: `
    CREATE TABLE IF NOT EXISTS contract_competitors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
      address VARCHAR(255) NOT NULL,
      chain VARCHAR(50) NOT NULL,
      name VARCHAR(255),
      abi TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_competitors_contract ON contract_competitors(contract_id);
    CREATE INDEX IF NOT EXISTS idx_competitors_address ON contract_competitors(address, chain);
  `,

  // 6. Contract RPC Config table
  contract_rpc_config: `
    CREATE TABLE IF NOT EXISTS contract_rpc_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
      chain VARCHAR(50) NOT NULL,
      rpc_urls TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_rpc_contract ON contract_rpc_config(contract_id);
    CREATE INDEX IF NOT EXISTS idx_rpc_chain ON contract_rpc_config(chain);
  `,

  // 7. Contract Analysis Params table
  contract_analysis_params: `
    CREATE TABLE IF NOT EXISTS contract_analysis_params (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
      block_range INTEGER DEFAULT 1000,
      whale_threshold DECIMAL(20, 8) DEFAULT 10,
      max_concurrent_requests INTEGER DEFAULT 10,
      failover_timeout INTEGER DEFAULT 30000,
      max_retries INTEGER DEFAULT 2,
      output_formats TEXT[] DEFAULT ARRAY['json', 'csv', 'markdown'],
      custom_params JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contract_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_params_contract ON contract_analysis_params(contract_id);
  `,

  // 8. Analyses table
  analyses: `
    CREATE TABLE IF NOT EXISTS analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      config_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
      analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('single', 'quick_scan', 'competitive', 'comparative')),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
      progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      results JSONB,
      metadata JSONB DEFAULT '{}',
      error_message TEXT,
      has_errors BOOLEAN DEFAULT false,
      logs TEXT[] DEFAULT ARRAY[]::TEXT[],
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_update TIMESTAMP,
      current_step VARCHAR(255)
    );
    
    CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_config ON analyses(config_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
    CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(analysis_type);
    CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
  `,

  // 9. Chat Sessions table
  chat_sessions: `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(500) DEFAULT 'New Chat',
      contract_address VARCHAR(255),
      contract_chain VARCHAR(50),
      contract_name VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      message_count INTEGER DEFAULT 0,
      last_message_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_contract ON chat_sessions(contract_address, contract_chain);
    CREATE INDEX IF NOT EXISTS idx_sessions_active ON chat_sessions(is_active);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC);
  `,

  // 10. Chat Messages table
  chat_messages: `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      components JSONB,
      tokens_used INTEGER,
      model VARCHAR(100),
      processing_time INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(created_at DESC);
  `
};

// Trigger function for updated_at
const updatedAtTrigger = `
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';
`;

// Apply triggers to tables with updated_at
const triggers = [
  'users',
  'user_onboarding',
  'user_preferences',
  'contracts',
  'contract_rpc_config',
  'contract_analysis_params',
  'analyses',
  'chat_sessions'
];

async function createSchema() {
  console.log('🗄️  Creating PostgreSQL Schema\n');
  console.log('═'.repeat(60));

  try {
    // Test connection first
    console.log('\n📡 Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    console.log('\n📋 Creating tables...\n');

    // Create tables in order (respecting foreign keys)
    const tableOrder = [
      'users',
      'user_onboarding',
      'user_preferences',
      'contracts',
      'contract_competitors',
      'contract_rpc_config',
      'contract_analysis_params',
      'analyses',
      'chat_sessions',
      'chat_messages'
    ];

    for (const tableName of tableOrder) {
      console.log(`   Creating table: ${tableName}`);
      await query(schema[tableName]);
      console.log(`   ✅ ${tableName} created`);
    }

    // Create updated_at trigger function
    console.log('\n🔧 Creating trigger function...');
    await query(updatedAtTrigger);
    console.log('   ✅ Trigger function created');

    // Apply triggers
    console.log('\n⚡ Applying triggers...\n');
    for (const tableName of triggers) {
      const triggerSQL = `
        DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName};
        CREATE TRIGGER update_${tableName}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `;
      await query(triggerSQL);
      console.log(`   ✅ Trigger applied to ${tableName}`);
    }

    // Verify schema
    console.log('\n📊 Verifying schema...\n');
    const tableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log(`   ✅ Found ${tableCheck.rows.length} tables:`);
    tableCheck.rows.forEach(row => {
      console.log(`      - ${row.table_name}`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Schema creation complete!\n');
    console.log('📝 Next step: Migrate data from JSON files');
    console.log('   npm run db:migrate\n');

  } catch (error) {
    console.error('\n❌ Schema creation failed:', error.message);
    console.error('\n💡 Error details:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

createSchema();
