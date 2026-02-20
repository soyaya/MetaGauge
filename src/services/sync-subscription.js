/**
 * Sync user subscription from smart contract
 * This should be called when:
 * 1. User connects wallet
 * 2. User starts analysis
 * 3. Dashboard loads
 */

import { UserStorage, AnalysisStorage } from '../api/database/index.js';
import subscriptionService from './SubscriptionService.js';

async function syncSubscriptionFromBlockchain(userId, walletAddress) {
  console.log(`🔄 Syncing subscription for wallet: ${walletAddress}\n`);
  
  try {
    // Get subscription from smart contract
    const subInfo = await subscriptionService.getSubscriptionInfo(walletAddress);
    
    console.log('📋 Smart Contract Data:');
    console.log('   Tier Number:', subInfo.tier);
    console.log('   Tier Name:', subInfo.tierName);
    console.log('   Active:', subInfo.isActive);
    console.log('   Days Remaining:', subInfo.daysRemaining);
    console.log('   Billing Cycle:', subInfo.billingCycleName);
    console.log('   Start Time:', subInfo.startTime);
    console.log('   End Time:', subInfo.endTime);
    
    // Get plan details
    const planInfo = await subscriptionService.getPlanInfo(subInfo.tier);
    console.log('\n📦 Plan Features:');
    console.log('   Historical Data:', planInfo.limits.historicalData, 'days');
    console.log('   Max Projects:', planInfo.features.maxProjects);
    console.log('   Max Alerts:', planInfo.features.maxAlerts);
    
    // Update user in database
    const user = await UserStorage.findById(userId);
    
    // Only update tier if subscription is active AND has a valid paid tier
    const updateData = {
      walletAddress: walletAddress,
      subscription: {
        tier: subInfo.tier,
        tierName: subInfo.tierName,
        isActive: subInfo.isActive,
        endTime: subInfo.endTime,
        features: planInfo.features,
        limits: planInfo.limits,
        lastSynced: new Date().toISOString()
      }
    };
    
    // Determine user tier based on subscription status
    if (subInfo.isActive && subInfo.tier > 0) {
      // Active paid subscription
      updateData.tier = subInfo.tierName.toLowerCase();
      console.log('\n✅ Active subscription detected - Setting tier to:', updateData.tier);
    } else {
      // No active subscription or Free tier
      updateData.tier = 'free';
      console.log('\n⚠️  No active subscription - Keeping tier as: free');
      console.log('   Reason: isActive =', subInfo.isActive, ', tier =', subInfo.tier);
    }
    
    await UserStorage.update(userId, updateData);
    
    // Update onboarding contract if exists
    if (user.onboarding?.defaultContract) {
      await UserStorage.update(userId, {
        onboarding: {
          ...user.onboarding,
          defaultContract: {
            ...user.onboarding.defaultContract,
            subscriptionTier: subInfo.tierName
          }
        }
      });
    }
    
    // Update analysis metadata if exists
    if (user.onboarding?.defaultContract?.lastAnalysisId) {
      const analysis = await AnalysisStorage.findById(user.onboarding.defaultContract.lastAnalysisId);
      if (analysis) {
        await AnalysisStorage.update(analysis.id, {
          metadata: {
            ...analysis.metadata,
            subscription: {
              tier: subInfo.tierName,
              tierNumber: subInfo.tier,
              historicalDays: planInfo.limits.historicalData,
              continuousSync: subInfo.tier >= 2 // Pro and above
            }
          }
        });
      }
    }
    
    console.log('\n✅ Subscription synced successfully!');
    return {
      success: true,
      tier: subInfo.tierName,
      historicalDays: planInfo.limits.historicalData
    };
    
  } catch (error) {
    console.error('❌ Failed to sync subscription:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for use in API routes
export { syncSubscriptionFromBlockchain };

// Test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testWallet = process.argv[2];
  const testUserId = process.argv[3];
  
  if (!testWallet || !testUserId) {
    console.log('Usage: node sync-subscription.js <wallet-address> <user-id>');
    process.exit(1);
  }
  
  syncSubscriptionFromBlockchain(testUserId, testWallet);
}
