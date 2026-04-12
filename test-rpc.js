#!/usr/bin/env node

/**
 * Test RPC connectivity for all configured providers
 */

import dotenv from 'dotenv';
dotenv.config();

const RPC_URLS = {
  ethereum: [
    process.env.ETHEREUM_RPC_URL1,
    process.env.ETHEREUM_RPC_URL2, 
    process.env.ETHEREUM_RPC_URL3,
    'https://ethereum-rpc.publicnode.com' // fallback
  ].filter(Boolean),
  starknet: [
    process.env.STARKNET_RPC_URL1,
    process.env.STARKNET_RPC_URL2,
    process.env.STARKNET_RPC_URL3
  ].filter(Boolean)
};

async function testRpcCall(url, method, params = []) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1
      })
    });
    
    const data = await response.json();
    return { success: true, result: data.result, error: data.error };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function testEthereumRpc(url) {
  console.log(`\n🔗 Testing Ethereum RPC: ${url}`);
  
  // Test 1: Get latest block number
  const blockTest = await testRpcCall(url, 'eth_blockNumber');
  if (blockTest.success && blockTest.result) {
    const blockNum = parseInt(blockTest.result, 16);
    console.log(`  ✅ Latest block: ${blockNum}`);
  } else {
    console.log(`  ❌ Block number failed: ${blockTest.error}`);
    return false;
  }
  
  // Test 2: Get logs for a known active contract (USDT)
  const logsTest = await testRpcCall(url, 'eth_getLogs', [{
    fromBlock: '0x' + (parseInt(blockTest.result, 16) - 100).toString(16),
    toBlock: 'latest',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7' // USDT
  }]);
  
  if (logsTest.success && logsTest.result) {
    console.log(`  ✅ Logs test: ${logsTest.result.length} logs found`);
  } else {
    console.log(`  ❌ Logs test failed: ${logsTest.error}`);
  }
  
  return blockTest.success;
}

async function main() {
  console.log('🧪 Testing RPC Connectivity...\n');
  
  // Test Ethereum RPCs
  console.log('📡 ETHEREUM RPCs:');
  let workingEthRpcs = 0;
  
  for (const url of RPC_URLS.ethereum) {
    const works = await testEthereumRpc(url);
    if (works) workingEthRpcs++;
  }
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`  Ethereum RPCs: ${workingEthRpcs}/${RPC_URLS.ethereum.length} working`);
  
  if (workingEthRpcs === 0) {
    console.log(`\n❌ NO WORKING ETHEREUM RPCs FOUND!`);
    console.log(`   This explains why indexing is failing.`);
  } else {
    console.log(`\n✅ RPC connectivity looks good.`);
  }
}

main().catch(console.error);
