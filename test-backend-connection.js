#!/usr/bin/env node

/**
 * Test if backend on port 5000 is responding
 */

import http from 'http';

console.log('🔍 Testing backend connection on port 5000...\n');

async function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    console.log(`📡 Testing ${method} ${path}...`);
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ ${method} ${path} - Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          console.log(`   Response:`, JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log(`   Response:`, data.substring(0, 200));
        }
        resolve({ success: true, status: res.statusCode, data });
      });
    });

    req.on('timeout', () => {
      console.log(`⏱️  ${method} ${path} - TIMEOUT (5 seconds)`);
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.on('error', (error) => {
      console.log(`❌ ${method} ${path} - ERROR: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('Testing various endpoints:\n');
  
  // Test 1: Health check
  await testEndpoint('/health');
  console.log('');
  
  // Test 2: Root endpoint
  await testEndpoint('/');
  console.log('');
  
  // Test 3: Test endpoint
  await testEndpoint('/test');
  console.log('');
  
  // Test 4: Test POST
  await testEndpoint('/test-post', 'POST', { test: 'data' });
  console.log('');
  
  console.log('✅ All tests completed');
}

runTests().catch(console.error);
