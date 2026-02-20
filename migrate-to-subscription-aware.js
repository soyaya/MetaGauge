/**
 * Migration Script: Convert Old Marathon Sync Data to Subscription-Aware Format
 * This script updates existing analyses to include subscription metadata
 */

import { UserStorage, AnalysisStorage } from './src/api/database/index.js';
import subscriptionBlockRangeCalculator from './src/services/SubscriptionBlockRangeCalculator.js';
import { DeploymentBlockFinder } from './src/services/DeploymentBlockFinder.js';
import { ethers } from 'ethers';

async function migrateToSubscriptionAware() {
  console.log('🔄 Migrating to Subscription-Aware Format\n');
  console.log('This will update all existing analyses to include subscription metadata.\n');
  
  try {
    // Get all users
    const users = await UserStorage.findAll();
    console.log(`👥 Found ${users.length} users\n`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      if (!user.onboarding?.defaultContract?.address) {
        console.log(`⏭️  Skipping user ${user.email} - no default contract`);
        skippedCount++;
        continue;
      }
      
      console.log(`\n📊 Processing user: ${user.email}`);
      const contract = user.onboarding.defaultContract;
      
      // Get all analyses for this user
      const analyses = await AnalysisStorage.findByUserId(user.id);
      const defaultContractAnalyses = analyses.filter(a => 
        a.metadata?.isDefaultContract === true ||
        a.results?.target?.contract?.address?.toLowerCase() === contract.address.toLowerCase()
      );
      
      console.log(`   Found ${defaultContractAnalyses.length} default contract analyses`);
      
      if (defaultContractAnalyses.length === 0) {
        console.log(`   ⏭️  No analyses to migrate`);
        skippedCount++;
        continue;
      }
      
      // Get RPC URL for chain
      const getRpcUrl = (chain) => {
        const urls = {
          ethereum: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
          lisk: process.env.LISK_RPC_URL1 || 'https://rpc.api.lisk.com',
          starknet: process.env.STARKNET_RPC_URL1 || 'https://rpc.starknet.lava.build'
        };
        return urls[chain.toLowerCase()] || urls.lisk;
      };
      
      try {
        // Find deployment block
        console.log(`   🔍 Finding deployment block...`);
        const deploymentFinder = new DeploymentBlockFinder();
        const deploymentBlock = await deploymentFinder.findDeploymentBlock(
          contract.address,
          contract.chain
        );
        console.log(`   📍 Deployment block: ${deploymentBlock}`);
        
        // Get current block
        const provider = new ethers.JsonRpcProvider(getRpcUrl(contract.chain));
        const currentBlock = await provider.getBlockNumber();
        
        // Calculate block range based on subscription
        console.log(`   📊 Calculating subscription-aware block range...`);
        const blockRange = await subscriptionBlockRangeCalculator.calculateBlockRange(
          user.walletAddress || '0x0000000000000000000000000000000000000000',
          contract.chain,
          deploymentBlock,
          currentBlock
        );
        
        console.log(`   ✅ Subscription: ${blockRange.tierName}`);
        console.log(`   ✅ Historical data: ${blockRange.historicalDays === -1 ? 'All history' : `${blockRange.historicalDays} days`}`);
        console.log(`   ✅ Block range: ${blockRange.startBlock} → ${blockRange.endBlock}`);
        
        // Update all analyses with subscription metadata
        for (const analysis of defaultContractAnalyses) {
          // Check if already has subscription metadata
          if (analysis.metadata?.subscription) {
            console.log(`   ⏭️  Analysis ${analysis.id} already has subscription metadata`);
            continue;
          }
          
          // Add subscription metadata
          const updatedMetadata = {
            ...analysis.metadata,
            subscription: {
              tier: blockRange.tierName,
              tierNumber: blockRange.tierNumber,
              historicalDays: blockRange.historicalDays,
              continuousSync: blockRange.continuousSync
            },
            blockRange: {
              start: blockRange.startBlock,
              end: blockRange.endBlock,
              deployment: blockRange.deploymentBlock,
              total: blockRange.actualBlocks
            },
            // Remove old Marathon Sync metadata
            marathonSync: undefined,
            syncCycle: undefined,
            cycleStartTime: undefined,
            estimatedCycleDuration: undefined,
            cyclesCompleted: undefined
          };
          
          await AnalysisStorage.update(analysis.id, {
            metadata: updatedMetadata
          });
          
          console.log(`   ✅ Updated analysis ${analysis.id}`);
          migratedCount++;
        }
        
        // Update user's default contract with subscription info
        await UserStorage.update(user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...user.onboarding.defaultContract,
              deploymentBlock: blockRange.deploymentBlock,
              subscriptionTier: blockRange.tierName,
              // Remove old Marathon Sync fields
              continuousSync: blockRange.continuousSync,
              continuousSyncStarted: undefined,
              continuousSyncStopped: undefined
            }
          }
        });
        
        console.log(`   ✅ Updated user default contract`);
        
      } catch (error) {
        console.error(`   ❌ Error processing user ${user.email}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Users processed: ${users.length}`);
    console.log(`   - Analyses migrated: ${migratedCount}`);
    console.log(`   - Users skipped: ${skippedCount}`);
    console.log('\n🎉 All data has been migrated to subscription-aware format!');
    console.log('🔄 Refresh your dashboard to see the new UI.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateToSubscriptionAware()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
