#!/usr/bin/env node

/**
 * Indexing Issue Diagnostic Script
 * Identifies exactly where the indexing flow breaks
 */

import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = 'http://localhost:5000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

console.log('\n' + '='.repeat(80));
log('INDEXING ISSUE DIAGNOSTIC', 'cyan');
console.log('='.repeat(80) + '\n');

// Test 1: Check RPC Connectivity
async function testRPCConnectivity() {
  log('\n📡 TEST 1: RPC Connectivity', 'cyan');
  console.log('-'.repeat(80));
  
  const rpcUrls = {
    ethereum: [
      process.env.ETHEREUM_RPC_URL1,
      process.env.ETHEREUM_RPC_URL2,
      process.env.ETHEREUM_RPC_URL3
    ].filter(Boolean),
    lisk: [
      process.env.LISK_RPC_URL1,
      process.env.LISK_RPC_URL2,
      process.env.LISK_RPC_URL3
    ].filter(Boolean)
  };
  
  for (const [chain, urls] of Object.entries(rpcUrls)) {
    log(`\n${chain.toUpperCase()}:`, 'blue');
    for (let i = 0; i < urls.length; i++) {
      try {
        const provider = new ethers.JsonRpcProvider(urls[i]);
        const blockNumber = await provider.getBlockNumber();
        log(`  ✅ URL ${i + 1}: ${urls[i].substring(0, 50)}... (Block: ${blockNumber})`, 'green');
      } catch (error) {
        log(`  ❌ URL ${i + 1}: ${urls[i].substring(0, 50)}... (Error: ${error.message})`, 'red');
      }
    }
  }
}

// Test 2: Check Backend Server
async function testBackendServer() {
  log('\n🖥️  TEST 2: Backend Server Health', 'cyan');
  console.log('-'.repeat(80));
  
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    log(`✅ Backend is running`, 'green');
    log(`   Status: ${response.data.status}`, 'blue');
    log(`   Storage: ${response.data.storage}`, 'blue');
    log(`   Environment: ${response.data.environment}`, 'blue');
  } catch (error) {
    log(`❌ Backend is NOT running`, 'red');
    log(`   Error: ${error.message}`, 'red');
    log(`   Please start: cd mvp-workspace/src/api && node server.js`, 'yellow');
    process.exit(1);
  }
}

