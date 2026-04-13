#!/usr/bin/env node

/**
 * MetaGauge Route Testing Summary
 * Tests all routes and identifies issues
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
let token = null;

const results = {
  working: [],
  failing: [],
  needsSetup: []
};

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
    
    const routeInfo = `${method} ${endpoint}`;
    
    if (response.ok) {
      results.working.push(routeInfo);
    } else if (result.includes('No analysis found') || result.includes('No default contract')) {
      results.needsSetup.push(`${routeInfo} - ${result.substring(0, 50)}`);
    } else {
      results.failing.push(`${routeInfo} - ${response.status} - ${result.substring(0, 50)}`);
    }
    
    return { status: response.status, data: result };
  } catch (error) {
    results.failing.push(`${method} ${endpoint} - ERROR - ${error.message}`);
    return { status: 'ERROR', error: error.message };
  }
}

async function setup() {
  // Login
  const loginResult = await testRoute('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (loginResult.status === 200) {
    const loginData = JSON.parse(loginResult.data);
    token = loginData.token;
  }
  
  // Complete onboarding
  await testRoute('POST', '/api/onboarding/complete', {
    contractAddress: '0xA0b86a33E6441E6C7D3E4C2e4b9c3C4d5e6f7890',
    chain: 'ethereum',
    contractName: 'Test Contract',
    purpose: 'Testing',
    category: 'defi'
  }, true);
}

async function testAllRoutes() {
  await setup();
  
  console.log('Testing all MetaGauge routes...\n');
  
  // Test all major endpoints
  const routes = [
    ['GET', '/health'],
    ['GET', '/api/auth/me', null, true],
    ['POST', '/api/auth/refresh-api-key', null, true],
    ['GET', '/api/contracts', null, true],
    ['GET', '/api/analysis/history', null, true],
    ['GET', '/api/dashboard/contract-info', null, true],
    ['GET', '/api/dashboard/indexing-status', null, true],
    ['GET', '/api/dashboard/block-metrics', null, true],
    ['GET', '/api/traction/tasks', null, true],
    ['GET', '/api/traction/metrics', null, true],
    ['GET', '/api/traction/productivity', null, true],
    ['GET', '/api/agent/digest', null, true],
    ['GET', '/api/chat/sessions', null, true],
    ['GET', '/api/metrics/dashboard', null, true],
    ['GET', '/api/metrics/glossary', null, true],
    ['GET', '/api/users/profile', null, true],
    ['GET', '/api/users/dashboard', null, true],
    ['GET', '/api/users/usage', null, true],
    ['GET', '/api/subscription/status', null, true],
    ['GET', '/api/subscription/usage', null, true],
    ['GET', '/api/alerts', null, true],
    ['GET', '/api/alerts/config', null, true],
    ['GET', '/api/billing/usage', null, true],
    ['GET', '/api/billing/pricing', null, true],
    ['GET', '/api/faucet/status', null, true],
    ['GET', '/api/onboarding/status', null, true],
    ['GET', '/api/onboarding/default-contract', null, true]
  ];
  
  for (const route of routes) {
    await testRoute(...route);
  }
  
  // Print summary
  console.log('=== ROUTE TESTING SUMMARY ===\n');
  
  console.log(`✅ WORKING ROUTES (${results.working.length}):`);
  results.working.forEach(route => console.log(`  ${route}`));
  
  console.log(`\n⚠️  NEEDS SETUP/DATA (${results.needsSetup.length}):`);
  results.needsSetup.forEach(route => console.log(`  ${route}`));
  
  console.log(`\n❌ FAILING ROUTES (${results.failing.length}):`);
  results.failing.forEach(route => console.log(`  ${route}`));
  
  console.log(`\n📊 OVERALL STATUS:`);
  console.log(`  Total routes tested: ${results.working.length + results.needsSetup.length + results.failing.length}`);
  console.log(`  Working: ${results.working.length}`);
  console.log(`  Needs setup: ${results.needsSetup.length}`);
  console.log(`  Failing: ${results.failing.length}`);
  
  const successRate = Math.round((results.working.length / (results.working.length + results.needsSetup.length + results.failing.length)) * 100);
  console.log(`  Success rate: ${successRate}%`);
}

testAllRoutes().catch(console.error);
