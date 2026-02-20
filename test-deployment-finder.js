/**
 * Test script for Deployment Block Finder
 */

import { DeploymentBlockFinder } from './src/services/DeploymentBlockFinder.js';
import { LiskRpcClient } from './src/services/LiskRpcClient.js';

async function testDeploymentFinder() {
  console.log('🧪 Testing Deployment Block Finder\n');
  
  // Your contract address
  const contractAddress = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
  
  // Initialize RPC client
  const rpcUrl = process.env.LISK_RPC_URL1 || 'https://rpc.api.lisk.com';
  console.log(`🔗 Using RPC: ${rpcUrl}\n`);
  
  const rpcClient = new LiskRpcClient(rpcUrl);
  const finder = new DeploymentBlockFinder(rpcClient);
  
  try {
    // Get current block
    console.log('📊 Getting current block number...');
    const currentBlock = await rpcClient.getCurrentBlockNumber();
    console.log(`✅ Current block: ${currentBlock.toLocaleString()}\n`);
    
    // Find deployment block (limited to last 1 month)
    console.log('🔍 Finding deployment block...\n');
    const deploymentBlock = await finder.findDeploymentBlockWithLimit(
      contractAddress,
      currentBlock,
      1 // Look back 1 month
    );
    
    console.log('\n📋 Results:');
    console.log(`  Contract: ${contractAddress}`);
    console.log(`  Deployment Block: ${deploymentBlock.toLocaleString()}`);
    console.log(`  Current Block: ${currentBlock.toLocaleString()}`);
    console.log(`  Blocks to Index: ${(currentBlock - deploymentBlock).toLocaleString()}`);
    
    // Calculate time estimate
    const blocksToIndex = currentBlock - deploymentBlock;
    const chunksNeeded = Math.ceil(blocksToIndex / 10000);
    const estimatedMinutes = Math.ceil(chunksNeeded * 0.5); // ~30 seconds per chunk
    
    console.log(`\n⏱️  Indexing Estimate:`);
    console.log(`  Chunks: ${chunksNeeded}`);
    console.log(`  Estimated Time: ~${estimatedMinutes} minutes`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run test
testDeploymentFinder();
