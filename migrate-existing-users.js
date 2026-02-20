/**
 * Migration Script: Update Existing Users to Correct Subscription Tiers
 * 
 * This script:
 * 1. Finds all users with default contracts
 * 2. Queries smart contract for their real subscription
 * 3. Deletes old analyses with wrong block ranges
 * 4. Marks users for re-indexing with correct configuration
 */

import { UserStorage, AnalysisStorage } from './src/api/database/index.js';
import SubscriptionService from './src/services/SubscriptionService.js';
import subscriptionBlockRangeCalculator from './src/services/SubscriptionBlockRangeCalculator.js';

console.log('🔄 Starting User Migration to Correct Subscription Tiers\n');
console.log('=' .repeat(80));

async function migrateUsers() {
  try {
    // Get all users
    const allUsers = await UserStorage.findAll();
    console.log(`\n📊 Found ${allUsers.length} total users`);
    
    // Filter users with default contracts
    const usersWithContracts = allUsers.filter(user => 
      user.onboarding?.completed && 
      user.onboarding?.defaultContract?.address
    );
    
    console.log(`📋 Found ${usersWithContracts.length} users with default contracts\n`);
    
    if (usersWithContracts.length === 0) {
      console.log('✅ No users to migrate');
      return;
    }
    
    const subscriptionService = new SubscriptionService();
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const user of usersWithContracts) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`👤 User: ${user.email} (${user.id})`);
      console.log(`   Contract: ${user.onboarding.defaultContract.address}`);
      console.log(`   Chain: ${user.onboarding.defaultContract.chain}`);
      
      // Check if user has wallet address
      if (!user.walletAddress) {
        console.log(`   ⚠️  No wallet address - skipping (user needs to connect wallet)`);
        skippedCount++;
        continue;
      }
      
      try {
        // Get subscription from smart contract
        console.log(`   🔍 Querying smart contract for wallet: ${user.walletAddress}`);
        const subInfo = await subscriptionService.getSubscriptionInfo(user.walletAddress);
        
        console.log(`   📊 Contract says: ${subInfo.tierName} (Tier ${subInfo.tier})`);
        console.log(`   📊 Active: ${subInfo.isActive}`);
        console.log(`   📊 Days Remaining: ${subInfo.daysRemaining}`);
        
        // Get current subscription tier from user's last analysis
        const userAnalyses = await AnalysisStorage.findByUserId(user.id);
        const defaultContractAnalyses = userAnalyses.filter(a => 
          a.metadata?.isDefaultContract === true
        );
        
        if (defaultContractAnalyses.length === 0) {
          console.log(`   ℹ️  No analyses found - user will get correct tier on next onboarding`);
          skippedCount++;
          continue;
        }
        
        const latestAnalysis = defaultContractAnalyses
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        
        const currentTier = latestAnalysis.metadata?.subscription?.tierNumber || 0;
        const currentDays = latestAnalysis.metadata?.subscription?.historicalDays || 7;
        
        console.log(`   📊 Current backend tier: Tier ${currentTier} (${currentDays} days)`);
        
        // Check if migration is needed
        const tierConfig = subscriptionBlockRangeCalculator.getTierConfig(subInfo.tier);
        const needsMigration = currentDays !== tierConfig.historicalDays;
        
        if (!needsMigration) {
          console.log(`   ✅ Already using correct tier configuration - no migration needed`);
          skippedCount++;
          continue;
        }
        
        console.log(`   🔄 Migration needed: ${currentDays} days → ${tierConfig.historicalDays} days`);
        
        // Delete old analyses with wrong block ranges
        console.log(`   🗑️  Deleting ${defaultContractAnalyses.length} old analyses...`);
        for (const analysis of defaultContractAnalyses) {
          await AnalysisStorage.delete(analysis.id);
          console.log(`      ✓ Deleted analysis ${analysis.id}`);
        }
        
        // Update user's onboarding data to trigger re-indexing
        await UserStorage.update(user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...user.onboarding.defaultContract,
              isIndexed: false,
              indexingProgress: 0,
              lastAnalysisId: null,
              subscriptionTier: subInfo.tierName,
              migrated: true,
              migratedAt: new Date().toISOString(),
              oldTier: currentTier,
              oldDays: currentDays,
              newTier: subInfo.tier,
              newDays: tierConfig.historicalDays
            }
          }
        });
        
        console.log(`   ✅ User migrated successfully`);
        console.log(`   📝 User needs to refresh dashboard to trigger re-indexing`);
        migratedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error migrating user: ${error.message}`);
        errorCount++;
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTotal users: ${usersWithContracts.length}`);
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (migratedCount > 0) {
      console.log(`\n📝 Next Steps:`);
      console.log(`   1. Migrated users should refresh their dashboard`);
      console.log(`   2. System will automatically re-index with correct tier`);
      console.log(`   3. Users will see correct historical data`);
    }
    
    if (skippedCount > 0) {
      console.log(`\n⚠️  Skipped Users:`);
      console.log(`   - Users without wallet addresses need to connect wallet`);
      console.log(`   - Users without analyses will get correct tier on next onboarding`);
      console.log(`   - Users already on correct tier don't need migration`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
  }
}

// Run migration
migrateUsers()
  .then(() => {
    console.log('\n🏁 Migration Complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
