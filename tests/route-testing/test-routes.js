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
    
    console.log(`${method} ${endpoint}: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      console.log(`  Error: ${result.substring(0, 100)}`);
    }
    
    return { status: response.status, data: result };
  } catch (error) {
    console.log(`${method} ${endpoint}: ERROR - ${error.message}`);
    return { status: 'ERROR', error: error.message };
  }
}

async function testBasicRoutes() {
  console.log('=== Testing Basic Routes ===');
  
  // Health check
  await testRoute('GET', '/health');
  
  // Auth routes
  await testRoute('POST', '/api/auth/register', {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  });
  
  const loginResult = await testRoute('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (loginResult.status === 200) {
    try {
      const loginData = JSON.parse(loginResult.data);
      token = loginData.token;
      console.log('  ✅ Got auth token');
    } catch (e) {
      console.log('  ❌ Failed to parse login response');
    }
  }
  
  // Test authenticated routes
  await testRoute('GET', '/api/auth/me', null, true);
  await testRoute('GET', '/api/contracts', null, true);
  await testRoute('GET', '/api/subscription/status', null, true);
}

testBasicRoutes().catch(console.error);
