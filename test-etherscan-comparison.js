#!/usr/bin/env node

/**
 * Test Etherscan Comparison
 * Compares our RPC data with Etherscan for WETH contract
 */

import { EtherscanComparator } from './src/services/EtherscanComparator.js';
import { EthereumRpcClient } from './src/services/EthereumRpcClient.js';
import dotenv from 'dotenv';

dotenv.config();

const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

async function testComparison() {
  console.log('🧪 Testing Etherscan Comparison for WETH\n');

  try {
    // Initialize clients
    const comparator = new EtherscanComparator();
    const rpcClient = new EthereumRpcClient([
      process.env.ETHEREUM_RPC_URL1,
      process.env.ETHEREUM_RPC_URL2,
      process.env.ETHEREUM_RPC_URL3
    ]);

    // 1. Verify contract
    console.log('1️⃣ Verifying contract deployment...');
    await comparator.verifyContractDeployment(WETH_ADDRESS);

    // 2. Get our RPC data (last 100 blocks for quick test)
    console.log('\n2️⃣ Fetching data from our RPC...');
    const currentBlock = await rpcClient.getBlockNumber();
    const fromBlock = currentBlock - 100;
    
    console.log(`   Current block: ${currentBlock}`);
    console.log(`   Analyzing blocks: ${fromBlock} to ${currentBlock}`);
    
    const ourTransactions = await rpcClient.getTransactionsByAddress(
      WETH_ADDRESS,
      fromBlock,
      currentBlock
    );

    console.log(`   ✅ Found ${ourTransactions.length} transactions`);

    // 3. Compare with Etherscan
    console.log('\n3️⃣ Comparing with Etherscan...');
    const comparison = await comparator.compareTransactionData(WETH_ADDRESS, {
      transactions: ourTransactions
    });

    // 4. Summary
    console.log('\n📊 Comparison Summary:');
    console.log(`   Our RPC:        ${comparison.ourCount} transactions`);
    console.log(`   Etherscan:      ${comparison.etherscanCount} transactions`);
    console.log(`   Difference:     ${comparison.difference}`);
    console.log(`   Accuracy:       ${comparison.accuracy}%`);
    console.log(`   Our Users:      ${comparison.ourUsers}`);
    console.log(`   Etherscan Users: ${comparison.etherscanUsers}`);

    if (comparison.accuracy >= 95) {
      console.log('\n✅ Data accuracy is excellent!');
    } else if (comparison.accuracy >= 80) {
      console.log('\n⚠️  Data accuracy is acceptable but could be improved');
    } else {
      console.log('\n❌ Data accuracy is low - investigation needed');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testComparison();
