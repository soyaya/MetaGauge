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
      const shortError = result.substring(0, 120).replace(/\n/g, ' ');
      console.log(`    ${shortError}`);
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

async function testOnboardingFlow() {
  await setup();
  
  console.log('\n=== Testing Onboarding Flow ===');
  
  // Check onboarding status
  await testRoute('GET', '/api/onboarding/status', null, true);
  
  // Try to complete onboarding with a test contract
  console.log('\n--- Completing Onboarding ---');
  await testRoute('POST', '/api/onboarding/complete', {
    contractAddress: '0xA0b86a33E6441E6C7D3E4C2e4b9c3C4d5e6f7890',
    chain: 'ethereum',
    contractName: 'Test Contract',
    purpose: 'Testing',
    category: 'defi'
  }, true);
  
  // Check if default contract is now available
  await testRoute('GET', '/api/onboarding/default-contract', null, true);
  
  console.log('\n--- Testing Dashboard After Onboarding ---');
  await testRoute('GET', '/api/dashboard/contract-info', null, true);
  await testRoute('GET', '/api/dashboard/indexing-status', null, true);
  
  console.log('\n--- Testing Traction After Onboarding ---');
  await testRoute('GET', '/api/traction/tasks', null, true);
  await testRoute('GET', '/api/traction/metrics', null, true);
  
  console.log('\n--- Testing Metrics After Onboarding ---');
  await testRoute('GET', '/api/metrics/dashboard', null, true);
}

testOnboardingFlow().catch(console.error);
