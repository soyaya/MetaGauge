import { UserStorage, ContractStorage, AnalysisStorage } from './src/api/database/index.js';
import { SmartContractFetcher } from './src/services/SmartContractFetcher.js';

async function runAnalysis() {
  console.log('🚀 Starting new analysis...\n');
  
  const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
  const contract = user.onboarding.defaultContract;
  
  // Find contract config
  const configs = await ContractStorage.findByUserId(user.id);
  const config = configs.find(c => c.isDefault);
  
  if (!config) {
    console.error('❌ No default contract config found');
    return;
  }
  
  console.log('📋 Contract:', contract.address);
  console.log('⛓️  Chain:', contract.chain);
  console.log('📦 Config ID:', config.id);
  
  // Create new analysis
  const analysisData = {
    userId: user.id,
    configId: config.id,
    analysisType: 'single',
    status: 'running',
    progress: 0,
    results: null,
    metadata: {
      isDefaultContract: true,
      indexingStarted: new Date().toISOString(),
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
  };
  
  const analysis = await AnalysisStorage.create(analysisData);
  console.log('✅ Created analysis:', analysis.id);
  
  // Update user
  await UserStorage.update(user.id, {
    onboarding: {
      ...user.onboarding,
      defaultContract: {
        ...contract,
        lastAnalysisId: analysis.id,
        isIndexed: false,
        indexingProgress: 0
      }
    }
  });
  
  // Run analysis
  try {
    console.log('\n🔄 Fetching blockchain data...');
    
    const fetcher = new SmartContractFetcher();
    const results = await fetcher.analyzeContract({
      targetContract: {
        address: contract.address,
        chain: contract.chain,
        name: contract.name
      },
      competitors: [],
      analysisParams: {
        blockRange: 1000,
        includeEvents: true,
        includeTransactions: true
      }
    });
    
    console.log('✅ Analysis complete!');
    console.log('   Transactions:', results.target?.transactions || 0);
    console.log('   Events:', results.target?.events?.length || 0);
    
    // Update analysis with results
    await AnalysisStorage.update(analysis.id, {
      status: 'completed',
      progress: 100,
      results: { target: results.target },
      completedAt: new Date().toISOString()
    });
    
    // Update user
    await UserStorage.update(user.id, {
      onboarding: {
        ...user.onboarding,
        defaultContract: {
          ...contract,
          lastAnalysisId: analysis.id,
          isIndexed: true,
          indexingProgress: 100
        }
      }
    });
    
    console.log('\n✅ Dashboard should now show data!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    await AnalysisStorage.update(analysis.id, {
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date().toISOString()
    });
  }
}

runAnalysis();
