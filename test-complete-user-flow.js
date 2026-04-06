#!/usr/bin/env node

/**
 * Complete User Flow Test
 * Tests entire MetaGauge workflow from registration to analytics
 */

import fetch from 'node-fetch';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000';

class MetaGaugeFlowTest {
  constructor() {
    this.token = null;
    this.userId = null;
    this.contractId = null;
    this.analysisId = null;
    this.chatSessionId = null;
    this.ws = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(description, testFn) {
    try {
      await this.log(`Testing: ${description}`);
      await testFn();
      this.testResults.passed++;
      await this.log(`✅ PASSED: ${description}`, 'success');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push({ description, error: error.message });
      await this.log(`❌ FAILED: ${description} - ${error.message}`, 'error');
    }
  }

  async apiCall(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      throw new Error(`${response.status}: ${data.message || data.error || 'Request failed'}`);
    }

    return { response, data };
  }

  async runCompleteFlow() {
    await this.log('🚀 Starting Complete MetaGauge Flow Test');
    
    // Phase 1: Authentication & User Management
    await this.testAuthenticationFlow();
    
    // Phase 2: Onboarding & Contract Setup
    await this.testOnboardingFlow();
    
    // Phase 3: Analytics & Indexing
    await this.testAnalyticsFlow();
    
    // Phase 4: AI & Chat Features
    await this.testAIFeatures();
    
    // Phase 5: Advanced Features
    await this.testAdvancedFeatures();
    
    // Phase 6: WebSocket & Real-time
    await this.testWebSocketFeatures();
    
    // Phase 7: Subscription & Billing
    await this.testSubscriptionFeatures();
    
    // Cleanup
    await this.cleanup();
    
    // Results
    await this.printResults();
  }

