#!/usr/bin/env node

/**
 * Health Check - Quick Scan with Progress Updates
 */

import dotenv from 'dotenv';
import { SmartContractFetcher } from './src/services/SmartContractFetcher.js';
import { OptimizedQuickScan } from './src/services/OptimizedQuickScan.js';

dotenv.config();

async function healthCheckProgress() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏥 HEALTH CHECK - Quick Scan Progress Updates`);
  console.log(`${'='.repeat(60)}\n`);

  const contractAddress = '0x05D032ac25d322df992303dCa074EE7392C117b9';
  const chain = 'lisk';
  const progressUpdates = [];

  try {
    // Initialize fetcher
    const fetcher = new SmartContractFetcher({
      maxRequestsPerSecond: 10,
      failoverTimeout: 60000
    });

    // Initialize quick scan with progress callback
    const quickScan = new OptimizedQuickScan(fetcher, {
      weekInBlocks: 10000, // Smaller range for quick test
      maxScanBlocks: 10000,
      minScanBlocks: 10000,
      batchSize: 10,
      onProgress: (progressData) => {
        // Track progress updates
        progressUpdates.push(progressData);
        
        // Display progress
        console.log(`\n📊 PROGRESS UPDATE:`);
        console.log(`   Step: ${progressData.step}`);
        console.log(`   Progress: ${progressData.progress}%`);
        console.log(`   Message: ${progressData.message}`);
        
        if (progressData.transactions !== undefined) {
          console.log(`   Transactions: ${progressData.transactions}`);
        }
        if (progressData.events !== undefined) {
          console.log(`   Events: ${progressData.events}`);
        }
        if (progressData.accounts !== undefined) {
          console.log(`   Accounts: ${progressData.accounts}`);
        }
        if (progressData.blocks !== undefined) {
          console.log(`   Blocks: ${progressData.blocks}`);
        }
      }
    });

    console.log(`🚀 Starting Quick Scan with Progress Tracking...\n`);
    const startTime = Date.now();

    // Run quick scan
    const results = await quickScan.quickScan(contractAddress, chain);
    const duration = (Date.now() - startTime) / 1000;

    // Health Check Results
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ HEALTH CHECK RESULTS`);
    console.log(`${'='.repeat(60)}\n`);

    console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
    console.log(`📊 Progress Updates Received: ${progressUpdates.length}`);
    console.log(`📝 Transactions Found: ${results.metrics.totalTransactions}`);
    console.log(`📋 Events Found: ${results.metrics.totalEvents}`);
    console.log(`👥 Accounts Found: ${results.metrics.uniqueAccounts}`);
    console.log(`🧱 Blocks Found: ${results.metrics.uniqueBlocks}`);

    // Verify progress updates
    console.log(`\n📊 Progress Update Verification:`);
    
    const steps = progressUpdates.map(p => p.step);
    const uniqueSteps = [...new Set(steps)];
    console.log(`   Steps Tracked: ${uniqueSteps.join(' → ')}`);
    
    const progressValues = progressUpdates.map(p => p.progress);
    const minProgress = Math.min(...progressValues);
    const maxProgress = Math.max(...progressValues);
    console.log(`   Progress Range: ${minProgress}% → ${maxProgress}%`);

    // Check if all expected steps were hit
    const expectedSteps = ['init', 'fetching', 'processing', 'deployment', 'complete'];
    const missingSteps = expectedSteps.filter(s => !uniqueSteps.includes(s));
    
    if (missingSteps.length === 0) {
      console.log(`   ✅ All expected steps tracked`);
    } else {
      console.log(`   ⚠️  Missing steps: ${missingSteps.join(', ')}`);
    }

    // Check if progress reached 100%
    if (maxProgress === 100) {
      console.log(`   ✅ Progress reached 100%`);
    } else {
      console.log(`   ⚠️  Progress only reached ${maxProgress}%`);
    }

    // Check if data was collected
    if (results.metrics.totalTransactions > 0) {
      console.log(`   ✅ Data collection working`);
    } else {
      console.log(`   ⚠️  No transactions found`);
    }

    // Overall health status
    console.log(`\n${'='.repeat(60)}`);
    const isHealthy = 
      progressUpdates.length > 0 &&
      maxProgress === 100 &&
      missingSteps.length === 0 &&
      results.metrics.totalTransactions > 0;

    if (isHealthy) {
      console.log(`🟢 HEALTH STATUS: HEALTHY`);
      console.log(`✅ Progress updates working correctly`);
      console.log(`✅ All steps tracked`);
      console.log(`✅ Data collection successful`);
      console.log(`✅ Ready for production`);
    } else {
      console.log(`🟡 HEALTH STATUS: NEEDS ATTENTION`);
      if (progressUpdates.length === 0) console.log(`⚠️  No progress updates received`);
      if (maxProgress !== 100) console.log(`⚠️  Progress didn't reach 100%`);
      if (missingSteps.length > 0) console.log(`⚠️  Missing steps: ${missingSteps.join(', ')}`);
      if (results.metrics.totalTransactions === 0) console.log(`⚠️  No data collected`);
    }
    console.log(`${'='.repeat(60)}\n`);

    await fetcher.close();

  } catch (error) {
    console.error(`\n❌ HEALTH CHECK FAILED:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}\n`);
    process.exit(1);
  }
}

healthCheckProgress();
