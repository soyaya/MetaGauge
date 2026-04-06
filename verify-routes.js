#!/usr/bin/env node

/**
 * Quick Route Verification Test
 * Tests all major API endpoints and features
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Test data
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Flow Test User'
};

const TEST_CONTRACT = {
  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI token
  chain: 'ethereum',
  name: 'Test Contract',
  purpose: 'Testing',
  category: 'defi'
};

class QuickVerification {
  constructor() {
    this.token = null;
    this.userId = null;
    this.results = [];
  }

  async api(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json().catch(() => ({}));
      
      return {
        ok: response.ok,
        status: response.status,
        data,
        error: !response.ok ? (data.message || data.error || 'Request failed') : null
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: {},
        error: error.message
      };
    }
  }

  log(endpoint, method, status, error = null) {
    const result = {
      endpoint,
      method: method || 'GET',
      status,
      success: status >= 200 && status < 300,
      error
    };
    
    this.results.push(result);
    
    const icon = result.success ? '✅' : '❌';
    const errorMsg = error ? ` - ${error}` : '';
    console.log(`${icon} ${method || 'GET'} ${endpoint} → ${status}${errorMsg}`);
  }

  async run() {
    console.log('🚀 Starting MetaGauge Route Verification\n');

    // 1. Health Check
    console.log('📋 System Health');
    const health = await this.api('/health');
    this.log('/health', 'GET', health.status, health.error);

    // 2. Authentication Flow
    console.log('\n🔐 Authentication');
    
    // Register
    const register = await this.api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(TEST_USER)
    });
    this.log('/api/auth/register', 'POST', register.status, register.error);
    
    if (register.ok && register.data.token) {
      this.token = register.data.token;
      this.userId = register.data.user?.id;
    }

    // Get current user
    const me = await this.api('/api/auth/me');
    this.log('/api/auth/me', 'GET', me.status, me.error);

    // Generate API key
    const apiKey = await this.api('/api/auth/refresh-api-key', { method: 'POST' });
    this.log('/api/auth/refresh-api-key', 'POST', apiKey.status, apiKey.error);

    // 3. Onboarding Flow
    console.log('\n🎯 Onboarding');
    
    const onboarding = await this.api('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(TEST_CONTRACT)
    });
    this.log('/api/onboarding/complete', 'POST', onboarding.status, onboarding.error);

    const defaultContract = await this.api('/api/onboarding/default-contract');
    this.log('/api/onboarding/default-contract', 'GET', defaultContract.status, defaultContract.error);

    const triggerIndexing = await this.api('/api/onboarding/trigger-indexing', { method: 'POST' });
    this.log('/api/onboarding/trigger-indexing', 'POST', triggerIndexing.status, triggerIndexing.error);

    // 4. Contract Management
    console.log('\n📋 Contract Management');
    
    const contracts = await this.api('/api/contracts');
    this.log('/api/contracts', 'GET', contracts.status, contracts.error);

    // 5. Analysis & Metrics
    console.log('\n📊 Analysis & Metrics');
    
    const analysisMetrics = await this.api('/api/enhanced-metrics/analysis');
    this.log('/api/enhanced-metrics/analysis', 'GET', analysisMetrics.status, analysisMetrics.error);

    const userMetrics = await this.api('/api/enhanced-metrics/users');
    this.log('/api/enhanced-metrics/users', 'GET', userMetrics.status, userMetrics.error);

    const functions = await this.api('/api/functions/signatures');
    this.log('/api/functions/signatures', 'GET', functions.status, functions.error);

    // 6. AI Features
    console.log('\n🤖 AI Features');
    
    const chatSessions = await this.api('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Session' })
    });
    this.log('/api/chat/sessions', 'POST', chatSessions.status, chatSessions.error);

    const chatList = await this.api('/api/chat/sessions');
    this.log('/api/chat/sessions', 'GET', chatList.status, chatList.error);

    const advice = await this.api('/api/advice/generate', {
      method: 'POST',
      body: JSON.stringify({
        contractAddress: TEST_CONTRACT.address,
        chain: TEST_CONTRACT.chain
      })
    });
    this.log('/api/advice/generate', 'POST', advice.status, advice.error);

    // 7. Advanced Features
    console.log('\n⚡ Advanced Features');
    
    const competitive = await this.api('/api/competitive/analysis');
    this.log('/api/competitive/analysis', 'GET', competitive.status, competitive.error);

    const walletAnalytics = await this.api('/api/wallet-analytics/enrichment');
    this.log('/api/wallet-analytics/enrichment', 'GET', walletAnalytics.status, walletAnalytics.error);

    const alerts = await this.api('/api/alerts/configure', {
      method: 'POST',
      body: JSON.stringify({
        enabled: true,
        thresholds: { retentionDrop: 20 }
      })
    });
    this.log('/api/alerts/configure', 'POST', alerts.status, alerts.error);

    // 8. Subscription & Billing
    console.log('\n💳 Subscription & Billing');
    
    const subscription = await this.api('/api/subscription/status');
    this.log('/api/subscription/status', 'GET', subscription.status, subscription.error);

    const usage = await this.api('/api/subscription/usage');
    this.log('/api/subscription/usage', 'GET', usage.status, usage.error);

    const billing = await this.api('/api/billing/info');
    this.log('/api/billing/info', 'GET', billing.status, billing.error);

    // 9. Monitoring & Health
    console.log('\n🏥 Monitoring & Health');
    
    const monitoring = await this.api('/api/monitoring/health');
    this.log('/api/monitoring/health', 'GET', monitoring.status, monitoring.error);

    const indexerHealth = await this.api('/api/indexer/health');
    this.log('/api/indexer/health', 'GET', indexerHealth.status, indexerHealth.error);

    // 10. Indexer Controls
    console.log('\n🔄 Indexer Controls');
    
    const indexerStatus = await this.api('/api/indexer/status');
    this.log('/api/indexer/status', 'GET', indexerStatus.status, indexerStatus.error);

    const indexerMetrics = await this.api('/api/indexer/metrics');
    this.log('/api/indexer/metrics', 'GET', indexerMetrics.status, indexerMetrics.error);

    // Results Summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 VERIFICATION SUMMARY');
    console.log('='.repeat(60));

    const total = this.results.length;
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log(`✅ Successful: ${successful}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📊 Success Rate: ${((successful/total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED ENDPOINTS:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   ${r.method} ${r.endpoint} → ${r.status} ${r.error || ''}`);
        });
    }

    // Group by feature
    console.log('\n📊 BY FEATURE:');
    const features = {
      'Health': this.results.filter(r => r.endpoint.includes('/health')),
      'Auth': this.results.filter(r => r.endpoint.includes('/auth')),
      'Onboarding': this.results.filter(r => r.endpoint.includes('/onboarding')),
      'Contracts': this.results.filter(r => r.endpoint.includes('/contracts')),
      'Analytics': this.results.filter(r => r.endpoint.includes('/metrics') || r.endpoint.includes('/functions')),
      'AI': this.results.filter(r => r.endpoint.includes('/chat') || r.endpoint.includes('/advice')),
      'Advanced': this.results.filter(r => r.endpoint.includes('/competitive') || r.endpoint.includes('/wallet') || r.endpoint.includes('/alerts')),
      'Subscription': this.results.filter(r => r.endpoint.includes('/subscription') || r.endpoint.includes('/billing')),
      'Monitoring': this.results.filter(r => r.endpoint.includes('/monitoring') || r.endpoint.includes('/indexer'))
    };

    Object.entries(features).forEach(([name, routes]) => {
      if (routes.length > 0) {
        const success = routes.filter(r => r.success).length;
        const rate = ((success / routes.length) * 100).toFixed(0);
        const icon = rate >= 80 ? '✅' : rate >= 50 ? '⚠️' : '❌';
        console.log(`   ${icon} ${name}: ${success}/${routes.length} (${rate}%)`);
      }
    });

    console.log('='.repeat(60));

    // Overall assessment
    const successRate = (successful / total) * 100;
    if (successRate >= 90) {
      console.log('🎉 EXCELLENT! All major features working.');
    } else if (successRate >= 70) {
      console.log('⚠️  GOOD but some endpoints need attention.');
    } else if (successRate >= 50) {
      console.log('🚨 MODERATE issues. Several features not working.');
    } else {
      console.log('💥 CRITICAL issues. Major system problems detected.');
    }
  }
}

// Check server and run
async function main() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) throw new Error('Server not responding');
    
    console.log('✅ Server is running, starting verification...\n');
    
    const verifier = new QuickVerification();
    await verifier.run();
    
  } catch (error) {
    console.error('❌ Cannot connect to server. Please ensure server is running:');
    console.error('   npm run dev');
    console.error(`   Server should be running on ${BASE_URL}`);
    process.exit(1);
  }
}

if (process.argv[1].endsWith('verify-routes.js')) {
  main();
}

export { QuickVerification };
