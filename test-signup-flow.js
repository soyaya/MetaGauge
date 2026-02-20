/**
 * Test user signup flow
 * This tests the complete registration process
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';

async function testSignup() {
  console.log('🧪 Testing User Signup Flow\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Health check
    console.log('\n1️⃣  Testing health endpoint...');
    const healthResponse = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData.status);

    // Test 2: Simple test endpoint
    console.log('\n2️⃣  Testing simple endpoint...');
    const testResponse = await fetch(`${API_URL}/test`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!testResponse.ok) {
      throw new Error(`Test endpoint failed: ${testResponse.status}`);
    }
    
    const testData = await testResponse.json();
    console.log('✅ Test endpoint passed:', testData.message);

    // Test 3: Registration
    console.log('\n3️⃣  Testing user registration...');
    const timestamp = Date.now();
    const testUser = {
      email: `test${timestamp}@example.com`,
      password: 'TestPassword123!',
      walletAddress: `0x${timestamp.toString(16).padStart(40, '0')}`
    };

    console.log('   Registering user:', testUser.email);
    console.log('   Wallet:', testUser.walletAddress);

    const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json();
      throw new Error(`Registration failed: ${registerResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const registerData = await registerResponse.json();
    console.log('✅ Registration successful!');
    console.log('   User ID:', registerData.user.id);
    console.log('   Token received:', registerData.token ? 'Yes' : 'No');

    // Test 4: Login
    console.log('\n4️⃣  Testing user login...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      throw new Error(`Login failed: ${loginResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log('   Token received:', loginData.token ? 'Yes' : 'No');

    // Test 5: Access protected endpoint
    console.log('\n5️⃣  Testing protected endpoint access...');
    const profileResponse = await fetch(`${API_URL}/api/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      }
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json();
      throw new Error(`Profile access failed: ${profileResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const profileData = await profileResponse.json();
    console.log('✅ Protected endpoint access successful!');
    console.log('   Profile email:', profileData.email);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n✅ Backend is working correctly');
    console.log('✅ Registration flow is functional');
    console.log('✅ Authentication is working');
    console.log('✅ Protected routes are accessible\n');

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Backend server is not running or not responding');
      console.error('   Please restart the backend server:');
      console.error('   1. Press Ctrl+C in the terminal where backend is running');
      console.error('   2. Run: node src/api/server.js');
    }
    
    process.exit(1);
  }
}

// Run the test
testSignup();
