/**
 * Test streaming indexer with real contract
 */

import { initializeStreamingIndexer } from './src/indexer/index.js';

async function testRealContract() {
  console.log('🚀 Testing Streaming Indexer with Real Contract\n');

  try {
    // Initialize system
    const { indexerManager, components } = await initializeStreamingIndexer();
    
    // Initialize Lisk chain
    components.rpcPool.initializeChain('lisk');
    
    // Test contract (USDT on Lisk)
    const contractAddress = '0x05D032ac25d322df992303dCa074EE7392C117b9';
    const chainId = 'lisk';
    
    console.log('📍 Finding deployment block...');
    const deploymentBlock = await components.deploymentFinder.findDeploymentBlock(
      chainId,
      contractAddress
    );
    console.log(`✅ Deployment block: ${deploymentBlock}\n`);
    
    // Get current block
    const endpoint = components.rpcPool.getHealthyEndpoint(chainId);
    const provider = components.fetcher.getProvider(chainId, endpoint);
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);
    console.log(`📏 Total blocks to index: ${currentBlock - deploymentBlock}\n`);
    
    // Test fetching small range
    console.log('🔍 Testing data fetch (last 100 blocks)...');
    const testStart = currentBlock - 100;
    const testData = await components.fetcher.fetchContractData(
      chainId,
      contractAddress,
      testStart,
      currentBlock
    );
    
    console.log(`✅ Fetched ${testData.logs.length} logs`);
    console.log(`✅ Block range: ${testData.blockRange.startBlock} - ${testData.blockRange.endBlock}\n`);
    
    // Test chunk division
    console.log('📦 Testing chunk division...');
    const chunks = components.chunkManager.divideIntoChunks(deploymentBlock, currentBlock);
    console.log(`✅ Divided into ${chunks.length} chunks of 200k blocks each\n`);
    
    // Test processing one chunk
    console.log('⚙️  Processing first chunk...');
    const firstChunk = await components.chunkManager.processChunk(
      chainId,
      contractAddress,
      chunks[0]
    );
    console.log(`✅ Chunk processed: ${firstChunk.metrics.logCount} logs, ${firstChunk.metrics.blocksCovered} blocks\n`);
    
    // Test starting full indexer (but stop immediately)
    console.log('🎯 Testing full indexer initialization...');
    const indexer = await indexerManager.startIndexing(
      'test-user-123',
      contractAddress,
      chainId,
      'free'
    );
    
    const status = indexerManager.getIndexingStatus('test-user-123');
    console.log('✅ Indexer status:', JSON.stringify(status, null, 2));
    
    // Stop immediately
    indexerManager.stopIndexing('test-user-123');
    console.log('✅ Indexer stopped\n');
    
    // Cleanup
    components.rpcPool.stopHealthChecks();
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRealContract();
