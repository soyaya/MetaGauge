/**
 * Clean up failed analysis and reset user for fresh onboarding
 */

import { UserStorage, ContractStorage, AnalysisStorage } from './src/api/database/index.js';

async function cleanFailedAnalysis() {
  console.log('🧹 Cleaning up failed analysis...\n');

  try {
    // Get all users
    const users = await UserStorage.findAll();
    
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    const user = users[0];
    console.log(`👤 Cleaning data for user: ${user.email} (${user.id})\n`);

    // Get all analyses
    const allAnalyses = await AnalysisStorage.findByUserId(user.id);
    console.log(`📊 Found ${allAnalyses.length} analyses`);

    // Delete all analyses
    for (const analysis of allAnalyses) {
      await AnalysisStorage.delete(analysis.id);
      console.log(`   ✅ Deleted analysis ${analysis.id} (${analysis.status})`);
    }

    // Get all contracts
    const allContracts = await ContractStorage.findByUserId(user.id);
    console.log(`\n📋 Found ${allContracts.length} contracts`);

    // Delete all contracts
    for (const contract of allContracts) {
      await ContractStorage.delete(contract.id);
      console.log(`   ✅ Deleted contract ${contract.id} (${contract.name})`);
    }

    // Reset user onboarding
    await UserStorage.update(user.id, {
      onboarding: {
        completed: false,
        socialLinks: {},
        logo: null,
        defaultContract: null
      }
    });

    console.log('\n✅ User reset successfully!');
    console.log('\nNext steps:');
    console.log('1. Go to /onboarding in your browser');
    console.log('2. Submit a new contract');
    console.log('3. Wait for automatic indexing to complete');
    console.log('4. Dashboard will show clean subscription-aware data');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    console.error(error.stack);
  }
}

cleanFailedAnalysis();
