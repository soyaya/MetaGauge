#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
let token = null;

async function testRoute(method, endpoint, data = null, requiresAuth = false) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (requiresAuth && token) {
      options.headers.Authorization = `Bearer ${token}`;
    }
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const result = await response.text();
    
    const status = response.ok ? '✅' : '❌';
    console.log(`${status} ${method} ${endpoint}: ${response.status}`);
    
    if (!response.ok) {
      console.log(`    ${result.substring(0, 100)}`);
    }
    
    return { status: response.status, data: result };
  } catch (error) {
    console.log(`❌ ${method} ${endpoint}: ERROR - ${error.message}`);
    return { status: 'ERROR', error: error.message };
  }
}

async function setup() {
  const loginResult = await testRoute('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (loginResult.status === 200) {
    const loginData = JSON.parse(loginResult.data);
    token = loginData.token;
  }
}

async function testCorrectRoutes() {
  await setup();
  
  console.log('\n=== Testing Correct API Routes ===');
  
  // Dashboard routes (correct endpoints)
  console.log('\n--- Dashboard Routes ---');
  await testRoute('GET', '/api/dashboard/contract-info', null, true);
  await testRoute('GET', '/api/dashboard/indexing-status', null, true);
  await testRoute('GET', '/api/dashboard/block-metrics', null, true);
  
  // Analyzer routes
  console.log('\n--- Analyzer Routes ---');
  await testRoute('GET', '/api/analyzer/overview', null, true);
  await testRoute('GET', '/api/analyzer/metrics', null, true);
  await testRoute('GET', '/api/analyzer/users', null, true);
  await testRoute('GET', '/api/analyzer/transactions', null, true);
  
  // Traction routes
  console.log('\n--- Traction Routes ---');
  await testRoute('GET', '/api/traction/overview', null, true);
  await testRoute('GET', '/api/traction/metrics', null, true);
  
  // Agent routes
  console.log('\n--- Agent Routes ---');
  await testRoute('GET', '/api/agent/status', null, true);
  
  // Contract creation with correct fields
  console.log('\n--- Contract Creation ---');
  await testRoute('POST', '/api/contracts', {
    name: 'Test Contract',
    targetContract: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum'
  }, true);
}

testCorrectRoutes().catch(console.error);
