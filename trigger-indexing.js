#!/usr/bin/env node

/**
 * Manually trigger indexing for user with completed onboarding
 */

import { UserStorage } from './src/api/database/index.js';
import { initializeStreamingIndexer } from './src/indexer/index.js';

async function triggerIndexing() {
  try {
    console.log('🔍 Finding user...');
    
    // Get the user
    const users = await UserStorage.findAll();
    const user = users.find(u => u.email === 'davidlovedavid1015@gmail.com');
    
    if (!user) {
      console.error('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.email);
    console.log('📋 Contract:', user.onboarding?.defaultContract?.address);
    console.log('⛓️  Chain:', user.onboarding?.defaultContract?.chain);
    
    if (!user.onboarding?.defaultContract?.address) {
      console.error('❌ No default contract found');
      return;
    }
    
    const contract = user.onboarding.defaultContract;
    
    // Initialize streaming indexer
    console.log('\n🚀 Initializing streaming indexer...');
    const { indexerManager } = await initializeStreamingIndexer();
    
    // Start indexing
    console.log('📊 Starting indexing...');
    console.log('   User ID:', user.id);
    console.log('   Contract:', contract.address);
    console.log('   Chain:', contract.chain);
    console.log('   Tier:', user.tier);
    
    await indexerManager.startIndexing(
      user.id,
      contract.address,
      contract.chain,
      user.tier
    );
    
    console.log('\n✅ Indexing started successfully!');
    console.log('📈 Check the dashboard for real-time progress');
    console.log('🔗 http://localhost:3000/dashboard');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

triggerIndexing();
