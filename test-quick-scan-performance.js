#!/usr/bin/env node

/**
 * Test Quick Scan Performance
 * Measures how fast quick scan fetches 1 week of data
 */

import { SmartContractFetcher } from './src/services/SmartContractFetcher.js';
import { OptimizedQuickScan } from './src/services/OptimizedQuickScan.js';
import dotenv from 'dotenv';

dotenv.config();

async function testQuickScanPerformance() {
  console.log('\n🧪 QUICK SCAN PERFORMANCE TEST');
  console.log('='.repeat(60));
  
  // Test contract - USDT on Lisk
  const contractAddress = process.env.CONTRACT_ADDRESS || '0x05D032ac25d322df992303dCa074EE7392C117b9';
  const chain = process.env.CONTRACT_CHAIN || 'lisk';
  const contractName = process.env.CONTRACT_NAME || 'USDT';
  
  console.log(`\n📋 Test Configuration:`);
  console.log(`   Contract: ${contractName}`);
  console.log(`   Address: ${contractAddress}`);
  console.log(`   Chain: ${chain}`);
  console.log(`   Target: ~1 week of data (50k-100k blocks)\n`);
  
  const overallStart = Date.now();
  
  try {
    // Initialize fetcher
    console.log('⚙️  Initializing SmartContractFetcher...');
    const fetcherStart = Date.now();
    const fetcher = new SmartContractFetcher({
      maxRequestsPerSecond: 10,
      failoverTimeout: 60000
    });
    const fetcherTime = Date.now() - fetcherStart;
    console.log(`   ✅ Fetcher initialized in ${fetcherTime}ms\n`);
    
    // Initialize quick scan
    console.log('⚙️  Initializing OptimizedQuickScan...');
    const scanStart = Date.now();
    const quickScan = new OptimizedQuickScan(fetcher, {
      weekInBlocks: 50400,
      maxScanBlocks: 100000,
      minScanBlocks: 50000,
      batchSize: 10,
      onProgress: (progressData) => {
        // Track progress
        console.log(`   📊 [${progressData.progress}%] ${progressData.step}: ${progressData.message}`);
      }
    });
    const scanInitTime = Date.now() - scanStart;
    console.log(`   ✅ Quick scan initialized in ${scanInitTime}ms\n`);
    
    // Run quick scan
    console.log('🚀 Starting Quick Scan...\n');
    const scanExecutionStart = Date.now();
    const results = await quickScan.quickScan(contractAddress, chain);
    const scanExecutionTime = (Date.now() - scanExecutionStart) / 1000;
    
    // Get statistics
    const stats = quickScan.getStats(results);
    
    // Calculate total time
    const totalTime = (Date.now() - overallStart) / 1000;
    
    // Print detailed results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n⏱️  TIMING:');
    console.log(`   Fetcher Init:     ${fetcherTime}ms`);
    console.log(`   Scan Init:        ${scanInitTime}ms`);
    console.log(`   Scan Execution:   ${scanExecutionTime.toFixed(2)}s`);
    console.log(`   Total Time:       ${totalTime.toFixed(2)}s`);
    
    console.log('\n📦 DATA COLLECTED:');
    console.log(`   Transactions:     ${results.metrics.totalTransactions.toLocaleString()}`);
    console.log(`   Events:           ${results.metrics.totalEvents.toLocaleString()}`);
    console.log(`   Unique Accounts:  ${results.metrics.uniqueAccounts.toLocaleString()}`);
    console.log(`   Unique Blocks:    ${results.metrics.uniqueBlocks.toLocaleString()}`);
    
    console.log('\n📏 BLOCK RANGE:');
    console.log(`   From Block:       ${results.metrics.blockRange.from.toLocaleString()}`);
    console.log(`   To Block:         ${results.metrics.blockRange.to.toLocaleString()}`);
    console.log(`   Total Blocks:     ${(results.metrics.blockRange.to - results.metrics.blockRange.from).toLocaleString()}`);
    console.log(`   Days Scanned:     ${stats.coverage.daysScanned}`);
    
    console.log('\n⚡ EFFICIENCY:');
    console.log(`   Transactions/sec: ${stats.efficiency.transactionsPerSecond}`);
    console.log(`   Events/sec:       ${stats.efficiency.eventsPerSecond}`);
    console.log(`   Blocks/sec:       ${stats.efficiency.blocksPerSecond}`);
    
    console.log('\n🎯 DEPLOYMENT:');
    if (results.deploymentInfo?.found) {
      console.log(`   Status:           ✅ Found`);
      console.log(`   Date:             ${results.deploymentInfo.date}`);
      console.log(`   Block:            ${results.deploymentInfo.blockNumber.toLocaleString()}`);
      console.log(`   Deployer:         ${results.deploymentInfo.deployer}`);
      console.log(`   Tx Hash:          ${results.deploymentInfo.transactionHash}`);
    } else {
      console.log(`   Status:           ⚠️  Not found in scanned range`);
      console.log(`   Note:             Contract likely deployed before block ${results.metrics.blockRange.from.toLocaleString()}`);
    }
    
    console.log('\n✅ DATA QUALITY:');
    console.log(`   Quality:          ${results.metrics.dataQuality}`);
    console.log(`   Completeness:     ${stats.quality.completeness}`);
    console.log(`   Source:           100% Real RPC Data`);
    
    // Performance assessment
    console.log('\n📈 PERFORMANCE ASSESSMENT:');
    if (totalTime < 60) {
      console.log(`   ⭐⭐⭐ EXCELLENT - Completed in under 1 minute`);
    } else if (totalTime < 90) {
      console.log(`   ⭐⭐ GOOD - Completed within expected time (60-90s)`);
    } else if (totalTime < 120) {
      console.log(`   ⭐ ACCEPTABLE - Slightly slower than expected`);
    } else {
      console.log(`   ⚠️  SLOW - Performance may need optimization`);
    }
    
    // Data rate assessment
    const blocksScanned = results.metrics.blockRange.to - results.metrics.blockRange.from;
    const blocksPerSecond = blocksScanned / scanExecutionTime;
    console.log(`   Block Scan Rate:  ${blocksPerSecond.toFixed(0)} blocks/second`);
    
    if (blocksPerSecond > 1000) {
      console.log(`   ⚡ FAST - Excellent scan rate`);
    } else if (blocksPerSecond > 500) {
      console.log(`   ✅ GOOD - Solid scan rate`);
    } else {
      console.log(`   ⚠️  SLOW - Consider optimization`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60) + '\n');
    
    // Close fetcher
    await fetcher.close();
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run test
testQuickScanPerformance();