  async testAuthenticationFlow() {
    await this.log('📋 Phase 1: Authentication & User Management');

    // Test user registration
    await this.test('User Registration', async () => {
      const { data } = await this.apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Test User'
        })
      });
      
      if (!data.token) throw new Error('No token received');
      this.token = data.token;
      this.userId = data.user.id;
    });

    // Test user login
    await this.test('User Login', async () => {
      const { data } = await this.apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: `test-${Date.now()-1000}@example.com`,
          password: 'TestPassword123!'
        })
      });
      // Should fail for non-existent user, but endpoint should work
    });

    // Test get current user
    await this.test('Get Current User', async () => {
      const { data } = await this.apiCall('/api/auth/me');
      if (!data.user || !data.user.id) throw new Error('User data not returned');
    });

    // Test API key generation
    await this.test('Generate API Key', async () => {
      const { data } = await this.apiCall('/api/auth/refresh-api-key', {
        method: 'POST'
      });
      if (!data.apiKey) throw new Error('API key not generated');
    });
  }

  async testOnboardingFlow() {
    await this.log('🎯 Phase 2: Onboarding & Contract Setup');

    // Test onboarding completion
    await this.test('Complete Onboarding', async () => {
      const { data } = await this.apiCall('/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI token
          chain: 'ethereum',
          contractName: 'Test Contract',
          purpose: 'Testing',
          category: 'defi',
          socialLinks: {
            website: 'https://test.com',
            twitter: 'https://twitter.com/test'
          }
        })
      });
      
      if (!data.defaultContractId) throw new Error('Contract not created');
      this.contractId = data.defaultContractId;
    });

    // Test trigger indexing
    await this.test('Trigger Contract Indexing', async () => {
      const { data } = await this.apiCall('/api/onboarding/trigger-indexing', {
        method: 'POST'
      });
      
      if (!data.analysisId) throw new Error('Analysis not started');
      this.analysisId = data.analysisId;
    });

    // Test get default contract
    await this.test('Get Default Contract', async () => {
      const { data } = await this.apiCall('/api/onboarding/default-contract');
      if (!data.contract) throw new Error('Default contract not found');
    });
  }

  async testAnalyticsFlow() {
    await this.log('📊 Phase 3: Analytics & Indexing');

    // Test contract management
    await this.test('List Contracts', async () => {
      const { data } = await this.apiCall('/api/contracts');
      if (!Array.isArray(data)) throw new Error('Contracts not returned as array');
    });

    // Test analysis status
    await this.test('Get Analysis Status', async () => {
      if (!this.analysisId) throw new Error('No analysis ID available');
      const { data } = await this.apiCall(`/api/analysis/${this.analysisId}/status`);
      if (!data.status) throw new Error('Analysis status not returned');
    });

    // Test analysis results
    await this.test('Get Analysis Results', async () => {
      if (!this.analysisId) throw new Error('No analysis ID available');
      const { data } = await this.apiCall(`/api/analysis/${this.analysisId}/results`);
      // Results might be empty if indexing just started
    });

    // Test metrics endpoints
    await this.test('Get Enhanced Metrics', async () => {
      const { data } = await this.apiCall('/api/enhanced-metrics/analysis');
      // Should return metrics data structure
    });

    // Test user metrics
    await this.test('Get User Metrics', async () => {
      const { data } = await this.apiCall('/api/enhanced-metrics/users');
      // Should return user analytics
    });

    // Test function signatures
    await this.test('Get Function Signatures', async () => {
      const { data } = await this.apiCall('/api/functions/signatures', {
        method: 'GET'
      });
      // Should return function signature data
    });
  }

  async testAIFeatures() {
    await this.log('🤖 Phase 4: AI & Chat Features');

    // Test create chat session
    await this.test('Create Chat Session', async () => {
      const { data } = await this.apiCall('/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Chat Session'
        })
      });
      
      if (!data.sessionId) throw new Error('Chat session not created');
      this.chatSessionId = data.sessionId;
    });

    // Test send chat message
    await this.test('Send Chat Message', async () => {
      if (!this.chatSessionId) throw new Error('No chat session available');
      
      const { data } = await this.apiCall('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: this.chatSessionId,
          message: 'What are the key metrics for my contract?',
          contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
        })
      });
      
      if (!data.response) throw new Error('AI response not received');
    });

    // Test get chat sessions
    await this.test('List Chat Sessions', async () => {
      const { data } = await this.apiCall('/api/chat/sessions');
      if (!Array.isArray(data)) throw new Error('Chat sessions not returned as array');
    });

    // Test AI insights
    await this.test('Get AI Insights', async () => {
      if (!this.analysisId) throw new Error('No analysis ID available');
      const { data } = await this.apiCall(`/api/analysis/${this.analysisId}/interpret`, {
        method: 'POST',
        body: JSON.stringify({
          focusAreas: ['user_behavior', 'performance']
        })
      });
      // AI insights might take time to generate
    });

    // Test simple AI advice
    await this.test('Get AI Advice', async () => {
      const { data } = await this.apiCall('/api/advice/generate', {
        method: 'POST',
        body: JSON.stringify({
          contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
          chain: 'ethereum'
        })
      });
      // Should return AI-generated advice
    });
  }

  async testAdvancedFeatures() {
    await this.log('⚡ Phase 5: Advanced Features');

    // Test competitive analysis
    await this.test('Get Competitive Analysis', async () => {
      const { data } = await this.apiCall('/api/competitive/analysis');
      // Should return competitive data structure
    });

    // Test wallet analytics
    await this.test('Get Wallet Analytics', async () => {
      const { data } = await this.apiCall('/api/wallet-analytics/enrichment');
      // Should return wallet enrichment data
    });

    // Test alerts configuration
    await this.test('Configure Alerts', async () => {
      const { data } = await this.apiCall('/api/alerts/configure', {
        method: 'POST',
        body: JSON.stringify({
          enabled: true,
          thresholds: {
            retentionDrop: 20,
            botSurge: 50,
            churnSpike: 30
          },
          notifications: {
            email: true,
            inApp: true
          }
        })
      });
      // Should configure alerts successfully
    });

    // Test filters
    await this.test('Apply Filters', async () => {
      const { data } = await this.apiCall('/api/filters/apply', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31'
          },
          userTypes: ['whale', 'regular'],
          transactionTypes: ['successful']
        })
      });
      // Should apply filters successfully
    });

    // Test monitoring
    await this.test('Get System Monitoring', async () => {
      const { data } = await this.apiCall('/api/monitoring/health');
      if (!data.status) throw new Error('Health status not returned');
    });
  }

  async testWebSocketFeatures() {
    await this.log('🔌 Phase 6: WebSocket & Real-time Features');

    await this.test('WebSocket Connection', async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        this.ws = new WebSocket(WS_URL);
        
        this.ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.log(`WebSocket message: ${message.type}`);
          } catch (e) {
            // Ignore parsing errors
          }
        });
      });
    });

    // Test indexer status via WebSocket
    await this.test('Indexer Status via WebSocket', async () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }
      
      // Send a message to trigger status update
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'indexing_progress',
        userId: this.userId
      }));
      
      // Wait for response (simplified test)
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
  }

  async testSubscriptionFeatures() {
    await this.log('💳 Phase 7: Subscription & Billing');

    // Test subscription status
    await this.test('Get Subscription Status', async () => {
      const { data } = await this.apiCall('/api/subscription/status');
      if (!data.tier) throw new Error('Subscription tier not returned');
    });

    // Test usage stats
    await this.test('Get Usage Statistics', async () => {
      const { data } = await this.apiCall('/api/subscription/usage');
      // Should return usage data
    });

    // Test billing information
    await this.test('Get Billing Info', async () => {
      const { data } = await this.apiCall('/api/billing/info');
      // Should return billing structure
    });
  }

  async testHealthAndDiagnostics() {
    await this.log('🏥 Health & Diagnostics');

    // Test health endpoint
    await this.test('Health Check', async () => {
      const { data } = await this.apiCall('/health');
      if (data.status !== 'healthy') throw new Error('System not healthy');
    });

    // Test indexer health
    await this.test('Indexer Health', async () => {
      const { data } = await this.apiCall('/api/indexer/health');
      // Should return indexer health status
    });

    // Test RPC health
    await this.test('RPC Health Check', async () => {
      const { data } = await this.apiCall('/api/monitoring/rpc-health');
      // Should return RPC endpoint health
    });
  }

  async cleanup() {
    await this.log('🧹 Cleaning up test resources');

    try {
      // Close WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }

      // Stop any ongoing indexing
      if (this.analysisId) {
        await this.apiCall('/api/indexer/stop', { method: 'POST' }).catch(() => {});
      }

      // Delete test chat sessions
      if (this.chatSessionId) {
        await this.apiCall(`/api/chat/sessions/${this.chatSessionId}`, { 
          method: 'DELETE' 
        }).catch(() => {});
      }

    } catch (error) {
      await this.log(`Cleanup error: ${error.message}`, 'error');
    }
  }

  async printResults() {
    await this.log('📋 Test Results Summary');
    console.log('\n' + '='.repeat(60));
    console.log(`✅ PASSED: ${this.testResults.passed}`);
    console.log(`❌ FAILED: ${this.testResults.failed}`);
    console.log(`📊 TOTAL:  ${this.testResults.passed + this.testResults.failed}`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.description}`);
        console.log(`   Error: ${error.error}\n`);
      });
    }
    
    console.log('='.repeat(60));
    
    const successRate = (this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100;
    console.log(`🎯 Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 90) {
      console.log('🎉 EXCELLENT! System is working well.');
    } else if (successRate >= 70) {
      console.log('⚠️  GOOD but needs attention on failed tests.');
    } else {
      console.log('🚨 CRITICAL issues found. System needs fixes.');
    }
  }
}

// Run the complete test
async function main() {
  const tester = new MetaGaugeFlowTest();
  
  try {
    await tester.runCompleteFlow();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) throw new Error('Server not responding');
    console.log('✅ Server is running');
    return true;
  } catch (error) {
    console.error('❌ Server is not running. Please start the server first:');
    console.error('   npm run dev');
    return false;
  }
}

// Entry point
if (process.argv[1].endsWith('test-complete-user-flow.js')) {
  checkServer().then(isRunning => {
    if (isRunning) {
      main();
    } else {
      process.exit(1);
    }
  });
}

export { MetaGaugeFlowTest };
