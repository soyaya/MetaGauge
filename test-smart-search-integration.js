/**
 * Test Smart Block Range Integration
 * Demonstrates the Orbiter Finance-inspired smart search strategy
 */

import { AnalyticsEngine } from './src/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSmartSearchIntegration() {
  console.log('🚀 TESTING SMART BLOCK RANGE INTEGRATION');
  console.log('=========================================\n');
  
  try {
    // Initialize Analytics Engine with smart search configuration
    const engine = new AnalyticsEngine({
      smartRange: {
        stopOnLowActivity: process.env.SMART_SEARCH_STOP_ON_LOW_ACTIVITY === 'true',
        maxBlocksToSearch: parseInt(process.env.SMART_SEARCH_MAX_BLOCKS) || 2000000,
        minActivityThreshold: parseInt(process.env.SMART_SEARCH_MIN_ACTIVITY_THRESHOLD) || 5,
        highActivityThreshold: parseInt(process.env.SMART_SEARCH_HIGH_ACTIVITY_THRESHOLD) || 10
      }
    });
    
    // Test contracts for different chains
    const testContracts = [
      {
        address: '0xA0b86a33E6441e6e80D0c4C6C7556C721C4C2e7E', // Example Ethereum contract
        chain: 'ethereum',
        name: 'Test Ethereum Contract',
        strategy: 'standard'
      },
      {
        address: '0x05D032ac25d322df992303dCa074EE7392C117b9', // Example Lisk contract
        chain: 'lisk',
        name: 'Test Lisk Contract',
        strategy: 'comprehensive'
      }
    ];
    
    for (const contract of testContracts) {
      console.log(`\n📊 TESTING: ${contract.name} (${contract.chain})`);
      console.log('='.repeat(60));
      
      try {
        // Test 1: Smart search with auto-detected strategy
        console.log(`\n🔍 Test 1: Smart search with auto-detected strategy`);
        const smartResult = await engine.analyzeContract(
          contract.address,
          contract.chain,
          contract.name
          // No blockRange parameter = use smart search
        );
        
        console.log(`✅ Smart Search Results:`);
        console.log(`   Strategy: ${smartResult.searchSummary?.strategy || 'N/A'}`);
        console.log(`   Transactions Found: ${smartResult.transactions}`);
        console.log(`   Blocks Searched: ${smartResult.searchSummary?.blocksSearched?.toLocaleString() || 'N/A'}`);
        console.log(`   Search Time: ${smartResult.searchSummary?.searchTime || 'N/A'}`);
        console.log(`   Activity Level: ${smartResult.searchSummary?.activityLevel || 'N/A'}`);
        
        // Test 2: Legacy fixed range for comparison
        console.log(`\n🔍 Test 2: Legacy fixed range (1000 blocks) for comparison`);
        const legacyResult = await engine.analyzeContract(
          contract.address,
          contract.chain,
          contract.name,
          1000 // Fixed block range = use legacy mode
        );
        
        console.log(`✅ Legacy Search Results:`);
        console.log(`   Strategy: ${legacyResult.searchSummary?.strategy || 'N/A'}`);
        console.log(`   Transactions Found: ${legacyResult.transactions}`);
        console.log(`   Blocks Searched: ${legacyResult.searchSummary?.blocksSearched?.toLocaleString() || 'N/A'}`);
        
        // Test 3: Specific strategy override
        console.log(`\n🔍 Test 3: Specific strategy override (${contract.strategy})`);
        const strategyResult = await engine.analyzeContract(
          contract.address,
          contract.chain,
          contract.name,
          null, // No fixed range
          contract.strategy // Specific strategy
        );
        
        console.log(`✅ Strategy Override Results:`);
        console.log(`   Strategy: ${strategyResult.searchSummary?.strategy || 'N/A'}`);
        console.log(`   Transactions Found: ${strategyResult.transactions}`);
        console.log(`   Blocks Searched: ${strategyResult.searchSummary?.blocksSearched?.toLocaleString() || 'N/A'}`);
        console.log(`   Search Time: ${strategyResult.searchSummary?.searchTime || 'N/A'}`);
        
        // Performance comparison
        console.log(`\n📈 PERFORMANCE COMPARISON:`);
        console.log(`   Smart vs Legacy Efficiency: ${smartResult.transactions > legacyResult.transactions ? 'BETTER' : 'SIMILAR'}`);
        console.log(`   Smart Search Found: ${smartResult.transactions - legacyResult.transactions} more transactions`);
        
      } catch (error) {
        console.error(`❌ Error testing ${contract.name}:`, error.message);
      }
      
      // Add delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Test 4: Strategy information display
    console.log(`\n📋 AVAILABLE SEARCH STRATEGIES:`);
    console.log('='.repeat(40));
    
    const strategies = ['quick', 'standard', 'comprehensive', 'bridge'];
    for (const strategy of strategies) {
      const info = engine.smartRangeSelector.getStrategyInfo(strategy);
      console.log(`${strategy.toUpperCase()}:`);
      console.log(`   Ranges: ${info.ranges}`);
      console.log(`   Max Blocks: ${info.maxBlocks.toLocaleString()}`);
      console.log(`   Total Blocks: ${info.totalBlocks.toLocaleString()}`);
      console.log(`   Description: ${info.description}\n`);
    }
    
    console.log('✅ Smart Block Range Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

// Run the test
testSmartSearchIntegration().catch(console.error);