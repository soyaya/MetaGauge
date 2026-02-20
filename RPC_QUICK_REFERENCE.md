# RPC Multi-URL Failover - Quick Reference

## 🚀 Quick Start

### Using Enhanced RPC Clients

```javascript
// Import the client
import { LiskRpcClient } from './src/services/LiskRpcClient.js';

// Option 1: Single URL (backward compatible)
const client1 = new LiskRpcClient('https://lisk.drpc.org');

// Option 2: Multiple URLs (enhanced with failover)
const client2 = new LiskRpcClient([
  'https://lisk.drpc.org',
  'https://rpc.api.lisk.com',
  'https://lisk.gateway.tenderly.co/2o3VKjmisQNOJIPlLrt6Ye'
]);

// Option 3: From environment variables
const urls = [
  process.env.LISK_RPC_URL1,
  process.env.LISK_RPC_URL2,
  process.env.LISK_RPC_URL3
].filter(Boolean);
const client3 = new LiskRpcClient(urls);

// Use the client
const blockNumber = await client3.getBlockNumber();
```

## 📋 Environment Variables

### Required Format
```env
# Ethereum
ETHEREUM_RPC_URL1=https://ethereum-rpc.publicnode.com
ETHEREUM_RPC_URL2=https://eth.nownodes.io/YOUR_API_KEY
ETHEREUM_RPC_URL3=https://eth.llamarpc.com

# Lisk
LISK_RPC_URL1=https://lisk.drpc.org
LISK_RPC_URL2=https://lisk.gateway.tenderly.co/YOUR_KEY
LISK_RPC_URL3=https://rpc.api.lisk.com

# Starknet
STARKNET_RPC_URL1=https://rpc.starknet.lava.build
STARKNET_RPC_URL2=https://starknet-rpc.publicnode.com
STARKNET_RPC_URL3=https://starknet-mainnet.infura.io/v3/YOUR_KEY
```

## 🔧 Failover Behavior

### How It Works
1. Client tries URL1 (3 attempts: 1 initial + 2 retries)
2. If URL1 fails, tries URL2 (3 attempts)
3. If URL2 fails, tries URL3 (3 attempts)
4. If all fail, throws error with details

### Total Attempts
- 3 URLs × 3 attempts = **9 total attempts**
- Retry delay: 1s, 2s (exponential backoff)

## 🧪 Testing

### Run Test Suite
```bash
cd mvp-workspace
node test-enhanced-rpc-failover.js
```

### Quick Manual Test
```javascript
import { LiskRpcClient } from './src/services/LiskRpcClient.js';

// Test with intentional bad URL
const client = new LiskRpcClient([
  'https://invalid-url.com',  // Will fail
  'https://lisk.drpc.org'     // Will succeed
]);

const block = await client.getBlockNumber();
console.log('Failover worked! Block:', block);
```

## 📊 All Supported Chains

### Lisk
```javascript
import { LiskRpcClient } from './src/services/LiskRpcClient.js';
const client = new LiskRpcClient([...urls]);
```

### Ethereum
```javascript
import { EthereumRpcClient } from './src/services/EthereumRpcClient.js';
const client = new EthereumRpcClient([...urls]);
```

### Starknet
```javascript
import { StarknetRpcClient } from './src/services/StarknetRpcClient.js';
const client = new StarknetRpcClient([...urls]);
```

## 🎯 Common Use Cases

### 1. Basic Block Query
```javascript
const client = new LiskRpcClient([url1, url2, url3]);
const blockNumber = await client.getBlockNumber();
const block = await client.getBlock(blockNumber);
```

### 2. Transaction Fetching
```javascript
const client = new LiskRpcClient([url1, url2, url3]);
const txs = await client.getTransactionsByAddress(
  '0xAddress',
  fromBlock,
  toBlock
);
```

### 3. With MultiChainContractIndexer
```javascript
import { MultiChainContractIndexer } from './src/services/MultiChainContractIndexer.js';

const indexer = new MultiChainContractIndexer();
const result = await indexer.indexContractInteractions(
  '0xAddress',
  fromBlock,
  toBlock,
  'lisk'
);
// Automatically uses all configured URLs
```

## 🔍 Monitoring & Debugging

### Check Logs
Enhanced clients log failover events:
```
⚠️ RPC call failed on https://url1.com: timeout
🔄 Trying next URL: https://url2.com
✅ RPC call successful on https://url2.com
```

### Error Messages
If all URLs fail:
```
Error: All RPC URLs failed after 9 attempts
  URL 1 (https://url1.com): timeout
  URL 2 (https://url2.com): connection refused
  URL 3 (https://url3.com): rate limited
```

## ⚡ Performance Tips

### 1. Order URLs by Speed
Put fastest URLs first:
```javascript
const urls = [
  'https://fast-provider.com',    // Fastest
  'https://medium-provider.com',  // Medium
  'https://slow-provider.com'     // Slowest (backup)
];
```

### 2. Use Paid Providers First
```javascript
const urls = [
  process.env.PAID_RPC_URL,      // Paid (reliable)
  process.env.PUBLIC_RPC_URL1,   // Public (free)
  process.env.PUBLIC_RPC_URL2    // Public (backup)
];
```

### 3. Geographic Distribution
```javascript
const urls = [
  'https://us-provider.com',     // US
  'https://eu-provider.com',     // Europe
  'https://asia-provider.com'    // Asia
];
```

## 🛠️ Troubleshooting

### Issue: All URLs failing
**Solution**: Check .env configuration
```bash
# Verify URLs are set
echo $LISK_RPC_URL1
echo $LISK_RPC_URL2
echo $LISK_RPC_URL3
```

### Issue: Slow failover
**Solution**: Reduce timeout (default 30s)
```javascript
const client = new LiskRpcClient(urls, {
  timeout: 10000  // 10 seconds
});
```

### Issue: Too many retries
**Solution**: Reduce retry count
```javascript
const client = new LiskRpcClient(urls, {
  retries: 1  // Only 1 retry per URL
});
```

## 📚 Additional Resources

- **Full Documentation**: `RPC_ENHANCEMENT_COMPLETE.md`
- **Integration Status**: `RPC_INTEGRATION_STATUS.md`
- **Original Analysis**: `RPC_EFFECTIVENESS_ANALYSIS.md`
- **Test Script**: `test-enhanced-rpc-failover.js`

## ✅ Checklist

Before deploying:
- [ ] .env configured with 3 URLs per chain
- [ ] Test script passes (`node test-enhanced-rpc-failover.js`)
- [ ] Logs show failover working correctly
- [ ] Backward compatibility verified
- [ ] Production URLs tested

---

**Quick Help**: If you need help, check the logs for detailed error messages showing which URLs failed and why.
