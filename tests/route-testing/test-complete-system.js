#!/usr/bin/env node

/**
 * Complete System Verification
 * Tests entire MetaGauge system - backend, frontend, and full user flow
 */

import { execSync } from 'child_process';
import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:3000';

class SystemVerification {
  constructor() {
    this.results = {
      backend: { running: false, healthy: false },
      frontend: { running: false, healthy: false },
      routes: { total: 0, passed: 0, failed: 0 },
      flow: { total: 0, passed: 0, failed: 0 }
    };
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async checkServers() {
    await this.log('Checking server status...');

    // Check backend
    try {
      const response = await fetch(`${BACKEND_URL}/health`, { timeout: 5000 });
      this.results.backend.running = true;
      
      if (response.ok) {
        const data = await response.json();
        this.results.backend.healthy = data.status === 'healthy';
        await this.log(`Backend: ${response.status} - ${data.status || 'unknown'}`, 'success');
      } else {
        await this.log(`Backend: ${response.status} - not healthy`, 'warning');
      }
    } catch (error) {
      await this.log(`Backend: Not running - ${error.message}`, 'error');
    }

    // Check frontend
    try {
      const response = await fetch(FRONTEND_URL, { timeout: 5000 });
      this.results.frontend.running = response.ok;
      this.results.frontend.healthy = response.ok;
      
      if (response.ok) {
        await this.log(`Frontend: ${response.status} - running`, 'success');
      } else {
        await this.log(`Frontend: ${response.status} - not healthy`, 'warning');
      }
    } catch (error) {
      await this.log(`Frontend: Not running - ${error.message}`, 'error');
    }
  }

  async runRouteTests() {
    if (!this.results.backend.running) {
      await this.log('Skipping route tests - backend not running', 'warning');
      return;
    }

    await this.log('Running API route verification...');
    
    try {
      // Import and run the route verification
      const { QuickVerification } = await import('./verify-routes.js');
      const verifier = new QuickVerification();
      
      // Capture console output to parse results
      const originalLog = console.log;
      let output = '';
      console.log = (msg) => {
        output += msg + '\n';
        originalLog(msg);
      };
      
      await verifier.run();
      
      // Restore console.log
      console.log = originalLog;
      
      // Parse results
      const successMatches = output.match(/✅/g);
      const failMatches = output.match(/❌/g);
      
      this.results.routes.passed = successMatches ? successMatches.length : 0;
      this.results.routes.failed = failMatches ? failMatches.length : 0;
      this.results.routes.total = this.results.routes.passed + this.results.routes.failed;
      
      await this.log(`Route tests completed: ${this.results.routes.passed}/${this.results.routes.total} passed`, 'success');
      
    } catch (error) {
      await this.log(`Route tests failed: ${error.message}`, 'error');
    }
  }

  async runFrontendTests() {
    if (!this.results.frontend.running) {
      await this.log('Skipping frontend tests - frontend not running', 'warning');
      return;
    }

    await this.log('Running frontend route verification...');
    
    try {
      const { FrontendVerification } = await import('./test-frontend-routes.js');
      const verifier = new FrontendVerification();
      
      // Capture results
      const originalLog = console.log;
      let output = '';
      console.log = (msg) => {
        output += msg + '\n';
        originalLog(msg);
      };
      
      await verifier.run();
      console.log = originalLog;
      
      await this.log('Frontend tests completed', 'success');
      
    } catch (error) {
      await this.log(`Frontend tests failed: ${error.message}`, 'error');
    }
  }

  async runFlowTests() {
    if (!this.results.backend.running || !this.results.backend.healthy) {
      await this.log('Skipping flow tests - backend not ready', 'warning');
      return;
    }

    await this.log('Running complete user flow test...');
    
    try {
      // Run a simplified flow test
      await this.testBasicFlow();
      await this.log('Flow tests completed', 'success');
      
    } catch (error) {
      await this.log(`Flow tests failed: ${error.message}`, 'error');
    }
  }

  async testBasicFlow() {
    const testUser = {
      email: `flow-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Flow Test User'
    };

    let token = null;
    let passed = 0;
    let total = 0;

    // Helper function
    const apiCall = async (endpoint, options = {}) => {
      total++;
      try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          ...options
        });
        
        if (response.ok) {
          passed++;
          return await response.json();
        } else {
          throw new Error(`${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        await this.log(`Flow step failed: ${endpoint} - ${error.message}`, 'error');
        throw error;
      }
    };

    // 1. Register user
    const registerData = await apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });
    token = registerData.token;

    // 2. Get user info
    await apiCall('/api/auth/me');

