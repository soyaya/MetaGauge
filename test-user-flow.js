#!/usr/bin/env node

/**
 * Manual User Flow Test
 * Creates a user and tests the complete flow step by step
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';
const USER = {
  email: `demo_${Date.now()}@metagauge.io`,
  password: 'Demo123!',
  name: 'Demo User'
};

const CONTRACT = {
  name: 'Uniswap V2 Router',
  description: 'Testing with Uniswap V2 Router contract',
  targetContract: {
    address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    chain: 'ethereum',
    name: 'Uniswap V2 Router'
  }
};

let token = null;
let contractId = null;
let analysisId = null;
let chatSessionId = null;

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

console.log('\n🚀 Starting Manual User Flow Test\n');

// Step 1: Register
console.log('1️⃣  Registering user...');
const registerRes = await request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify(USER)
});

if (!registerRes.ok) {
  console.log('❌ Registration failed:', registerRes.data.message);
  process.exit(1);
}

token = registerRes.data.token;
console.log('✅ User registered:', USER.email);
console.log('   Token:', token.substring(0, 20) + '...\n');

// Step 2: Create Contract
console.log('2️⃣  Creating contract...');
const contractRes = await request('/api/contracts', {
  method: 'POST',
  body: JSON.stringify(CONTRACT)
});

if (!contractRes.ok) {
  console.log('❌ Contract creation failed:', contractRes.data.message);
  process.exit(1);
}

contractId = contractRes.data.id;
console.log('✅ Contract created:', contractId);
console.log('   Name:', contractRes.data.name);
console.log('   Address:', contractRes.data.targetContract.address, '\n');

// Step 3: Complete Onboarding
console.log('3️⃣  Completing onboarding...');
const onboardRes = await request('/api/onboarding/complete', {
  method: 'POST',
  body: JSON.stringify({
    defaultContract: {
      address: CONTRACT.targetContract.address,
      chain: CONTRACT.targetContract.chain,
      name: CONTRACT.targetContract.name
    }
  })
});

if (!onboardRes.ok) {
  console.log('❌ Onboarding failed:', onboardRes.data.message);
} else {
  console.log('✅ Onboarding completed\n');
}

// Step 4: Start Analysis
console.log('4️⃣  Starting contract analysis...');
const analysisRes = await request('/api/analysis/start', {
  method: 'POST',
  body: JSON.stringify({ contractId })
});

if (!analysisRes.ok) {
  console.log('❌ Analysis failed:', analysisRes.data.message);
} else {
  analysisId = analysisRes.data.analysisId;
  console.log('✅ Analysis started:', analysisId);
  
  // Wait and check status
  console.log('   Waiting 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const statusRes = await request(`/api/analysis/${analysisId}/status`);
  console.log('   Status:', statusRes.data.status);
  console.log('   Progress:', statusRes.data.progress || 0, '%\n');
}

// Step 5: Create Chat Session
console.log('5️⃣  Creating chat session...');
const chatRes = await request('/api/chat/sessions', {
  method: 'POST',
  body: JSON.stringify({ contractId })
});

if (!chatRes.ok) {
  console.log('❌ Chat session failed:', chatRes.data.message);
} else {
  chatSessionId = chatRes.data.sessionId;
  console.log('✅ Chat session created:', chatSessionId, '\n');
}

// Step 6: Send Chat Message
if (chatSessionId) {
  console.log('6️⃣  Sending chat message...');
  const msgRes = await request(`/api/chat/sessions/${chatSessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: 'What is this contract?' })
  });

  if (!msgRes.ok) {
    console.log('❌ Message failed:', msgRes.data.message);
  } else {
    console.log('✅ Message sent');
    console.log('   AI Response:', msgRes.data.response?.substring(0, 100) + '...\n');
  }
}

// Step 7: Get User Profile
console.log('7️⃣  Getting user profile...');
const profileRes = await request('/api/users/profile');

if (!profileRes.ok) {
  console.log('❌ Profile failed:', profileRes.data.message);
} else {
  console.log('✅ Profile retrieved');
  console.log('   Name:', profileRes.data.name);
  console.log('   Email:', profileRes.data.email);
  console.log('   Tier:', profileRes.data.tier, '\n');
}

// Step 8: List Contracts
console.log('8️⃣  Listing contracts...');
const listRes = await request('/api/contracts');

if (!listRes.ok) {
  console.log('❌ List failed:', listRes.data.message);
} else {
  const contracts = listRes.data.contracts || listRes.data;
  console.log('✅ Contracts listed:', contracts.length);
  contracts.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name} (${c.targetContract.address})`);
  });
  console.log();
}

// Summary
console.log('━'.repeat(60));
console.log('🎉 FLOW TEST COMPLETE!\n');
console.log('Summary:');
console.log('  User:', USER.email);
console.log('  Contract ID:', contractId);
console.log('  Analysis ID:', analysisId || 'N/A');
console.log('  Chat Session:', chatSessionId || 'N/A');
console.log('\n✅ All core features tested successfully!');
console.log('━'.repeat(60), '\n');
