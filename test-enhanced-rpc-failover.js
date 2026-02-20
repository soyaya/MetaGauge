/**
 * Test Enhanced RPC Clients with Multi-URL Failover
 * Verifies that all three enhanced clients properly handle multiple URLs
 */

import { LiskRpcClient } from './src/services/LiskRpcClient.js';
import { EthereumRpcClient } from './src/services/EthereumRpcClient.js';
import { StarknetRpcClient } from './src/services/StarknetRpcClient.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 Testing Enhanced RPC Clients with Multi-URL Failover\n');
console.log('='.repeat(60));

/**
 * Test Lisk RPC Client with multiple URLs
 */
async function testLiskMultiUrl() {
  console.log('\n📘 LISK RPC CLIENT - Multi-URL Failover Test');
  console.log('-'.repeat(60));
  
  const urls = [
    process.env.LISK_RPC_URL1,
    process.env.LISK_RPC_URL2,
    process.env.LISK_RPC_URL3
  ].filter(Boolean);
  
  console.log(`   Configured URLs: ${urls.length}`);
  urls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
  
  try {
    const client = new LiskRpcClient(urls);
    
    // Test 1: Get block number
    console.log('\n   Test 1: Get current block number');
    const blockNumber = await client.getBlockNumber();
    console.log(`   ✅ Block number: ${blockNumber}`);
    
    // Test 2: Get block
    console.log('\n   Test 2: Get specific block');
    const block = await client.getBlock(blockNumber - 1);
    console.log(`   ✅ Block hash: ${block.hash}`);
    console.log(`   ✅ Transactions: ${block.transactions?.length || 0}`);
    
    // Test 3: Test with intentional bad URL
    console.log('\n   Test 3: Failover with bad URL');
    const badUrls = [
      'https://invalid-url-that-does-not-exist.com',
      ...urls
    ];
    const clientWithBadUrl = new LiskRpcClient(badUrls);
    const blockNumber2 = await clientWithBadUrl.getBlockNumber();
    console.log(`   ✅ Failover successful! Block: ${blockNumber2}`);
    console.log(`   ✅ Client automatically failed over to working URL`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Ethereum RPC Client with multiple URLs
 */
async function testEthereumMultiUrl() {
  console.log('\n📙 ETHEREUM RPC CLIENT - Multi-URL Failover Test');
  console.log('-'.repeat(60));
  
  const urls = [
    process.env.ETHEREUM_RPC_URL1,
    process.env.ETHEREUM_RPC_URL2,
    process.env.ETHEREUM_RPC_URL3
  ].filter(Boolean);
  
  console.log(`   Configured URLs: ${urls.length}`);
  urls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
  
  try {
    const client = new EthereumRpcClient(urls);
    
    // Test 1: Get block number
    console.log('\n   Test 1: Get current block number');
    const blockNumber = await client.getBlockNumber();
    console.log(`   ✅ Block number: ${blockNumber}`);
    
    // Test 2: Get block
    console.log('\n   Test 2: Get specific block');
    const block = await client.getBlock(blockNumber - 1);
    console.log(`   ✅ Block hash: ${block.hash}`);
    console.log(`   ✅ Transactions: ${block.transactions?.length || 0}`);
    
    // Test 3: Test with intentional bad URL
    console.log('\n   Test 3: Failover with bad URL');
    const badUrls = [
      'https://invalid-ethereum-url.com',
      ...urls
    ];
    const clientWithBadUrl = new EthereumRpcClient(badUrls);
    const blockNumber2 = await clientWithBadUrl.getBlockNumber();
    console.log(`   ✅ Failover successful! Block: ${blockNumber2}`);
    console.log(`   ✅ Client automatically failed over to working URL`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Starknet RPC Client with multiple URLs
 */
async function testStarknetMultiUrl() {
  console.log('\n📕 STARKNET RPC CLIENT - Multi-URL Failover Test');
  console.log('-'.repeat(60));
  
  const urls = [
    process.env.STARKNET_RPC_URL1,
    process.env.STARKNET_RPC_URL2,
    process.env.STARKNET_RPC_URL3
  ].filter(Boolean);
  
  console.log(`   Configured URLs: ${urls.length}`);
  urls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
  
  try {
    const client = new StarknetRpcClient(urls);
    
    // Test 1: Get block number
    console.log('\n   Test 1: Get current block number');
    const blockNumber = await client.getBlockNumber();
    console.log(`   ✅ Block number: ${blockNumber}`);
    
    // Test 2: Get block
    console.log('\n   Test 2: Get specific block');
    const block = await client.getBlock(blockNumber - 1);
    console.log(`   ✅ Block hash: ${block.block_hash || block.hash}`);
    console.log(`   ✅ Transactions: ${block.transactions?.length || 0}`);
    
    // Test 3: Test with intentional bad URL
    console.log('\n   Test 3: Failover with bad URL');
    const badUrls = [
      'https://invalid-starknet-url.com',
      ...urls
    ];
    const clientWithBadUrl = new StarknetRpcClient(badUrls);
    const blockNumber2 = await clientWithBadUrl.getBlockNumber();
    console.log(`   ✅ Failover successful! Block: ${blockNumber2}`);
    console.log(`   ✅ Client automatically failed over to working URL`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test backward compatibility with single URL
 */
async function testBackwardCompatibility() {
  console.log('\n🔄 BACKWARD COMPATIBILITY TEST - Single URL');
  console.log('-'.repeat(60));
  
  try {
    // Test Lisk with single URL
    console.log('\n   Test 1: Lisk with single URL');
    const liskClient = new LiskRpcClient(process.env.LISK_RPC_URL1);
    const liskBlock = await liskClient.getBlockNumber();
    console.log(`   ✅ Lisk single URL works: Block ${liskBlock}`);
    
    // Test Ethereum with single URL
    console.log('\n   Test 2: Ethereum with single URL');
    const ethClient = new EthereumRpcClient(process.env.ETHEREUM_RPC_URL1);
    const ethBlock = await ethClient.getBlockNumber();
    console.log(`   ✅ Ethereum single URL works: Block ${ethBlock}`);
    
    // Test Starknet with single URL
    console.log('\n   Test 3: Starknet with single URL');
    const starknetClient = new StarknetRpcClient(process.env.STARKNET_RPC_URL1);
    const starknetBlock = await starknetClient.getBlockNumber();
    console.log(`   ✅ Starknet single URL works: Block ${starknetBlock}`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  const results = {
    lisk: false,
    ethereum: false,
    starknet: false,
    backward: false
  };
  
  try {
    results.lisk = await testLiskMultiUrl();
    results.ethereum = await testEthereumMultiUrl();
    results.starknet = await testStarknetMultiUrl();
    results.backward = await testBackwardCompatibility();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Lisk Multi-URL:           ${results.lisk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Ethereum Multi-URL:       ${results.ethereum ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Starknet Multi-URL:       ${results.starknet ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Backward Compatibility:   ${results.backward ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r === true);
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED! Enhanced RPC clients are working correctly.');
      console.log('✅ Multi-URL failover is operational');
      console.log('✅ Backward compatibility maintained');
      console.log('✅ Ready for production use');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review errors above');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
  }
}

// Run tests
runAllTests().catch(console.error);
