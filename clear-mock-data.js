import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
const contract = user.onboarding.defaultContract;

// Reset to pending state
await AnalysisStorage.update(contract.lastAnalysisId, {
  status: 'pending',
  progress: 0,
  results: null,
  metadata: {
    isDefaultContract: true,
    subscription: {
      tier: 'Free',
      tierNumber: 0,
      historicalDays: 7,
      continuousSync: false
    },
    blockRange: {
      start: null,
      end: null,
      deployment: contract.deploymentBlock,
      total: null
    }
  }
});

await UserStorage.update(user.id, {
  onboarding: {
    ...user.onboarding,
    defaultContract: {
      ...contract,
      isIndexed: false,
      indexingProgress: 0
    }
  }
});

console.log('✅ Mock data cleared - ready for real indexing');
