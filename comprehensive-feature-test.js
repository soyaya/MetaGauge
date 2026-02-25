#!/usr/bin/env node

/**
 * Comprehensive MetaGauge Feature Test
 * Tests all features and identifies inconsistencies
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';
const TEST_USER = {
  email: `test_${Date.now()}@metagauge.io`,
  password: 'TestPassword123!',
  name: 'Test User'
};

// Test contract - Using a known Ethereum contract
const TEST_CONTRACT = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
  chain: 'ethereum',
  name: 'USDC Test Contract'
};

let authToken = null;
let userId = null;
let contractId = null;
let onboardingId = null;
let analysisId = null;
let chatSessionId = null;

const issues = [];

function logIssue(category, severity, message, details = {}) {
  issues.push({ category, severity, message, details, timestamp: new Date().toISOString() });
  console.log(`\n❌ [${severity}] ${category}: ${message}`);
  if (Object.keys(details).length > 0) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

async function makeRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      response
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message
    };
  }
}

// ============================================================================
// TEST 1: Authentication Flow
// ============================================================================
async function testAuthentication() {
  console.log('\n\n🔐 TEST 1: Authentication Flow');
  console.log('='.repeat(60));

  // 1.1 Register
  console.log('\n📝 Testing user registration...');
  const registerRes = await makeRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(TEST_USER)
  });

  if (!registerRes.ok) {
    logIssue('Authentication', 'CRITICAL', 'User registration failed', registerRes);
    return false;
  }

  if (!registerRes.data.token) {
    logIssue('Authentication', 'CRITICAL', 'No token returned on registration', registerRes.data);
    return false;
  }

  authToken = registerRes.data.token;
  userId = registerRes.data.user?.id;
  logSuccess(`User registered: ${TEST_USER.email}`);

  // 1.2 Login
  console.log('\n🔑 Testing user login...');
  const loginRes = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password
    })
  });

  if (!loginRes.ok) {
    logIssue('Authentication', 'HIGH', 'User login failed', loginRes);
  } else {
    logSuccess('User login successful');
  }

  // 1.3 Get current user
  console.log('\n👤 Testing get current user...');
  const meRes = await makeRequest('/api/auth/me');

  if (!meRes.ok) {
    logIssue('Authentication', 'HIGH', 'Get current user failed', meRes);
  } else if (!meRes.data.email) {
    logIssue('Authentication', 'MEDIUM', 'User data incomplete', meRes.data);
  } else {
    logSuccess(`Current user retrieved: ${meRes.data.email}`);
  }

  // 1.4 Refresh API key
  console.log('\n🔄 Testing API key refresh...');
  const apiKeyRes = await makeRequest('/api/auth/refresh-api-key', {
    method: 'POST'
  });

  if (!apiKeyRes.ok) {
    logIssue('Authentication', 'MEDIUM', 'API key refresh failed', apiKeyRes);
  } else if (!apiKeyRes.data.apiKey) {
    logIssue('Authentication', 'MEDIUM', 'No API key returned', apiKeyRes.data);
  } else {
    logSuccess('API key refreshed successfully');
  }

  return true;
}

// ============================================================================
// TEST 2: Contract Onboarding
// ============================================================================
async function testOnboarding() {
  console.log('\n\n📋 TEST 2: Contract Onboarding');
  console.log('='.repeat(60));

  // 2.1 Start onboarding
  console.log('\n🚀 Starting contract onboarding...');
  const onboardRes = await makeRequest('/api/onboarding/start', {
    method: 'POST',
    body: JSON.stringify(TEST_CONTRACT)
  });

  if (!onboardRes.ok) {
    logIssue('Onboarding', 'CRITICAL', 'Onboarding start failed', onboardRes);
    return false;
  }

  onboardingId = onboardRes.data.onboardingId;
  contractId = onboardRes.data.contractId;
  logSuccess(`Onboarding started: ${onboardingId}`);

  // 2.2 Monitor onboarding progress
  console.log('\n⏳ Monitoring onboarding progress...');
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  let lastStatus = null;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusRes = await makeRequest(`/api/onboarding/${onboardingId}/status`);
    
    if (!statusRes.ok) {
      logIssue('Onboarding', 'HIGH', 'Failed to get onboarding status', statusRes);
      break;
    }

    const status = statusRes.data.status;
    const progress = statusRes.data.progress || 0;

    if (status !== lastStatus) {
      console.log(`   Status: ${status} (${progress}%)`);
      lastStatus = status;
    }

    if (status === 'completed') {
      logSuccess('Onboarding completed successfully');
      break;
    }

    if (status === 'failed') {
      logIssue('Onboarding', 'CRITICAL', 'Onboarding failed', statusRes.data);
      return false;
    }

    attempts++;
  }

  if (attempts >= maxAttempts) {
    logIssue('Onboarding', 'HIGH', 'Onboarding timeout', { attempts, lastStatus });
  }

  // 2.3 Get onboarding results
  console.log('\n📊 Fetching onboarding results...');
  const resultsRes = await makeRequest(`/api/onboarding/${onboardingId}/results`);

  if (!resultsRes.ok) {
    logIssue('Onboarding', 'HIGH', 'Failed to get onboarding results', resultsRes);
  } else {
    logSuccess('Onboarding results retrieved');
    console.log(`   Transactions: ${resultsRes.data.transactions?.length || 0}`);
    console.log(`   Events: ${resultsRes.data.events?.length || 0}`);
  }

  return true;
}

// ============================================================================
// TEST 3: Contract Management
// ============================================================================
async function testContractManagement() {
  console.log('\n\n📝 TEST 3: Contract Management');
  console.log('='.repeat(60));

  // 3.1 List contracts
  console.log('\n📋 Listing user contracts...');
  const listRes = await makeRequest('/api/contracts');

  if (!listRes.ok) {
    logIssue('Contracts', 'HIGH', 'Failed to list contracts', listRes);
  } else if (!Array.isArray(listRes.data)) {
    logIssue('Contracts', 'MEDIUM', 'Contracts list is not an array', listRes.data);
  } else {
    logSuccess(`Found ${listRes.data.length} contract(s)`);
  }

  // 3.2 Get specific contract
  console.log('\n🔍 Getting contract details...');
  const getRes = await makeRequest(`/api/contracts/${contractId}`);

  if (!getRes.ok) {
    logIssue('Contracts', 'HIGH', 'Failed to get contract details', getRes);
  } else if (!getRes.data.address) {
    logIssue('Contracts', 'MEDIUM', 'Contract data incomplete', getRes.data);
  } else {
    logSuccess(`Contract details retrieved: ${getRes.data.address}`);
  }

  // 3.3 Update contract
  console.log('\n✏️ Updating contract...');
  const updateRes = await makeRequest(`/api/contracts/${contractId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Updated USDC Test Contract'
    })
  });

  if (!updateRes.ok) {
    logIssue('Contracts', 'MEDIUM', 'Failed to update contract', updateRes);
  } else {
    logSuccess('Contract updated successfully');
  }

  return true;
}

// ============================================================================
// TEST 4: Analysis Features
// ============================================================================
async function testAnalysis() {
  console.log('\n\n📊 TEST 4: Analysis Features');
  console.log('='.repeat(60));

  // 4.1 Start analysis
  console.log('\n🔬 Starting contract analysis...');
  const startRes = await makeRequest('/api/analysis/start', {
    method: 'POST',
    body: JSON.stringify({
      contractId: contractId
    })
  });

  if (!startRes.ok) {
    logIssue('Analysis', 'HIGH', 'Failed to start analysis', startRes);
    return false;
  }

  analysisId = startRes.data.analysisId;
  logSuccess(`Analysis started: ${analysisId}`);

  // 4.2 Monitor analysis progress
  console.log('\n⏳ Monitoring analysis progress...');
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusRes = await makeRequest(`/api/analysis/${analysisId}/status`);
    
    if (!statusRes.ok) {
      logIssue('Analysis', 'HIGH', 'Failed to get analysis status', statusRes);
      break;
    }

    const status = statusRes.data.status;
    console.log(`   Status: ${status}`);

    if (status === 'completed') {
      logSuccess('Analysis completed');
      break;
    }

    if (status === 'failed') {
      logIssue('Analysis', 'HIGH', 'Analysis failed', statusRes.data);
      return false;
    }

    attempts++;
  }

  // 4.3 Get analysis results
  console.log('\n📈 Fetching analysis results...');
  const resultsRes = await makeRequest(`/api/analysis/${analysisId}/results`);

  if (!resultsRes.ok) {
    logIssue('Analysis', 'HIGH', 'Failed to get analysis results', resultsRes);
  } else {
    logSuccess('Analysis results retrieved');
    const data = resultsRes.data;
    console.log(`   Metrics: ${Object.keys(data.metrics || {}).length}`);
    console.log(`   Users: ${data.users?.length || 0}`);
    console.log(`   Transactions: ${data.transactions?.length || 0}`);
  }

  // 4.4 Get analysis history
  console.log('\n📜 Fetching analysis history...');
  const historyRes = await makeRequest('/api/analysis/history');

  if (!historyRes.ok) {
    logIssue('Analysis', 'MEDIUM', 'Failed to get analysis history', historyRes);
  } else {
    logSuccess(`Analysis history retrieved: ${historyRes.data.length || 0} items`);
  }

  // 4.5 AI Interpretation
  console.log('\n🤖 Testing AI interpretation...');
  const interpretRes = await makeRequest(`/api/analysis/${analysisId}/interpret`, {
    method: 'POST',
    body: JSON.stringify({
      focus: 'overview'
    })
  });

  if (!interpretRes.ok) {
    logIssue('Analysis', 'MEDIUM', 'AI interpretation failed', interpretRes);
  } else if (!interpretRes.data.interpretation) {
    logIssue('Analysis', 'MEDIUM', 'No interpretation returned', interpretRes.data);
  } else {
    logSuccess('AI interpretation generated');
  }

  // 4.6 Quick Insights
  console.log('\n⚡ Testing quick insights...');
  const insightsRes = await makeRequest(`/api/analysis/${analysisId}/quick-insights`);

  if (!insightsRes.ok) {
    logIssue('Analysis', 'MEDIUM', 'Quick insights failed', insightsRes);
  } else {
    logSuccess('Quick insights retrieved');
  }

  return true;
}

// ============================================================================
// TEST 5: Chat Features
// ============================================================================
async function testChat() {
  console.log('\n\n💬 TEST 5: Chat Features');
  console.log('='.repeat(60));

  // 5.1 Create chat session
  console.log('\n🆕 Creating chat session...');
  const createRes = await makeRequest('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({
      contractId: contractId,
      title: 'Test Chat Session'
    })
  });

  if (!createRes.ok) {
    logIssue('Chat', 'HIGH', 'Failed to create chat session', createRes);
    return false;
  }

  chatSessionId = createRes.data.sessionId;
  logSuccess(`Chat session created: ${chatSessionId}`);

  // 5.2 Send message
  console.log('\n💬 Sending chat message...');
  const messageRes = await makeRequest('/api/chat/message', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: chatSessionId,
      message: 'What are the key metrics for this contract?'
    })
  });

  if (!messageRes.ok) {
    logIssue('Chat', 'HIGH', 'Failed to send chat message', messageRes);
  } else if (!messageRes.data.response) {
    logIssue('Chat', 'MEDIUM', 'No response from AI', messageRes.data);
  } else {
    logSuccess('Chat message sent and response received');
  }

  // 5.3 Get chat history
  console.log('\n📜 Fetching chat history...');
  const historyRes = await makeRequest(`/api/chat/sessions/${chatSessionId}/messages`);

  if (!historyRes.ok) {
    logIssue('Chat', 'MEDIUM', 'Failed to get chat history', historyRes);
  } else if (!Array.isArray(historyRes.data)) {
    logIssue('Chat', 'MEDIUM', 'Chat history is not an array', historyRes.data);
  } else {
    logSuccess(`Chat history retrieved: ${historyRes.data.length} messages`);
  }

  // 5.4 List chat sessions
  console.log('\n📋 Listing chat sessions...');
  const sessionsRes = await makeRequest('/api/chat/sessions');

  if (!sessionsRes.ok) {
    logIssue('Chat', 'MEDIUM', 'Failed to list chat sessions', sessionsRes);
  } else {
    logSuccess(`Chat sessions listed: ${sessionsRes.data.length || 0} sessions`);
  }

  return true;
}

// ============================================================================
// TEST 6: Subscription Features
// ============================================================================
async function testSubscription() {
  console.log('\n\n💳 TEST 6: Subscription Features');
  console.log('='.repeat(60));

  // 6.1 Get subscription status
  console.log('\n📊 Getting subscription status...');
  const statusRes = await makeRequest('/api/subscription/status');

  if (!statusRes.ok) {
    logIssue('Subscription', 'HIGH', 'Failed to get subscription status', statusRes);
  } else {
    logSuccess(`Subscription tier: ${statusRes.data.tier || 'unknown'}`);
    console.log(`   API calls used: ${statusRes.data.apiCallsUsed || 0}`);
    console.log(`   API calls limit: ${statusRes.data.apiCallsLimit || 0}`);
  }

  // 6.2 Get usage stats
  console.log('\n📈 Getting usage statistics...');
  const usageRes = await makeRequest('/api/subscription/usage');

  if (!usageRes.ok) {
    logIssue('Subscription', 'MEDIUM', 'Failed to get usage stats', usageRes);
  } else {
    logSuccess('Usage statistics retrieved');
  }

  // 6.3 Test payment verification (mock)
  console.log('\n💰 Testing payment verification...');
  const verifyRes = await makeRequest('/api/subscription/verify', {
    method: 'POST',
    body: JSON.stringify({
      txHash: '0x1234567890abcdef',
      chain: 'lisk',
      tier: 'starter'
    })
  });

  if (verifyRes.ok) {
    logIssue('Subscription', 'LOW', 'Payment verification accepted invalid tx', verifyRes.data);
  } else {
    logSuccess('Payment verification correctly rejected invalid tx');
  }

  return true;
}

// ============================================================================
// TEST 7: API Documentation
// ============================================================================
async function testDocumentation() {
  console.log('\n\n📚 TEST 7: API Documentation');
  console.log('='.repeat(60));

  console.log('\n📖 Checking API documentation...');
  const docsRes = await makeRequest('/api-docs');

  if (!docsRes.ok) {
    logIssue('Documentation', 'LOW', 'API documentation not accessible', docsRes);
  } else {
    logSuccess('API documentation accessible');
  }

  return true;
}

// ============================================================================
// TEST 8: Error Handling
// ============================================================================
async function testErrorHandling() {
  console.log('\n\n⚠️ TEST 8: Error Handling');
  console.log('='.repeat(60));

  // 8.1 Invalid contract ID
  console.log('\n🔍 Testing invalid contract ID...');
  const invalidContractRes = await makeRequest('/api/contracts/invalid-id-12345');

  if (invalidContractRes.ok) {
    logIssue('Error Handling', 'MEDIUM', 'Invalid contract ID accepted', invalidContractRes.data);
  } else {
    logSuccess('Invalid contract ID correctly rejected');
  }

  // 8.2 Unauthorized access
  console.log('\n🔒 Testing unauthorized access...');
  const tempToken = authToken;
  authToken = null;
  const unauthRes = await makeRequest('/api/contracts');
  authToken = tempToken;

  if (unauthRes.ok) {
    logIssue('Error Handling', 'HIGH', 'Unauthorized access allowed', unauthRes.data);
  } else {
    logSuccess('Unauthorized access correctly blocked');
  }

  // 8.3 Invalid data
  console.log('\n❌ Testing invalid data submission...');
  const invalidDataRes = await makeRequest('/api/contracts', {
    method: 'POST',
    body: JSON.stringify({
      address: 'not-a-valid-address',
      chain: 'invalid-chain'
    })
  });

  if (invalidDataRes.ok) {
    logIssue('Error Handling', 'MEDIUM', 'Invalid data accepted', invalidDataRes.data);
  } else {
    logSuccess('Invalid data correctly rejected');
  }

  return true;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     MetaGauge Comprehensive Feature Test Suite            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  try {
    await testAuthentication();
    await testOnboarding();
    await testContractManagement();
    await testAnalysis();
    await testChat();
    await testSubscription();
    await testDocumentation();
    await testErrorHandling();
  } catch (error) {
    console.error('\n💥 Fatal error during testing:', error);
    logIssue('System', 'CRITICAL', 'Fatal error during testing', { error: error.message });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // ============================================================================
  // FINAL REPORT
  // ============================================================================
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n⏱️  Total Duration: ${duration}s`);
  console.log(`📊 Total Issues Found: ${issues.length}`);

  if (issues.length === 0) {
    console.log('\n🎉 All tests passed! No issues found.');
  } else {
    // Group by severity
    const critical = issues.filter(i => i.severity === 'CRITICAL');
    const high = issues.filter(i => i.severity === 'HIGH');
    const medium = issues.filter(i => i.severity === 'MEDIUM');
    const low = issues.filter(i => i.severity === 'LOW');

    console.log('\n📋 Issues by Severity:');
    console.log(`   🔴 CRITICAL: ${critical.length}`);
    console.log(`   🟠 HIGH: ${high.length}`);
    console.log(`   🟡 MEDIUM: ${medium.length}`);
    console.log(`   🟢 LOW: ${low.length}`);

    // Group by category
    const categories = {};
    issues.forEach(issue => {
      if (!categories[issue.category]) {
        categories[issue.category] = [];
      }
      categories[issue.category].push(issue);
    });

    console.log('\n📋 Issues by Category:');
    Object.entries(categories).forEach(([category, categoryIssues]) => {
      console.log(`   ${category}: ${categoryIssues.length}`);
    });

    console.log('\n\n📝 Detailed Issues:');
    console.log('='.repeat(60));
    issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. [${issue.severity}] ${issue.category}`);
      console.log(`   ${issue.message}`);
      if (Object.keys(issue.details).length > 0) {
        console.log(`   Details: ${JSON.stringify(issue.details, null, 2)}`);
      }
    });
  }

  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    totalIssues: issues.length,
    issues,
    testUser: TEST_USER.email,
    testContract: TEST_CONTRACT
  };

  const fs = await import('fs');
  const reportPath = './test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);

  console.log('\n');
}

// Run tests
runAllTests().catch(console.error);
