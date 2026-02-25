/**
 * Fetch Real WETH Data from Etherscan
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';

const ETHERSCAN_API_KEY = 'PCDRZ41EVQTF4HYC8CVC88BC6C9JR7SP5M';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const ETHERSCAN_API = 'https://api.etherscan.io/api';

async function fetchWETHTransactions() {
  console.log('📡 Fetching real WETH transactions from Etherscan...\n');

  try {
    // Get latest 1000 transactions
    const url = `${ETHERSCAN_API}?module=account&action=txlist&address=${WETH_ADDRESS}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    
    console.log('🔍 Requesting data...');
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1') {
      throw new Error(`Etherscan API error: ${data.message}`);
    }

    const transactions = data.result;
    console.log(`✅ Fetched ${transactions.length} transactions\n`);

    // Process transactions
    const interactions = transactions.map(tx => ({
      walletAddress: tx.from.toLowerCase(),
      signature: tx.input.substring(0, 10),
      timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      transactionHash: tx.hash,
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: parseInt(tx.gasUsed),
      value: tx.value
    })).filter(i => i.signature !== '0x');

    // Save to storage
    const { FunctionAnalyticsStorage } = await import('./src/services/FunctionAnalyticsStorage.js');
    const storage = new FunctionAnalyticsStorage();
    await storage.saveInteractions(WETH_ADDRESS, 'ethereum', interactions);

    console.log('📊 Statistics:');
    console.log(`   Total transactions: ${interactions.length}`);
    console.log(`   Unique wallets: ${new Set(interactions.map(i => i.walletAddress)).size}`);
    console.log(`   Unique signatures: ${new Set(interactions.map(i => i.signature)).size}`);
    console.log(`   Date range: ${interactions[interactions.length-1].timestamp.split('T')[0]} to ${interactions[0].timestamp.split('T')[0]}`);
    
    console.log('\n✅ Real WETH data saved!');
    console.log('\nNow test with:');
    console.log(`curl "http://localhost:5000/api/functions/signatures?contractAddress=${WETH_ADDRESS}&chain=ethereum" -H "Authorization: Bearer YOUR_TOKEN"`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchWETHTransactions();
