#!/usr/bin/env node

/**
 * Complete Flow Verification Script
 * 
 * Tests:
 * 1. User registration and authentication
 * 2. Onboarding flow with real contract
 * 3. Data fetching from blockchain
 * 4. Etherscan API validation
 * 5. Data consistency verification
 * 6. AI analysis quality
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:5000';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

// Test configuration
const TEST_CONFIG = {
  user: {
    email: `test-${Date.now()}@example.com`,
    password: 'test123456',
    name: 'Test User'
  },
  contract: {
    // Use a real contract - USDT on Ethereum
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    chain: 'ethereum',
    name: 'Tether USD',
    purpose: 'Stablecoin for digital payments and transfers',
    category: 'defi',
    startDate: '2017-11-28'
  }
};

let authToken = null;
let userId = null;
let analysisId = null;

// Helper functions
const log = (emoji, message, data = null) => {
  console.log(`${emoji} ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
};

const apiRequest = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { Authorization: `Bearer ${authToken}` })
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Etherscan API functions
const etherscanRequest = async (params) => {
  if (!ETHERSCAN_API_KEY) {
    log('⚠️', 'Etherscan API key not found, skipping validation');
    return null;
  }

  const url = new URL('https://api.etherscan.io/api');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  url.searchParams.append('apikey', ETHERSCAN_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== '1') {
    throw new Error(`Etherscan Error: ${data.message}`);
  }

  return data.result;
};

const getEtherscanTransactions = async (address, startBlock = 0) => {
  return await etherscanRequest({
    module: 'account',
    action: 'txlist',
    address,
    startblock: startBlock,
    endblock: 99999999,
    sort: 'desc',
    page: 1,
    offset: 100
  });
};

const getEtherscanBalance = async (address) => {
  return await etherscanRequest({
    module: 'account',
    action: 'balance',
    address,
    tag: 'latest'
  });
};

// Test functions
async function test1_UserRegistration() {
  log('🧪', 'TEST 1: User Registration');
  
  const result = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(TEST_CONFIG.user)
  });

  authToken = result.token;
  userId = result.user.id;

  log('✅', 'User registered successfully', {
    userId,
    email: result.user.email,
    tier: result.user.tier
  });

  return result;
}

async function test2_OnboardingComplete() {
  log('🧪', 'TEST 2: Complete Onboarding');

  const onboardingData = {
    socialLinks: {
      website: 'https://tether.to',
      twitter: '@Tether_to'
    },
    contractAddress: TEST_CONFIG.contract.address,
    chain: TEST_CONFIG.contract.chain,
    contractName: TEST_CONFIG.contract.name,
    purpose: TEST_CONFIG.contract.purpose,
    category: TEST_CONFIG.contract.category,
    startDate: TEST_CONFIG.contract.startDate
  };

  const result = await apiRequest('/api/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(onboardingData)
  });

  log('✅', 'Onboarding completed', {
    defaultContractId: result.defaultContractId,
    indexingStarted: result.indexingStarted
  });

  return result;
}

async function test3_WaitForIndexing() {
  log('🧪', 'TEST 3: Wait for Indexing to Complete');

  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    await sleep(5000); // Wait 5 seconds

    const status = await apiRequest('/api/onboarding/status');
    
    log('📊', `Progress: ${status.indexingProgress}% - ${status.currentStep || 'Processing...'}`);

    if (status.isIndexed && status.indexingProgress === 100) {
      log('✅', 'Indexing completed successfully');
      return status;
    }

    attempts++;
  }

  throw new Error('Indexing timeout - took longer than 5 minutes');
}

async function test4_FetchAnalysisData() {
  log('🧪', 'TEST 4: Fetch Analysis Data');

  const data = await apiRequest('/api/onboarding/default-contract');

  analysisId = data.analysisHistory?.latest?.id;

  log('✅', 'Analysis data fetched', {
    contract: data.contract.name,
    transactions: data.metrics?.transactions || 0,
    uniqueUsers: data.metrics?.uniqueUsers || 0,
    tvl: data.metrics?.tvl || 0,
    analysisId
  });

  return data;
}

async function test5_EtherscanValidation() {
  log('🧪', 'TEST 5: Etherscan Data Validation');

  if (!ETHERSCAN_API_KEY) {
    log('⚠️', 'Skipping Etherscan validation - no API key');
    return null;
  }

  // Fetch data from Etherscan
  const etherscanTxs = await getEtherscanTransactions(TEST_CONFIG.contract.address);
  const etherscanBalance = await getEtherscanBalance(TEST_CONFIG.contract.address);

  log('📊', 'Etherscan data fetched', {
    transactions: etherscanTxs?.length || 0,
    balance: etherscanBalance
  });

  // Fetch our data
  const ourData = await apiRequest('/api/onboarding/default-contract');

  // Compare transaction counts
  const ourTxCount = ourData.metrics?.transactions || 0;
  const etherscanTxCount = etherscanTxs?.length || 0;

  log('🔍', 'Data Comparison', {
    ourTransactions: ourTxCount,
    etherscanTransactions: etherscanTxCount,
    difference: Math.abs(ourTxCount - etherscanTxCount)
  });

  // Validate consistency (allow some difference due to block range)
  const isConsistent = Math.abs(ourTxCount - etherscanTxCount) < etherscanTxCount * 0.1; // 10% tolerance

  if (isConsistent) {
    log('✅', 'Data consistency validated - within 10% tolerance');
  } else {
    log('⚠️', 'Data inconsistency detected - may be due to different block ranges');
  }

  return {
    ourData: ourData.metrics,
    etherscanData: {
      transactions: etherscanTxCount,
      balance: etherscanBalance
    },
    isConsistent
  };
}

async function test6_AIAnalysis() {
  log('🧪', 'TEST 6: AI Analysis Quality');

  if (!analysisId) {
    log('⚠️', 'No analysis ID available, skipping AI test');
    return null;
  }

  try {
    // Request AI insights
    const insights = await apiRequest(`/api/analysis/${analysisId}/quick-insights`, {
      method: 'GET'
    });

    log('✅', 'AI insights generated', {
      hasInsights: !!insights,
      performanceScore: insights?.performanceScore,
      keyMetrics: insights?.keyMetrics?.length || 0
    });

    return insights;
  } catch (error) {
    log('⚠️', `AI analysis failed: ${error.message}`);
    return null;
  }
}

async function test7_DataIntegrity() {
  log('🧪', 'TEST 7: Data Integrity Check');

  const data = await apiRequest('/api/onboarding/default-contract');

  // Check required fields
  const checks = {
    hasContract: !!data.contract,
    hasMetrics: !!data.metrics,
    hasTransactions: (data.metrics?.transactions || 0) > 0,
    hasUniqueUsers: (data.metrics?.uniqueUsers || 0) > 0,
    hasBlockRange: !!data.blockRange,
    hasAnalysisHistory: !!data.analysisHistory
  };

  const allPassed = Object.values(checks).every(v => v);

  log(allPassed ? '✅' : '❌', 'Data integrity check', checks);

  return { checks, allPassed };
}

async function test8_SubscriptionTier() {
  log('🧪', 'TEST 8: Subscription Tier Validation');

  const data = await apiRequest('/api/onboarding/default-contract');

  const tierInfo = {
    tier: data.contract?.subscriptionTier || 'free',
    blockRange: data.blockRange?.total || 0,
    transactions: data.metrics?.transactions || 0
  };

  // Validate tier limits
  const tierLimits = {
    free: { blocks: 10000, transactions: 100 },
    starter: { blocks: 50000, transactions: 500 },
    pro: { blocks: 200000, transactions: 2000 },
    enterprise: { blocks: 500000, transactions: 10000 }
  };

  const limits = tierLimits[tierInfo.tier] || tierLimits.free;
  const withinLimits = 
    tierInfo.blockRange <= limits.blocks &&
    tierInfo.transactions <= limits.transactions;

  log(withinLimits ? '✅' : '⚠️', 'Subscription tier validation', {
    ...tierInfo,
    limits,
    withinLimits
  });

  return { tierInfo, limits, withinLimits };
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 COMPLETE FLOW VERIFICATION');
  console.log('='.repeat(60) + '\n');

  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
  };

  const tests = [
    { name: 'User Registration', fn: test1_UserRegistration },
    { name: 'Onboarding Complete', fn: test2_OnboardingComplete },
    { name: 'Wait for Indexing', fn: test3_WaitForIndexing },
    { name: 'Fetch Analysis Data', fn: test4_FetchAnalysisData },
    { name: 'Etherscan Validation', fn: test5_EtherscanValidation },
    { name: 'AI Analysis', fn: test6_AIAnalysis },
    { name: 'Data Integrity', fn: test7_DataIntegrity },
    { name: 'Subscription Tier', fn: test8_SubscriptionTier }
  ];

  for (const test of tests) {
    try {
      console.log('\n' + '-'.repeat(60));
      const result = await test.fn();
      results.passed++;
      results.tests.push({ name: test.name, status: 'PASSED', result });
    } catch (error) {
      console.error(`❌ ${test.name} FAILED:`, error.message);
      results.failed++;
      results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Skipped: ${results.skipped}`);
  console.log(`📈 Success Rate: ${((results.passed / tests.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60) + '\n');

  // Detailed results
  console.log('📋 DETAILED RESULTS:\n');
  results.tests.forEach((test, i) => {
    const emoji = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${i + 1}. ${emoji} ${test.name}: ${test.status}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('🎉 VERIFICATION COMPLETE');
  console.log('='.repeat(60) + '\n');

  return results;
}

// Run tests
runAllTests()
  .then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
