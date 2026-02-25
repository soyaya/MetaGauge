#!/usr/bin/env node
import fetch from 'node-fetch';

const API = 'http://localhost:5000';

// More active contracts
const CONTRACTS = {
  lisk: {
    address: '0x4200000000000000000000000000000000000042', // L2StandardBridge on Lisk
    name: 'Lisk Bridge',
    chain: 'lisk'
  },
  starknet: {
    address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', // Starkgate ETH Bridge
    name: 'Starkgate Bridge',
    chain: 'starknet'
  }
};

async function testChain(chain, contract) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${chain.toUpperCase()}: ${contract.name}`);
  console.log('='.repeat(60));

  const email = `${chain}_fix_${Date.now()}@metagauge.io`;
  
  // Register
  const reg = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test123!', name: `${chain} User` })
  });
  const { token } = await reg.json();
  console.log('✅ User registered');

  // Create contract
  const cont = await fetch(`${API}/api/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: contract.name,
      targetContract: contract
    })
  });
  const { id } = await cont.json();
  console.log('✅ Contract created:', id);

  // Start analysis
  const anal = await fetch(`${API}/api/analysis/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contractId: id })
  });
  const { analysisId } = await anal.json();
  console.log('✅ Analysis started:', analysisId);
  console.log('⏳ Waiting 90 seconds...\n');

  await new Promise(r => setTimeout(r, 90000));

  // Get results
  const res = await fetch(`${API}/api/analysis/${analysisId}/results`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  console.log('📊 Results:');
  console.log('  Transactions:', data.target?.transactions || 0);
  console.log('  Method:', data.target?.fetchMethod || 'unknown');
  console.log('  Error:', data.target?.error || 'None');
  
  return data.target?.transactions || 0;
}

console.log('\n🔧 Testing Lisk and Starknet with Active Contracts\n');

const liskTx = await testChain('lisk', CONTRACTS.lisk);
const starknetTx = await testChain('starknet', CONTRACTS.starknet);

console.log('\n\n' + '='.repeat(60));
console.log('FINAL RESULTS:');
console.log('='.repeat(60));
console.log(`Lisk: ${liskTx} transactions ${liskTx > 0 ? '✅' : '❌'}`);
console.log(`Starknet: ${starknetTx} transactions ${starknetTx > 0 ? '✅' : '❌'}`);
console.log('='.repeat(60) + '\n');
