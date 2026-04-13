#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
let token = null;
let contractId = null;

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
    
    console.log(`${method} ${endpoint}: ${response.status}`);
    if (!response.ok && response.status !== 404) {
      console.log(`  ❌ ${result.substring(0, 150)}`);
    }
    
    return { status: response.status, data: result };
  } catch (error) {
    console.log(`${method} ${endpoint}: ERROR - ${error.message}`);
    return { status: 'ERROR', error: error.message };
  }
}

async function setup() {
  // Login to get token
  const loginResult = await testRoute('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (loginResult.status === 200) {
    const loginData = JSON.parse(loginResult.data);
    token = loginData.token;
  }
}

async function testAllRoutes() {
  await setup();
  
  console.log('\n=== Testing All API Routes ===');
  
  // Auth routes
  console.log('\n--- Auth Routes ---');
  await testRoute('GET', '/api/auth/me', null, true);
  await testRoute('POST', '/api/auth/refresh-api-key', null, true);
  
  // Contract routes
  console.log('\n--- Contract Routes ---');
  await testRoute('GET', '/api/contracts', null, true);
  
  const contractResult = await testRoute('POST', '/api/contracts', {
    address: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum',
    name: 'Test Contract'
  }, true);
  
  if (contractResult.status === 201) {
    try {
      const contractData = JSON.parse(contractResult.data);
      contractId = contractData.id;
    } catch (e) {}
  }
  
  // Analysis routes
  console.log('\n--- Analysis Routes ---');
  await testRoute('GET', '/api/analysis/history', null, true);
  
  // Dashboard routes
  console.log('\n--- Dashboard Routes ---');
  await testRoute('GET', '/api/dashboard/overview', null, true);
  await testRoute('GET', '/api/dashboard/metrics', null, true);
  await testRoute('GET', '/api/dashboard/users', null, true);
  await testRoute('GET', '/api/dashboard/transactions', null, true);
  
  // Chat routes
  console.log('\n--- Chat Routes ---');
  await testRoute('GET', '/api/chat/sessions', null, true);
  await testRoute('POST', '/api/chat/sessions', { title: 'Test Chat' }, true);
  
  // Subscription routes
  console.log('\n--- Subscription Routes ---');
  await testRoute('GET', '/api/subscription/status', null, true);
  await testRoute('GET', '/api/subscription/usage', null, true);
  
  // Other routes
  console.log('\n--- Other Routes ---');
  await testRoute('GET', '/api/metrics/overview', null, true);
  await testRoute('GET', '/api/competitive/analysis', null, true);
  await testRoute('GET', '/api/alerts', null, true);
}

testAllRoutes().catch(console.error);
