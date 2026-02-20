#!/usr/bin/env node

/**
 * RPC Connection Test
 * Tests all RPC endpoints to ensure they're working before running full tests
 */

import dotenv from 'dotenv';

dotenv.config();

// Color output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function testRpcEndpoint(name, urls, chain) {
  logInfo(`Testing ${name}...`);
  
  if (!urls || urls.length === 0) {
    logError(`No RPC URLs configured for ${name}`);
    return false;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;
    
    try {
      // Dynamically import the appropriate RPC client
      let RpcClient;
      if (chain === 'ethereum') {
        const module = await import('./src/services/EthereumRpcClient.js');
        RpcClient = module.EthereumRpcClient;
      } else if (chain === 'lisk') {
        const module = await import('./src/services/LiskRpcClient.js');
        RpcClient = module.LiskRpcClient;
      } else if (chain === 'starknet') {
        const module = await import('./src/services/StarknetRpcClient.js');
        RpcClient = module.StarknetRpcClient;
      }
      
      const client = new RpcClient([url], { tier: 'free' });
      
      // Test getting current block number
      const blockNumber = await client.getBlockNumber();
      
      logSuccess(`  URL ${i + 1}: ${url.substring(0, 50)}... - Block: ${blockNumber.toLocaleString()}`);
      successCount++;
    } catch (error) {
      logError(`  URL ${i + 1}: ${url.substring(0, 50)}... - ${error.message}`);
      failCount++;
    }
  }
  
  console.log();
  if (successCount > 0) {
    logSuccess(`${name}: ${successCount}/${urls.length} endpoints working`);
    return true;
  } else {
    logError(`${name}: All endpoints failed!`);
    return false;
  }
}

async function runRpcTests() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║                        RPC CONNECTION TEST                                    ║', 'bright');
  log('║                                                                               ║', 'bright');
  log('║  Testing all RPC endpoints before running full integration tests             ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════════════════════════╝', 'bright');
  console.log('\n');
  
  const startTime = Date.now();
  
  // Collect RPC URLs from environment
  const ethereumUrls = [
    process.env.ETHEREUM_RPC_URL1,
    process.env.ETHEREUM_RPC_URL2,
    process.env.ETHEREUM_RPC_URL3
  ].filter(Boolean);
  
  const liskUrls = [
    process.env.LISK_RPC_URL1,
    process.env.LISK_RPC_URL2,
    process.env.LISK_RPC_URL3
  ].filter(Boolean);
  
  const starknetUrls = [
    process.env.STARKNET_RPC_URL1,
    process.env.STARKNET_RPC_URL2,
    process.env.STARKNET_RPC_URL3
  ].filter(Boolean);
  
  logSection('CONFIGURATION CHECK');
  
  logInfo(`Ethereum RPC URLs configured: ${ethereumUrls.length}`);
  ethereumUrls.forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });
  
  console.log();
  logInfo(`Lisk RPC URLs configured: ${liskUrls.length}`);
  liskUrls.forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });
  
  console.log();
  logInfo(`Starknet RPC URLs configured: ${starknetUrls.length}`);
  starknetUrls.forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });
  
  // Test each chain
  logSection('TESTING ETHEREUM RPC ENDPOINTS');
  const ethereumWorks = await testRpcEndpoint('Ethereum', ethereumUrls, 'ethereum');
  
  logSection('TESTING LISK RPC ENDPOINTS');
  const liskWorks = await testRpcEndpoint('Lisk', liskUrls, 'lisk');
  
  logSection('TESTING STARKNET RPC ENDPOINTS');
  const starknetWorks = await testRpcEndpoint('Starknet', starknetUrls, 'starknet');
  
  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  logSection('TEST SUMMARY');
  
  console.log(`\n⏱️  Total Duration: ${duration} seconds\n`);
  
  console.log('📊 Results:');
  console.log('─'.repeat(80));
  console.log(`Ethereum:  ${ethereumWorks ? '✅ PASS' : '❌ FAIL'} (${ethereumUrls.length} endpoints)`);
  console.log(`Lisk:      ${liskWorks ? '✅ PASS' : '❌ FAIL'} (${liskUrls.length} endpoints)`);
  console.log(`Starknet:  ${starknetWorks ? '✅ PASS' : '❌ FAIL'} (${starknetUrls.length} endpoints)`);
  console.log('─'.repeat(80));
  
  const allPassed = ethereumWorks && liskWorks && starknetWorks;
  
  if (allPassed) {
    logSuccess('\n🎉 All RPC endpoints are working! Ready to run integration tests.\n');
  } else {
    logError('\n❌ Some RPC endpoints failed. Please check configuration and network connectivity.\n');
    
    console.log('💡 Troubleshooting:');
    console.log('─'.repeat(80));
    console.log('1. Check your .env file has correct RPC URLs');
    console.log('2. Verify network connectivity');
    console.log('3. Try alternative RPC providers');
    console.log('4. Check if RPC endpoints are rate-limited');
    console.log('─'.repeat(80));
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run the test
runRpcTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
