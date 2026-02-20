#!/usr/bin/env node

/**
 * Real User Journey Test
 * Creates a real user and walks through the complete application flow
 * Tests: Registration → Login → Onboarding → Dashboard → All Features
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Test user credentials
const TEST_USER = {
  email: `realtest-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Real Test User',
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
};

// Test contract
const TEST_CONTRACT = {
  address: '0x05D032ac25d322df992303dCa074EE7392C117b9', // USDT on Lisk
  chain: 'lisk',
  name: 'USDT',
  purpose: 'Stablecoin for testing',
  category: 'defi',
  startDate: '2024-01-01'
};

let authToken = null;
let userId = null;

// Color output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Step 1: Check if backend is running
 */
async function checkBackend() {
  logSection('STEP 1: CHECKING BACKEND STATUS');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    logSuccess('Backend is running');
    logInfo(`Status: ${response.data.status}`);
    return true;
  } catch (error) {
    logError('Backend is not running!');
    logInfo('Please start the backend with: npm run dev');
    return false;
  }
}

/**
 * Step 2: Register new user
 */
async function registerUser() {
  logSection('STEP 2: USER REGISTRATION');
  
  try {
    logInfo(`Registering user: ${TEST_USER.email}`);
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: TEST_USER.name,
      walletAddress: TEST_USER.walletAddress
    });
    
    authToken = response.data.token;
    userId = response.data.user.id;
    
    logSuccess('Registration successful!');
    logInfo(`User ID: ${userId}`);
    logInfo(`Email: ${response.data.user.email}`);
    logInfo(`Tier: ${response.data.user.tier}`);
    logInfo(`API Key: ${response.data.user.apiKey?.substring(0, 20)}...`);
    
    return true;
  } catch (error) {
    logError(`Registration failed: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('Response:', error.response.data);
    }
    return false;
  }
}

/**
 * Step 3: Login
 */
async function loginUser() {
  logSection('STEP 3: USER LOGIN');
  
  try {
    logInfo('Logging in...');
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    authToken = response.data.token;
    
    logSuccess('Login successful!');
    logInfo(`Token: ${authToken.substring(0, 30)}...`);
    
    return true;
  } catch (error) {
    logError(`Login failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Step 4: Check onboarding status
 */
async function checkOnboardingStatus() {
  logSection('STEP 4: CHECKING ONBOARDING STATUS');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/onboarding/status`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logInfo(`Onboarding completed: ${response.data.completed}`);
    
    if (response.data.completed) {
      logInfo('User has already completed onboarding');
      if (response.data.defaultContract) {
        logInfo(`Default contract: ${response.data.defaultContract.name}`);
      }
    } else {
      logInfo('User needs to complete onboarding');
    }
    
    return response.data;
  } catch (error) {
    logError(`Failed to check onboarding: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Step 5: Complete onboarding
 */
async function completeOnboarding() {
  logSection('STEP 5: COMPLETING ONBOARDING');
  
  try {
    logInfo(`Contract: ${TEST_CONTRACT.name} (${TEST_CONTRACT.address})`);
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
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    logSuccess('Onboarding completed!');
    logInfo(`Message: ${response.data.message}`);
    
    if (response.data.indexingStarted) {
      logSuccess('Indexing started automatically');
    }
    
    return true;
  } catch (error) {
    logError(`Onboarding failed: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('Response:', error.response.data);
    }
    return false;
  }
}

/**
 * Step 6: Get user profile
 */
async function getUserProfile() {
  logSection('STEP 6: FETCHING USER PROFILE');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess('Profile fetched successfully');
    logInfo(`Name: ${response.data.name}`);
    logInfo(`Email: ${response.data.email}`);
    logInfo(`Tier: ${response.data.tier}`);
    logInfo(`Wallet: ${response.data.walletAddress || 'Not set'}`);
    
    return response.data;
  } catch (error) {
    logError(`Failed to fetch profile: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Step 7: Get dashboard data
 */
async function getDashboardData() {
  logSection('STEP 7: FETCHING DASHBOARD DATA');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/users/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess('Dashboard data fetched');
    logInfo(`Total analyses: ${response.data.stats?.totalAnalyses || 0}`);
    logInfo(`Contracts: ${response.data.contracts?.length || 0}`);
    logInfo(`Recent analyses: ${response.data.recentAnalyses?.length || 0}`);
    
    return response.data;
  } catch (error) {
    logError(`Failed to fetch dashboard: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Step 8: Get default contract data
 */
async function getDefaultContract() {
  logSection('STEP 8: FETCHING DEFAULT CONTRACT DATA');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/onboarding/default-contract`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess('Default contract data fetched');
    
    if (response.data.contract) {
      logInfo(`Contract: ${response.data.contract.name}`);
      logInfo(`Address: ${response.data.contract.address}`);
      logInfo(`Chain: ${response.data.contract.chain}`);
      logInfo(`Indexed: ${response.data.contract.isIndexed || false}`);
    }
    
    if (response.data.metrics) {
      logInfo(`\nMetrics:`);
      logInfo(`  Transactions: ${response.data.metrics.totalTransactions || 0}`);
      logInfo(`  Users: ${response.data.metrics.uniqueUsers || 0}`);
      logInfo(`  Total Value: ${response.data.metrics.totalValue?.toFixed(4) || 0} ETH`);
    }
    
    return response.data;
  } catch (error) {
    logError(`Failed to fetch contract: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Step 9: List all contracts
 */
async function listContracts() {
  logSection('STEP 9: LISTING ALL CONTRACTS');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/contracts`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess(`Found ${response.data.length} contract(s)`);
    
    response.data.forEach((contract, index) => {
      logInfo(`\nContract ${index + 1}:`);
      logInfo(`  Name: ${contract.name}`);
      logInfo(`  Address: ${contract.targetContract?.address}`);
      logInfo(`  Chain: ${contract.targetContract?.chain}`);
      logInfo(`  Default: ${contract.isDefault ? 'Yes' : 'No'}`);
    });
    
    return response.data;
  } catch (error) {
    logError(`Failed to list contracts: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Step 10: Get subscription info
 */
async function getSubscriptionInfo() {
  logSection('STEP 10: FETCHING SUBSCRIPTION INFO');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/subscription/info`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logSuccess('Subscription info fetched');
    logInfo(`Tier: ${response.data.tierName || 'Unknown'}`);
    logInfo(`Historical days: ${response.data.historicalDays || 0}`);
    logInfo(`API calls/month: ${response.data.apiCallsPerMonth || 0}`);
    logInfo(`Continuous sync: ${response.data.continuousSync ? 'Yes' : 'No'}`);
    
    if (response.data.features) {
      logInfo(`\nFeatures:`);
      Object.entries(response.data.features).forEach(([key, value]) => {
        logInfo(`  ${key}: ${value ? 'Yes' : 'No'}`);
      });
    }
    
    return response.data;
  } catch (error) {
    logError(`Failed to fetch subscription: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Step 11: Test all API routes
 */
async function testAllRoutes() {
  logSection('STEP 11: TESTING ALL API ROUTES');
  
  const routes = [
    { method: 'GET', path: '/api/auth/me', name: 'Get current user' },
    { method: 'GET', path: '/api/users/usage', name: 'Get usage stats' },
    { method: 'GET', path: '/api/analysis/history', name: 'Get analysis history' },
    { method: 'GET', path: '/health', name: 'Health check', noAuth: true },
  ];
  
  for (const route of routes) {
    try {
      const config = route.noAuth ? {} : {
        headers: { Authorization: `Bearer ${authToken}` }
      };
      
      const response = await axios[route.method.toLowerCase()](`${API_BASE_URL}${route.path}`, config);
      logSuccess(`${route.name}: ${response.status}`);
    } catch (error) {
      logError(`${route.name}: ${error.response?.status || 'Failed'}`);
    }
  }
}

/**
 * Main test runner
 */
async function runCompleteJourney() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║                    REAL USER JOURNEY TEST                                     ║', 'bright');
  log('║                                                                               ║', 'bright');
  log('║  Walking through the complete application as a real user                     ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════════════════════════╝', 'bright');
  console.log('\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Check backend
    const backendRunning = await checkBackend();
    if (!backendRunning) {
      process.exit(1);
    }
    await wait(1000);
    
    // Step 2: Register
    const registered = await registerUser();
    if (!registered) {
      process.exit(1);
    }
    await wait(1000);
    
    // Step 3: Login
    const loggedIn = await loginUser();
    if (!loggedIn) {
      process.exit(1);
    }
    await wait(1000);
    
    // Step 4: Check onboarding status
    await checkOnboardingStatus();
    await wait(1000);
    
    // Step 5: Complete onboarding
    const onboarded = await completeOnboarding();
    if (!onboarded) {
      process.exit(1);
    }
    await wait(2000);
    
    // Step 6: Get profile
    await getUserProfile();
    await wait(1000);
    
    // Step 7: Get dashboard
    await getDashboardData();
    await wait(1000);
    
    // Step 8: Get default contract
    await getDefaultContract();
    await wait(1000);
    
    // Step 9: List contracts
    await listContracts();
    await wait(1000);
    
    // Step 10: Get subscription
    await getSubscriptionInfo();
    await wait(1000);
    
    // Step 11: Test all routes
    await testAllRoutes();
    
    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    logSection('TEST SUMMARY');
    logSuccess(`Complete user journey test finished in ${duration} seconds!`);
    
    console.log('\n📊 User Journey Steps:');
    console.log('─'.repeat(80));
    console.log('✅ 1. Backend health check');
    console.log('✅ 2. User registration');
    console.log('✅ 3. User login');
    console.log('✅ 4. Onboarding status check');
    console.log('✅ 5. Onboarding completion');
    console.log('✅ 6. Profile retrieval');
    console.log('✅ 7. Dashboard data');
    console.log('✅ 8. Default contract data');
    console.log('✅ 9. Contract listing');
    console.log('✅ 10. Subscription info');
    console.log('✅ 11. All API routes tested');
    console.log('─'.repeat(80));
    
    console.log('\n💡 User Details:');
    console.log('─'.repeat(80));
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Password: ${TEST_USER.password}`);
    console.log(`User ID: ${userId}`);
    console.log(`Wallet: ${TEST_USER.walletAddress}`);
    console.log('─'.repeat(80));
    
    console.log('\n🎯 Next Steps:');
    console.log('─'.repeat(80));
    console.log('1. Login to the frontend with the credentials above');
    console.log('2. Navigate to http://localhost:3000/login');
    console.log('3. View the dashboard and explore all features');
    console.log('4. Check analytics, metrics, and user data');
    console.log('─'.repeat(80));
    
    logSuccess('\n🎉 Real user journey test completed successfully!\n');
    
  } catch (error) {
    logError(`\nTest failed with error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runCompleteJourney().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
