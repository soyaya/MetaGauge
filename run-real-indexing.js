import { UserStorage, AnalysisStorage, ContractStorage } from './src/api/database/index.js';
import { SmartContractFetcher } from './src/services/SmartContractFetcher.js';
import { OptimizedQuickScan } from './src/services/OptimizedQuickScan.js';

async function runRealIndexing() {
  console.log('🚀 Starting real blockchain indexing...\n');
  
  const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
  const contract = user.onboarding.defaultContract;
  const analysisId = contract.lastAnalysisId;
  
  console.log('📋 Contract:', contract.address);
  console.log('⛓️  Chain:', contract.chain);
  
  // Get contract config
  const configs = await ContractStorage.findByUserId(user.id);
  const config = configs.find(c => c.isDefault);
  
  if (!config) {
    console.error('❌ No contract config found');
    return;
  }
  
  try {
    // Update to running
    await AnalysisStorage.update(analysisId, {
      status: 'running',
      progress: 5
    });
    
    await UserStorage.update(user.id, {
      onboarding: {
        ...user.onboarding,
        defaultContract: {
          ...contract,
          indexingProgress: 5
        }
      }
    });
    
    console.log('\n🔄 Initializing fetcher...');
    const fetcher = new SmartContractFetcher();
    const scanner = new OptimizedQuickScan(fetcher, {
      onProgress: async (data) => {
        console.log(`   ${data.progress}% - ${data.message}`);
        await AnalysisStorage.update(analysisId, { progress: data.progress });
        await UserStorage.update(user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              indexingProgress: data.progress
            }
          }
        });
      }
    });
    
    console.log('📊 Fetching blockchain data...\n');
    const results = await scanner.quickScan({
      targetContract: {
        address: contract.address,
        chain: contract.chain,
        name: contract.name
      },
      competitors: []
    });
    
    console.log('\n✅ Data fetched successfully!');
    console.log('   Transactions:', results.target?.transactions || 0);
    console.log('   Events:', results.target?.events?.length || 0);
    console.log('   Users:', results.target?.uniqueUsers || 0);
    
    // Get block range from results
    const blockRange = results.target?.blockRange || {};
    
    // Update analysis
    await AnalysisStorage.update(analysisId, {
      status: 'completed',
      progress: 100,
      results: { target: results.target },
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
          start: blockRange.start || null,
          end: blockRange.end || null,
          deployment: contract.deploymentBlock,
          total: blockRange.total || null
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
    
    console.log('\n✅ Indexing complete - real blockchain data loaded!');
    
  } catch (error) {
    console.error('\n❌ Indexing failed:', error.message);
    console.error(error.stack);
    
    await AnalysisStorage.update(analysisId, {
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date().toISOString()
    });
  }
}

runRealIndexing();
