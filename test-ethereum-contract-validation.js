#!/usr/bin/env node

/**
 * Ethereum Contract Data Validation Test
 * 
 * This test:
 * 1. Creates a user and onboards with an Ethereum contract
 * 2. Observes the indexing process in real-time
 * 3. Fetches data from our system
 * 4. Fetches the same data from Etherscan API
 * 5. Compares results to validate data accuracy
 */

import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/api';

// Test with USDC on Ethereum - high activity, well-known contract
const TEST_CONTRACT = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  chain: 'ethereum',
  name: 'USD Coin (USDC)',
  purpose: 'Stablecoin for testing data accuracy',
  category: 'defi',
  startDate: '2018-09-26'
};

const TEST_USER = {
  email: `ethtest-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Ethereum Test User',
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
    // Register
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
 * Step 2: Onboard with Ethereum contract
 */
async function onboardContract() {
  logSection('STEP 2: CONTRACT ONBOARDING');
  
  try {
    logInfo(`Contract: ${TEST_CONTRACT.name}`);
    logInfo(`Address: ${TEST_CONTRACT.address}`);
    logInfo(`Chain: ${TEST_CONTRACT.chain}`);
    
    const response = await axios.post(
      `${API_BASE_URL}/api/onboarding/complete`,
      {
        contractAddress: TEST_CONTRACT.address,
        chain: TEST_CONTRACT.chain,
        contractName: TEST_CONTRACT.name,
        purpose: TEST_CONTRACT.purpose,
        category: TEST_CONTRACT.category,
        startDate: TEST_CONTRACT.startDate
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    logSuccess('Onboarding completed!');
    
    if (response.data.indexingStarted) {
      logSuccess('✨ Automatic indexing started!');
    }
    
    return true;
  } catch (error) {
    logError(`Onboarding failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Step 3: Monitor indexing progress in real-time
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
      
      // Only log when progress changes
      if (progress !== lastProgress) {
        const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        logProgress(`Progress: [${progressBar}] ${progress}%`);
        lastProgress = progress;
      }
      
      if (isIndexed) {
        console.log('─'.repeat(80));
        logSuccess(`Indexing complete! (${progress}%)`);
        return true;
      }
      
      await wait(10000); // Check every 10 seconds
      
    } catch (error) {
      logError(`Monitoring error: ${error.message}`);
    }
  }
  
  if (!isIndexed) {
    console.log('─'.repeat(80));
    logWarning(`Indexing not complete after ${maxAttempts} attempts (${lastProgress}%)`);
    logInfo('Continuing with partial data...');
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
    
    const metrics = response.data.metrics || {};
    
    logData('Our System Metrics:');
    console.log('─'.repeat(80));
    console.log(`Total Transactions: ${metrics.totalTransactions || 0}`);
    console.log(`Unique Users: ${metrics.uniqueUsers || 0}`);
    console.log(`Total Value: ${metrics.totalValue?.toFixed(4) || 0} ETH`);
    console.log(`Avg Transaction Value: ${metrics.avgTransactionValue?.toFixed(4) || 0} ETH`);
    console.log(`Success Rate: ${metrics.successRate?.toFixed(2) || 0}%`);
    console.log(`Avg Gas Cost: ${metrics.avgGasCost?.toFixed(6) || 0} ETH`);
    console.log('─'.repeat(80));
    
    return metrics;
  } catch (error) {
    logError(`Failed to fetch our data: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Step 5: Fetch data from Etherscan API
 */
async function fetchEtherscanData() {
  logSection('STEP 5: FETCHING DATA FROM ETHERSCAN');
  
  if (!ETHERSCAN_API_KEY) {
    logWarning('Etherscan API key not configured!');
    logInfo('Set ETHERSCAN_API_KEY in .env file to enable comparison');
    return null;
  }
  
  try {
    logProgress('Fetching transaction data from Etherscan...');
    
    // Get recent transactions (last 100)
    const txResponse = await axios.get(ETHERSCAN_BASE_URL, {
      params: {
        module: 'account',
        action: 'txlist',
        address: TEST_CONTRACT.address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 100,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY
      }
    });
    
    if (txResponse.data.status !== '1') {
      logError('Etherscan API error');
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
 * Step 6: Compare data and validate accuracy
 */
function compareAndValidate(ourData, etherscanData) {
  logSection('STEP 6: DATA COMPARISON & VALIDATION');
  
  if (!ourData || !etherscanData) {
    logWarning('Cannot compare - missing data from one or both sources');
    return;
  }
  
  logInfo('Comparing our data with Etherscan ground truth...');
  console.log('\n' + '═'.repeat(80));
  log('DETAILED COMPARISON', 'bright');
  console.log('═'.repeat(80));
  
  // Transaction count
  const txDiff = Math.abs(ourData.totalTransactions - etherscanData.totalTransactions);
  const txMatch = txDiff <= 10; // Allow small variance due to timing
  console.log(`\n📊 Transaction Count:`);
  console.log(`  Our System:   ${ourData.totalTransactions || 0}`);
  console.log(`  Etherscan:    ${etherscanData.totalTransactions}`);
  console.log(`  Difference:   ${txDiff}`);
  console.log(`  Status:       ${txMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  // Unique users
  const userDiff = Math.abs(ourData.uniqueUsers - etherscanData.uniqueUsers);
  const userMatch = userDiff <= 20; // Allow variance
  console.log(`\n👥 Unique Users:`);
  console.log(`  Our System:   ${ourData.uniqueUsers || 0}`);
  console.log(`  Etherscan:    ${etherscanData.uniqueUsers}`);
  console.log(`  Difference:   ${userDiff}`);
  console.log(`  Status:       ${userMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  // Total value
  const valueDiff = Math.abs(ourData.totalValue - etherscanData.totalValue);
  const valueMatch = valueDiff < 1; // Allow 1 ETH variance
  console.log(`\n💰 Total Value (ETH):`);
  console.log(`  Our System:   ${ourData.totalValue?.toFixed(4) || 0}`);
  console.log(`  Etherscan:    ${etherscanData.totalValue.toFixed(4)}`);
  console.log(`  Difference:   ${valueDiff.toFixed(4)}`);
  console.log(`  Status:       ${valueMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  // Success rate
  const successDiff = Math.abs(ourData.successRate - etherscanData.successRate);
  const successMatch = successDiff < 10; // Allow 10% variance
  console.log(`\n✓ Success Rate (%):`);
  console.log(`  Our System:   ${ourData.successRate?.toFixed(2) || 0}%`);
  console.log(`  Etherscan:    ${etherscanData.successRate.toFixed(2)}%`);
  console.log(`  Difference:   ${successDiff.toFixed(2)}%`);
  console.log(`  Status:       ${successMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  // Gas cost
  const gasDiff = Math.abs(ourData.avgGasCost - etherscanData.avgGasCost);
  const gasMatch = gasDiff < 0.001; // Allow small variance
  console.log(`\n⛽ Avg Gas Cost (ETH):`);
  console.log(`  Our System:   ${ourData.avgGasCost?.toFixed(6) || 0}`);
  console.log(`  Etherscan:    ${etherscanData.avgGasCost.toFixed(6)}`);
  console.log(`  Difference:   ${gasDiff.toFixed(6)}`);
  console.log(`  Status:       ${gasMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n' + '═'.repeat(80));
  
  // Overall assessment
  const allTests = [txMatch, userMatch, valueMatch, successMatch, gasMatch];
  const passedTests = allTests.filter(t => t).length;
  const totalTests = allTests.length;
  
  console.log(`\n📈 OVERALL ACCURACY: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    logSuccess('🎉 ALL TESTS PASSED! Data is accurate!');
  } else if (passedTests >= totalTests * 0.8) {
    logWarning(`⚠️  ${passedTests}/${totalTests} tests passed - Good accuracy with minor variances`);
  } else {
    logError(`❌ Only ${passedTests}/${totalTests} tests passed - Data accuracy issues detected`);
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
async function runValidationTest() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║           ETHEREUM CONTRACT DATA VALIDATION TEST                              ║', 'bright');
  log('║                                                                               ║', 'bright');
  log('║  Testing data accuracy by comparing with Etherscan API                       ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════════════════════════╝', 'bright');
  console.log('\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Setup user
    const userSetup = await setupUser();
    if (!userSetup) process.exit(1);
    await wait(2000);
    
    // Step 2: Onboard contract
    const onboarded = await onboardContract();
    if (!onboarded) process.exit(1);
    await wait(3000);
    
    // Step 3: Monitor indexing
    logInfo('Waiting for indexing to complete...');
    await monitorIndexing();
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
    console.log(`\n📝 Contract: ${TEST_CONTRACT.name}`);
    console.log(`📍 Address: ${TEST_CONTRACT.address}`);
    console.log(`⛓️  Chain: ${TEST_CONTRACT.chain}`);
    
    if (results) {
      console.log(`\n✅ Tests Passed: ${results.passed}/${results.total}`);
      console.log(`📊 Accuracy: ${results.accuracy.toFixed(1)}%`);
    }
    
    console.log('\n💡 Next Steps:');
    console.log('─'.repeat(80));
    console.log('1. Login to frontend with the credentials above');
    console.log('2. View the indexed contract data in the dashboard');
    console.log('3. Compare metrics with Etherscan manually');
    console.log('4. Test other features (analytics, charts, AI insights)');
    console.log('─'.repeat(80));
    
    logSuccess('\n🎉 Validation test completed!\n');
    
  } catch (error) {
    logError(`\nTest failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runValidationTest().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
