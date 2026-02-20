/**
 * Quick test of streaming indexer components
 */

import { initializeStreamingIndexer } from './src/indexer/index.js';

async function quickTest() {
  console.log('🚀 Quick Component Test\n');

  const { indexerManager, components } = await initializeStreamingIndexer();
  
  // Test 1: RPC Pool
  console.log('1️⃣  Testing RPC Pool...');
  components.rpcPool.initializeChain('lisk');
  const endpoint = components.rpcPool.getHealthyEndpoint('lisk');
  console.log(`✅ Got endpoint: ${endpoint}\n`);
  
  // Test 2: Storage
  console.log('2️⃣  Testing Storage...');
  const health = await components.storage.checkHealth();
  console.log(`✅ Storage health:`, health, '\n');
  
  // Test 3: Fetch recent data
  console.log('3️⃣  Testing Data Fetch...');
  const provider = components.fetcher.getProvider('lisk', endpoint);
  const currentBlock = await provider.getBlockNumber();
  console.log(`✅ Current block: ${currentBlock}`);
  
  const data = await components.fetcher.fetchContractData(
    'lisk',
    '0x05D032ac25d322df992303dCa074EE7392C117b9',
    currentBlock - 100,
    currentBlock
  );
  console.log(`✅ Fetched ${data.logs.length} logs\n`);
  
  // Test 4: Chunk Manager
  console.log('4️⃣  Testing Chunk Manager...');
  const chunks = components.chunkManager.divideIntoChunks(1000000, 1200000);
  console.log(`✅ Created ${chunks.length} chunks\n`);
  
  // Test 5: WebSocket Manager (if available)
  if (components.wsManager) {
    console.log('5️⃣  Testing WebSocket Manager...');
    components.wsManager.emitProgress('test-user', {
      progress: 50,
      message: 'Test progress'
    });
    console.log(`✅ WebSocket message sent\n`);
  }
  
  components.rpcPool.stopHealthChecks();
  console.log('✅ All component tests passed!');
}

quickTest().catch(console.error);
