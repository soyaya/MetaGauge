/**
 * Test Fresh Onboarding with Subscription-Aware Indexing
 * This script simulates a fresh onboarding to test the new subscription-aware flow
 */

import { UserStorage, ContractStorage, AnalysisStorage } from './src/api/database/index.js';

async function testFreshOnboarding() {
  console.log('🧪 Testing Fresh Onboarding with Subscription-Aware Indexing\n');
  
  try {
    // Find a test user
    const users = await UserStorage.findAll();
    const testUser = users.find(u => u.email);
    
    if (!testUser) {
      console.error('❌ No test user found. Please create a user first.');
      return;
    }
    
    console.log(`👤 Test User: ${testUser.email} (ID: ${testUser.id})`);
    
    // Clear old onboarding data
    console.log('\n🗑️  Clearing old onboarding data...');
    await UserStorage.update(testUser.id, {
      onboarding: {
        completed: false,
        defaultContract: null
      }
    });
    
    // Delete old analyses
    const oldAnalyses = await AnalysisStorage.findByUserId(testUser.id);
    console.log(`   Found ${oldAnalyses.length} old analyses`);
    
    for (const analysis of oldAnalyses) {
      await AnalysisStorage.delete(analysis.id);
    }
    
    console.log('   ✅ Old data cleared');
    
    // Delete old contracts
    const oldContracts = await ContractStorage.findByUserId(testUser.id);
    console.log(`   Found ${oldContracts.length} old contracts`);
    
    for (const contract of oldContracts) {
      await ContractStorage.delete(contract.id);
    }
    
    console.log('   ✅ Old contracts cleared');
    
    console.log('\n✅ Fresh onboarding ready!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start the backend: npm run dev');
    console.log('2. Start the frontend: cd frontend && npm run dev');
    console.log('3. Log in with:', testUser.email);
    console.log('4. Complete onboarding with a contract');
    console.log('5. Watch the subscription-aware indexing happen!');
    console.log('\n🔍 What you should see:');
    console.log('   - Subscription tier displayed (Free/Starter/Pro/Enterprise)');
    console.log('   - Historical data limit (7/30/90 days or "All history")');
    console.log('   - Deployment block number');
    console.log('   - Block range indexed');
    console.log('   - Progress bar during indexing');
    console.log('   - "Fully Indexed" badge when complete');
    console.log('   - "Live Monitoring" badge for paid tiers');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

testFreshOnboarding();
