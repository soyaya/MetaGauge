#!/usr/bin/env node

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

const endpoints = [
  // Health
  { method: 'GET', path: '/health', auth: false },
  
  // Auth endpoints
  { method: 'POST', path: '/api/auth/register', auth: false, body: { email: 'test@test.com', password: 'test123', name: 'Test' } },
  { method: 'POST', path: '/api/auth/login', auth: false, body: { email: 'test@test.com', password: 'test123' } },
  { method: 'GET', path: '/api/auth/me', auth: true },
  
  // Contracts
  { method: 'GET', path: '/api/contracts', auth: true },
  
  // Analysis
  { method: 'GET', path: '/api/analysis/history', auth: true },
  
  // Users
  { method: 'GET', path: '/api/users/dashboard', auth: true },
  { method: 'GET', path: '/api/users/profile', auth: true },
];

async function checkEndpoint(endpoint, token) {
  const url = `${BASE_URL}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (endpoint.auth && token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (endpoint.body) {
    options.body = JSON.stringify(endpoint.body);
  }
  
  try {
    const response = await fetch(url, options);
    const status = response.status;
    const statusText = response.statusText;
    
    return {
      endpoint: `${endpoint.method} ${endpoint.path}`,
      status,
      statusText,
      ok: response.ok,
      auth: endpoint.auth
    };
  } catch (error) {
    return {
      endpoint: `${endpoint.method} ${endpoint.path}`,
      status: 'ERROR',
      statusText: error.message,
      ok: false,
      auth: endpoint.auth
    };
  }
}

async function runHealthCheck() {
  console.log(`🏥 Health Check for ${BASE_URL}\n`);
  
  let token = null;
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await checkEndpoint(endpoint, token);
    results.push(result);
    
    // Capture token from login
    if (endpoint.path === '/api/auth/login' && result.ok) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(endpoint.body)
        });
        const data = await response.json();
        token = data.token;
      } catch (e) {}
    }
    
    const icon = result.ok ? '✅' : '❌';
    const authLabel = result.auth ? '🔒' : '🔓';
    console.log(`${icon} ${authLabel} ${result.endpoint} - ${result.status} ${result.statusText}`);
  }
  
  console.log(`\n📊 Summary:`);
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`   Passed: ${passed}/${results.length}`);
  console.log(`   Failed: ${failed}/${results.length}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runHealthCheck();
