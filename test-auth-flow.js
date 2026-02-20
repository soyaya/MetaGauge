#!/usr/bin/env node

/**
 * Test user signup and login flow
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';
const timestamp = Date.now();
const testUser = {
  email: `testuser-${timestamp}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User'
};

console.log('🧪 Testing Authentication Flow\n');
console.log('Test User:', testUser.email);
console.log('');

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Test signup
 */
async function testSignup() {
  console.log('📝 Step 1: Testing User Registration');
  console.log('   POST /api/auth/register');
  
  try {
    const response = await makeRequest('POST', '/api/auth/register', testUser);
    
    if (response.status === 201) {
      console.log('   ✅ Registration successful!');
      console.log('   User ID:', response.data.user?.id);
      console.log('   Email:', response.data.user?.email);
      console.log('   Token received:', response.data.token ? 'Yes' : 'No');
      return { success: true, token: response.data.token, userId: response.data.user?.id };
    } else {
      console.log('   ❌ Registration failed');
      console.log('   Status:', response.status);
      console.log('   Error:', response.data.error || response.data.message);
      return { success: false };
    }
  } catch (error) {
    console.log('   ❌ Registration error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test login
 */
async function testLogin() {
  console.log('\n🔐 Step 2: Testing User Login');
  console.log('   POST /api/auth/login');
  
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    
    if (response.status === 200) {
      console.log('   ✅ Login successful!');
      console.log('   User ID:', response.data.user?.id);
      console.log('   Email:', response.data.user?.email);
      console.log('   Token received:', response.data.token ? 'Yes' : 'No');
      return { success: true, token: response.data.token };
    } else {
      console.log('   ❌ Login failed');
      console.log('   Status:', response.status);
      console.log('   Error:', response.data.error || response.data.message);
      return { success: false };
    }
  } catch (error) {
    console.log('   ❌ Login error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test authenticated endpoint
 */
async function testAuthenticatedEndpoint(token) {
  console.log('\n🔒 Step 3: Testing Authenticated Endpoint');
  console.log('   GET /api/auth/me');
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const response = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data });
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.on('error', reject);
      req.end();
    });
    
    if (response.status === 200) {
      console.log('   ✅ Authenticated request successful!');
      console.log('   User:', response.data.user?.email);
      console.log('   Name:', response.data.user?.name);
      console.log('   Tier:', response.data.user?.tier);
      return { success: true };
    } else {
      console.log('   ❌ Authenticated request failed');
      console.log('   Status:', response.status);
      return { success: false };
    }
  } catch (error) {
    console.log('   ❌ Authenticated request error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test wrong password
 */
async function testWrongPassword() {
  console.log('\n🚫 Step 4: Testing Login with Wrong Password');
  console.log('   POST /api/auth/login (wrong password)');
  
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: testUser.email,
      password: 'WrongPassword123!'
    });
    
    if (response.status === 401) {
      console.log('   ✅ Correctly rejected wrong password');
      return { success: true };
    } else {
      console.log('   ❌ Should have rejected wrong password');
      console.log('   Status:', response.status);
      return { success: false };
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Test 1: Signup
  const signupResult = await testSignup();
  if (!signupResult.success) {
    console.log('\n❌ Test suite failed at signup');
    return;
  }
  
  // Test 2: Login
  const loginResult = await testLogin();
  if (!loginResult.success) {
    console.log('\n❌ Test suite failed at login');
    return;
  }
  
  // Test 3: Authenticated endpoint
  const authResult = await testAuthenticatedEndpoint(loginResult.token);
  if (!authResult.success) {
    console.log('\n❌ Test suite failed at authenticated endpoint');
    return;
  }
  
  // Test 4: Wrong password
  const wrongPasswordResult = await testWrongPassword();
  if (!wrongPasswordResult.success) {
    console.log('\n❌ Test suite failed at wrong password test');
    return;
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ ALL TESTS PASSED!');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Summary:');
  console.log('  ✅ User registration working');
  console.log('  ✅ User login working');
  console.log('  ✅ JWT authentication working');
  console.log('  ✅ Password validation working');
  console.log('');
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
