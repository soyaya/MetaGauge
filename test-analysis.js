#!/usr/bin/env node
import fetch from 'node-fetch';

const API = 'http://localhost:5000';

// Login
const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'testuser_1771851908917@metagauge.io',
    password: 'Test123!'
  })
});
const { token } = await login.json();

// Start new analysis
console.log('🔬 Starting new analysis...\n');
const start = await fetch(`${API}/api/analysis/start`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ contractId: '1fb49879-baee-436b-8d7c-2ef8d7aebdb9' })
});

const { analysisId } = await start.json();
console.log('Analysis ID:', analysisId, '\n');

// Poll for results
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2000));
  
  const status = await fetch(`${API}/api/analysis/${analysisId}/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await status.json();
  
  console.log(`[${i*2}s] Status: ${data.status} | Progress: ${data.progress}%`);
  
  if (data.status === 'completed' || data.status === 'failed') {
    console.log('\n✅ Analysis finished!\n');
    
    // Get results
    const results = await fetch(`${API}/api/analysis/${analysisId}/results`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const r = await results.json();
    
    if (r.target) {
      console.log('📊 Results:');
      console.log('  Transactions:', r.target.transactions);
      console.log('  TVL:', r.target.metrics?.tvl);
      console.log('  DAU:', r.target.metrics?.dau);
      console.log('  MAU:', r.target.metrics?.mau);
      console.log('  24h Volume:', r.target.metrics?.transactionVolume24h);
      console.log('\n🔍 Data Source:', r.target.transactions > 0 ? 'REAL BLOCKCHAIN' : 'MOCK/FALLBACK');
    }
    break;
  }
}
