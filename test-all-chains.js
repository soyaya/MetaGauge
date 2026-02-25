#!/usr/bin/env node
import fetch from 'node-fetch';

const API = 'http://localhost:5000';

// Test contracts for each chain
const CONTRACTS = {
  ethereum: {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI token (less busy than USDC)
    name: 'Uniswap Token',
    chain: 'ethereum'
  },
  lisk: {
    address: '0x4200000000000000000000000000000000000006', // WETH on Lisk
    name: 'Wrapped Ether',
    chain: 'lisk'
  },
  starknet: {
    address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH on Starknet
    name: 'Ether',
    chain: 'starknet'
  }
};

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers }
  });
  return await res.json();
}

async function testChain(chain, contract) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔗 Testing ${chain.toUpperCase()}`);
  console.log('='.repeat(70));

  // 1. Register user
  const email = `${chain}_test_${Date.now()}@metagauge.io`;
  console.log(`\n1. Registering user: ${email}`);
  
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'Test123!',
      name: `${chain} Test User`
    })
  });
  
  if (!reg.token) {
    console.log('❌ Registration failed:', reg.message);
    return;
  }
  
  const token = reg.token;
  console.log('✅ User registered');

  // 2. Create contract
  console.log(`\n2. Creating ${contract.name} contract...`);
  const cont = await api('/api/contracts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: contract.name,
      description: `${chain} test contract`,
      targetContract: contract
    })
  });

  if (!cont.id) {
    console.log('❌ Contract creation failed:', cont.message);
    return;
  }

  console.log('✅ Contract created:', cont.id);

  // 3. Start analysis
  console.log('\n3. Starting analysis...');
  const anal = await api('/api/analysis/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contractId: cont.id })
  });

  if (!anal.analysisId) {
    console.log('❌ Analysis failed:', anal.message);
    return;
  }

  console.log('✅ Analysis started:', anal.analysisId);
  console.log('   Waiting for completion...');

  // 4. Poll for results
  let attempts = 0;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    
    const status = await api(`/api/analysis/${anal.analysisId}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (status.status === 'completed') {
      console.log('✅ Analysis completed!');
      
      // Get results
      const results = await api(`/api/analysis/${anal.analysisId}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('\n📊 Results:');
      console.log('   Transactions:', results.target?.transactions || 0);
      console.log('   Method:', results.target?.fetchMethod || 'unknown');
      console.log('   TVL:', results.target?.metrics?.tvl || 0);
      console.log('   DAU:', results.target?.metrics?.dau || 0);
      console.log('   MAU:', results.target?.metrics?.mau || 0);
      
      if (results.target?.transactions > 0) {
        console.log('\n✅ SUCCESS: Real blockchain data fetched!');
      } else {
        console.log('\n⚠️  WARNING: No transactions fetched (might be timeout or no activity)');
      }
      
      return {
        chain,
        success: results.target?.transactions > 0,
        transactions: results.target?.transactions || 0
      };
    }

    if (status.status === 'failed') {
      console.log('❌ Analysis failed');
      return { chain, success: false, transactions: 0 };
    }

    attempts++;
    if (attempts % 6 === 0) {
      console.log(`   Still running... (${attempts * 5}s elapsed)`);
    }
  }

  console.log('⏱️  Timeout waiting for analysis');
  return { chain, success: false, transactions: 0 };
}

// Main
console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║          Multi-Chain Data Fetching Verification Test                ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

const results = [];

// Test Ethereum
results.push(await testChain('ethereum', CONTRACTS.ethereum));

// Test Lisk
results.push(await testChain('lisk', CONTRACTS.lisk));

// Test Starknet
results.push(await testChain('starknet', CONTRACTS.starknet));

// Summary
console.log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                         FINAL SUMMARY                                ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

results.forEach(r => {
  const status = r.success ? '✅ SUCCESS' : '❌ FAILED';
  console.log(`${status} - ${r.chain.toUpperCase()}: ${r.transactions} transactions`);
});

const allSuccess = results.every(r => r.success);
console.log(`\n${allSuccess ? '🎉' : '⚠️'} Overall: ${results.filter(r => r.success).length}/${results.length} chains working\n`);
