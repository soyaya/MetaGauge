import { UserStorage, AnalysisStorage } from './src/api/database/index.js';
import { ethers } from 'ethers';

async function runIndexing() {
  console.log('🚀 Running simple indexing...\n');
  
  const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
  const contract = user.onboarding.defaultContract;
  const analysisId = contract.lastAnalysisId;
  
  console.log('📋 Contract:', contract.address);
  console.log('⛓️  Chain:', contract.chain);
  console.log('📦 Analysis ID:', analysisId);
  
  try {
    // Get provider
    const rpcUrl = process.env.LISK_RPC_URL1 || 'https://lisk.drpc.org';
    console.log('🔗 RPC:', rpcUrl);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const currentBlock = await provider.getBlockNumber();
    console.log('📊 Current block:', currentBlock);
    
    // Calculate 7 days of blocks (Lisk: ~2 sec per block)
    const blocksPerDay = Math.floor(86400 / 2);
    const blocks7Days = blocksPerDay * 7;
    const startBlock = Math.max(contract.deploymentBlock, currentBlock - blocks7Days);
    
    console.log('📊 Block range:', startBlock, '→', currentBlock);
    console.log('📊 Total blocks:', currentBlock - startBlock);
    
    // Update analysis with progress
    await AnalysisStorage.update(analysisId, {
      status: 'running',
      progress: 10,
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
          start: startBlock,
          end: currentBlock,
          deployment: contract.deploymentBlock,
          total: currentBlock - startBlock
        }
      }
    });
    
    // Update user progress
    await UserStorage.update(user.id, {
      onboarding: {
        ...user.onboarding,
        defaultContract: {
          ...contract,
          indexingProgress: 10
        }
      }
    });
    
    console.log('\n🔄 Fetching logs...');
    const logs = await provider.getLogs({
      address: contract.address,
      fromBlock: startBlock,
      toBlock: currentBlock
    });
    
    console.log('✅ Found', logs.length, 'events');
    
    // Create results
    const results = {
      target: {
        contract: {
          address: contract.address,
          chain: contract.chain,
          name: contract.name
        },
        transactions: logs.length,
        events: logs,
        metrics: {
          totalTransactions: logs.length,
          uniqueUsers: new Set(logs.map(l => l.topics[1])).size,
          blockRange: {
            start: startBlock,
            end: currentBlock,
            total: currentBlock - startBlock
          }
        }
      }
    };
    
    // Update analysis as completed
    await AnalysisStorage.update(analysisId, {
      status: 'completed',
      progress: 100,
      results,
      completedAt: new Date().toISOString()
    });
    
    // Update user as indexed
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
    
    console.log('\n✅ Indexing complete!');
    console.log('   Dashboard should now show all data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await AnalysisStorage.update(analysisId, {
      status: 'failed',
      errorMessage: error.message
    });
  }
}

runIndexing();
