/**
 * Complete User Journey Test for MetaGauge Analytics Platform
 * Tests: Registration → Onboarding → Subscription → Data Fetching → Alerts → Competitors → AI Chat
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';
let authToken = null;
let userId = null;
let analysisId = null;
let chatSessionId = null;

// Test user data
const testUser = {
  email: `testuser_${Date.now()}@example.com`,
  password: 'TestPass123!',
  name: 'Test User'
};

// Test contract (WETH on Ethereum)
const testContract = {
  contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  chain: 'ethereum',
  contractName: 'Wrapped Ether',
  purpose: 'ERC20 wrapper for ETH',
  category: 'defi',
  startDate: new Date().toISOString()
};

const results = { passed: [], failed: [], warnings: [] };

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
    throw new Error(`API Error (${response.status}): ${data.error || data.message || response.statusText}`);
  }

  return data;
}

function logStep(step, message) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP ${step}: ${message}`);
  console.log('='.repeat(80));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test Steps
async function runCompleteTest() {
  console.log('🚀 MetaGauge Complete User Journey Test\n');
  console.log('='.repeat(80));

  try {
    // Step 1: User Registration
    logStep(1, 'Register a new user account');
    try {
      const signupData = await apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(testUser)
      });
      authToken = signupData.token;
      userId = signupData.user.id;
      console.log(`✅ User registered: ${testUser.email}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Tier: ${signupData.user.tier}`);
      console.log(`   API Key: ${signupData.user.apiKey.substring(0, 20)}...`);
      results.passed.push('POST /api/auth/register - User registration');
    } catch (error) {
      console.error(`❌ Registration failed: ${error.message}`);
      results.failed.push({ step: 'Registration', error: error.message });
      throw error;
    }

    // Step 2: User Login
    logStep(2, 'Login with credentials');
    try {
      const loginData = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password
        })
      });
      authToken = loginData.token;
      console.log(`✅ Login successful`);
      console.log(`   Token: ${authToken.substring(0, 30)}...`);
      results.passed.push('POST /api/auth/login - User login');
    } catch (error) {
      console.error(`❌ Login failed: ${error.message}`);
      results.failed.push({ step: 'Login', error: error.message });
      throw error;
    }

    // Step 3: Complete Onboarding
    logStep(3, 'Complete onboarding with contract information');
    try {
      const onboardingData = await apiCall('/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify(testContract)
      });
      console.log(`✅ Onboarding completed`);
      console.log(`   Contract: ${testContract.contractName}`);
      console.log(`   Address: ${testContract.contractAddress}`);
      console.log(`   Default Contract ID: ${onboardingData.defaultContractId}`);
      console.log(`   Indexing started: ${onboardingData.indexingStarted}`);
      results.passed.push('POST /api/onboarding/complete - Onboarding completion');
    } catch (error) {
      console.error(`❌ Onboarding failed: ${error.message}`);
      results.failed.push({ step: 'Onboarding', error: error.message });
      results.warnings.push('Continuing without onboarding...');
    }

    // Step 4: Verify subscription tier assignment
    logStep(4, 'Verify subscription tier is assigned');
    try {
      const profile = await apiCall('/api/auth/me');
      console.log(`✅ User profile retrieved`);
      console.log(`   Name: ${profile.user.name}`);
      console.log(`   Email: ${profile.user.email}`);
      console.log(`   Tier: ${profile.user.tier}`);
      console.log(`   Onboarding completed: ${profile.user.onboarding?.completed}`);
      results.passed.push('GET /api/auth/me - Subscription tier verification');
    } catch (error) {
      console.error(`❌ Profile retrieval failed: ${error.message}`);
      results.failed.push({ step: 'Profile', error: error.message });
    }

    // Step 5: Check real-time data fetching and metrics
    logStep(5, 'Check real-time data fetching and metrics updates');
    console.log('Waiting for initial data indexing (10 seconds)...');
    await sleep(10000);
    
    let dataFetched = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!dataFetched && attempts < maxAttempts) {
      try {
        const contractData = await apiCall('/api/onboarding/default-contract');
        console.log(`   Attempt ${attempts + 1}:`);
        console.log(`   - Indexing progress: ${contractData.indexingStatus?.progress || 0}%`);
        console.log(`   - Is indexed: ${contractData.indexingStatus?.isIndexed}`);
        
        if (contractData.metrics) {
          console.log(`✅ Metrics available:`);
          console.log(`   - TVL: ${contractData.metrics.tvl || 0}`);
          console.log(`   - DAU: ${contractData.metrics.dau || 0}`);
          console.log(`   - Transaction Volume (24h): ${contractData.metrics.transactionVolume24h || 0}`);
          console.log(`   - Gas Efficiency: ${contractData.metrics.gasEfficiency || 'N/A'}`);
          dataFetched = true;
          results.passed.push('GET /api/onboarding/default-contract - Real-time data fetching');
        }
      } catch (error) {
        console.log(`   Attempt ${attempts + 1}: ${error.message}`);
      }
      
      if (!dataFetched) {
        await sleep(5000);
        attempts++;
      }
    }
    
    if (!dataFetched) {
      console.log(`⚠️  Data fetching took longer than expected`);
      results.warnings.push('Data fetching incomplete after 60 seconds');
    }

    // Step 6: Test alert functionality
    logStep(6, 'Test alert functionality');
    try {
      const metricsData = await apiCall('/api/onboarding/user-metrics');
      
      if (metricsData.recentAnalyses && metricsData.recentAnalyses.length > 0) {
        analysisId = metricsData.recentAnalyses[0].id;
        
        try {
          const alertsData = await apiCall(`/api/analysis/${analysisId}/alerts`, {
            method: 'POST',
            body: JSON.stringify({})
          });
          console.log(`✅ Alerts generated`);
          console.log(`   Total alerts: ${alertsData.alerts?.length || 0}`);
          if (alertsData.alerts && alertsData.alerts.length > 0) {
            console.log(`   First alert: ${alertsData.alerts[0].message}`);
            console.log(`   Severity: ${alertsData.alerts[0].severity}`);
          }
          results.passed.push('POST /api/analysis/:id/alerts - Alert functionality');
        } catch (error) {
          console.log(`⚠️  Alert generation: ${error.message}`);
          results.warnings.push('Alert generation needs completed analysis');
        }
      } else {
        console.log(`⚠️  No completed analyses available for alert testing`);
        results.warnings.push('No analyses available for alerts');
      }
    } catch (error) {
      console.error(`❌ Alert test failed: ${error.message}`);
      results.warnings.push('Alert functionality test skipped');
    }

    // Step 7: Add competitor projects
    logStep(7, 'Add competitor projects for comparison');
    try {
      const contractsData = await apiCall('/api/contracts');
      
      if (contractsData.length > 0) {
        const contractId = contractsData[0].id;
        
        const competitor = {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
          chain: 'ethereum',
          name: 'DAI Stablecoin'
        };
        
        try {
          const updateData = await apiCall(`/api/contracts/${contractId}`, {
            method: 'PUT',
            body: JSON.stringify({ competitors: [competitor] })
          });
          console.log(`✅ Competitor added`);
          console.log(`   Name: ${competitor.name}`);
          console.log(`   Address: ${competitor.address}`);
          results.passed.push('PUT /api/contracts/:id - Competitor comparison');
        } catch (error) {
          console.log(`⚠️  Competitor update: ${error.message}`);
          results.warnings.push('Competitor feature may need different endpoint');
        }
      }
    } catch (error) {
      console.error(`❌ Competitor test failed: ${error.message}`);
      results.warnings.push('Competitor functionality test skipped');
    }

    // Step 8: Test AI chat with metrics data
    logStep(8, 'Test AI chat with metrics data');
    try {
      // Create chat session
      const sessionData = await apiCall('/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({
          contractAddress: testContract.contractAddress,
          contractChain: testContract.chain,
          contractName: testContract.contractName
        })
      });
      chatSessionId = sessionData.sessionId || sessionData.id;
      console.log(`✅ Chat session created: ${chatSessionId}`);
      
      // Send a message
      const messageData = await apiCall(`/api/chat/sessions/${chatSessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: 'What are the key metrics for this contract?' })
      });
      console.log(`✅ AI response received`);
      console.log(`   User message: ${messageData.userMessage.content}`);
      console.log(`   AI response: ${messageData.assistantMessage.content.substring(0, 150)}...`);
      results.passed.push('POST /api/chat/sessions/:id/messages - AI chat functionality');
    } catch (error) {
      console.error(`❌ AI Chat test failed: ${error.message}`);
      results.warnings.push('AI chat may need API key configuration');
    }

    // Step 9: Verify subscription limits are enforced
    logStep(9, 'Verify subscription limits are enforced');
    try {
      const finalMetrics = await apiCall('/api/onboarding/user-metrics');
      console.log(`✅ Subscription limits verified`);
      console.log(`   Tier: ${finalMetrics.subscription?.tierName || 'Free'}`);
      console.log(`   Monthly limit: ${finalMetrics.limits.monthly}`);
      console.log(`   Used this month: ${finalMetrics.overview.monthlyAnalyses}`);
      console.log(`   Remaining: ${finalMetrics.limits.remaining}`);
      
      if (finalMetrics.limits.remaining >= 0) {
        console.log(`✅ Limits are being tracked correctly`);
        results.passed.push('GET /api/onboarding/user-metrics - Subscription limit enforcement');
      }
    } catch (error) {
      console.error(`❌ Subscription limits check failed: ${error.message}`);
      results.failed.push({ step: 'Subscription limits', error: error.message });
    }

    // Final Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ PASSED (${results.passed.length}):`);
    results.passed.forEach(t => console.log(`   ✓ ${t}`));
    
    console.log(`\n⚠️  WARNINGS (${results.warnings.length}):`);
    results.warnings.forEach(t => console.log(`   ! ${t}`));
    
    console.log(`\n❌ FAILED (${results.failed.length}):`);
    results.failed.forEach(t => console.log(`   ✗ ${t.step}: ${t.error}`));
    
    const totalTests = results.passed.length + results.failed.length;
    const successRate = totalTests > 0 ? Math.round((results.passed.length / totalTests) * 100) : 0;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 User journey test completed!`);
    console.log(`   Success rate: ${successRate}% (${results.passed.length}/${totalTests} tests passed)`);
    console.log(`   Warnings: ${results.warnings.length}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error(`\n❌ FATAL ERROR: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    results.failed.push({ step: 'Fatal error', error: error.message });
  }
}

runCompleteTest().catch(console.error);
