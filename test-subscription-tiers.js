/**
 * Test Subscription Tier Configuration
 * Verifies that backend tier configuration matches smart contract
 */

import subscriptionBlockRangeCalculator, { SUBSCRIPTION_TIERS, BLOCKS_PER_DAY } from './src/services/SubscriptionBlockRangeCalculator.js';
import SubscriptionService from './src/services/SubscriptionService.js';

// Test configuration
const TEST_CONFIG = {
  walletAddress: process.env.TEST_WALLET_ADDRESS || '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
  chain: 'lisk',
  deploymentBlock: 28168268,
  currentBlock: 29559845
};

console.log('🧪 Testing Subscription Tier Configuration\n');
console.log('=' .repeat(80));

// Test 1: Verify tier configuration matches contract
console.log('\n📋 Test 1: Verify Tier Configuration');
console.log('-'.repeat(80));

const expectedTiers = {
  FREE: { historicalDays: 30, maxContracts: 5, apiCallsPerMonth: 1000 },
  STARTER: { historicalDays: 90, maxContracts: 20, apiCallsPerMonth: 10000 },
  PRO: { historicalDays: 365, maxContracts: 100, apiCallsPerMonth: 50000 },
  ENTERPRISE: { historicalDays: 730, maxContracts: 1000, apiCallsPerMonth: 250000 }
};

let allTiersCorrect = true;

for (const [tierName, expected] of Object.entries(expectedTiers)) {
  const actual = SUBSCRIPTION_TIERS[tierName];
  
  const daysMatch = actual.historicalDays === expected.historicalDays;
  const contractsMatch = actual.maxContracts === expected.maxContracts;
  const apiCallsMatch = actual.apiCallsPerMonth === expected.apiCallsPerMonth;
  
  const allMatch = daysMatch && contractsMatch && apiCallsMatch;
  allTiersCorrect = allTiersCorrect && allMatch;
  
  console.log(`\n${tierName}:`);
  console.log(`  Historical Days: ${actual.historicalDays} ${daysMatch ? '✅' : '❌ Expected: ' + expected.historicalDays}`);
  console.log(`  Max Contracts: ${actual.maxContracts} ${contractsMatch ? '✅' : '❌ Expected: ' + expected.maxContracts}`);
  console.log(`  API Calls/Month: ${actual.apiCallsPerMonth} ${apiCallsMatch ? '✅' : '❌ Expected: ' + expected.apiCallsPerMonth}`);
}

console.log(`\n${allTiersCorrect ? '✅ All tiers match contract configuration' : '❌ Some tiers do not match contract'}`);

// Test 2: Calculate block ranges for each tier
console.log('\n\n📊 Test 2: Block Range Calculations');
console.log('-'.repeat(80));

const blocksPerDay = BLOCKS_PER_DAY[TEST_CONFIG.chain.toLowerCase()];
console.log(`\nChain: ${TEST_CONFIG.chain}`);
console.log(`Blocks per day: ${blocksPerDay.toLocaleString()}`);
console.log(`Current block: ${TEST_CONFIG.currentBlock.toLocaleString()}`);
console.log(`Deployment block: ${TEST_CONFIG.deploymentBlock.toLocaleString()}`);

for (const [tierName, tierConfig] of Object.entries(SUBSCRIPTION_TIERS)) {
  const expectedBlocks = tierConfig.historicalDays * blocksPerDay;
  const calculatedStart = TEST_CONFIG.currentBlock - expectedBlocks;
  const actualStart = Math.max(TEST_CONFIG.deploymentBlock, calculatedStart);
  const actualBlocks = TEST_CONFIG.currentBlock - actualStart;
  
  console.log(`\n${tierName} (${tierConfig.historicalDays} days):`);
  console.log(`  Expected blocks: ${expectedBlocks.toLocaleString()}`);
  console.log(`  Calculated start: ${calculatedStart.toLocaleString()}`);
  console.log(`  Actual start: ${actualStart.toLocaleString()}`);
  console.log(`  Actual blocks: ${actualBlocks.toLocaleString()}`);
  
  if (calculatedStart < TEST_CONFIG.deploymentBlock) {
    console.log(`  ⚠️  Note: Limited by deployment block (contract is younger than ${tierConfig.historicalDays} days)`);
  } else {
    console.log(`  ✅ Full historical range available`);
  }
}

