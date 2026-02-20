#!/usr/bin/env node

/**
 * Test Onboarding Flow
 * Simulates user registration, onboarding, and monitors data loading
 */

const API_URL = 'http://localhost:5000';

async function testOnboardingFlow() {
  console.log('🧪 Testing Onboarding Flow\n');
  
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  try {
    // Step 1: Register
    console.log('1️⃣ Registering user...');
    const registerRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: 'Test User'
      })
    });
    
    if (!registerRes.ok) {
      throw new Error(`Registration failed: ${await registerRes.text()}`);
    }
    
    const { token, user } = await registerRes.json();
    console.log(`✅ Registered: ${user.email}`);
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Step 2: Complete Onboarding
    console.log('\n2️⃣ Completing onboarding with WETH contract...');
    const startTime = Date.now();
    
    const onboardingRes = await fetch(`${API_URL}/api/onboarding/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        chain: 'ethereum',
        contractName: 'WETH',
        purpose: 'Wrapped Ether - High volume DeFi token',
        category: 'defi',
        startDate: new Date().toISOString(),
        socialLinks: {}
      })
    });
    
    if (!onboardingRes.ok) {
      throw new Error(`Onboarding failed: ${await onboardingRes.text()}`);
    }
    
    const onboardingData = await onboardingRes.json();
    const onboardingTime = Date.now() - startTime;
    console.log(`✅ Onboarding completed in ${onboardingTime}ms`);
    console.log(`   Indexing started: ${onboardingData.indexingStarted}`);
    
    // Step 3: Monitor indexing progress
    console.log('\n3️⃣ Monitoring indexing progress...');
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const statusRes = await fetch(`${API_URL}/api/onboarding/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const status = await statusRes.json();
      
      console.log(`   [${attempts * 2}s] Progress: ${status.indexingProgress}% - ${status.currentStep || 'Processing...'}`);
      
      if (status.isIndexed) {
        console.log(`\n✅ Indexing completed in ${attempts * 2} seconds!`);
        break;
      }
    }
    
    // Step 4: Check if data is available
    console.log('\n4️⃣ Checking dashboard data...');
    const dashboardRes = await fetch(`${API_URL}/api/onboarding/default-contract`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!dashboardRes.ok) {
      console.log('⚠️  Dashboard data not yet available');
    } else {
      const dashboardData = await dashboardRes.json();
      console.log('✅ Dashboard data available:');
      console.log(`   Contract: ${dashboardData.contract.name}`);
      console.log(`   Indexed: ${dashboardData.indexingStatus.isIndexed}`);
      console.log(`   Metrics: ${dashboardData.metrics ? 'Available' : 'Not yet'}`);
      
      if (dashboardData.metrics) {
        console.log(`   Transactions: ${dashboardData.metrics.transactions || 0}`);
        console.log(`   Unique Users: ${dashboardData.metrics.uniqueUsers || 0}`);
        console.log(`   TVL: ${dashboardData.metrics.tvl || 0}`);
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   You can now login at http://localhost:3000/login`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testOnboardingFlow();
