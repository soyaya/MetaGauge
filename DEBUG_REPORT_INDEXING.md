# Debug Report: Indexing Failure Root Cause

## Issue
All indexing attempts fail with "Blockchain connection temporarily unavailable"

## Root Cause Found
**USDT Contract (0xdAC17F958D2ee523a2206206994597C13D831ec7) is TOO ACTIVE**

### The Problem:
1. Pro tier requests 200,000 blocks of history
2. USDT has **millions of Transfer events** in that range
3. Single `eth_getLogs` call with 200k blocks **times out**
4. RPC providers reject or timeout the request
5. Error is caught and shown as "connection unavailable"

### Proof:
```javascript
// Current request for Pro tier:
fromBlock: currentBlock - 200000  // ~1 month
toBlock: currentBlock
address: 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)

// Result: MILLIONS of events → RPC timeout
```

## Solutions

### Option 1: Chunked Log Fetching (RECOMMENDED)
Split large block ranges into smaller chunks:

```javascript
// In EthereumRpcClient.getTransactionsByAddress()
const CHUNK_SIZE = 2000; // Fetch 2000 blocks at a time
const chunks = [];

for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
  const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
  const logs = await this._makeRpcCall('eth_getLogs', [{
    fromBlock: '0x' + start.toString(16),
    toBlock: '0x' + end.toString(16),
    address: contractAddress
  }]);
  chunks.push(...logs);
  
  // Progress update
  const progress = ((start - fromBlock) / (toBlock - fromBlock)) * 100;
  console.log(`   📦 Fetched ${chunks.length} events (${progress.toFixed(1)}%)`);
}
```

### Option 2: Adaptive Block Range
Detect high-activity contracts and reduce range:

```javascript
// Known high-activity contracts
const HIGH_ACTIVITY_CONTRACTS = [
  '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
];

const blockRanges = {
  free: isHighActivity ? 1000 : 10000,
  starter: isHighActivity ? 5000 : 50000,
  pro: isHighActivity ? 10000 : 200000,
  enterprise: isHighActivity ? 50000 : 500000
};
```

### Option 3: Sample Recent Data Only
For high-activity contracts, only fetch last N blocks:

```javascript
const MAX_BLOCKS_FOR_HIGH_ACTIVITY = 10000; // ~2 days
if (isHighActivity && blockRange > MAX_BLOCKS_FOR_HIGH_ACTIVITY) {
  startBlock = currentBlock - MAX_BLOCKS_FOR_HIGH_ACTIVITY;
  console.log(`⚠️ High-activity contract detected, limiting to ${MAX_BLOCKS_FOR_HIGH_ACTIVITY} blocks`);
}
```

## Immediate Fix

**Implement Option 1 (Chunked Fetching)** in `EthereumRpcClient.js`:

Location: `src/services/EthereumRpcClient.js` line ~190

Replace single `eth_getLogs` call with chunked approach.

## Testing After Fix

```bash
# Test with USDT (high activity)
curl -X POST http://localhost:5000/api/onboarding/trigger-indexing \
  -H "Authorization: Bearer TOKEN"

# Should see:
# ✅ Fetched 1000 events (10%)
# ✅ Fetched 2500 events (25%)
# ✅ Fetched 5000 events (50%)
# etc.
```

## Why This Wasn't Caught Earlier

1. RPC works fine for small contracts
2. Error message is generic ("connection unavailable")
3. No chunking for initial log fetch
4. USDT is an extreme case (most active ERC20)

## Recommendation

Implement **Option 1 + Option 2**:
- Chunk all log requests (safer for all contracts)
- Reduce range for known high-activity contracts
- Add progress updates during chunking
