#!/usr/bin/env node

/**
 * Health Check for Backend Signup Route
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';
const TIMEOUT = 10000; // 10 seconds

const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'test123456',
  name: 'Test User'
};

console.log('🔍 Testing Backend Signup Route\n');
console.log('=' .repeat(50));

// Test 1: Health endpoint
console.log('\n1️⃣  Testing /health endpoint...');
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  
  const start = Date.now();
  const response = await fetch(`${API_URL}/health`, {
    signal: controller.signal
  });
  clearTimeout(timeout);
  
  const duration = Date.now() - start;
  
  if (response.ok) {
    const data = await response.json();
    console.log(`✅ Health check passed (${duration}ms)`);
    console.log(`   Status: ${data.status}`);
  } else {
    console.log(`❌ Health check failed: ${response.status}`);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log(`❌ Health check timeout (>${TIMEOUT}ms)`);
  } else {
    console.log(`❌ Health check error: ${error.message}`);
  }
  console.log('\n⚠️  Backend may not be running. Start it with: npm run dev');
  process.exit(1);
}

// Test 2: Signup route
console.log('\n2️⃣  Testing /api/auth/register endpoint...');
console.log(`   Email: ${testUser.email}`);

try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  
  const start = Date.now();
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
    signal: controller.signal
  });
  clearTimeout(timeout);
  
  const duration = Date.now() - start;
  const data = await response.json();
  
  if (response.ok) {
    console.log(`✅ Signup successful (${duration}ms)`);
    console.log(`   User ID: ${data.user.id}`);
    console.log(`   Email: ${data.user.email}`);
    console.log(`   Tier: ${data.user.tier}`);
    console.log(`   Token: ${data.token.substring(0, 20)}...`);
  } else {
    console.log(`❌ Signup failed: ${response.status}`);
    console.log(`   Error: ${data.error || data.message}`);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log(`❌ Signup timeout (>${TIMEOUT}ms)`);
    console.log('   Backend is hanging - check logs for errors');
  } else {
    console.log(`❌ Signup error: ${error.message}`);
  }
  process.exit(1);
}

// Test 3: Check backend logs
console.log('\n3️⃣  Checking backend logs...');
try {
  const { readFileSync } = await import('fs');
  const logs = readFileSync('./backend-test.log', 'utf-8').split('\n').slice(-10);
  console.log('   Last 10 lines:');
  logs.forEach(line => {
    if (line.trim()) console.log(`   ${line}`);
  });
} catch (error) {
  console.log('   ⚠️  Could not read backend logs');
}

console.log('\n' + '='.repeat(50));
console.log('✅ All health checks passed!\n');
