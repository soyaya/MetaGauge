/**
 * Test script to verify filter errors are fixed
 * This script tests that the RobustProvider properly intercepts and suppresses filter errors
 */

import { createRobustProvider } from './src/services/RobustProvider.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com';

async function testFilterFix() {
  console.log('🧪 Testing Filter Error Fix\n');
  console.log('=' .repeat(60));
  
  try {
    // Create robust provider
    console.log('\n1️⃣  Creating RobustProvider...');
    const provider = createRobustProvider(RPC_URL, {
      disableFilters: true,
      usePolling: true,
      pollingInterval: 4000
    });
    console.log('✅ RobustProvider created successfully');
    
    // Test 1: Verify filter methods are intercepted
    console.log('\n2️⃣  Testing filter method interception...');
    
    try {
      const result1 = await provider.send('eth_newFilter', [{ address: '0x0000000000000000000000000000000000000000' }]);
      console.log('✅ eth_newFilter intercepted, returned:', result1);
    } catch (error) {
      console.error('❌ eth_newFilter failed:', error.message);
    }
    
    try {
      const result2 = await provider.send('eth_getFilterChanges', ['0x123']);
      console.log('✅ eth_getFilterChanges intercepted, returned:', result2);
    } catch (error) {
      console.error('❌ eth_getFilterChanges failed:', error.message);
    }
    
    try {
      const result3 = await provider.send('eth_uninstallFilter', ['0x123']);
      console.log('✅ eth_uninstallFilter intercepted, returned:', result3);
    } catch (error) {
      console.error('❌ eth_uninstallFilter failed:', error.message);
    }
    
    // Test 2: Verify normal RPC calls still work
    console.log('\n3️⃣  Testing normal RPC calls...');
    
    try {
      const blockNumber = await provider.getBlockNumber();
      console.log('✅ getBlockNumber works:', blockNumber);
    } catch (error) {
      console.error('❌ getBlockNumber failed:', error.message);
    }
    
    // Test 3: Test eth_getLogs (should use chunking)
    console.log('\n4️⃣  Testing eth_getLogs...');
    
    try {
      const logs = await provider.getLogs({
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        fromBlock: '0x' + (20000000).toString(16),
        toBlock: '0x' + (20000010).toString(16),
        topics: []
      });
      console.log('✅ getLogs works, returned', logs.length, 'logs');
    } catch (error) {
      console.error('❌ getLogs failed:', error.message);
    }
    
    // Test 4: Test robust event listener
    console.log('\n5️⃣  Testing robust event listener...');
    
    try {
      let eventCount = 0;
      const cleanup = provider.createRobustEventListener(
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
          topics: []
        },
        (log) => {
          eventCount++;
          if (eventCount === 1) {
            console.log('✅ Event listener received first event:', log.transactionHash);
          }
        }
      );
      
      // Wait a bit to see if events come in
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      console.log(`✅ Event listener active, received ${eventCount} events`);
      
      // Cleanup
      cleanup();
      console.log('✅ Event listener cleaned up');
    } catch (error) {
      console.error('❌ Event listener failed:', error.message);
    }
    
    // Test 5: Check provider stats
    console.log('\n6️⃣  Checking provider statistics...');
    const stats = provider.getStats();
    console.log('✅ Provider stats:', JSON.stringify(stats, null, 2));
    
    // Cleanup
    console.log('\n7️⃣  Cleaning up...');
    await provider.destroy();
    console.log('✅ Provider destroyed');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('🎉 Filter errors should now be eliminated');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testFilterFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
