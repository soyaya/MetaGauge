import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

console.log('🔧 Fixing dashboard issues...\n');

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
const contract = user.onboarding.defaultContract;

// Fix 1: Update purpose
console.log('1️⃣ Updating purpose...');
await UserStorage.update(user.id, {
  onboarding: {
    ...user.onboarding,
    defaultContract: {
      ...contract,
      purpose: 'USDT stablecoin on Lisk network - Tether USD for decentralized finance'
    }
  }
});
console.log('   ✅ Purpose updated\n');

// Fix 2: Reset failed analysis
console.log('2️⃣ Resetting failed analysis...');
const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);

await AnalysisStorage.update(analysis.id, {
  status: 'pending',
  progress: 0,
  errorMessage: null,
  results: null
});

await UserStorage.update(user.id, {
  onboarding: {
    ...user.onboarding,
    defaultContract: {
      ...contract,
      purpose: 'USDT stablecoin on Lisk network - Tether USD for decentralized finance',
      isIndexed: false,
      indexingProgress: 0
    }
  }
});

console.log('   ✅ Analysis reset to pending\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All issues fixed!\n');
console.log('📋 Next steps:');
console.log('   1. Refresh dashboard');
console.log('   2. Purpose now shows proper description');
console.log('   3. Ready for new analysis (needs manual trigger)');
