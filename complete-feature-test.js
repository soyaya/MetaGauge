#!/usr/bin/env node

/**
 * Complete MetaGauge Feature Test - Working with Real API
 * Tests actual implementation and identifies all inconsistencies
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';
const TEST_USER = {
  email: `test_complete_${Date.now()}@metagauge.io`,
  password: 'TestPassword123!',
  name: 'Complete Test User'
};

// Using a real, simple Ethereum contract for testing
const TEST_CONTRACT = {
  name: 'USDC Test Contract',
  description: 'Testing with USDC contract',
  targetContract: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    chain: 'ethereum',
    name: 'USDC'
  }
};

let authToken = null;
let userId = null;
let contractId = null;
let analysisId = null;
let chatSessionId = null;

const issues = [];
const successes = [];

function logIssue(category, severity, message, details = {}) {
  issues.push({ category, severity, message, details, timestamp: new Date().toISOString() });
  console.log(`\n❌ [${severity}] ${category}: ${message}`);
  if (Object.keys(details).length > 0 && details.error) {
    console.log(`   Error: ${details.error}`);
  }
}

function logSuccess(category, message, data = {}) {
  successes.push({ category, message, data, timestamp: new Date().toISOString() });
  console.log(`✅ ${category}: ${message}`);
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
    const contentType = response.headers.get('content-type');
    let data = {};
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { rawResponse: text };
    }
    
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
      error: error.message,
      data: {}
    };
  }
}

// ============================================================================
// TEST 1: Authentication & User Management
// ============================================================================
async function testAuthentication() {
  console.log('\n\n🔐 TEST 1: Authentication & User Management');
  console.log('='.repeat(70));

  // 1.1 Register
  console.log('\n📝 Testing user registration...');
  const registerRes = await makeRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(TEST_USER)
  });

  if (!registerRes.ok) {
    logIssue('Authentication', 'CRITICAL', 'User registration failed', registerRes.data);
    return false;
  }

  if (!registerRes.data.token) {
    logIssue('Authentication', 'CRITICAL', 'No token returned on registration', registerRes.data);
    return false;
  }

  authToken = registerRes.data.token;
  userId = registerRes.data.user?.id;
  logSuccess('Authentication', `User registered: ${TEST_USER.email}`);

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
    logIssue('Authentication', 'HIGH', 'User login failed', loginRes.data);
  } else {
    logSuccess('Authentication', 'User login successful');
  }

  // 1.3 Get current user
  console.log('\n👤 Testing get current user...');
  const meRes = await makeRequest('/api/auth/me');

  if (!meRes.ok) {
    logIssue('Authentication', 'HIGH', 'Get current user failed', meRes.data);
  } else {
    const userData = meRes.data.user || meRes.data;
    if (!userData.email) {
      logIssue('Authentication', 'MEDIUM', 'User data structure unexpected', { 
        expected: 'email field', 
        received: Object.keys(userData)
      });
    } else {
      logSuccess('Authentication', `Current user retrieved: ${userData.email}`);
    }
  }

  // 1.4 Refresh API key
  console.log('\n🔄 Testing API key refresh...');
  const apiKeyRes = await makeRequest('/api/auth/refresh-api-key', {
    method: 'POST'
  });

  if (!apiKeyRes.ok) {
    logIssue('Authentication', 'MEDIUM', 'API key refresh failed', apiKeyRes.data);
  } else if (!apiKeyRes.data.apiKey) {
    logIssue('Authentication', 'MEDIUM', 'No API key returned', apiKeyRes.data);
  } else {
    logSuccess('Authentication', 'API key refreshed successfully');
  }

  return true;
}

// ============================================================================
// TEST 2: Contract Management (Actual Working Flow)
// ============================================================================
async function testContractManagement() {
  console.log('\n\n📝 TEST 2: Contract Management');
  console.log('='.repeat(70));

  // 2.1 Create contract
  console.log('\n➕ Creating contract...');
  const createRes = await makeRequest('/api/contracts', {
    method: 'POST',
    body: JSON.stringify(TEST_CONTRACT)
  });

  if (!createRes.ok) {
    logIssue('Contracts', 'CRITICAL', 'Contract creation failed', createRes.data);
    return false;
  }

  contractId = createRes.data.id;
  logSuccess('Contracts', `Contract created: ${contractId}`);

  // 2.2 List contracts
  console.log('\n📋 Listing user contracts...');
  const listRes = await makeRequest('/api/contracts');

  if (!listRes.ok) {
    logIssue('Contracts', 'HIGH', 'Failed to list contracts', listRes.data);
  } else {
    // Check response format
    if (Array.isArray(listRes.data)) {
      logSuccess('Contracts', `Found ${listRes.data.length} contract(s) - Direct array format`);
    } else if (listRes.data.contracts && Array.isArray(listRes.data.contracts)) {
      logSuccess('Contracts', `Found ${listRes.data.contracts.length} contract(s) - Paginated format`);
      if (listRes.data.pagination) {
        console.log(`   Pagination: page ${listRes.data.pagination.page}/${listRes.data.pagination.pages}`);
      }
    } else {
      logIssue('Contracts', 'MEDIUM', 'Unexpected response format', {
        expected: 'Array or {contracts: [], pagination: {}}',
        received: typeof listRes.data
      });
    }
  }

  // 2.3 Get specific contract
  console.log('\n🔍 Getting contract details...');
  const getRes = await makeRequest(`/api/contracts/${contractId}`);

  if (!getRes.ok) {
    logIssue('Contracts', 'HIGH', 'Failed to get contract details', getRes.data);
  } else if (!getRes.data.targetContract?.address) {
    logIssue('Contracts', 'MEDIUM', 'Contract data incomplete', getRes.data);
  } else {
    logSuccess('Contracts', `Contract details retrieved: ${getRes.data.targetContract.address}`);
  }

  // 2.4 Update contract (FIXED)
  console.log('\n✏️ Updating contract...');
  const updateRes = await makeRequest(`/api/contracts/${contractId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Updated USDC Test Contract',
      description: 'Updated description'
    })
  });

  if (!updateRes.ok) {
    logIssue('Contracts', 'HIGH', 'Failed to update contract', updateRes.data);
  } else {
    logSuccess('Contracts', 'Contract updated successfully');
  }

  // 2.5 Duplicate contract
  console.log('\n📋 Duplicating contract...');
  const dupRes = await makeRequest(`/api/contracts/${contractId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Duplicated USDC Contract'
    })
  });

  if (!dupRes.ok) {
    logIssue('Contracts', 'MEDIUM', 'Failed to duplicate contract', dupRes.data);
  } else {
    logSuccess('Contracts', 'Contract duplicated successfully');
  }

  return true;
}

// ============================================================================
// TEST 3: Onboarding Flow
// ============================================================================
async function testOnboarding() {
  console.log('\n\n📋 TEST 3: Onboarding Flow');
  console.log('='.repeat(70));

  // 3.1 Check onboarding status
  console.log('\n📊 Checking onboarding status...');
  const statusRes = await makeRequest('/api/onboarding/status');

  if (!statusRes.ok) {
    logIssue('Onboarding', 'HIGH', 'Failed to get onboarding status', statusRes.data);
  } else {
    logSuccess('Onboarding', 'Onboarding status retrieved');
    console.log(`   Completed: ${statusRes.data.completed}`);
    console.log(`   Has default contract: ${statusRes.data.hasDefaultContract}`);
  }

  // 3.2 Complete onboarding with default contract
  console.log('\n✅ Completing onboarding...');
  const completeRes = await makeRequest('/api/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({
      defaultContract: TEST_CONTRACT.targetContract
    })
  });

  if (!completeRes.ok) {
    logIssue('Onboarding', 'MEDIUM', 'Failed to complete onboarding', completeRes.data);
  } else {
    logSuccess('Onboarding', 'Onboarding completed');
  }

  // 3.3 Get default contract
  console.log('\n🎯 Getting default contract...');
  const defaultRes = await makeRequest('/api/onboarding/default-contract');

  if (!defaultRes.ok) {
    logIssue('Onboarding', 'MEDIUM', 'Failed to get default contract', defaultRes.data);
  } else {
    logSuccess('Onboarding', 'Default contract retrieved');
  }

  return true;
}

// ============================================================================
// TEST 4: Analysis System
// ============================================================================
async function testAnalysis() {
  console.log('\n\n📊 TEST 4: Analysis System');
  console.log('='.repeat(70));

  if (!contractId) {
    console.log('⚠️  Skipping analysis tests - no contract created');
    return false;
  }

  // 4.1 Start analysis (test both parameter names)
  console.log('\n🔬 Starting analysis with contractId...');
  let startRes = await makeRequest('/api/analysis/start', {
    method: 'POST',
    body: JSON.stringify({
      contractId: contractId
    })
  });

  if (!startRes.ok) {
    console.log(`   ⚠️  contractId failed: ${startRes.data.message}`);
    
    // Try with configurationId
    console.log('   🔄 Retrying with configurationId...');
    startRes = await makeRequest('/api/analysis/start', {
      method: 'POST',
      body: JSON.stringify({
        configurationId: contractId
      })
    });
  }

  if (!startRes.ok) {
    logIssue('Analysis', 'HIGH', 'Failed to start analysis with both parameter names', {
      triedContractId: true,
      triedConfigurationId: true,
      error: startRes.data.message
    });
    return false;
  }

  analysisId = startRes.data.analysisId || startRes.data.id;
  logSuccess('Analysis', `Analysis started: ${analysisId}`);

  // 4.2 Check analysis status
  console.log('\n⏳ Checking analysis status...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  
  const statusRes = await makeRequest(`/api/analysis/${analysisId}/status`);

  if (!statusRes.ok) {
    logIssue('Analysis', 'HIGH', 'Failed to get analysis status', statusRes.data);
  } else {
    logSuccess('Analysis', `Analysis status: ${statusRes.data.status}`);
  }

  // 4.3 Get analysis history
  console.log('\n📜 Getting analysis history...');
  const historyRes = await makeRequest('/api/analysis/history');

  if (!historyRes.ok) {
    logIssue('Analysis', 'MEDIUM', 'Failed to get analysis history', historyRes.data);
  } else {
    const count = Array.isArray(historyRes.data) ? historyRes.data.length : 
                  historyRes.data.analyses?.length || 0;
    logSuccess('Analysis', `Analysis history retrieved: ${count} items`);
  }

  return true;
}

// ============================================================================
// TEST 5: Chat System
// ============================================================================
async function testChat() {
  console.log('\n\n💬 TEST 5: Chat System');
  console.log('='.repeat(70));

  if (!contractId) {
    console.log('⚠️  Skipping chat tests - no contract created');
    return false;
  }

  // Get contract details for chat
  const contractRes = await makeRequest(`/api/contracts/${contractId}`);
  const contractAddress = contractRes.data?.targetContract?.address;
  const contractChain = contractRes.data?.targetContract?.chain;

  // 5.1 Create chat session (test both parameter formats)
  console.log('\n🆕 Creating chat session with contractId...');
  let createRes = await makeRequest('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({
      contractId: contractId,
      title: 'Test Chat Session'
    })
  });

  if (!createRes.ok) {
    console.log(`   ⚠️  contractId failed: ${createRes.data.message}`);
    
    // Try with contractAddress + contractChain
    console.log('   🔄 Retrying with contractAddress + contractChain...');
    createRes = await makeRequest('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({
        contractAddress: contractAddress,
        contractChain: contractChain,
        title: 'Test Chat Session'
      })
    });
  }

  if (!createRes.ok) {
    logIssue('Chat', 'HIGH', 'Failed to create chat session with both parameter formats', {
      triedContractId: true,
      triedAddressChain: true,
      error: createRes.data.message
    });
    return false;
  }

  chatSessionId = createRes.data.sessionId || createRes.data.id;
  logSuccess('Chat', `Chat session created: ${chatSessionId}`);

  // 5.2 Send message
  console.log('\n💬 Sending chat message...');
  const messageRes = await makeRequest(`/api/chat/sessions/${chatSessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'What are the key metrics for this contract?'
    })
  });

  if (!messageRes.ok) {
    logIssue('Chat', 'HIGH', 'Failed to send chat message', messageRes.data);
  } else {
    logSuccess('Chat', 'Chat message sent successfully');
  }

  // 5.3 Get chat messages
  console.log('\n📜 Getting chat messages...');
  const messagesRes = await makeRequest(`/api/chat/sessions/${chatSessionId}/messages`);

  if (!messagesRes.ok) {
    logIssue('Chat', 'MEDIUM', 'Failed to get chat messages', messagesRes.data);
  } else {
    const count = Array.isArray(messagesRes.data) ? messagesRes.data.length :
                  messagesRes.data.messages?.length || 0;
    logSuccess('Chat', `Chat messages retrieved: ${count} messages`);
  }

  // 5.4 List chat sessions
  console.log('\n📋 Listing chat sessions...');
  const sessionsRes = await makeRequest('/api/chat/sessions');

  if (!sessionsRes.ok) {
    logIssue('Chat', 'MEDIUM', 'Failed to list chat sessions', sessionsRes.data);
  } else {
    const count = Array.isArray(sessionsRes.data) ? sessionsRes.data.length :
                  sessionsRes.data.sessions?.length || 0;
    logSuccess('Chat', `Chat sessions listed: ${count} sessions`);
  }

  return true;
}

// ============================================================================
// TEST 6: Subscription System
// ============================================================================
async function testSubscription() {
  console.log('\n\n💳 TEST 6: Subscription System');
  console.log('='.repeat(70));

  // 6.1 Get subscription plans
  console.log('\n📋 Getting subscription plans...');
  const plansRes = await makeRequest('/api/subscription/plans');

  if (!plansRes.ok) {
    logIssue('Subscription', 'MEDIUM', 'Failed to get subscription plans', plansRes.data);
  } else {
    const count = Array.isArray(plansRes.data) ? plansRes.data.length :
                  plansRes.data.plans?.length || 0;
    logSuccess('Subscription', `Subscription plans retrieved: ${count} plans`);
  }

  // 6.2 Get subscription stats
  console.log('\n📊 Getting subscription stats...');
  const statsRes = await makeRequest('/api/subscription/stats');

  if (!statsRes.ok) {
    logIssue('Subscription', 'MEDIUM', 'Failed to get subscription stats', statsRes.data);
  } else {
    logSuccess('Subscription', 'Subscription stats retrieved');
  }

  return true;
}

// ============================================================================
// TEST 7: User Profile & Settings
// ============================================================================
async function testUserProfile() {
  console.log('\n\n👤 TEST 7: User Profile & Settings');
  console.log('='.repeat(70));

  // 7.1 Get user profile
  console.log('\n📊 Getting user profile...');
  const profileRes = await makeRequest('/api/users/profile');

  if (!profileRes.ok) {
    logIssue('User Profile', 'MEDIUM', 'Failed to get user profile', profileRes.data);
  } else {
    logSuccess('User Profile', 'User profile retrieved');
  }

  // 7.2 Update user profile
  console.log('\n✏️ Updating user profile...');
  const updateRes = await makeRequest('/api/users/profile', {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Updated Test User'
    })
  });

  if (!updateRes.ok) {
    logIssue('User Profile', 'MEDIUM', 'Failed to update user profile', updateRes.data);
  } else {
    logSuccess('User Profile', 'User profile updated');
  }

  // 7.3 Get usage stats
  console.log('\n📈 Getting usage stats...');
  const usageRes = await makeRequest('/api/users/usage');

  if (!usageRes.ok) {
    logIssue('User Profile', 'MEDIUM', 'Failed to get usage stats', usageRes.data);
  } else {
    logSuccess('User Profile', 'Usage stats retrieved');
  }

  return true;
}

// ============================================================================
// TEST 8: Error Handling & Edge Cases
// ============================================================================
async function testErrorHandling() {
  console.log('\n\n⚠️ TEST 8: Error Handling & Edge Cases');
  console.log('='.repeat(70));

  // 8.1 Invalid contract ID
  console.log('\n🔍 Testing invalid contract ID...');
  const invalidRes = await makeRequest('/api/contracts/invalid-id-12345');

  if (invalidRes.ok) {
    logIssue('Error Handling', 'MEDIUM', 'Invalid contract ID accepted', invalidRes.data);
  } else {
    logSuccess('Error Handling', 'Invalid contract ID correctly rejected');
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
    logSuccess('Error Handling', 'Unauthorized access correctly blocked');
  }

  // 8.3 Invalid data
  console.log('\n❌ Testing invalid data submission...');
  const invalidDataRes = await makeRequest('/api/contracts', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test',
      // Missing required targetContract field
    })
  });

  if (invalidDataRes.ok) {
    logIssue('Error Handling', 'MEDIUM', 'Invalid data accepted', invalidDataRes.data);
  } else {
    logSuccess('Error Handling', 'Invalid data correctly rejected');
  }

  return true;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║     MetaGauge Complete Feature Test - Real API Implementation     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  try {
    await testAuthentication();
    await testContractManagement();
    await testOnboarding();
    await testAnalysis();
    await testChat();
    await testSubscription();
    await testUserProfile();
    await testErrorHandling();
  } catch (error) {
    console.error('\n💥 Fatal error during testing:', error);
    logIssue('System', 'CRITICAL', 'Fatal error during testing', { error: error.message, stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // ============================================================================
  // FINAL REPORT
  // ============================================================================
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                         TEST SUMMARY                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n⏱️  Total Duration: ${duration}s`);
  console.log(`✅ Successful Tests: ${successes.length}`);
  console.log(`❌ Issues Found: ${issues.length}`);

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
    console.log('='.repeat(70));
    issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. [${issue.severity}] ${issue.category}`);
      console.log(`   ${issue.message}`);
      if (issue.details.error) {
        console.log(`   Error: ${issue.details.error}`);
      }
    });
  }

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    totalTests: successes.length + issues.length,
    successfulTests: successes.length,
    totalIssues: issues.length,
    issues,
    successes,
    testUser: TEST_USER.email,
    testContract: TEST_CONTRACT,
    ids: {
      userId,
      contractId,
      analysisId,
      chatSessionId
    }
  };

  const fs = await import('fs');
  const reportPath = './complete-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);

  console.log('\n');
}

// Run tests
runAllTests().catch(console.error);
