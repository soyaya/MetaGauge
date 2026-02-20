import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

async function populateMockData() {
  console.log('🚀 Populating mock data for dashboard...\n');
  
  const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
  const contract = user.onboarding.defaultContract;
  const analysisId = contract.lastAnalysisId;
  
  const currentBlock = 28175268;
  const deploymentBlock = 28168268;
  const startBlock = deploymentBlock; // Use deployment as start for demo
  const totalBlocks = currentBlock - startBlock;
  
  console.log('📊 Setting up data:');
  console.log('   Deployment:', deploymentBlock.toLocaleString());
  console.log('   Start:', startBlock.toLocaleString());
  console.log('   End:', currentBlock.toLocaleString());
  console.log('   Total blocks:', totalBlocks.toLocaleString());
  
  // Create mock results with proper structure
  const results = {
    target: {
      contract: {
        address: contract.address,
        chain: contract.chain,
        name: contract.name
      },
      transactions: 17,
      events: [],
      metrics: {
        totalTransactions: 17,
        uniqueUsers: 11,
        tvl: 125000,
        volume: 450000,
        gasEfficiency: 85,
        avgGasUsed: 45000,
        totalGasCost: 0.15
      },
      fullReport: {
        summary: {
          totalTransactions: 17,
          uniqueUsers: 11,
          blockRange: {
            start: startBlock,
            end: currentBlock,
            total: totalBlocks
          }
        }
      }
    }
  };
  
  // Update analysis
  await AnalysisStorage.update(analysisId, {
    status: 'completed',
    progress: 100,
    results,
    metadata: {
      isDefaultContract: true,
      indexingStarted: new Date(Date.now() - 60000).toISOString(),
      subscription: {
        tier: 'Free',
        tierNumber: 0,
        historicalDays: 7,
        continuousSync: false
      },
      blockRange: {
        start: startBlock,
        end: currentBlock,
        deployment: deploymentBlock,
        total: totalBlocks
      }
    },
    completedAt: new Date().toISOString()
  });
  
  // Update user
  await UserStorage.update(user.id, {
    onboarding: {
      ...user.onboarding,
      defaultContract: {
        ...contract,
        isIndexed: true,
        indexingProgress: 100
      }
    }
  });
  
  console.log('\n✅ Mock data populated!');
  console.log('\n📊 Dashboard should now show:');
  console.log('   ✅ Subscription: Free');
  console.log('   ✅ Historical Data: 7 days');
  console.log('   ✅ Blocks Indexed:', totalBlocks.toLocaleString());
  console.log('   ✅ Block Range:', startBlock.toLocaleString(), '→', currentBlock.toLocaleString());
  console.log('   ✅ Status: Fully Indexed');
  console.log('   ✅ Transactions: 17');
  console.log('   ✅ Unique Users: 11');
}

populateMockData();
