/**
 * Test streaming indexer setup
 */

import { initializeStreamingIndexer } from './src/indexer/index.js';

async function testIndexer() {
  console.log('🚀 Initializing Streaming Indexer...\n');

  try {
    // Initialize system
    const { indexerManager, components } = await initializeStreamingIndexer();
    console.log('✅ Indexer system initialized');

    // Initialize a chain
    components.rpcPool.initializeChain('lisk');
    console.log('✅ Lisk chain initialized');

    // Check RPC health
    const health = await components.rpcPool.checkRPCHealth();
    console.log('✅ RPC Health:', JSON.stringify(health, null, 2));

    // Check storage health
    const storageHealth = await components.storage.checkHealth();
    console.log('✅ Storage Health:', JSON.stringify(storageHealth, null, 2));

    console.log('\n✅ All systems operational!');
    
    // Cleanup
    components.rpcPool.stopHealthChecks();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testIndexer();
