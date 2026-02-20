#!/usr/bin/env node

/**
 * Test Optimized Quick Scan
 * Demonstrates fast, contract-focused data fetching with deployment detection
 */

import dotenv from 'dotenv';
import { SmartContractFetcher } from './src/services/SmartContractFetcher.js';
import { OptimizedQuickScan } from './src/services/OptimizedQuickScan.js';

dotenv.config();

async function testOptimizedQuickScan() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⚡ OPTIMIZED QUICK SCAN TEST`);
  console.log(`${'='.repeat(60)}\n`);

  // Test configuration
  const testCases = [
    {
      name: 'Lisk USDT Contract',
      address: '0x05D032ac25d322df992303dCa074EE7392C117b9',
      chain: 'lisk'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`${'─'.repeat(60)}\n`);

    try {
      // Initialize fetcher
      const fetcher = new SmartContractFetcher({
        maxRequestsPerSecond: 10,
        failoverTimeout: 60000
      });

      // Initialize quick scan
      const quickScan = new OptimizedQuickScan(fetcher, {
        weekInBlocks: 50400,    // ~7 days (12 sec blocks)
        maxScanBlocks: 100000,  // Max 100k blocks
        minScanBlocks: 50000,   // Min 50k blocks
        batchSize: 10           // Batch transaction fetching
      });

      // Run quick scan
      const startTime = Date.now();
      const results = await quickScan.quickScan(testCase.address, testCase.chain);
      const duration = (Date.now() - startTime) / 1000;

      // Get statistics
      const stats = quickScan.getStats(results);

      // Display results
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 QUICK SCAN RESULTS - ${testCase.name}`);
      console.log(`${'='.repeat(60)}\n`);

      console.log(`⏱️  Performance:`);
      console.log(`   Duration: ${duration.toFixed(2)}s`);
      console.log(`   Transactions/sec: ${stats.efficiency.transactionsPerSecond}`);
      console.log(`   Events/sec: ${stats.efficiency.eventsPerSecond}`);
      console.log(`   Blocks/sec: ${stats.efficiency.blocksPerSecond}\n`);

      console.log(`📊 Data Collected:`);
      console.log(`   Transactions: ${results.metrics.totalTransactions}`);
      console.log(`   Events: ${results.metrics.totalEvents}`);
      console.log(`   Unique Accounts: ${results.metrics.uniqueAccounts}`);
      console.log(`   Unique Blocks: ${results.metrics.uniqueBlocks}\n`);

      console.log(`📅 Coverage:`);
      console.log(`   Block Range: ${results.metrics.blockRange.from.toLocaleString()} → ${results.metrics.blockRange.to.toLocaleString()}`);
      console.log(`   Total Blocks: ${stats.coverage.totalBlocks.toLocaleString()}`);
      console.log(`   Days Scanned: ~${stats.coverage.daysScanned} days\n`);

      console.log(`🚀 Deployment Info:`);
      if (results.deploymentInfo?.found) {
        console.log(`   ✅ Deployment Found!`);
        console.log(`   Date: ${results.deploymentInfo.date}`);
        console.log(`   Block: ${results.deploymentInfo.blockNumber.toLocaleString()}`);
        console.log(`   Transaction: ${results.deploymentInfo.transactionHash}`);
        console.log(`   Deployer: ${results.deploymentInfo.deployer}\n`);
      } else {
        console.log(`   ⚠️  Deployment Not Found`);
        console.log(`   Reason: ${results.deploymentInfo?.message || 'Unknown'}\n`);
      }

      console.log(`✅ Quality:`);
      console.log(`   Data Quality: ${stats.quality.dataQuality}`);
      console.log(`   Completeness: ${stats.quality.completeness}`);
      console.log(`   Deployment Detected: ${stats.quality.deploymentDetected ? 'Yes' : 'No'}\n`);

      // Sample data preview
      if (results.transactions.length > 0) {
        console.log(`📝 Sample Transactions (first 3):`);
        results.transactions.slice(0, 3).forEach((tx, idx) => {
          console.log(`   ${idx + 1}. ${tx.hash || tx.transactionHash}`);
          console.log(`      From: ${tx.from}`);
          console.log(`      Block: ${tx.blockNumber}`);
        });
        console.log();
      }

      if (results.accounts.size > 0) {
        console.log(`👥 Sample Accounts (first 5):`);
        Array.from(results.accounts).slice(0, 5).forEach((account, idx) => {
          console.log(`   ${idx + 1}. ${account}`);
        });
        console.log();
      }

      console.log(`${'='.repeat(60)}\n`);

      // Close fetcher
      await fetcher.close();

    } catch (error) {
      console.error(`\n❌ Test failed for ${testCase.name}:`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}\n`);
    }
  }

  console.log(`\n✅ Quick Scan Test Complete!\n`);
}

// Run test
testOptimizedQuickScan().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
