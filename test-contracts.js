#!/usr/bin/env node

/**
 * Test specific contracts that are failing to index
 */

import dotenv from 'dotenv';
dotenv.config();

const CONTRACTS = [
  { name: 'PEPE', address: '0x6982508145454ce325ddbe47a25d4ec3d2311933', user: 'simple' },
  { name: 'ONK', address: '0x4aeF9BD3fBb09d8f374436D9ec25711A1Be9BaCb', user: 'dinogoyin' }
];

const RPC_URL = 'https://ethereum-rpc.publicnode.com';

async function testContract(contract) {
  console.log(`\n🔍 Testing ${contract.name} (${contract.address}):`);
  
  try {
    // Get current block
    const blockResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    const blockData = await blockResponse.json();
    const currentBlock = parseInt(blockData.result, 16);
    console.log(`  Current block: ${currentBlock}`);
    
    // Test logs for last 1000 blocks (small range)
    const fromBlock = currentBlock - 1000;
    const logsResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: 'latest',
          address: contract.address
        }],
        id: 2
      })
    });
    
    const logsData = await logsResponse.json();
    
    if (logsData.error) {
      console.log(`  ❌ Error: ${logsData.error.message}`);
      return;
    }
    
    const logs = logsData.result || [];
    console.log(`  📊 Logs in last 1000 blocks: ${logs.length}`);
    
    if (logs.length > 0) {
      const txHashes = [...new Set(logs.map(log => log.transactionHash))];
      console.log(`  📝 Unique transactions: ${txHashes.length}`);
      
      // Test getting one transaction
      if (txHashes.length > 0) {
        const txResponse = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionByHash',
            params: [txHashes[0]],
            id: 3
          })
        });
        
        const txData = await txResponse.json();
        if (txData.result) {
          console.log(`  ✅ Transaction fetch works`);
        } else {
          console.log(`  ❌ Transaction fetch failed`);
        }
      }
    } else {
      console.log(`  ⚠️ No recent activity found`);
      
      // Try a much larger range (10k blocks)
      const largeFromBlock = currentBlock - 10000;
      const largeLogsResponse = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getLogs',
          params: [{
            fromBlock: '0x' + largeFromBlock.toString(16),
            toBlock: 'latest',
            address: contract.address
          }],
          id: 4
        })
      });
      
      const largeLogsData = await largeLogsResponse.json();
      const largeLogs = largeLogsData.result || [];
      console.log(`  📊 Logs in last 10k blocks: ${largeLogs.length}`);
    }
    
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}`);
  }
}

async function main() {
  console.log('🧪 Testing Problem Contracts...');
  
  for (const contract of CONTRACTS) {
    await testContract(contract);
  }
}

main().catch(console.error);
