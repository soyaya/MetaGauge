#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
let token = null;

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  });
  
  const data = await response.json();
  token = data.token;
  console.log('✅ Logged in');
}

async function getContractId() {
  const response = await fetch(`${BASE_URL}/api/contracts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const contracts = await response.json();
  if (contracts.length > 0) {
    console.log('✅ Found contract:', contracts[0].id);
    return contracts[0].id;
  }
  return null;
}

async function startAnalysis(contractId) {
  const response = await fetch(`${BASE_URL}/api/analysis/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contractId: contractId,
      analysisType: 'quick'
    })
  });
  
  const data = await response.json();
  if (response.ok) {
    console.log('✅ Analysis started:', data.analysisId);
    return data.analysisId;
  } else {
    console.log('❌ Analysis failed:', data.message);
    return null;
  }
}

async function testTractionRoutes() {
  console.log('\n--- Testing Traction Routes ---');
  const routes = [
    '/api/traction/tasks',
    '/api/traction/metrics'
  ];
  
  for (const route of routes) {
    const response = await fetch(`${BASE_URL}${route}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const status = response.ok ? '✅' : '❌';
    console.log(`${status} GET ${route}: ${response.status}`);
  }
}

async function fix() {
  await login();
  const contractId = await getContractId();
  
  if (contractId) {
    await startAnalysis(contractId);
    
    // Wait for analysis to process
    setTimeout(async () => {
      await testTractionRoutes();
    }, 3000);
  } else {
    console.log('❌ No contracts found');
  }
}

fix().catch(console.error);
