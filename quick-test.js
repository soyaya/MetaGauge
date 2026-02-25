#!/usr/bin/env node
import fetch from 'node-fetch';

const API = 'http://localhost:5000';
const email = `quick_test_${Date.now()}@metagauge.io`;

// Register
const reg = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'Test123!', name: 'Quick Test' })
});
const { token } = await reg.json();

// Create contract
const cont = await fetch(`${API}/api/contracts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    name: 'UNI Token',
    targetContract: {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      chain: 'ethereum',
      name: 'UNI'
    }
  })
});
const { id } = await cont.json();

// Start analysis
const anal = await fetch(`${API}/api/analysis/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ contractId: id })
});
const { analysisId } = await anal.json();

console.log('Analysis started:', analysisId);
console.log('Waiting 60 seconds...\n');

await new Promise(r => setTimeout(r, 60000));

// Check error log
const fs = await import('fs');
if (fs.existsSync('analysis-errors.log')) {
  console.log('📋 Error Log:');
  console.log(fs.readFileSync('analysis-errors.log', 'utf8'));
} else {
  console.log('✅ No errors logged');
}

// Get results
const res = await fetch(`${API}/api/analysis/${analysisId}/results`, {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();

console.log('\n📊 Results:');
console.log('Transactions:', data.target?.transactions || 0);
console.log('Error:', data.target?.error || 'None');
console.log('Method:', data.target?.fetchMethod || 'unknown');
