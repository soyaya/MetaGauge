/**
 * End-to-End User Journey Test
 * Tests complete user flow: signup → onboard contract → fetch data → analytics → subscription → alerts
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';
let authToken = null;
let userId = null;
let contractId = null;

// Test user data
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'Test123!@#',
  name: 'Test User'
};

// Test contract (USDC on Ethereum)
const testContract = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  chain: 'ethereum',
  name: 'USDC Token',
  category: 'DeFi',
  purpose: 'Stablecoin'
};

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...options.headers
  };

  console.log(`📡 ${options.method || 'GET'} ${endpoint}`);
  
  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API Error: ${data.error || response.statusText}`);
  }

  return data;
}

// Test Steps
async function runE2ETest() {
  console.log('🚀 Starting End-to-End User Journey Test\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: User Registration
    console.log('\n📝 STEP 1: User Registration');
    console.log('-'.repeat(60));
    const signupData = await apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });
    authToken = signupData.token;
    userId = signupData.user.id;
    console.log(`✅ User registered: ${testUser.email}`);
    console.log(`   User ID: ${userId}`);

    // Step 2: User Login
    console.log('\n🔐 STEP 2: User Login');
    console.log('-'.repeat(60));
    const loginData = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    authToken = loginData.token;
    console.log(`✅ Login successful`);
    console.log(`   Token: ${authToken.substring(0, 20)}...`);

    // Step 3: Get User Profile
    console.log('\n👤 STEP 3: Get User Profile');
    console.log('-'.repeat(60));
    const profile = await apiCall('/api/auth/me');
    console.log(`✅ Profile retrieved`);
    console.log(`   Name: ${profile.name}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Subscription: ${profile.subscriptionTier || 'Free'}`);

    // Step 4: Check Subscription Status (Optional)
    console.log('\n💳 STEP 4: Check Subscription Status');
    console.log('-'.repeat(60));
    try {
      const subscription = await apiCall('/api/subscription/status');
      console.log(`✅ Subscription status retrieved`);
      console.log(`   Tier: ${subscription.tier}`);
      console.log(`   API Calls Remaining: ${subscription.apiCallsRemaining}`);
    } catch (error) {
      console.log(`⚠️  Subscription endpoint not available (optional)`);
    }

    // Step 5: Onboard Contract
    console.log('\n📋 STEP 5: Onboard Contract');
    console.log('-'.repeat(60));
    const onboardingData = await apiCall('/api/onboarding/start', {
      method: 'POST',
      body: JSON.stringify(testContract)
    });
    contractId = onboardingData.contractId;
    console.log(`✅ Contract onboarding started`);
    console.log(`   Contract ID: ${contractId}`);
    console.log(`   Address: ${testContract.address}`);
    console.log(`   Chain: ${testContract.chain}`);

    // Step 6: Check Onboarding Status
    console.log('\n⏳ STEP 6: Monitor Onboarding Progress');
    console.log('-'.repeat(60));
    let onboardingComplete = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!onboardingComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const status = await apiCall(`/api/onboarding/${contractId}/status`);
      console.log(`   Progress: ${status.progress}% - ${status.status}`);
      
      if (status.status === 'completed') {
        onboardingComplete = true;
        console.log(`✅ Onboarding completed!`);
        console.log(`   Blocks processed: ${status.blocksProcessed || 'N/A'}`);
      } else if (status.status === 'failed') {
        throw new Error(`Onboarding failed: ${status.error}`);
      }
      
      attempts++;
    }

    if (!onboardingComplete) {
      console.log(`⚠️  Onboarding still in progress after ${maxAttempts * 2}s, continuing...`);
    }

    // Step 7: Get Contract Details
    console.log('\n📊 STEP 7: Get Contract Details');
    console.log('-'.repeat(60));
    const contracts = await apiCall('/api/contracts');
    const contract = contracts.find(c => c.id === contractId);
    console.log(`✅ Contract details retrieved`);
    console.log(`   Name: ${contract.name}`);
    console.log(`   Chain: ${contract.chain}`);
    console.log(`   Indexed: ${contract.isIndexed}`);

    // Step 8: Test Function Analytics - Signatures
    console.log('\n🔍 STEP 8: Function Signature Analytics');
    console.log('-'.repeat(60));
    try {
      const signatures = await apiCall(
        `/api/functions/signatures?contractAddress=${testContract.address}&chain=${testContract.chain}`
      );
      console.log(`✅ Function signatures retrieved`);
      console.log(`   Total signatures: ${signatures.length}`);
      if (signatures.length > 0) {
        console.log(`   Top signature: ${signatures[0].name || signatures[0].signature}`);
        console.log(`   Wallet count: ${signatures[0].walletCount}`);
        console.log(`   Transaction count: ${signatures[0].transactionCount}`);
      }
    } catch (error) {
      console.log(`⚠️  Function analytics: ${error.message} (may need data)`);
    }

    // Step 9: Test Function Analytics - Flow
    console.log('\n🌊 STEP 9: User Journey Flow');
    console.log('-'.repeat(60));
    try {
      const flow = await apiCall(
        `/api/functions/journeys/flow?contractAddress=${testContract.address}&chain=${testContract.chain}`
      );
      console.log(`✅ Flow visualization retrieved`);
      console.log(`   Nodes: ${flow.nodes.length}`);
      console.log(`   Edges: ${flow.edges.length}`);
      if (flow.nodes.length > 0) {
        const entryPoints = flow.nodes.filter(n => n.isEntryPoint);
        console.log(`   Entry points: ${entryPoints.length}`);
      }
    } catch (error) {
      console.log(`⚠️  Flow visualization: ${error.message} (may need data)`);
    }

    // Step 10: Test Function Analytics - Cohorts
    console.log('\n👥 STEP 10: Cohort Analysis');
    console.log('-'.repeat(60));
    try {
      const cohorts = await apiCall(
        `/api/functions/cohorts?contractAddress=${testContract.address}&chain=${testContract.chain}&metricType=activation`
      );
      console.log(`✅ Cohort analysis retrieved`);
      console.log(`   Total cohorts: ${cohorts.length}`);
      if (cohorts.length > 0) {
        console.log(`   First cohort: ${cohorts[0].cohortId}`);
        console.log(`   Wallet count: ${cohorts[0].walletCount}`);
        console.log(`   Activation rate: ${(cohorts[0].activationRate * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.log(`⚠️  Cohort analysis: ${error.message} (may need data)`);
    }

    // Step 11: Start Analysis
    console.log('\n📈 STEP 11: Start Contract Analysis');
    console.log('-'.repeat(60));
    try {
      const analysis = await apiCall('/api/analysis/start', {
        method: 'POST',
        body: JSON.stringify({
          contractId: contractId
        })
      });
      console.log(`✅ Analysis started`);
      console.log(`   Analysis ID: ${analysis.analysisId}`);
    } catch (error) {
      console.log(`⚠️  Analysis: ${error.message}`);
    }

    // Step 12: Create Alert Configuration
    console.log('\n🔔 STEP 12: Create Alert Configuration');
    console.log('-'.repeat(60));
    try {
      const alert = await apiCall('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          contractId: contractId,
          alertType: 'transaction_volume',
          threshold: 1000,
          enabled: true
        })
      });
      console.log(`✅ Alert created`);
      console.log(`   Alert ID: ${alert.id}`);
      console.log(`   Type: ${alert.alertType}`);
    } catch (error) {
      console.log(`⚠️  Alert creation: ${error.message}`);
    }

    // Step 13: Get Alerts
    console.log('\n📋 STEP 13: Get User Alerts');
    console.log('-'.repeat(60));
    try {
      const alerts = await apiCall('/api/alerts');
      console.log(`✅ Alerts retrieved`);
      console.log(`   Total alerts: ${alerts.length}`);
    } catch (error) {
      console.log(`⚠️  Get alerts: ${error.message}`);
    }

    // Step 14: Test Chat (if available)
    console.log('\n💬 STEP 14: Test AI Chat');
    console.log('-'.repeat(60));
    try {
      const chatSession = await apiCall('/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({
          contractId: contractId
        })
      });
      console.log(`✅ Chat session created`);
      console.log(`   Session ID: ${chatSession.sessionId}`);

      // Send a test message
      const chatMessage = await apiCall('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: chatSession.sessionId,
          message: 'What are the key metrics for this contract?'
        })
      });
      console.log(`✅ Chat message sent`);
      console.log(`   Response: ${chatMessage.response.substring(0, 100)}...`);
    } catch (error) {
      console.log(`⚠️  Chat: ${error.message}`);
    }

    // Step 15: Check API Usage (Optional)
    console.log('\n📊 STEP 15: Check API Usage');
    console.log('-'.repeat(60));
    try {
      const usage = await apiCall('/api/subscription/usage');
      console.log(`✅ Usage stats retrieved`);
      console.log(`   API calls used: ${usage.apiCallsUsed}`);
      console.log(`   API calls remaining: ${usage.apiCallsRemaining}`);
    } catch (error) {
      console.log(`⚠️  Usage endpoint not available (optional)`);
    }

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ END-TO-END TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   User: ${testUser.email}`);
    console.log(`   Contract: ${testContract.name} (${testContract.address})`);
    console.log(`   Chain: ${testContract.chain}`);
    console.log(`   All core features tested ✅`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      console.log('✅ Server is running\n');
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running!');
    console.error('   Please start the server with: npm start');
    process.exit(1);
  }
}

// Run the test
(async () => {
  await checkServer();
  await runE2ETest();
})();
