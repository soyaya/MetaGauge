#!/usr/bin/env node

/**
 * Test backend endpoints to identify the hanging issue
 */

console.log('🧪 Testing Backend Endpoints\n');

async function testEndpoint(name, url, method = 'GET', body = null) {
  console.log(`Testing ${name}...`);
  const start = Date.now();
  
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    const duration = Date.now() - start;
    
    console.log(`✅ ${name}: ${response.status} (${duration}ms)`);
    console.log(`   Response:`, JSON.stringify(data).substring(0, 100));
    console.log('');
    return true;
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ ${name}: ${error.message} (${duration}ms)`);
    console.log('');
    return false;
  }
}

async function runTests() {
  const baseUrl = 'http://localhost:5000';
  
  // Test 1: Health check
  await testEndpoint('Health Check', `${baseUrl}/health`);
  
  // Test 2: Simple GET test
  await testEndpoint('Test GET', `${baseUrl}/test`);
  
  // Test 3: Simple POST test
  await testEndpoint('Test POST', `${baseUrl}/test-post`, 'POST', { test: 'data' });
  
  // Test 4: Test registration endpoint
  await testEndpoint(
    'Test Register', 
    `${baseUrl}/api/test-register`, 
    'POST', 
    { email: 'test@test.com', password: 'test123', name: 'Test' }
  );
  
  // Test 5: Actual registration endpoint
  await testEndpoint(
    'Real Register', 
    `${baseUrl}/api/auth/register`, 
    'POST', 
    { email: 'test@test.com', password: 'test123', name: 'Test User' }
  );
  
  console.log('🏁 Tests complete');
}

runTests().catch(console.error);
