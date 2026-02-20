#!/usr/bin/env node

/**
 * Simple Ethereum Test - Create user and check if indexing works
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = 'http://localhost:5000';

const TEST_USER = {
  email: `ethtest-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Ethereum Test User',
  walletAddress: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
};

const TEST_CONTRACT = {
  contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  chain: 'ethereum',
  contractName: 'USD Coin (USDC)',
  purpose: 'Stablecoin for testing data accuracy',
  category: 'defi',
  startDate: '2018-09-26'
};

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🚀 Starting Simple Ethereum Test\n');
  
  try {
    // Step 1: Register
    console.log('📝 Registering user...');
    const registerResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, TEST_USER);
    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.id;
    console.log(`✅ User registered: ${userId}\n`);
    
    // Step 2: Onboard
    console.log('🎯 Onboarding with Ethereum contract...');
    const onboardResponse = await axios.post(
      `${API_BASE_URL}/api/onboarding/complete`,
      TEST_CONTRACT,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`✅ Onboarding complete`);
    console.log(`   Indexing started: ${onboardResponse.data.indexingStarted}\n`);
    
    // Step 3: Wait and check status multiple times
    console.log('⏳ Monitoring indexing (checking every 5 seconds for 60 seconds)...\n');
    
    for (let i = 0; i < 12; i++) {
      await wait(5000);
      
      try {
        const statusResponse = await axios.get(
          `${API_BASE_URL}/api/onboarding/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const progress = statusResponse.data.indexingProgress || 0;
        const isIndexed = statusResponse.data.isIndexed || false;
        const currentStep = statusResponse.data.currentStep || '';
        
        console.log(`[${i + 1}/12] Progress: ${progress}% | Indexed: ${isIndexed} | Step: ${currentStep}`);
        
        if (isIndexed) {
          console.log('\n✅ Indexing complete!\n');
          break;
        }
      } catch (error) {
        console.log(`[${i + 1}/12] ❌ Error checking status: ${error.message}`);
      }
    }
    
    // Step 4: Get final contract data
    console.log('\n📊 Fetching final contract data...');
    const contractResponse = await axios.get(
      `${API_BASE_URL}/api/onboarding/default-contract`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('\n📈 Results:');
    console.log('─'.repeat(60));
    console.log(`Contract: ${contractResponse.data.contract?.name}`);
    console.log(`Address: ${contractResponse.data.contract?.address}`);
    console.log(`Indexed: ${contractResponse.data.contract?.isIndexed}`);
    console.log(`Progress: ${contractResponse.data.contract?.indexingProgress}%`);
    
    if (contractResponse.data.metrics) {
      console.log(`\nMetrics:`);
      console.log(`  Transactions: ${contractResponse.data.metrics.totalTransactions || 0}`);
      console.log(`  Users: ${contractResponse.data.metrics.uniqueUsers || 0}`);
      console.log(`  Total Value: ${contractResponse.data.metrics.totalValue || 0} ETH`);
    } else {
      console.log(`\n⚠️  No metrics available yet`);
    }
    
    if (contractResponse.data.analysisError) {
      console.log(`\n❌ Analysis Error: ${contractResponse.data.analysisError}`);
    }
    
    console.log('─'.repeat(60));
    
    console.log(`\n✅ Test completed!`);
    console.log(`\n📧 Email: ${TEST_USER.email}`);
    console.log(`🔑 Password: ${TEST_USER.password}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

runTest();
