#!/usr/bin/env node

/**
 * Simple Direct Test - Verify Data Fetching
 */

import dotenv from 'dotenv';
import { SmartContractFetcher } from './src/services/SmartContractFetcher.js';

dotenv.config();

async function testDirectFetch() {
  console.log(`\n🧪 DIRECT FETCH TEST\n`);

  const contractAddress = '0x05D032ac25d322df992303dCa074EE7392C117b9';
  const chain = 'lisk';

  try {
    // Initialize fetcher
    const fetcher = new SmartContractFetcher({
      maxRequestsPerSecond: 10,
      failoverTimeout: 60000
    });

    // Get current block
    console.log(`1️⃣ Getting current block...`);
    const currentBlock = await fetcher.getCurrentBlockNumber(chain);
    console.log(`   ✅ Current block: ${currentBlock.toLocaleString()}\n`);

    // Calculate range (smaller for quick test)
    const fromBlock = currentBlock - 10000; // Just 10k blocks for quick test
    const toBlock = currentBlock;
    
    console.log(`2️⃣ Fetching transactions...`);
    console.log(`   Range: ${fromBlock.toLocaleString()} → ${toBlock.toLocaleString()}`);
    console.log(`   Blocks: ${(toBlock - fromBlock).toLocaleString()}\n`);

    // Fetch transactions
    const startTime = Date.now();
    const transactions = await fetcher.fetchTransactions(contractAddress, fromBlock, toBlock, chain);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n✅ FETCH COMPLETE`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    console.log(`   Transactions: ${transactions.length}`);

    if (transactions.length > 0) {
      console.log(`\n📊 Sample Transaction:`);
      const sample = transactions[0];
      console.log(`   Hash: ${sample.hash || sample.transactionHash || 'N/A'}`);
      console.log(`   From: ${sample.from || 'N/A'}`);
      console.log(`   To: ${sample.to || 'N/A'}`);
      console.log(`   Block: ${sample.blockNumber || 'N/A'}`);
      console.log(`   Events: ${sample.events?.length || 0}`);
      
      // Count total events
      let totalEvents = 0;
      transactions.forEach(tx => {
        if (tx.events) totalEvents += tx.events.length;
      });
      console.log(`\n📋 Total Events: ${totalEvents}`);

      // Extract unique accounts
      const accounts = new Set();
      transactions.forEach(tx => {
        if (tx.from) accounts.add(tx.from);
        if (tx.to) accounts.add(tx.to);
      });
      console.log(`👥 Unique Accounts: ${accounts.size}`);

      // Extract unique blocks
      const blocks = new Set();
      transactions.forEach(tx => {
        if (tx.blockNumber) blocks.add(tx.blockNumber);
      });
      console.log(`🧱 Unique Blocks: ${blocks.size}`);
    }

    await fetcher.close();
    console.log(`\n✅ Test Complete!\n`);

  } catch (error) {
    console.error(`\n❌ Test Failed:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}\n`);
  }
}

testDirectFetch();
