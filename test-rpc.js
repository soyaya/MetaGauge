#!/usr/bin/env node
import { ethers } from 'ethers';

console.log('\n🔍 Testing RPC Connection\n');

const RPC = 'https://ethereum-rpc.publicnode.com';
const CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC

try {
  const provider = new ethers.JsonRpcProvider(RPC);
  
  console.log('1. Getting current block...');
  const block = await provider.getBlockNumber();
  console.log('   ✅ Current block:', block);
  
  console.log('\n2. Getting contract code...');
  const code = await provider.getCode(CONTRACT);
  console.log('   ✅ Contract exists:', code.length > 2);
  
  console.log('\n3. Fetching recent transactions...');
  const fromBlock = block - 100;
  const logs = await provider.getLogs({
    address: CONTRACT,
    fromBlock,
    toBlock: block
  });
  console.log('   ✅ Found', logs.length, 'events in last 100 blocks');
  
  console.log('\n✅ RPC is working! Contract has activity.');
  
} catch (error) {
  console.log('\n❌ Error:', error.message);
}
