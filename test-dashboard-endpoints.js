#!/usr/bin/env node

/**
 * Test Dashboard Endpoints
 * Verifies the new dashboard API endpoints return correct data
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

class DashboardEndpointTest {
  constructor() {
    this.token = null;
    this.results = [];
  }

  async test(description, testFn) {
    try {
      console.log(`🧪 Testing: ${description}`);
      const result = await testFn();
      this.results.push({ description, success: true, result });
      console.log(`✅ PASSED: ${description}`);
      return result;
    } catch (error) {
      this.results.push({ description, success: false, error: error.message });
      console.log(`❌ FAILED: ${description} - ${error.message}`);
      return null;
    }
  }

  async apiCall(endpoint, options = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`${response.status}: ${data.message || data.error || 'Request failed'}`);
    }

    return { status: response.status, data };
  }

  async setupTestUser() {
    console.log('🔧 Setting up test user and contract...\n');

    // Create test user
    const testUser = {
      email: `dashboard-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Dashboard Test User'
    };

    const { data: registerData } = await this.apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });

    this.token = registerData.token;
    console.log('✅ Test user created');

    // Complete onboarding
    const contractData = {
      contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI token
      chain: 'ethereum',
      contractName: 'Test Contract',
      purpose: 'Testing',
      category: 'defi',
      socialLinks: {}
    };

    await this.apiCall('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(contractData)
    });

    console.log('✅ Onboarding completed');

    // Trigger indexing
    await this.apiCall('/api/onboarding/trigger-indexing', {
      method: 'POST'
    });

    console.log('✅ Indexing triggered\n');
  }

  async testDashboardEndpoints() {
    console.log('📊 Testing Dashboard Endpoints\n');

    // Test contract info endpoint
    await this.test('Contract Info Endpoint', async () => {
      const { data } = await this.apiCall('/api/dashboard/contract-info');
      
      // Verify expected fields
      const requiredFields = ['onboardedDate', 'deploymentBlock', 'blocksIndexed', 'blockRange'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(', ')}`);
      }

      console.log('   📅 Onboarded Date:', data.onboardedDate);
      console.log('   🏗️  Deployment Block:', data.deploymentBlock || 'Not found');
      console.log('   📦 Blocks Indexed:', data.blocksIndexed);
      console.log('   📊 Block Range:', data.blockRange ? `${data.blockRange.start} → ${data.blockRange.end}` : 'Not available');

      return data;
    });

    // Test indexing status endpoint
    await this.test('Indexing Status Endpoint', async () => {
      const { data } = await this.apiCall('/api/dashboard/indexing-status');
      
      const requiredFields = ['isIndexed', 'progress', 'status'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(', ')}`);
      }

      console.log('   🔄 Is Indexed:', data.isIndexed);
      console.log('   📈 Progress:', `${data.progress}%`);
      console.log('   📊 Status:', data.status);
      console.log('   🎯 Current Step:', data.currentStep || 'None');

      return data;
    });

    // Test block metrics endpoint
    await this.test('Block Metrics Endpoint', async () => {
      const { data } = await this.apiCall('/api/dashboard/block-metrics');
      
      const requiredFields = ['totalTransactions', 'blocksProcessed', 'transactionDensity'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(', ')}`);
      }

      console.log('   💰 Total Transactions:', data.totalTransactions);
      console.log('   📦 Blocks Processed:', data.blocksProcessed);
      console.log('   📊 Transaction Density:', data.transactionDensity);
      console.log('   📈 Avg Txs/Block:', data.avgTransactionsPerBlock);

      return data;
    });

    // Test original default contract endpoint for comparison
    await this.test('Original Default Contract Endpoint', async () => {
      const { data } = await this.apiCall('/api/onboarding/default-contract');
      
      console.log('   📋 Contract Address:', data.contract?.address);
      console.log('   🔗 Chain:', data.contract?.chain);
      console.log('   📊 Block Range:', data.blockRange ? 
        `${data.blockRange.start} → ${data.blockRange.end} (${data.blockRange.total} blocks)` : 
        'Not available');
      console.log('   🏗️  Deployment Block:', data.blockRange?.deployment || 'Not found');

      return data;
    });
  }

  async run() {
    console.log('🚀 Testing Dashboard Endpoints\n');

    try {
      // Check if server is running
      const healthCheck = await fetch(`${BASE_URL}/health`);
      if (!healthCheck.ok) throw new Error('Server not healthy');
      console.log('✅ Server is running\n');

      await this.setupTestUser();
      await this.testDashboardEndpoints();

      this.printSummary();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 DASHBOARD ENDPOINTS TEST SUMMARY');
    console.log('='.repeat(60));

    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📊 Success Rate: ${((passed/total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   • ${r.description}: ${r.error}`);
        });
    }

    console.log('\n✅ DASHBOARD DATA STRUCTURE:');
    console.log('   📊 /api/dashboard/contract-info');
    console.log('      - onboardedDate: Date when user completed onboarding');
    console.log('      - deploymentBlock: Block number when contract was deployed');
    console.log('      - blocksIndexed: Number of blocks processed');
    console.log('      - blockRange: {start, end, deployment, total}');
    
    console.log('\n   🔄 /api/dashboard/indexing-status');
    console.log('      - isIndexed: Boolean if indexing is complete');
    console.log('      - progress: Percentage (0-100)');
    console.log('      - status: Current indexing status');
    console.log('      - currentStep: What the indexer is currently doing');
    
    console.log('\n   📈 /api/dashboard/block-metrics');
    console.log('      - totalTransactions: Count of all transactions');
    console.log('      - blocksProcessed: Number of blocks analyzed');
    console.log('      - transactionDensity: Transactions per block');
    console.log('      - avgTransactionsPerBlock: Average transactions per block');

    console.log('='.repeat(60));

    if (passed === total) {
      console.log('🎉 All dashboard endpoints are working correctly!');
      console.log('📊 The dashboard should now display proper data for:');
      console.log('   • Onboarded date');
      console.log('   • Deployment block');
      console.log('   • Blocks indexed');
      console.log('   • Block range');
    } else {
      console.log('⚠️  Some dashboard endpoints need fixes.');
    }
  }
}

// Run the test
async function main() {
  const tester = new DashboardEndpointTest();
  await tester.run();
}

if (process.argv[1].endsWith('test-dashboard-endpoints.js')) {
  main();
}

export { DashboardEndpointTest };
