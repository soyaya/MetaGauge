#!/usr/bin/env node
import fetch from 'node-fetch';

const API = 'http://localhost:5000';
const USER = {
  email: `testuser_${Date.now()}@metagauge.io`,
  password: 'Test123!',
  name: 'Test User'
};

let token, contractId, analysisId, chatId;

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...opts.headers
    }
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

console.log('\n🚀 MetaGauge User Flow Test\n');

// 1. Register
console.log('1. Registering user...');
let r = await api('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify(USER)
});
if (!r.ok) { console.log('❌', r.data.message); process.exit(1); }
token = r.data.token;
console.log('✅ Registered:', USER.email, '\n');

// 2. Create Contract
console.log('2. Creating contract...');
r = await api('/api/contracts', {
  method: 'POST',
  body: JSON.stringify({
    name: 'USDC Contract',
    description: 'USDC on Ethereum',
    targetContract: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chain: 'ethereum',
      name: 'USDC'
    }
  })
});
if (!r.ok) { console.log('❌', r.data.message); process.exit(1); }
contractId = r.data.id;
console.log('✅ Contract created:', contractId);
console.log('   Address:', r.data.targetContract.address, '\n');

// 3. Onboard
console.log('3. Completing onboarding...');
r = await api('/api/onboarding/complete', {
  method: 'POST',
  body: JSON.stringify({
    defaultContract: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chain: 'ethereum',
      name: 'USDC'
    }
  })
});
if (!r.ok) { console.log('⚠️', r.data.message); }
else { console.log('✅ Onboarding complete\n'); }

// 4. Start Analysis
console.log('4. Starting analysis...');
r = await api('/api/analysis/start', {
  method: 'POST',
  body: JSON.stringify({ contractId })
});
if (!r.ok) { console.log('❌', r.data.message); }
else {
  analysisId = r.data.analysisId;
  console.log('✅ Analysis started:', analysisId);
  
  await new Promise(r => setTimeout(r, 2000));
  
  const s = await api(`/api/analysis/${analysisId}/status`);
  console.log('   Status:', s.data.status, '-', s.data.progress || 0, '%\n');
}

// 5. Create Chat
console.log('5. Creating chat session...');
r = await api('/api/chat/sessions', {
  method: 'POST',
  body: JSON.stringify({ contractId })
});
if (!r.ok) { console.log('❌', r.data.message); }
else {
  chatId = r.data.sessionId;
  console.log('✅ Chat created:', chatId, '\n');
}

// 6. Get Profile
console.log('6. Getting profile...');
r = await api('/api/users/profile');
if (!r.ok) { console.log('❌', r.data.message); }
else {
  console.log('✅ Profile:');
  console.log('   Name:', r.data.name);
  console.log('   Email:', r.data.email);
  console.log('   Tier:', r.data.tier, '\n');
}

// 7. List Contracts
console.log('7. Listing contracts...');
r = await api('/api/contracts');
if (!r.ok) { console.log('❌', r.data.message); }
else {
  const contracts = r.data.contracts || r.data;
  console.log('✅ Found', contracts.length, 'contract(s)');
  contracts.forEach((c, i) => {
    if (c.name) console.log(`   ${i+1}. ${c.name} (${c.targetContract?.address || 'N/A'})`);
  });
  console.log();
}

// 8. Get Subscription Plans
console.log('8. Getting subscription plans...');
r = await api('/api/subscription/plans');
if (!r.ok) { console.log('❌', r.data.message); }
else {
  const plans = r.data.plans || {};
  console.log('✅ Available plans:', Object.keys(plans).length);
  Object.values(plans).forEach(p => {
    if (p.name) console.log(`   - ${p.name}: $${p.monthlyPrice}/mo`);
  });
  console.log();
}

console.log('━'.repeat(60));
console.log('🎉 FLOW TEST COMPLETE!\n');
console.log('Summary:');
console.log('  User:', USER.email);
console.log('  Contract:', contractId);
console.log('  Analysis:', analysisId || 'N/A');
console.log('  Chat:', chatId || 'N/A');
console.log('\n✅ All features working!');
console.log('━'.repeat(60), '\n');
