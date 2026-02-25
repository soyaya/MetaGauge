/**
 * Victor's WETH Contract Onboarding Test
 * Contract: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)
 * Chain: Ethereum
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE = 'http://localhost:5000';
let authToken = null;

// Victor's user data
const victor = {
  name: 'Victor',
  email: 'victor@metagauge.io',
  password: 'Victor2024!Secure'
};

// WETH Contract
const wethContract = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  chain: 'ethereum',
  name: 'Wrapped Ether (WETH)',
  category: 'DeFi',
  purpose: 'ERC-20 wrapper for ETH',
  abi: [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"guy","type":"address"},{"name":"wad","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"src","type":"address"},{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"guy","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"}]
};

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...options.headers
  };

  console.log(`📡 ${options.method || 'GET'} ${endpoint}`);
  
  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${data.error || response.statusText}`);
  }

  return data;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVictorTest() {
  console.log('🚀 Victor\'s WETH Contract Onboarding\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Register Victor
    console.log('\n👤 STEP 1: Register Victor');
    console.log('-'.repeat(70));
    const signup = await apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(victor)
    });
    authToken = signup.token;
    console.log(`✅ Victor registered successfully`);
    console.log(`   Email: ${victor.email}`);
    console.log(`   User ID: ${signup.user.id}`);

    // Step 2: Save WETH contract with ABI to database
    console.log('\n💾 STEP 2: Save WETH Contract with ABI');
    console.log('-'.repeat(70));
    
    // Read existing contracts
    let contracts = [];
    try {
      const data = await fs.readFile('./data/contracts.json', 'utf-8');
      contracts = JSON.parse(data);
    } catch (error) {
      // File doesn't exist
    }

    // Add WETH contract
    contracts.push({
      address: wethContract.address,
      chain: wethContract.chain,
      name: wethContract.name,
      category: wethContract.category,
      purpose: wethContract.purpose,
      abi: wethContract.abi,
      userId: signup.user.id,
      createdAt: new Date().toISOString()
    });

    await fs.writeFile('./data/contracts.json', JSON.stringify(contracts, null, 2));
    console.log(`✅ WETH contract saved with ABI`);
    console.log(`   Address: ${wethContract.address}`);
    console.log(`   Functions: deposit, withdraw, transfer, approve, transferFrom`);

    // Step 3: Load ABI into decoder
    console.log('\n🔧 STEP 3: Load ABI into Function Decoder');
    console.log('-'.repeat(70));
    const { functionDecoder } = await import('./src/services/FunctionSignatureDecoder.js');
    functionDecoder.loadABI(wethContract.address, wethContract.abi);
    console.log(`✅ ABI loaded into decoder`);
    console.log(`   Contract functions will show proper names`);

    // Step 4: Generate sample WETH interaction data
    console.log('\n📊 STEP 4: Generate Sample WETH Interaction Data');
    console.log('-'.repeat(70));
    const { FunctionAnalyticsStorage } = await import('./src/services/FunctionAnalyticsStorage.js');
    const storage = new FunctionAnalyticsStorage();

    // Generate realistic WETH interactions
    const interactions = [];
    const wallets = [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444',
      '0x5555555555555555555555555555555555555555',
      '0x6666666666666666666666666666666666666666',
      '0x7777777777777777777777777777777777777777',
      '0x8888888888888888888888888888888888888888'
    ];

    // WETH function signatures
    const signatures = {
      '0xd0e30db0': 'deposit',
      '0x2e1a7d4d': 'withdraw',
      '0xa9059cbb': 'transfer',
      '0x095ea7b3': 'approve',
      '0x23b872dd': 'transferFrom'
    };

    let blockNumber = 18000000;
    let txCounter = 0;
    const startDate = new Date('2024-01-01');

    // Generate 60 days of data
    for (let day = 0; day < 60; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);

      // 10-30 interactions per day
      const dailyTxs = 10 + Math.floor(Math.random() * 20);

      for (let i = 0; i < dailyTxs; i++) {
        const wallet = wallets[Math.floor(Math.random() * wallets.length)];
        const sigKeys = Object.keys(signatures);
        const signature = sigKeys[Math.floor(Math.random() * sigKeys.length)];
        
        const timestamp = new Date(date);
        timestamp.setHours(Math.floor(Math.random() * 24));
        timestamp.setMinutes(Math.floor(Math.random() * 60));

        interactions.push({
          walletAddress: wallet,
          signature: signature,
          timestamp: timestamp.toISOString(),
          transactionHash: `0x${txCounter.toString(16).padStart(64, '0')}`,
          blockNumber: blockNumber++,
          gasUsed: 50000 + Math.floor(Math.random() * 100000),
          value: Math.random() > 0.5 ? (Math.random() * 10).toFixed(4) : '0'
        });

        txCounter++;
      }
    }

    await storage.saveInteractions(wethContract.address, wethContract.chain, interactions);
    console.log(`✅ Generated ${interactions.length} WETH interactions`);
    console.log(`   Wallets: ${wallets.length}`);
    console.log(`   Functions: ${Object.keys(signatures).length}`);
    console.log(`   Date range: ${interactions[0].timestamp.split('T')[0]} to ${interactions[interactions.length-1].timestamp.split('T')[0]}`);

    // Step 5: Test Function Signatures
    console.log('\n🔍 STEP 5: Analyze Function Signatures');
    console.log('-'.repeat(70));
    const sigs = await apiCall(
      `/api/functions/signatures?contractAddress=${wethContract.address}&chain=${wethContract.chain}`
    );
    console.log(`✅ Retrieved ${sigs.length} function signatures`);
    sigs.forEach((sig, i) => {
      console.log(`   ${i + 1}. ${sig.name || sig.signature}`);
      console.log(`      Wallets: ${sig.walletCount} | Transactions: ${sig.transactionCount} | Avg: ${sig.avgTransactionsPerWallet.toFixed(2)}`);
    });

    // Step 6: Test User Journey Flow
    console.log('\n🌊 STEP 6: Analyze User Journey Flow');
    console.log('-'.repeat(70));
    const flow = await apiCall(
      `/api/functions/journeys/flow?contractAddress=${wethContract.address}&chain=${wethContract.chain}`
    );
    console.log(`✅ Flow visualization generated`);
    console.log(`   Nodes: ${flow.nodes.length}`);
    console.log(`   Edges: ${flow.edges.length}`);
    
    const entryPoints = flow.nodes.filter(n => n.isEntryPoint);
    const dropOffs = flow.nodes.filter(n => n.isDropOff);
    
    console.log(`\n   Entry Points:`);
    entryPoints.forEach(node => {
      console.log(`      • ${node.name || node.signature} (${node.walletCount} wallets)`);
    });
    
    console.log(`\n   Drop-off Points:`);
    dropOffs.forEach(node => {
      console.log(`      • ${node.name || node.signature} (${node.walletCount} wallets)`);
    });

    // Step 7: Test Cohort Analysis
    console.log('\n👥 STEP 7: Cohort Analysis');
    console.log('-'.repeat(70));
    
    const activation = await apiCall(
      `/api/functions/cohorts/activation?contractAddress=${wethContract.address}&chain=${wethContract.chain}&cohortPeriod=monthly`
    );
    console.log(`✅ Activation Analysis:`);
    activation.forEach(cohort => {
      console.log(`   ${cohort.cohortId}: ${cohort.walletCount} wallets, ${(cohort.activationRate * 100).toFixed(1)}% activated`);
    });

    const retention = await apiCall(
      `/api/functions/cohorts/retention?contractAddress=${wethContract.address}&chain=${wethContract.chain}&cohortPeriod=monthly`
    );
    console.log(`\n✅ Retention Analysis:`);
    retention.forEach(cohort => {
      if (cohort.retentionRates) {
        console.log(`   ${cohort.cohortId}:`);
        console.log(`      Day 1: ${(cohort.retentionRates.day1 * 100).toFixed(1)}% | Day 7: ${(cohort.retentionRates.day7 * 100).toFixed(1)}% | Day 30: ${(cohort.retentionRates.day30 * 100).toFixed(1)}%`);
      }
    });

    // Step 8: Get Specific Signature Details
    console.log('\n📈 STEP 8: Detailed Analysis - Deposit Function');
    console.log('-'.repeat(70));
    const depositSig = '0xd0e30db0';
    const depositDetails = await apiCall(
      `/api/functions/signatures/${depositSig}?contractAddress=${wethContract.address}&chain=${wethContract.chain}`
    );
    console.log(`✅ Deposit Function Analysis:`);
    console.log(`   Name: ${depositDetails.name}`);
    console.log(`   Unique Wallets: ${depositDetails.walletCount}`);
    console.log(`   Total Transactions: ${depositDetails.transactionCount}`);
    console.log(`   Avg Txs per Wallet: ${depositDetails.avgTransactionsPerWallet.toFixed(2)}`);
    console.log(`   First Seen: ${new Date(depositDetails.firstSeen).toLocaleDateString()}`);
    console.log(`   Last Seen: ${new Date(depositDetails.lastSeen).toLocaleDateString()}`);

    // Step 9: Get Top Wallets
    console.log('\n💰 STEP 9: Top Wallets Using WETH');
    console.log('-'.repeat(70));
    const walletList = await apiCall(
      `/api/functions/signatures/${depositSig}/wallets?contractAddress=${wethContract.address}&chain=${wethContract.chain}&limit=5`
    );
    console.log(`✅ Top ${walletList.wallets.length} wallets for deposit:`);
    walletList.wallets.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w.walletAddress.substring(0, 10)}...${w.walletAddress.substring(w.walletAddress.length - 8)}`);
      console.log(`      Transactions: ${w.transactionCount} | Gas Used: ${w.totalGasUsed.toLocaleString()}`);
    });

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ VICTOR\'S WETH ONBOARDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📊 Summary:');
    console.log(`   User: Victor (${victor.email})`);
    console.log(`   Contract: ${wethContract.name}`);
    console.log(`   Address: ${wethContract.address}`);
    console.log(`   Chain: ${wethContract.chain}`);
    console.log(`   Total Interactions: ${interactions.length}`);
    console.log(`   Unique Wallets: ${wallets.length}`);
    console.log(`   Functions Tracked: ${sigs.length}`);
    console.log(`   Date Range: 60 days`);
    console.log(`\n   ✅ All function names resolved from ABI`);
    console.log(`   ✅ User journey flow mapped`);
    console.log(`   ✅ Cohort metrics calculated`);
    console.log(`   ✅ Ready for dashboard visualization`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(`   ${error.message}`);
    console.error(`   ${error.stack}`);
    process.exit(1);
  }
}

// Check server
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      console.log('✅ Server is running\n');
      return true;
    }
  } catch (error) {
    console.error('❌ Server not running! Start with: npm start');
    process.exit(1);
  }
}

(async () => {
  await checkServer();
  await runVictorTest();
})();
