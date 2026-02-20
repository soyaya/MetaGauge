/**
 * Test script to verify new onboarding properly replaces old contract
 */

import { UserStorage, ContractStorage, AnalysisStorage } from './src/api/database/index.js';

async function testNewOnboardingFix() {
  console.log('🧪 Testing new onboarding fix...\n');

  try {
    // Get all users
    const users = await UserStorage.findAll();
    
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    const user = users[0];
    console.log(`👤 Testing with user: ${user.email} (${user.id})\n`);

    // Check default contract
    console.log('📋 Default Contract:');
    if (user.onboarding?.defaultContract) {
      console.log(`   Address: ${user.onboarding.defaultContract.address}`);
      console.log(`   Name: ${user.onboarding.defaultContract.name}`);
      console.log(`   Chain: ${user.onboarding.defaultContract.chain}`);
      console.log(`   Last Analysis ID: ${user.onboarding.defaultContract.lastAnalysisId}`);
    } else {
      console.log('   No default contract found');
    }

    // Check all contract configs
    console.log('\n📋 All Contract Configs:');
    const allContracts = await ContractStorage.findByUserId(user.id);
    allContracts.forEach((contract, index) => {
      console.log(`   ${index + 1}. ${contract.name}`);
      console.log(`      ID: ${contract.id}`);
      console.log(`      Address: ${contract.targetContract.address}`);
      console.log(`      isDefault: ${contract.isDefault}`);
      console.log(`      isActive: ${contract.isActive}`);
    });

    // Check all analyses
    console.log('\n📊 All Analyses:');
    const allAnalyses = await AnalysisStorage.findByUserId(user.id);
    allAnalyses.forEach((analysis, index) => {
      console.log(`   ${index + 1}. Analysis ${analysis.id}`);
      console.log(`      Status: ${analysis.status}`);
      console.log(`      isDefaultContract: ${analysis.metadata?.isDefaultContract}`);
      console.log(`      Has subscription: ${!!analysis.metadata?.subscription}`);
      console.log(`      Has blockRange: ${!!analysis.metadata?.blockRange}`);
      if (analysis.metadata?.subscription) {
        console.log(`      Subscription tier: ${analysis.metadata.subscription.tier}`);
      }
      if (analysis.metadata?.replacedByNewDefault) {
        console.log(`      ⚠️  Replaced by new default at: ${analysis.metadata.replacedAt}`);
      }
    });

    // Check for issues
    console.log('\n🔍 Issue Detection:');
    const defaultContracts = allContracts.filter(c => c.isDefault);
    if (defaultContracts.length > 1) {
      console.log(`   ❌ Multiple default contracts found: ${defaultContracts.length}`);
    } else if (defaultContracts.length === 1) {
      console.log(`   ✅ Single default contract: ${defaultContracts[0].name}`);
    } else {
      console.log(`   ⚠️  No default contract found`);
    }

    const defaultAnalyses = allAnalyses.filter(a => a.metadata?.isDefaultContract === true);
    if (defaultAnalyses.length > 1) {
      console.log(`   ❌ Multiple default analyses found: ${defaultAnalyses.length}`);
    } else if (defaultAnalyses.length === 1) {
      console.log(`   ✅ Single default analysis: ${defaultAnalyses[0].id}`);
    } else {
      console.log(`   ⚠️  No default analysis found`);
    }

    const analysesWithSubscription = allAnalyses.filter(a => a.metadata?.subscription);
    console.log(`   📊 Analyses with subscription data: ${analysesWithSubscription.length}/${allAnalyses.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

testNewOnboardingFix();