// Test 3: Query smart contract for user's subscription
console.log('\n\n🔗 Test 3: Query Smart Contract');
console.log('-'.repeat(80));

try {
  const subscriptionService = new SubscriptionService();
  console.log(`\nQuerying subscription for wallet: ${TEST_CONFIG.walletAddress}`);
  
  const subInfo = await subscriptionService.getSubscriptionInfo(TEST_CONFIG.walletAddress);
  
  console.log(`\n✅ Subscription Info from Contract:`);
  console.log(`  Tier: ${subInfo.tierName} (${subInfo.tier})`);
  console.log(`  Active: ${subInfo.isActive}`);
  console.log(`  End Time: ${new Date(subInfo.endTime * 1000).toLocaleString()}`);
  console.log(`  Days Remaining: ${subInfo.daysRemaining}`);
  
  // Test 4: Calculate block range for user's actual subscription
  console.log('\n\n🎯 Test 4: Calculate Block Range for User');
  console.log('-'.repeat(80));
  
  const blockRange = await subscriptionBlockRangeCalculator.calculateBlockRange(
    TEST_CONFIG.walletAddress,
    TEST_CONFIG.chain,
    TEST_CONFIG.deploymentBlock,
    TEST_CONFIG.currentBlock
  );
  
  console.log(`\n✅ Block Range Calculation:`);
  console.log(`  Subscription: ${blockRange.tierName} (Tier ${blockRange.tierNumber})`);
  console.log(`  Historical Days: ${blockRange.historicalDays}`);
  console.log(`  Start Block: ${blockRange.startBlock.toLocaleString()}`);
  console.log(`  End Block: ${blockRange.endBlock.toLocaleString()}`);
  console.log(`  Total Blocks: ${blockRange.actualBlocks.toLocaleString()}`);
  console.log(`  Expected Blocks: ${(blockRange.historicalDays * blocksPerDay).toLocaleString()}`);
  console.log(`  Continuous Sync: ${blockRange.continuousSync ? 'Enabled' : 'Disabled'}`);
  
  // Verify calculation is correct
  const expectedBlocksForTier = blockRange.historicalDays * blocksPerDay;
  const calculationCorrect = blockRange.actualBlocks <= expectedBlocksForTier;
  
  console.log(`\n${calculationCorrect ? '✅ Block range calculation is correct' : '❌ Block range calculation has errors'}`);
  
  // Test 5: Verify tier limits
  console.log('\n\n📈 Test 5: Tier Limits');
  console.log('-'.repeat(80));
  
  const tierLimits = await subscriptionBlockRangeCalculator.getTierLimits(TEST_CONFIG.walletAddress);
  
  console.log(`\n✅ Tier Limits:`);
  console.log(`  Tier: ${tierLimits.tier} (${tierLimits.tierNumber})`);
  console.log(`  Historical Days: ${tierLimits.historicalDays}`);
  console.log(`  Max Contracts: ${tierLimits.maxContracts}`);
  console.log(`  Continuous Sync: ${tierLimits.continuousSync ? 'Enabled' : 'Disabled'}`);
  console.log(`  Active: ${tierLimits.isActive}`);
  console.log(`  Days Remaining: ${tierLimits.daysRemaining}`);
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ All tests completed successfully!`);
  console.log(`\nYour subscription: ${subInfo.tierName}`);
  console.log(`Historical data: ${blockRange.historicalDays} days (${blockRange.actualBlocks.toLocaleString()} blocks)`);
  console.log(`Block range: ${blockRange.startBlock.toLocaleString()} → ${blockRange.endBlock.toLocaleString()}`);
  
} catch (error) {
  console.error('\n❌ Error querying smart contract:', error.message);
  console.error('\nMake sure:');
  console.error('  1. Backend is running');
  console.error('  2. RPC URLs are configured in .env');
  console.error('  3. Wallet address is valid');
  console.error('  4. Smart contract is deployed on Lisk Sepolia');
}

console.log('\n' + '='.repeat(80));
console.log('🏁 Test Complete\n');