// Test 3: Test Direct Indexing Trigger
async function testDirectIndexing() {
  log('\n🔧 TEST 3: Direct Indexing Trigger', 'cyan');
  console.log('-'.repeat(80));
  
  // First, create a test user
  const testUser = {
    email: `diagnostic-${Date.now()}@test.com`,
    password: 'Test123!',
    name: 'Diagnostic User'
  };
  
  try {
    log('\n1. Creating test user...', 'blue');
    const registerResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, testUser);
    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.id;
    log(`   ✅ User created: ${userId}`, 'green');
    
    log('\n2. Completing onboarding...', 'blue');
    const onboardingResponse = await axios.post(
      `${API_BASE_URL}/api/onboarding/complete`,
      {
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        chain: 'ethereum',
        contractName: 'USD Coin',
        purpose: 'Diagnostic test',
        category: 'defi',
        startDate: '2018-09-26'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    log(`   ✅ Onboarding complete`, 'green');
    log(`   Default contract ID: ${onboardingResponse.data.defaultContractId}`, 'blue');
    log(`   Indexing started: ${onboardingResponse.data.indexingStarted}`, 'blue');
    
    log('\n3. Waiting 5 seconds for indexing to start...', 'blue');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    log('\n4. Checking onboarding status...', 'blue');
    const statusResponse = await axios.get(
      `${API_BASE_URL}/api/onboarding/status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    log(`   Has default contract: ${statusResponse.data.hasDefaultContract}`, 'blue');
    log(`   Is indexed: ${statusResponse.data.isIndexed}`, 'blue');
    log(`   Progress: ${statusResponse.data.indexingProgress}%`, 'blue');
    
    if (statusResponse.data.indexingProgress === 0) {
      log(`   ❌ PROBLEM: Indexing progress is still 0%`, 'red');
    } else {
      log(`   ✅ Indexing has started!`, 'green');
    }
    
    log('\n5. Checking default contract data...', 'blue');
    const contractResponse = await axios.get(
      `${API_BASE_URL}/api/onboarding/default-contract`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const contract = contractResponse.data.contract;
    const analysisHistory = contractResponse.data.analysisHistory;
    
    log(`   Last analysis ID: ${contract.lastAnalysisId || 'NULL'}`, contract.lastAnalysisId ? 'green' : 'red');
    log(`   Total analyses: ${analysisHistory.total}`, 'blue');
    log(`   Completed analyses: ${analysisHistory.completed}`, 'blue');
    
    if (!contract.lastAnalysisId) {
      log(`   ❌ PROBLEM: No analysis record created!`, 'red');
      log(`   This means the indexing trigger never executed`, 'yellow');
    }
    
    if (analysisHistory.total === 0) {
      log(`   ❌ PROBLEM: No analysis records in database!`, 'red');
    }
    
    return { userId, token, contract, analysisHistory };
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'yellow');
    }
    return null;
  }
}

// Test 4: Check Backend Logs
async function checkBackendLogs() {
  log('\n📋 TEST 4: Backend Logs Analysis', 'cyan');
  console.log('-'.repeat(80));
  
  try {
    const { readFile } = await import('fs/promises');
    const logPath = 'mvp-workspace/logs/analytics.log';
    
    try {
      const logs = await readFile(logPath, 'utf-8');
      const lines = logs.split('\n').slice(-50); // Last 50 lines
      
      log('\nLast 50 log lines:', 'blue');
      console.log('-'.repeat(80));
      lines.forEach(line => {
        if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
          log(line, 'red');
        } else if (line.includes('indexing') || line.includes('Indexing')) {
          log(line, 'green');
        } else if (line.includes('warn') || line.includes('Warning')) {
          log(line, 'yellow');
        } else {
          console.log(line);
        }
      });
    } catch (error) {
      log(`⚠️  Log file not found: ${logPath}`, 'yellow');
      log(`   This is normal if logging is disabled`, 'blue');
    }
  } catch (error) {
    log(`⚠️  Could not read logs: ${error.message}`, 'yellow');
  }
}

// Test 5: Check Database Files
async function checkDatabaseFiles() {
  log('\n💾 TEST 5: Database Files Check', 'cyan');
  console.log('-'.repeat(80));
  
  try {
    const { readdir, stat } = await import('fs/promises');
    
    const dirs = ['users', 'contracts', 'analyses'];
    
    for (const dir of dirs) {
      const path = `mvp-workspace/data/${dir}`;
      try {
        const files = await readdir(path);
        log(`\n${dir.toUpperCase()}:`, 'blue');
        log(`  Total files: ${files.length}`, 'green');
        
        if (files.length > 0) {
          log(`  Recent files:`, 'blue');
          const recentFiles = files.slice(-5);
          for (const file of recentFiles) {
            const fileStat = await stat(`${path}/${file}`);
            log(`    - ${file} (${fileStat.size} bytes, ${fileStat.mtime.toISOString()})`, 'green');
          }
        }
      } catch (error) {
        log(`  ❌ Directory not found: ${path}`, 'red');
      }
    }
  } catch (error) {
    log(`⚠️  Could not check database files: ${error.message}`, 'yellow');
  }
}

// Test 6: Test RPC Data Fetching
async function testRPCDataFetching() {
  log('\n📊 TEST 6: RPC Data Fetching Test', 'cyan');
  console.log('-'.repeat(80));
  
  const testContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC
  const rpcUrl = process.env.ETHEREUM_RPC_URL1;
  
  try {
    log(`\nTesting with contract: ${testContract}`, 'blue');
    log(`Using RPC: ${rpcUrl}`, 'blue');
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    log('\n1. Getting current block...', 'blue');
    const currentBlock = await provider.getBlockNumber();
    log(`   ✅ Current block: ${currentBlock}`, 'green');
    
    log('\n2. Fetching logs (last 1000 blocks)...', 'blue');
    const fromBlock = currentBlock - 1000;
    const toBlock = currentBlock;
    
    const logs = await provider.getLogs({
      address: testContract,
      fromBlock,
      toBlock
    });
    
    log(`   ✅ Found ${logs.length} events`, 'green');
    
    if (logs.length > 0) {
      log(`   Sample event:`, 'blue');
      log(`     Block: ${logs[0].blockNumber}`, 'green');
      log(`     Transaction: ${logs[0].transactionHash}`, 'green');
      log(`     Topics: ${logs[0].topics.length}`, 'green');
    }
    
    log('\n3. Testing transaction fetch...', 'blue');
    if (logs.length > 0) {
      const tx = await provider.getTransaction(logs[0].transactionHash);
      log(`   ✅ Transaction fetched successfully`, 'green');
      log(`     From: ${tx.from}`, 'green');
      log(`     To: ${tx.to}`, 'green');
      log(`     Value: ${ethers.formatEther(tx.value)} ETH`, 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ RPC data fetching failed: ${error.message}`, 'red');
    return false;
  }
}

// Main diagnostic runner
async function runDiagnostics() {
  try {
    await testBackendServer();
    await testRPCConnectivity();
    await testRPCDataFetching();
    const testResult = await testDirectIndexing();
    await checkDatabaseFiles();
    await checkBackendLogs();
    
    // Summary
    log('\n' + '='.repeat(80), 'cyan');
    log('DIAGNOSTIC SUMMARY', 'cyan');
    log('='.repeat(80), 'cyan');
    
    if (testResult && testResult.contract.lastAnalysisId) {
      log('\n✅ INDEXING IS WORKING!', 'green');
      log('   Analysis record was created successfully', 'green');
    } else {
      log('\n❌ INDEXING IS NOT WORKING!', 'red');
      log('\nPossible causes:', 'yellow');
      log('  1. Background task (setImmediate) not executing', 'yellow');
      log('  2. Error in trigger-indexing.js not being caught', 'yellow');
      log('  3. RPC connection failing during indexing', 'yellow');
      log('  4. Analysis record creation failing', 'yellow');
      log('\nRecommended actions:', 'blue');
      log('  1. Check backend console for errors', 'blue');
      log('  2. Add console.log to trigger-indexing.js', 'blue');
      log('  3. Test trigger-indexing.js directly', 'blue');
      log('  4. Check if setImmediate callback executes', 'blue');
    }
    
    log('\n' + '='.repeat(80) + '\n', 'cyan');
    
  } catch (error) {
    log(`\n❌ Diagnostic failed: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run diagnostics
runDiagnostics().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
