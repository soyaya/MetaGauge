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
    
    if (!response.ok && response.status !== 404) {
      const shortError = result.substring(0, 80).replace(/\n/g, ' ');
      console.log(`    ${shortError}...`);
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

async function testAllEndpoints() {
  await setup();
  
  console.log('\n=== Testing All Available Endpoints ===');
  
  // Auth endpoints
  console.log('\n--- Auth ---');
  await testRoute('GET', '/api/auth/me', null, true);
  await testRoute('POST', '/api/auth/refresh-api-key', null, true);
  
  // Contract endpoints
  console.log('\n--- Contracts ---');
  await testRoute('GET', '/api/contracts', null, true);
  await testRoute('GET', '/api/contracts/my/competitor-metrics', null, true);
  
  // Analysis endpoints
  console.log('\n--- Analysis ---');
  await testRoute('GET', '/api/analysis/history', null, true);
  
  // Dashboard endpoints
  console.log('\n--- Dashboard ---');
  await testRoute('GET', '/api/dashboard/contract-info', null, true);
  await testRoute('GET', '/api/dashboard/indexing-status', null, true);
  await testRoute('GET', '/api/dashboard/block-metrics', null, true);
  
  // Traction endpoints
  console.log('\n--- Traction ---');
  await testRoute('GET', '/api/traction/tasks', null, true);
  await testRoute('GET', '/api/traction/metrics', null, true);
  await testRoute('GET', '/api/traction/productivity', null, true);
  
  // Agent endpoints
  console.log('\n--- Agent ---');
  await testRoute('GET', '/api/agent/digest', null, true);
  
  // Chat endpoints
  console.log('\n--- Chat ---');
  await testRoute('GET', '/api/chat/sessions', null, true);
  
  // Metrics endpoints
  console.log('\n--- Metrics ---');
  await testRoute('GET', '/api/metrics/dashboard', null, true);
  await testRoute('GET', '/api/metrics/glossary', null, true);
  
  // User endpoints
  console.log('\n--- Users ---');
  await testRoute('GET', '/api/users/profile', null, true);
  await testRoute('GET', '/api/users/dashboard', null, true);
  await testRoute('GET', '/api/users/usage', null, true);
  
  // Subscription endpoints
  console.log('\n--- Subscription ---');
  await testRoute('GET', '/api/subscription/status', null, true);
  await testRoute('GET', '/api/subscription/usage', null, true);
  
  // Other endpoints
  console.log('\n--- Other ---');
  await testRoute('GET', '/api/alerts', null, true);
  await testRoute('GET', '/api/alerts/config', null, true);
  await testRoute('GET', '/api/billing/usage', null, true);
  await testRoute('GET', '/api/billing/pricing', null, true);
  await testRoute('GET', '/api/faucet/status', null, true);
}

testAllEndpoints().catch(console.error);
