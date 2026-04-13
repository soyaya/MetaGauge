#!/usr/bin/env node

/**
 * Test Rate Limiting Fix
 * Verifies that rate limiting doesn't block normal dashboard usage
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

class RateLimitTest {
  constructor() {
    this.token = null;
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

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data, headers: response.headers };
  }

  async setupUser() {
    console.log('🔧 Setting up test user...');

    const testUser = {
      email: `rate-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Rate Limit Test User'
    };

    const { data } = await this.apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });

    this.token = data.token;
    console.log('✅ Test user created and authenticated\n');
  }

  async testRateLimit() {
    console.log('🚀 Testing Rate Limiting After Onboarding\n');

    // Complete onboarding first
    console.log('📋 Completing onboarding...');
    await this.apiCall('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        chain: 'ethereum',
        contractName: 'Test Contract',
        purpose: 'Testing',
        category: 'defi',
        socialLinks: {}
      })
    });
    console.log('✅ Onboarding completed\n');

    // Simulate the API calls that happen after onboarding
    const endpoints = [
      '/api/onboarding/default-contract',
      '/api/billing/usage',
      '/api/subscription/status',
      '/api/dashboard/contract-info',
      '/api/dashboard/indexing-status',
      '/api/dashboard/block-metrics',
      '/api/onboarding/user-metrics'
    ];

    console.log('📊 Making rapid API calls (simulating dashboard load)...');
    
    let successCount = 0;
    let rateLimitCount = 0;
    
    // Make multiple rapid calls to each endpoint
    for (let i = 0; i < 3; i++) {
      console.log(`\n🔄 Round ${i + 1}:`);
      
      for (const endpoint of endpoints) {
        try {
          const { status, headers } = await this.apiCall(endpoint);
          
          if (status === 429) {
            rateLimitCount++;
            console.log(`❌ ${endpoint} → 429 (Rate Limited)`);
            
            // Check rate limit headers
            const remaining = headers.get('x-ratelimit-remaining');
            const reset = headers.get('x-ratelimit-reset');
            if (remaining !== null) {
              console.log(`   Remaining: ${remaining}, Reset: ${reset}`);
            }
          } else if (status >= 200 && status < 300) {
            successCount++;
            console.log(`✅ ${endpoint} → ${status}`);
          } else {
            console.log(`⚠️  ${endpoint} → ${status}`);
          }
        } catch (error) {
          console.log(`❌ ${endpoint} → ERROR: ${error.message}`);
        }
        
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Delay between rounds
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RATE LIMITING TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Successful calls: ${successCount}`);
    console.log(`❌ Rate limited calls: ${rateLimitCount}`);
    console.log(`📊 Total calls made: ${successCount + rateLimitCount}`);
    
    const successRate = (successCount / (successCount + rateLimitCount)) * 100;
    console.log(`📈 Success rate: ${successRate.toFixed(1)}%`);

    if (rateLimitCount === 0) {
      console.log('\n🎉 EXCELLENT! No rate limiting issues detected.');
      console.log('✅ Dashboard should load smoothly after onboarding.');
    } else if (successRate >= 80) {
      console.log('\n⚠️  MINOR rate limiting detected but mostly working.');
      console.log('💡 Consider further rate limit adjustments if needed.');
    } else {
      console.log('\n🚨 SIGNIFICANT rate limiting issues detected.');
      console.log('❌ Dashboard may have loading problems.');
    }
  }

  async run() {
    try {
      // Check server
      const health = await fetch(`${BASE_URL}/health`);
      if (!health.ok) throw new Error('Server not healthy');
      console.log('✅ Server is running\n');

      await this.setupUser();
      await this.testRateLimit();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the test
async function main() {
  const tester = new RateLimitTest();
  await tester.run();
}

if (process.argv[1].endsWith('test-rate-limit-fix.js')) {
  main();
}

export { RateLimitTest };
