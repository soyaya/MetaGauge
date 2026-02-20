#!/usr/bin/env node

/**
 * Comprehensive Backend Endpoint Vetting Script
 * Tests all API endpoints and verifies functionality
 */

const API_BASE = 'http://localhost:5000';

// Test results tracking
const results = {
  passed: [],
  failed: [],
  skipped: []
};

// Helper function to make requests
async function testEndpoint(method, path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));
    
    return {
      success: response.ok,
      status: response.status,
      data,
      response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Test categories
const tests = {
  // 1. Health & Basic Tests
  health: async () => {
    console.log('\n📊 Testing Health & Basic Endpoints...');
    
    const healthTest = await testEndpoint('GET', '/health');
    if (healthTest.success) {
      results.passed.push('GET /health');
      console.log('✅ GET /health - Working');
    } else {
      results.failed.push('GET /health');
      console.log('❌ GET /health - Failed');
    }

    const testGet = await testEndpoint('GET', '/test');
    if (testGet.success) {
      results.passed.push('GET /test');
      console.log('✅ GET /test - Working');
    } else {
      results.failed.push('GET /test');
      console.log('❌ GET /test - Failed');
    }

    const testPost = await testEndpoint('POST', '/test-post', {
      body: { test: 'data' }
    });
    if (testPost.success) {
      results.passed.push('POST /test-post');
      console.log('✅ POST /test-post - Working');
    } else {
      results.failed.push('POST /test-post');
      console.log('❌ POST /test-post - Failed');
    }
  },

  // 2. Authentication Endpoints
  auth: async () => {
    console.log('\n🔐 Testing Authentication Endpoints...');
    
    // Test registration
    const registerTest = await testEndpoint('POST', '/api/auth/register', {
      body: {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User'
      }
    });
    
    let token = null;
    if (registerTest.success && registerTest.data.token) {
      results.passed.push('POST /api/auth/register');
      console.log('✅ POST /api/auth/register - Working');
      token = registerTest.data.token;
    } else {
      results.failed.push('POST /api/auth/register');
      console.log('❌ POST /api/auth/register - Failed:', registerTest.error || registerTest.data);
    }

    // Test login
    const loginTest = await testEndpoint('POST', '/api/auth/login', {
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    if (loginTest.status === 200 || loginTest.status === 401) {
      results.passed.push('POST /api/auth/login');
      console.log('✅ POST /api/auth/login - Working (endpoint functional)');
      if (loginTest.data.token) token = loginTest.data.token;
    } else {
      results.failed.push('POST /api/auth/login');
      console.log('❌ POST /api/auth/login - Failed');
    }

    // Test /me endpoint
    if (token) {
      const meTest = await testEndpoint('GET', '/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (meTest.success) {
        results.passed.push('GET /api/auth/me');
        console.log('✅ GET /api/auth/me - Working');
      } else {
        results.failed.push('GET /api/auth/me');
        console.log('❌ GET /api/auth/me - Failed');
      }

      // Test refresh API key
      const refreshTest = await testEndpoint('POST', '/api/auth/refresh-api-key', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (refreshTest.success) {
        results.passed.push('POST /api/auth/refresh-api-key');
        console.log('✅ POST /api/auth/refresh-api-key - Working');
      } else {
        results.failed.push('POST /api/auth/refresh-api-key');
        console.log('❌ POST /api/auth/refresh-api-key - Failed');
      }
    }

    return token;
  },

  // 3. Contract Endpoints
  contracts: async (token) => {
    console.log('\n📝 Testing Contract Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping contract tests - no auth token');
      results.skipped.push('Contract endpoints');
      return;
    }

    // List contracts
    const listTest = await testEndpoint('GET', '/api/contracts', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (listTest.success) {
      results.passed.push('GET /api/contracts');
      console.log('✅ GET /api/contracts - Working');
    } else {
      results.failed.push('GET /api/contracts');
      console.log('❌ GET /api/contracts - Failed');
    }

    // Create contract
    const createTest = await testEndpoint('POST', '/api/contracts', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: 'Test Contract',
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        description: 'Test contract for endpoint vetting'
      }
    });
    
    let contractId = null;
    if (createTest.success && createTest.data.id) {
      results.passed.push('POST /api/contracts');
      console.log('✅ POST /api/contracts - Working');
      contractId = createTest.data.id;
    } else {
      results.failed.push('POST /api/contracts');
      console.log('❌ POST /api/contracts - Failed');
    }

    // Get specific contract
    if (contractId) {
      const getTest = await testEndpoint('GET', `/api/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (getTest.success) {
        results.passed.push('GET /api/contracts/:id');
        console.log('✅ GET /api/contracts/:id - Working');
      } else {
        results.failed.push('GET /api/contracts/:id');
        console.log('❌ GET /api/contracts/:id - Failed');
      }

      // Update contract
      const updateTest = await testEndpoint('PUT', `/api/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name: 'Updated Test Contract'
        }
      });
      
      if (updateTest.success) {
        results.passed.push('PUT /api/contracts/:id');
        console.log('✅ PUT /api/contracts/:id - Working');
      } else {
        results.failed.push('PUT /api/contracts/:id');
        console.log('❌ PUT /api/contracts/:id - Failed');
      }

      // Delete contract
      const deleteTest = await testEndpoint('DELETE', `/api/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (deleteTest.success) {
        results.passed.push('DELETE /api/contracts/:id');
        console.log('✅ DELETE /api/contracts/:id - Working');
      } else {
        results.failed.push('DELETE /api/contracts/:id');
        console.log('❌ DELETE /api/contracts/:id - Failed');
      }
    }
  },

  // 4. Analysis Endpoints
  analysis: async (token) => {
    console.log('\n📈 Testing Analysis Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping analysis tests - no auth token');
      results.skipped.push('Analysis endpoints');
      return;
    }

    // Start analysis
    const startTest = await testEndpoint('POST', '/api/analysis/start', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        contractAddress: '0x05D032ac25d322df992303dCa074EE7392C117b9',
        chain: 'lisk',
        blockRange: 100
      }
    });
    
    let analysisId = null;
    if (startTest.success && startTest.data.analysisId) {
      results.passed.push('POST /api/analysis/start');
      console.log('✅ POST /api/analysis/start - Working');
      analysisId = startTest.data.analysisId;
    } else {
      results.failed.push('POST /api/analysis/start');
      console.log('❌ POST /api/analysis/start - Failed:', startTest.data);
    }

    // Get analysis status
    if (analysisId) {
      const statusTest = await testEndpoint('GET', `/api/analysis/${analysisId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (statusTest.success) {
        results.passed.push('GET /api/analysis/:id/status');
        console.log('✅ GET /api/analysis/:id/status - Working');
      } else {
        results.failed.push('GET /api/analysis/:id/status');
        console.log('❌ GET /api/analysis/:id/status - Failed');
      }

      // Get analysis results
      const resultsTest = await testEndpoint('GET', `/api/analysis/${analysisId}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (resultsTest.status === 200 || resultsTest.status === 404) {
        results.passed.push('GET /api/analysis/:id/results');
        console.log('✅ GET /api/analysis/:id/results - Working');
      } else {
        results.failed.push('GET /api/analysis/:id/results');
        console.log('❌ GET /api/analysis/:id/results - Failed');
      }
    }

    // Get analysis history
    const historyTest = await testEndpoint('GET', '/api/analysis/history', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (historyTest.success) {
      results.passed.push('GET /api/analysis/history');
      console.log('✅ GET /api/analysis/history - Working');
    } else {
      results.failed.push('GET /api/analysis/history');
      console.log('❌ GET /api/analysis/history - Failed');
    }

    // Get analysis stats
    const statsTest = await testEndpoint('GET', '/api/analysis/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (statsTest.success) {
      results.passed.push('GET /api/analysis/stats');
      console.log('✅ GET /api/analysis/stats - Working');
    } else {
      results.failed.push('GET /api/analysis/stats');
      console.log('❌ GET /api/analysis/stats - Failed');
    }
  },

  // 5. Quick Scan Endpoints
  quickScan: async (token) => {
    console.log('\n⚡ Testing Quick Scan Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping quick scan tests - no auth token');
      results.skipped.push('Quick scan endpoints');
      return;
    }

    const quickScanTest = await testEndpoint('POST', '/api/quick-scan', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        contractAddress: '0x05D032ac25d322df992303dCa074EE7392C117b9',
        chain: 'lisk'
      }
    });
    
    if (quickScanTest.success) {
      results.passed.push('POST /api/quick-scan');
      console.log('✅ POST /api/quick-scan - Working');
    } else {
      results.failed.push('POST /api/quick-scan');
      console.log('❌ POST /api/quick-scan - Failed');
    }
  },

  // 6. User Endpoints
  users: async (token) => {
    console.log('\n👤 Testing User Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping user tests - no auth token');
      results.skipped.push('User endpoints');
      return;
    }

    // Get dashboard
    const dashboardTest = await testEndpoint('GET', '/api/users/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (dashboardTest.success) {
      results.passed.push('GET /api/users/dashboard');
      console.log('✅ GET /api/users/dashboard - Working');
    } else {
      results.failed.push('GET /api/users/dashboard');
      console.log('❌ GET /api/users/dashboard - Failed');
    }

    // Get profile
    const profileTest = await testEndpoint('GET', '/api/users/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (profileTest.success) {
      results.passed.push('GET /api/users/profile');
      console.log('✅ GET /api/users/profile - Working');
    } else {
      results.failed.push('GET /api/users/profile');
      console.log('❌ GET /api/users/profile - Failed');
    }

    // Update profile
    const updateTest = await testEndpoint('PUT', '/api/users/profile', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: 'Updated Test User'
      }
    });
    
    if (updateTest.success) {
      results.passed.push('PUT /api/users/profile');
      console.log('✅ PUT /api/users/profile - Working');
    } else {
      results.failed.push('PUT /api/users/profile');
      console.log('❌ PUT /api/users/profile - Failed');
    }

    // Get usage stats
    const usageTest = await testEndpoint('GET', '/api/users/usage', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (usageTest.success) {
      results.passed.push('GET /api/users/usage');
      console.log('✅ GET /api/users/usage - Working');
    } else {
      results.failed.push('GET /api/users/usage');
      console.log('❌ GET /api/users/usage - Failed');
    }
  },

  // 7. Onboarding Endpoints
  onboarding: async (token) => {
    console.log('\n🚀 Testing Onboarding Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping onboarding tests - no auth token');
      results.skipped.push('Onboarding endpoints');
      return;
    }

    // Get onboarding status
    const statusTest = await testEndpoint('GET', '/api/onboarding/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (statusTest.success) {
      results.passed.push('GET /api/onboarding/status');
      console.log('✅ GET /api/onboarding/status - Working');
    } else {
      results.failed.push('GET /api/onboarding/status');
      console.log('❌ GET /api/onboarding/status - Failed');
    }

    // Validate contract
    const validateTest = await testEndpoint('POST', '/api/onboarding/validate-contract', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        address: '0x05D032ac25d322df992303dCa074EE7392C117b9',
        chain: 'lisk'
      }
    });
    
    if (validateTest.success || validateTest.status === 400) {
      results.passed.push('POST /api/onboarding/validate-contract');
      console.log('✅ POST /api/onboarding/validate-contract - Working');
    } else {
      results.failed.push('POST /api/onboarding/validate-contract');
      console.log('❌ POST /api/onboarding/validate-contract - Failed');
    }
  },

  // 8. Subscription Endpoints
  subscription: async (token) => {
    console.log('\n💳 Testing Subscription Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping subscription tests - no auth token');
      results.skipped.push('Subscription endpoints');
      return;
    }

    // Get subscription status
    const statusTest = await testEndpoint('GET', '/api/subscription/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (statusTest.success) {
      results.passed.push('GET /api/subscription/status');
      console.log('✅ GET /api/subscription/status - Working');
    } else {
      results.failed.push('GET /api/subscription/status');
      console.log('❌ GET /api/subscription/status - Failed');
    }

    // Get plans
    const plansTest = await testEndpoint('GET', '/api/subscription/plans', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (plansTest.success) {
      results.passed.push('GET /api/subscription/plans');
      console.log('✅ GET /api/subscription/plans - Working');
    } else {
      results.failed.push('GET /api/subscription/plans');
      console.log('❌ GET /api/subscription/plans - Failed');
    }
  },

  // 9. Faucet Endpoints
  faucet: async (token) => {
    console.log('\n💧 Testing Faucet Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping faucet tests - no auth token');
      results.skipped.push('Faucet endpoints');
      return;
    }

    // Get faucet status
    const statusTest = await testEndpoint('GET', '/api/faucet/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (statusTest.success) {
      results.passed.push('GET /api/faucet/status');
      console.log('✅ GET /api/faucet/status - Working');
    } else {
      results.failed.push('GET /api/faucet/status');
      console.log('❌ GET /api/faucet/status - Failed');
    }
  },

  // 10. Chat Endpoints
  chat: async (token) => {
    console.log('\n💬 Testing Chat Endpoints...');
    
    if (!token) {
      console.log('⚠️  Skipping chat tests - no auth token');
      results.skipped.push('Chat endpoints');
      return;
    }

    // Get chat history
    const historyTest = await testEndpoint('GET', '/api/chat/history', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (historyTest.success) {
      results.passed.push('GET /api/chat/history');
      console.log('✅ GET /api/chat/history - Working');
    } else {
      results.failed.push('GET /api/chat/history');
      console.log('❌ GET /api/chat/history - Failed');
    }

    // Send message
    const messageTest = await testEndpoint('POST', '/api/chat/message', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        message: 'Test message',
        contractId: 'test-contract'
      }
    });
    
    if (messageTest.success || messageTest.status === 400) {
      results.passed.push('POST /api/chat/message');
      console.log('✅ POST /api/chat/message - Working');
    } else {
      results.failed.push('POST /api/chat/message');
      console.log('❌ POST /api/chat/message - Failed');
    }
  }
};

// Main execution
async function runAllTests() {
  console.log('🔍 Starting Comprehensive Backend Endpoint Vetting...\n');
  console.log(`Testing API at: ${API_BASE}\n`);
  console.log('=' .repeat(60));

  try {
    // Run tests in sequence
    await tests.health();
    const token = await tests.auth();
    await tests.contracts(token);
    await tests.analysis(token);
    await tests.quickScan(token);
    await tests.users(token);
    await tests.onboarding(token);
    await tests.subscription(token);
    await tests.faucet(token);
    await tests.chat(token);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SUMMARY\n');
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Skipped: ${results.skipped.length}`);
    console.log(`📈 Total: ${results.passed.length + results.failed.length + results.skipped.length}`);

    if (results.failed.length > 0) {
      console.log('\n❌ Failed Endpoints:');
      results.failed.forEach(endpoint => console.log(`   - ${endpoint}`));
    }

    if (results.skipped.length > 0) {
      console.log('\n⚠️  Skipped Categories:');
      results.skipped.forEach(category => console.log(`   - ${category}`));
    }

    console.log('\n' + '='.repeat(60));
    
    const successRate = ((results.passed.length / (results.passed.length + results.failed.length)) * 100).toFixed(1);
    console.log(`\n🎯 Success Rate: ${successRate}%`);
    
    if (results.failed.length === 0) {
      console.log('\n✨ All endpoints are working correctly!\n');
    } else {
      console.log('\n⚠️  Some endpoints need attention.\n');
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
