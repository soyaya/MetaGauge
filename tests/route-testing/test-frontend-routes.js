#!/usr/bin/env node

/**
 * Frontend Routes Verification
 * Tests all frontend pages and components
 */

import fetch from 'node-fetch';

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:5000';

class FrontendVerification {
  constructor() {
    this.results = [];
  }

  async checkRoute(path, expectedStatus = 200) {
    try {
      const response = await fetch(`${FRONTEND_URL}${path}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'MetaGauge-Test/1.0'
        }
      });

      const success = response.status === expectedStatus;
      const result = {
        path,
        status: response.status,
        success,
        error: success ? null : `Expected ${expectedStatus}, got ${response.status}`
      };

      this.results.push(result);
      
      const icon = success ? '✅' : '❌';
      console.log(`${icon} ${path} → ${response.status}`);
      
      return result;
    } catch (error) {
      const result = {
        path,
        status: 0,
        success: false,
        error: error.message
      };
      
      this.results.push(result);
      console.log(`❌ ${path} → ERROR: ${error.message}`);
      return result;
    }
  }

  async run() {
    console.log('🌐 Starting Frontend Route Verification\n');

    // Public routes
    console.log('📋 Public Routes');
    await this.checkRoute('/');                    // Landing page
    await this.checkRoute('/login');               // Login page
    await this.checkRoute('/signup');              // Signup page
    await this.checkRoute('/forgot-password');     // Forgot password
    await this.checkRoute('/reset-password');      // Reset password
    await this.checkRoute('/verify');              // Email verification

    // Protected routes (should redirect to login)
    console.log('\n🔐 Protected Routes (should redirect)');
    await this.checkRoute('/dashboard', 307);      // Dashboard (redirect)
    await this.checkRoute('/onboarding', 307);     // Onboarding (redirect)
    await this.checkRoute('/analyzer', 307);       // Analyzer (redirect)
    await this.checkRoute('/chat', 307);           // Chat (redirect)
    await this.checkRoute('/profile', 307);        // Profile (redirect)
    await this.checkRoute('/subscription', 307);   // Subscription (redirect)
    await this.checkRoute('/alerts', 307);         // Alerts (redirect)
    await this.checkRoute('/history', 307);        // History (redirect)

    // API routes (should return JSON)
    console.log('\n🔌 API Routes');
    await this.checkRoute('/api/health', 404);     // Should be on backend

    // Static assets
    console.log('\n📁 Static Assets');
    await this.checkRoute('/favicon.ico');
    await this.checkRoute('/icon.svg');

    // 404 handling
    console.log('\n🚫 404 Handling');
    await this.checkRoute('/non-existent-page', 404);

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 FRONTEND VERIFICATION SUMMARY');
    console.log('='.repeat(60));

    const total = this.results.length;
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log(`✅ Successful: ${successful}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📊 Success Rate: ${((successful/total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED ROUTES:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   ${r.path} → ${r.status} ${r.error || ''}`);
        });
    }

    console.log('='.repeat(60));

    const successRate = (successful / total) * 100;
    if (successRate >= 90) {
      console.log('🎉 EXCELLENT! Frontend is working properly.');
    } else if (successRate >= 70) {
      console.log('⚠️  GOOD but some routes need attention.');
    } else {
      console.log('🚨 CRITICAL issues with frontend routing.');
    }
  }
}

// Check both servers and run
async function main() {
  console.log('🔍 Checking servers...');
  
  // Check backend
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/health`);
    if (backendResponse.ok) {
      console.log('✅ Backend server is running');
    } else {
      console.log('⚠️  Backend server responding but not healthy');
    }
  } catch (error) {
    console.log('❌ Backend server is not running');
  }

  // Check frontend
  try {
    const frontendResponse = await fetch(FRONTEND_URL);
    if (frontendResponse.ok) {
      console.log('✅ Frontend server is running\n');
      
      const verifier = new FrontendVerification();
      await verifier.run();
    } else {
      throw new Error('Frontend not responding properly');
    }
  } catch (error) {
    console.error('❌ Cannot connect to frontend server. Please ensure it\'s running:');
    console.error('   cd frontend && npm run dev');
    console.error(`   Frontend should be running on ${FRONTEND_URL}`);
    process.exit(1);
  }
}

if (process.argv[1].endsWith('test-frontend-routes.js')) {
  main();
}

export { FrontendVerification };