    // 3. Complete onboarding
    await apiCall('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        chain: 'ethereum',
        contractName: 'Test Contract',
        purpose: 'Testing',
        category: 'defi'
      })
    });

    // 4. Get contracts
    await apiCall('/api/contracts');

    // 5. Check subscription
    await apiCall('/api/subscription/status');

    this.results.flow.total = total;
    this.results.flow.passed = passed;
    this.results.flow.failed = total - passed;
  }

  async checkDependencies() {
    await this.log('Checking system dependencies...');

    const deps = [
      { name: 'Node.js', cmd: 'node --version' },
      { name: 'npm', cmd: 'npm --version' },
      { name: 'Git', cmd: 'git --version' }
    ];

    for (const dep of deps) {
      try {
        const version = execSync(dep.cmd, { encoding: 'utf8' }).trim();
        await this.log(`${dep.name}: ${version}`, 'success');
      } catch (error) {
        await this.log(`${dep.name}: Not found`, 'error');
      }
    }
  }

  async checkEnvironment() {
    await this.log('Checking environment configuration...');

    const envVars = [
      'NODE_ENV',
      'ETHEREUM_RPC_URL1',
      'GEMINI_API_KEY',
      'JWT_SECRET'
    ];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        const masked = envVar.includes('KEY') || envVar.includes('SECRET') 
          ? '*'.repeat(8) 
          : value.length > 50 
            ? value.substring(0, 20) + '...' 
            : value;
        await this.log(`${envVar}: ${masked}`, 'success');
      } else {
        await this.log(`${envVar}: Not set`, 'warning');
      }
    }
  }

  async printFinalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 METAGAUGE SYSTEM VERIFICATION REPORT');
    console.log('='.repeat(80));

    // Server Status
    console.log('\n🖥️  SERVER STATUS:');
    console.log(`   Backend:  ${this.results.backend.running ? '✅ Running' : '❌ Not Running'} ${this.results.backend.healthy ? '(Healthy)' : '(Unhealthy)'}`);
    console.log(`   Frontend: ${this.results.frontend.running ? '✅ Running' : '❌ Not Running'} ${this.results.frontend.healthy ? '(Healthy)' : '(Unhealthy)'}`);

    // Route Tests
    if (this.results.routes.total > 0) {
      console.log('\n🔌 API ROUTES:');
      const routeRate = (this.results.routes.passed / this.results.routes.total * 100).toFixed(1);
      console.log(`   Tested: ${this.results.routes.total} endpoints`);
      console.log(`   Passed: ${this.results.routes.passed} (${routeRate}%)`);
      console.log(`   Failed: ${this.results.routes.failed}`);
    }

    // Flow Tests
    if (this.results.flow.total > 0) {
      console.log('\n🔄 USER FLOW:');
      const flowRate = (this.results.flow.passed / this.results.flow.total * 100).toFixed(1);
      console.log(`   Steps: ${this.results.flow.total}`);
      console.log(`   Passed: ${this.results.flow.passed} (${flowRate}%)`);
      console.log(`   Failed: ${this.results.flow.failed}`);
    }

    // Overall Assessment
    console.log('\n🎯 OVERALL ASSESSMENT:');
    
    let score = 0;
    let maxScore = 0;

    // Server health (40 points)
    maxScore += 40;
    if (this.results.backend.running && this.results.backend.healthy) score += 20;
    if (this.results.frontend.running && this.results.frontend.healthy) score += 20;

    // Route tests (40 points)
    maxScore += 40;
    if (this.results.routes.total > 0) {
      score += (this.results.routes.passed / this.results.routes.total) * 40;
    }

    // Flow tests (20 points)
    maxScore += 20;
    if (this.results.flow.total > 0) {
      score += (this.results.flow.passed / this.results.flow.total) * 20;
    }

    const overallScore = (score / maxScore * 100).toFixed(1);
    console.log(`   Score: ${overallScore}%`);

    if (overallScore >= 90) {
      console.log('   Status: 🎉 EXCELLENT - System is production ready!');
    } else if (overallScore >= 75) {
      console.log('   Status: ✅ GOOD - Minor issues to address');
    } else if (overallScore >= 50) {
      console.log('   Status: ⚠️  FAIR - Several issues need fixing');
    } else {
      console.log('   Status: ❌ POOR - Major issues require attention');
    }

    console.log('\n📋 RECOMMENDATIONS:');
    
    if (!this.results.backend.running) {
      console.log('   • Start backend server: npm run dev');
    }
    if (!this.results.frontend.running) {
      console.log('   • Start frontend server: cd frontend && npm run dev');
    }
    if (this.results.routes.failed > 0) {
      console.log('   • Check failed API endpoints and fix implementation');
    }
    if (this.results.flow.failed > 0) {
      console.log('   • Review user flow issues and database connectivity');
    }
    if (!process.env.GEMINI_API_KEY) {
      console.log('   • Set GEMINI_API_KEY for AI features');
    }

    console.log('='.repeat(80));
  }

  async run() {
    console.log('🚀 MetaGauge Complete System Verification\n');

    await this.checkDependencies();
    await this.checkEnvironment();
    await this.checkServers();
    
    if (this.results.backend.running) {
      await this.runRouteTests();
      await this.runFlowTests();
    }
    
    if (this.results.frontend.running) {
      await this.runFrontendTests();
    }

    await this.printFinalReport();
  }
}

// Main execution
async function main() {
  const verifier = new SystemVerification();
  
  try {
    await verifier.run();
  } catch (error) {
    console.error('❌ System verification failed:', error.message);
    process.exit(1);
  }
}

if (process.argv[1].endsWith('test-complete-system.js')) {
  main();
}

export { SystemVerification };
