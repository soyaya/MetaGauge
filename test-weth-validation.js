#!/usr/bin/env node

/**
 * WETH Contract Data Validation Test
 * 
 * Tests with Wrapped Ether (WETH) contract:
 * 1. Creates user and onboards with WETH contract + ABI
 * 2. Monitors indexing process in real-time
 * 3. Fetches data from our system
 * 4. Fetches same data from Etherscan API
 * 5. Compares and validates accuracy
 */

import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/api';

// WETH Contract with ABI
const WETH_CONTRACT = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  chain: 'ethereum',
  name: 'Wrapped Ether (WETH)',
  purpose: 'ERC20 wrapper for ETH - testing data accuracy',
  category: 'defi',
  startDate: '2017-12-18',
  abi: JSON.stringify([{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"guy","type":"address"},{"name":"wad","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"src","type":"address"},{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"guy","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"}])
};

const TEST_USER = {
  email: `wethtest-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'WETH Test User',
  walletAddress: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
};

let authToken = null;
let userId = null;

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logProgress(message) {
  log(`⏳ ${message}`, 'cyan');
}

function logData(message) {
  log(`📊 ${message}`, 'magenta');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Step 1: Register and login user
 */
async function setupUser() {
  logSection('STEP 1: USER SETUP');
  
  try {
    logInfo(`Registering user: ${TEST_USER.email}`);
    const registerResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, TEST_USER);
    
    authToken = registerResponse.data.token;
    userId = registerResponse.data.user.id;
    
    logSuccess('User registered successfully');
    logInfo(`User ID: ${userId}`);
    logInfo(`Tier: ${registerResponse.data.user.tier}`);
    
    return true;
  } catch (error) {
    logError(`User setup failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Step 2: Onboard with WETH contract
 */
async function onboardContract() {
  logSection('STEP 2: CONTRACT ONBOARDING WITH ABI');
  
  try {
    logInfo(`Contract: ${WETH_CONTRACT.name}`);
    logInfo(`Address: ${WETH_CONTRACT.address}`);
    logInfo(`Chain: ${WETH_CONTRACT.chain}`);
    logInfo(`ABI: Provided (${JSON.parse(WETH_CONTRACT.abi).length} functions/events)`);
    
    const response = await axios.post(
      `${API_BASE_URL}/api/onboarding/complete`,
      {
        contractAddress: WETH_CONTRACT.address,
        chain: WETH_CONTRACT.chain,
        contractName: WETH_CONTRACT.name,
        purpose: WETH_CONTRACT.purpose,
        category: WETH_CONTRACT.category,
        startDate: WETH_CONTRACT.startDate,
        abi: WETH_CONTRACT.abi
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    logSuccess('Onboarding completed with ABI!');
    
    if (response.data.indexingStarted) {
      logSuccess('✨ Automatic indexing started!');
    }
    
    return true;
  } catch (error) {
    logError(`Onboarding failed: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Step 3: Monitor indexing progress
 */
async function monitorIndexing() {
  logSection('STEP 3: MONITORING INDEXING PROCESS');
  
  logProgress('Watching indexing progress in real-time...');
  console.log('─'.repeat(80));
  
  let attempts = 0;
  const maxAttempts = 60; // 10 minutes max
  let isIndexed = false;
  let lastProgress = -1;
  
  while (attempts < maxAttempts && !isIndexed) {
    attempts++;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/onboarding/status`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      const progress = response.data.indexingProgress || 0;
      isIndexed = response.data.isIndexed || false;
      const currentStep = response.data.currentStep || '';
      
      // Log progress changes
      if (progress !== lastProgress || currentStep) {
        const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        const stepInfo = currentStep ? ` | ${currentStep}` : '';
        logProgress(`[${attempts}] Progress: [${progressBar}] ${progress}%${stepInfo}`);
        lastProgress = progress;
      }
      
      if (isIndexed) {
        console.log('─'.repeat(80));
        logSuccess(`Indexing complete! (${progress}%)`);
        return true;
      }
      
      await wait(10000); // Check every 10 seconds
      
    } catch (error) {
      logError(`[${attempts}] Monitoring error: ${error.message}`);
    }
  }
  
  if (!isIndexed) {
    console.log('─'.repeat(80));
    logWarning(`Indexing not complete after ${maxAttempts} attempts (${lastProgress}%)`);
    logInfo('Continuing with available data...');
  }
  
  return isIndexed;
}

/**
 * Step 4: Fetch data from our system
 */
async function fetchOurData() {
  logSection('STEP 4: FETCHING DATA FROM OUR SYSTEM');
  
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/onboarding/default-contract`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    logSuccess('Data fetched from our system');
    
    const contract = response.data.contract || {};
    const metrics = response.data.metrics || {};
    const analysisHistory = response.data.analysisHistory || {};
    
    logData('Our System Data:');
    console.log('─'.repeat(80));
    console.log(`Contract: ${contract.name}`);
    console.log(`Address: ${contract.address}`);
    console.log(`Indexed: ${contract.isIndexed}`);
    console.log(`Progress: ${contract.indexingProgress}%`);
    console.log(`\nAnalysis History:`);
    console.log(`  Total: ${analysisHistory.total || 0}`);
    console.log(`  Completed: ${analysisHistory.completed || 0}`);
    
    if (metrics && Object.keys(metrics).length > 0) {
      console.log(`\nMetrics:`);
      console.log(`  Transactions: ${metrics.transactions || metrics.totalTransactions || 0}`);
      console.log(`  Unique Users: ${metrics.uniqueUsers || 0}`);
      console.log(`  Total Value: ${metrics.totalValue || metrics.volume || 0}`);
      console.log(`  Success Rate: ${metrics.successRate || 0}%`);
      console.log(`  Avg Gas: ${metrics.avgGasUsed || metrics.avgGasCost || 0}`);
    } else {
      logWarning('  No metrics available yet');
    }
    
    if (response.data.analysisError) {
      logError(`\nAnalysis Error: ${response.data.analysisError}`);
    }
    
    console.log('─'.repeat(80));
    
    return { contract, metrics, analysisHistory };
  } catch (error) {
    logError(`Failed to fetch our data: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Step 5: Fetch data from Etherscan
 */
async function fetchEtherscanData() {
  logSection('STEP 5: FETCHING DATA FROM ETHERSCAN');
  
  if (!ETHERSCAN_API_KEY) {
    logWarning('Etherscan API key not configured!');
    logInfo('Set ETHERSCAN_API_KEY in .env file');
    return null;
  }
  
  try {
    logProgress('Fetching WETH transaction data from Etherscan...');
    
    // Get recent transactions (last 100)
    const txResponse = await axios.get(ETHERSCAN_BASE_URL, {
      params: {
        module: 'account',
        action: 'txlist',
        address: WETH_CONTRACT.address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 100,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY
      }
    });
    
    if (txResponse.data.status !== '1') {
      logError(`Etherscan API error: ${txResponse.data.message}`);
      return null;
    }
    
    const transactions = txResponse.data.result;
    logSuccess(`Fetched ${transactions.length} transactions from Etherscan`);
    
    // Calculate metrics
    const uniqueAddresses = new Set();
    let totalValue = 0;
    let totalGas = 0;
    let successCount = 0;
    
    transactions.forEach(tx => {
      uniqueAddresses.add(tx.from.toLowerCase());
      uniqueAddresses.add(tx.to.toLowerCase());
      totalValue += parseFloat(ethers.formatEther(tx.value));
      totalGas += parseFloat(ethers.formatEther(BigInt(tx.gasUsed) * BigInt(tx.gasPrice)));
      if (tx.isError === '0') successCount++;
    });
    
    const metrics = {
      totalTransactions: transactions.length,
      uniqueUsers: uniqueAddresses.size,
      totalValue,
      avgTransactionValue: totalValue / transactions.length,
      successRate: (successCount / transactions.length) * 100,
      avgGasCost: totalGas / transactions.length,
      transactions
    };
    
    logData('Etherscan Metrics (Last 100 transactions):');
    console.log('─'.repeat(80));
    console.log(`Total Transactions: ${metrics.totalTransactions}`);
    console.log(`Unique Addresses: ${metrics.uniqueUsers}`);
    console.log(`Total Value: ${metrics.totalValue.toFixed(4)} ETH`);
    console.log(`Avg Transaction Value: ${metrics.avgTransactionValue.toFixed(4)} ETH`);
    console.log(`Success Rate: ${metrics.successRate.toFixed(2)}%`);
    console.log(`Avg Gas Cost: ${metrics.avgGasCost.toFixed(6)} ETH`);
    console.log('─'.repeat(80));
    
    return metrics;
  } catch (error) {
    logError(`Etherscan API error: ${error.message}`);
    return null;
  }
}

/**
 * Step 6: Compare and validate
 */
function compareAndValidate(ourData, etherscanData) {
  logSection('STEP 6: DATA COMPARISON & VALIDATION');
  
  if (!ourData || !etherscanData) {
    logWarning('Cannot compare - missing data from one or both sources');
    return null;
  }
  
  const ourMetrics = ourData.metrics;
  
  if (!ourMetrics || Object.keys(ourMetrics).length === 0) {
    logWarning('Our system has no metrics yet - indexing may still be in progress');
    return null;
  }
  
  logInfo('Comparing our data with Etherscan ground truth...');
  console.log('\n' + '═'.repeat(80));
  log('DETAILED COMPARISON', 'bright');
  console.log('═'.repeat(80));
  
  // Transaction count
  const ourTxCount = ourMetrics.transactions || ourMetrics.totalTransactions || 0;
  const txDiff = Math.abs(ourTxCount - etherscanData.totalTransactions);
  const txMatch = txDiff <= 10;
  console.log(`\n📊 Transaction Count:`);
  console.log(`  Our System:   ${ourTxCount}`);
  console.log(`  Etherscan:    ${etherscanData.totalTransactions}`);
  console.log(`  Difference:   ${txDiff}`);
  console.log(`  Status:       ${txMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  // Unique users
  const ourUsers = ourMetrics.uniqueUsers || 0;
  const userDiff = Math.abs(ourUsers - etherscanData.uniqueUsers);
  const userMatch = userDiff <= 20;
  console.log(`\n👥 Unique Users:`);
  console.log(`  Our System:   ${ourUsers}`);
  console.log(`  Etherscan:    ${etherscanData.uniqueUsers}`);
  console.log(`  Difference:   ${userDiff}`);
  console.log(`  Status:       ${userMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  // Success rate
  const ourSuccess = parseFloat(ourMetrics.successRate || 0);
  const successDiff = Math.abs(ourSuccess - etherscanData.successRate);
  const successMatch = successDiff < 10;
  console.log(`\n✓ Success Rate (%):`);
  console.log(`  Our System:   ${ourSuccess.toFixed(2)}%`);
  console.log(`  Etherscan:    ${etherscanData.successRate.toFixed(2)}%`);
  console.log(`  Difference:   ${successDiff.toFixed(2)}%`);
  console.log(`  Status:       ${successMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n' + '═'.repeat(80));
  
  const allTests = [txMatch, userMatch, successMatch];
  const passedTests = allTests.filter(t => t).length;
  const totalTests = allTests.length;
  
  console.log(`\n📈 OVERALL ACCURACY: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    logSuccess('🎉 ALL TESTS PASSED! Data is accurate!');
  } else if (passedTests >= totalTests * 0.66) {
    logWarning(`⚠️  ${passedTests}/${totalTests} tests passed - Acceptable accuracy`);
  } else {
    logError(`❌ Only ${passedTests}/${totalTests} tests passed - Data accuracy issues`);
  }
  
  console.log('═'.repeat(80));
  
  return {
    passed: passedTests,
    total: totalTests,
    accuracy: (passedTests / totalTests) * 100
  };
}

/**
 * Main test runner
 */
async function runWethValidation() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║              WETH CONTRACT DATA VALIDATION TEST                               ║', 'bright');
  log('║                                                                               ║', 'bright');
  log('║  Testing with Wrapped Ether contract + ABI                                   ║', 'bright');
  log('║  Comparing our data with Etherscan API                                       ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════════════════════════╝', 'bright');
  console.log('\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Setup user
    const userSetup = await setupUser();
    if (!userSetup) process.exit(1);
    await wait(2000);
    
    // Step 2: Onboard with WETH + ABI
    const onboarded = await onboardContract();
    if (!onboarded) process.exit(1);
    await wait(3000);
    
    // Step 3: Monitor indexing
    logInfo('Monitoring indexing progress...');
    const indexed = await monitorIndexing();
    await wait(2000);
    
    // Step 4: Fetch our data
    const ourData = await fetchOurData();
    await wait(2000);
    
    // Step 5: Fetch Etherscan data
    const etherscanData = await fetchEtherscanData();
    await wait(2000);
    
    // Step 6: Compare and validate
    const results = compareAndValidate(ourData, etherscanData);
    
    // Final summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    logSection('TEST SUMMARY');
    
    console.log(`\n⏱️  Total Duration: ${duration} seconds`);
    console.log(`\n📧 Test User: ${TEST_USER.email}`);
    console.log(`🔑 Password: ${TEST_USER.password}`);
    console.log(`🆔 User ID: ${userId}`);
    console.log(`\n📝 Contract: ${WETH_CONTRACT.name}`);
    console.log(`📍 Address: ${WETH_CONTRACT.address}`);
    console.log(`⛓️  Chain: ${WETH_CONTRACT.chain}`);
    console.log(`📄 ABI: Provided`);
    console.log(`✅ Indexed: ${indexed ? 'Yes' : 'Partial'}`);
    
    if (results) {
      console.log(`\n✅ Tests Passed: ${results.passed}/${results.total}`);
      console.log(`📊 Accuracy: ${results.accuracy.toFixed(1)}%`);
    }
    
    console.log('\n💡 Next Steps:');
    console.log('─'.repeat(80));
    console.log('1. Login to frontend with credentials above');
    console.log('2. View WETH contract data in dashboard');
    console.log('3. Verify metrics match Etherscan');
    console.log('4. Test ABI-based event parsing');
    console.log('─'.repeat(80));
    
    logSuccess('\n🎉 WETH validation test completed!\n');
    
  } catch (error) {
    logError(`\nTest failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runWethValidation().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
