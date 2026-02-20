import { UserStorage } from './src/api/database/index.js';

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');

console.log('🔍 Checking Subscription Flow\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('👤 User Data:');
console.log('   Email:', user.email);
console.log('   Wallet:', user.walletAddress || '❌ Not connected');
console.log('   Tier (DB):', user.tier || 'free');

console.log('\n📊 Dashboard Data (from onboarding):');
const contract = user.onboarding?.defaultContract;
if (contract) {
  console.log('   Subscription Tier:', contract.subscriptionTier || 'Free');
  console.log('   Last Analysis:', contract.lastAnalysisId);
}

console.log('\n📋 Analysis Metadata:');
if (contract?.lastAnalysisId) {
  const { AnalysisStorage } = await import('./src/api/database/index.js');
  const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
  
  if (analysis?.metadata?.subscription) {
    console.log('   Tier:', analysis.metadata.subscription.tier);
    console.log('   Historical Days:', analysis.metadata.subscription.historicalDays);
    console.log('   Continuous Sync:', analysis.metadata.subscription.continuousSync);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n❌ PROBLEM IDENTIFIED:\n');
console.log('The subscription tier is set during onboarding but:');
console.log('1. Not checking wallet connection');
console.log('2. Not calling smart contract for real tier');
console.log('3. Using hardcoded "Free" tier');

console.log('\n✅ CORRECT FLOW SHOULD BE:\n');
console.log('1. User connects wallet');
console.log('2. Check wallet address in subscription smart contract');
console.log('3. Get real tier from blockchain');
console.log('4. Use that tier for indexing limits');
console.log('5. Update dashboard to show real tier');

if (!user.walletAddress) {
  console.log('\n⚠️  User has no wallet connected!');
  console.log('   Need to connect wallet first to check subscription');
}
