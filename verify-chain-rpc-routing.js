#!/usr/bin/env node

/**
 * Verify Chain-Specific RPC Routing
 * Tests that Lisk uses Lisk RPC, Starknet uses Starknet RPC, Ethereum uses Ethereum RPC
 */

import { SmartContractFetcher } from './src/services/SmartContractFetcher.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyChainRPCRouting() {
  console.log('\n🔍 CHAIN-SPECIFIC RPC ROUTING VERIFICATION');
  console.log('='.repeat(70));
  console.log('Testing that each chain uses its own dedicated RPC providers\n');
  
  const fetcher = new SmartContractFetcher({
    maxRequestsPerSecond: 10,
    failoverTimeout: 30000
  });
  
  const testResults = {
    lisk: { tested: false, success: false, providers: [], error: null },
    starknet: { tested: false, success: false, providers: [], error: null },
    ethereum: { tested: false, success: false, providers: [], error: null }
  };
  
  // Test 1: Lisk Chain
  console.log('📋 TEST 1: LISK CHAIN');
  console.log('-'.repeat(70));
  try {
    console.log('Chain: lisk');
    console.log('Expected RPC Providers:');
    console.log('  - lisk-api (https://rpc.api.lisk.com)');
    console.log('  - drpc (https://lisk.drpc.org)');
    console.log('  - tenderly (https://lisk.gateway.tenderly.co/...)');
    console.log('  - moralis (https://site1.moralis-nodes.com/lisk/...)');
    console.log('\nAttempting to fetch current block number...');
    
    const liskBlock = await fetcher.getCurrentBlockNumber('lisk');
    testResults.lisk.tested = true;
    testResults.lisk.success = true;
    testResults.lisk.providers = fetcher.providers['lisk']?.map(p => ({
      name: p.name,
      url: p.config.url,
      healthy: p.isHealthy
    })) || [];
    
    console.log(`✅ SUCCESS: Got block ${liskBlock.toLocaleString()}`);
    console.log(`✅ Used Lisk-specific RPC providers`);
    console.log(`\nActive Lisk Providers:`);
    testResults.lisk.providers.forEach(p => {
      console.log(`  ✓ ${p.name}: ${p.url}`);
    });
  } catch (error) {
    testResults.lisk.tested = true;
    testResults.lisk.error = error.message;
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  console.log('\n');
  
  // Test 2: Starknet Chain
  console.log('📋 TEST 2: STARKNET CHAIN');
  console.log('-'.repeat(70));
  try {
    console.log('Chain: starknet');
    console.log('Expected RPC Providers:');
    console.log('  - lava (https://rpc.starknet.lava.build)');
    console.log('  - publicnode (https://starknet-rpc.publicnode.com)');
    console.log('  - infura (https://starknet-mainnet.infura.io/v3/...)');
    console.log('\nAttempting to fetch current block number...');
    
    const starknetBlock = await fetcher.getCurrentBlockNumber('starknet');
    testResults.starknet.tested = true;
    testResults.starknet.success = true;
    testResults.starknet.providers = fetcher.providers['starknet']?.map(p => ({
      name: p.name,
      url: p.config.url,
      healthy: p.isHealthy
    })) || [];
    
    console.log(`✅ SUCCESS: Got block ${starknetBlock.toLocaleString()}`);
    console.log(`✅ Used Starknet-specific RPC providers`);
    console.log(`\nActive Starknet Providers:`);
    testResults.starknet.providers.forEach(p => {
      console.log(`  ✓ ${p.name}: ${p.url}`);
    });
  } catch (error) {
    testResults.starknet.tested = true;
    testResults.starknet.error = error.message;
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  console.log('\n');
  
  // Test 3: Ethereum Chain
  console.log('📋 TEST 3: ETHEREUM CHAIN');
  console.log('-'.repeat(70));
  try {
    console.log('Chain: ethereum');
    console.log('Expected RPC Providers:');
    console.log('  - publicnode (https://ethereum-rpc.publicnode.com)');
    console.log('  - nownodes (https://eth.nownodes.io/...)');
    console.log('\nAttempting to fetch current block number...');
    
    const ethereumBlock = await fetcher.getCurrentBlockNumber('ethereum');
    testResults.ethereum.tested = true;
    testResults.ethereum.success = true;
    testResults.ethereum.providers = fetcher.providers['ethereum']?.map(p => ({
      name: p.name,
      url: p.config.url,
      healthy: p.isHealthy
    })) || [];
    
    console.log(`✅ SUCCESS: Got block ${ethereumBlock.toLocaleString()}`);
    console.log(`✅ Used Ethereum-specific RPC providers`);
    console.log(`\nActive Ethereum Providers:`);
    testResults.ethereum.providers.forEach(p => {
      console.log(`  ✓ ${p.name}: ${p.url}`);
    });
  } catch (error) {
    testResults.ethereum.tested = true;
    testResults.ethereum.error = error.message;
    console.log(`❌ FAILED: ${error.message}`);
  }
  
  console.log('\n');
  
  // Test 4: Cross-Chain Isolation Verification
  console.log('📋 TEST 4: CROSS-CHAIN ISOLATION');
  console.log('-'.repeat(70));
  console.log('Verifying that each chain uses ONLY its own providers...\n');
  
  let isolationPassed = true;
  
  // Check Lisk providers don't contain Starknet/Ethereum URLs
  if (testResults.lisk.providers.length > 0) {
    const liskUrls = testResults.lisk.providers.map(p => p.url.toLowerCase());
    const hasStarknet = liskUrls.some(url => url.includes('starknet'));
    const hasEthereum = liskUrls.some(url => url.includes('ethereum') && !url.includes('lisk'));
    
    if (hasStarknet || hasEthereum) {
      console.log('❌ LISK: Contains non-Lisk providers!');
      isolationPassed = false;
    } else {
      console.log('✅ LISK: Only uses Lisk-specific providers');
    }
  }
  
  // Check Starknet providers don't contain Lisk/Ethereum URLs
  if (testResults.starknet.providers.length > 0) {
    const starknetUrls = testResults.starknet.providers.map(p => p.url.toLowerCase());
    const hasLisk = starknetUrls.some(url => url.includes('lisk'));
    const hasEthereum = starknetUrls.some(url => url.includes('ethereum') && !url.includes('starknet'));
    
    if (hasLisk || hasEthereum) {
      console.log('❌ STARKNET: Contains non-Starknet providers!');
      isolationPassed = false;
    } else {
      console.log('✅ STARKNET: Only uses Starknet-specific providers');
    }
  }
  
  // Check Ethereum providers don't contain Lisk/Starknet URLs
  if (testResults.ethereum.providers.length > 0) {
    const ethereumUrls = testResults.ethereum.providers.map(p => p.url.toLowerCase());
    const hasLisk = ethereumUrls.some(url => url.includes('lisk'));
    const hasStarknet = ethereumUrls.some(url => url.includes('starknet'));
    
    if (hasLisk || hasStarknet) {
      console.log('❌ ETHEREUM: Contains non-Ethereum providers!');
      isolationPassed = false;
    } else {
      console.log('✅ ETHEREUM: Only uses Ethereum-specific providers');
    }
  }
  
  console.log('\n');
  
  // Final Summary
  console.log('='.repeat(70));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  
  const liskStatus = testResults.lisk.success ? '✅ PASS' : '❌ FAIL';
  const starknetStatus = testResults.starknet.success ? '✅ PASS' : '❌ FAIL';
  const ethereumStatus = testResults.ethereum.success ? '✅ PASS' : '❌ FAIL';
  const isolationStatus = isolationPassed ? '✅ PASS' : '❌ FAIL';
  
  console.log(`\nLisk Chain:           ${liskStatus}`);
  if (testResults.lisk.error) console.log(`  Error: ${testResults.lisk.error}`);
  
  console.log(`Starknet Chain:       ${starknetStatus}`);
  if (testResults.starknet.error) console.log(`  Error: ${testResults.starknet.error}`);
  
  console.log(`Ethereum Chain:       ${ethereumStatus}`);
  if (testResults.ethereum.error) console.log(`  Error: ${testResults.ethereum.error}`);
  
  console.log(`Chain Isolation:      ${isolationStatus}`);
  
  const allPassed = testResults.lisk.success && 
                    testResults.starknet.success && 
                    testResults.ethereum.success && 
                    isolationPassed;
  
  console.log('\n' + '='.repeat(70));
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
    console.log('✅ Each chain correctly uses its own dedicated RPC providers');
    console.log('✅ No cross-chain contamination detected');
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    console.log('Review the errors above for details');
  }
  console.log('='.repeat(70) + '\n');
  
  // Close fetcher
  await fetcher.close();
  
  process.exit(allPassed ? 0 : 1);
}

// Run verification
verifyChainRPCRouting().catch(error => {
  console.error('\n❌ VERIFICATION FAILED');
  console.error(error);
  process.exit(1);
});
