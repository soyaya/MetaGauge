# RPC Effectiveness Analysis for Multi-Chain Indexing

## Date: February 17, 2026

This document analyzes the current RPC configuration and implementation for Lisk, Starknet, and Ethereum to determine if they are effective for multi-chain indexing.

---

## Executive Summary

### Overall Assessment: ⚠️ PARTIALLY EFFECTIVE

The RPC configuration has good foundations but needs improvements:

✅ **Strengths:**
- Multiple RPC endpoints configured for each chain
- RPCClientPool with failover and health monitoring
- Round-robin load balancing implemented
- Circuit breaker pattern for unhealthy endpoints

⚠️ **Weaknesses:**
- Missing fallback URLs in .env for Ethereum
- Starknet RPC configuration incomplete
- No rate limiting implementation
- Health checks not automatically started
- Some RPC clients don't use the pool

---

## Current RPC Configuration

### 1. Ethereum

**Primary RPC:**
```
ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com
```

**Issues:**
- ❌ No fallback URL configured in .env
- ❌ `ETHEREUM_RPC_URL_FALLBACK` is referenced in code but not set
- ⚠️ Public node may have rate limits
- ⚠️ No API key for priority access

**Recommendation:**
```env
ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com
ETHEREUM_RPC_URL_FALLBACK=https://eth.llamarpc.com
ETHEREUM_RPC_URL_BACKUP=https://rpc.ankr.com/eth
```

### 2. Lisk

**Primary RPC:**
```
LISK_RPC_URL1=https://lisk.drpc.org
LISK_RPC_URL2=https://lisk.gateway.tenderly.co/2o3VKjmisQNOJIPlLrt6Ye
```

**Assessment:**
- ✅ Two endpoints configured
- ✅ Tenderly endpoint has API key
- ⚠️ Only 2 endpoints (should have 3-4 for production)
- ⚠️ drpc.org may have rate limits

**Recommendation:**
```env
LISK_RPC_URL1=https://lisk.drpc.org
LISK_RPC_URL2=https://lisk.gateway.tenderly.co/2o3VKjmisQNOJIPlLrt6Ye
LISK_RPC_URL3=https://rpc.lisk.com
LISK_RPC_URL4=https://lisk-mainnet.public.blastapi.io
```

### 3. Starknet

**Primary RPC:**
```
STARKNET_RPC_URL=https://starknet-rpc.publicnode.com
STARKNET_RPC_PRIMARY=https://starknet-rpc.publicnode.com
STARKNET_RPC_FALLBACK=https://rpc.starknet.lava.build
```

**Issues:**
- ⚠️ Duplicate configuration (STARKNET_RPC_URL and STARKNET_RPC_PRIMARY)
- ⚠️ Only 2 endpoints
- ⚠️ Public nodes may have rate limits
- ❌ No numbered URLs (STARKNET_RPC_URL1, URL2, etc.) for pool

**Recommendation:**
```env
STARKNET_RPC_URL1=https://starknet-rpc.publicnode.com
STARKNET_RPC_URL2=https://rpc.starknet.lava.build
STARKNET_RPC_URL3=https://starknet-mainnet.infura.io/v3/YOUR_KEY
STARKNET_RPC_URL4=https://free-rpc.nethermind.io/mainnet-juno
```

---

## RPC Implementation Analysis

### 1. RPCClientPool (✅ GOOD)

**Location:** `mvp-workspace/src/indexer/services/RPCClientPool.js`

**Features:**
- ✅ Chain-specific endpoint management
- ✅ Health monitoring with failure tracking
- ✅ Round-robin load balancing
- ✅ Circuit breaker pattern (threshold: 3 failures)
- ✅ Automatic failover to healthy endpoints
- ✅ Health check polling capability

**Issues:**
- ⚠️ Health checks not automatically started
- ⚠️ No rate limiting implementation
- ⚠️ No retry logic with exponential backoff
- ⚠️ Health check interval not configurable

**Code Quality:** Good

### 2. Individual RPC Clients

#### LiskRpcClient (⚠️ NEEDS IMPROVEMENT)

**Location:** `mvp-workspace/src/services/LiskRpcClient.js`

**Issues:**
- ❌ Single URL only (no failover)
- ❌ Doesn't use RPCClientPool
- ❌ No health monitoring
- ❌ No rate limiting

**Current Implementation:**
```javascript
export class LiskRpcClient {
  constructor(rpcUrl, options = {}) {
    this.rpcUrl = rpcUrl;  // Single URL only!
    this.provider = new ethers.JsonRpcProvider(rpcUrl, options);
  }
}
```

**Recommendation:** Refactor to use RPCClientPool or implement failover

#### EthereumRpcClient (⚠️ NEEDS IMPROVEMENT)

**Location:** `mvp-workspace/src/services/EthereumRpcClient.js`

**Issues:**
- ❌ Single URL only (no failover)
- ❌ Doesn't use RPCClientPool
- ❌ No health monitoring
- ⚠️ Uses RobustProvider but unclear if it has failover

**Recommendation:** Refactor to use RPCClientPool

#### StarknetRpcClient (⚠️ NEEDS IMPROVEMENT)

**Location:** `mvp-workspace/src/services/StarknetRpcClient.js`

**Issues:**
- ❌ Single URL only (no failover)
- ❌ Doesn't use RPCClientPool
- ❌ No health monitoring
- ❌ Manual fetch implementation (no library)

**Recommendation:** Refactor to use RPCClientPool

### 3. MultiChainContractIndexer (✅ GOOD)

**Location:** `mvp-workspace/src/services/MultiChainContractIndexer.js`

**Features:**
- ✅ Configures multiple RPC URLs per chain
- ✅ Uses chain-specific client classes
- ✅ Supports both EVM and Cairo chains

**Configuration:**
```javascript
lisk: {
  rpcUrls: [
    process.env.LISK_RPC_URL1,
    process.env.LISK_RPC_URL2,
    process.env.LISK_RPC_URL3,
    process.env.LISK_RPC_URL4
  ],
  clientClass: LiskRpcClient,
  type: 'evm',
  chainId: 1135
}
```

**Issue:** Client classes don't actually use multiple URLs

---

## Rate Limiting Analysis

### Current State: ❌ NO RATE LIMITING

**Issues:**
- No rate limiting implementation found
- Public RPC nodes typically have limits:
  - PublicNode: ~100 requests/second
  - drpc.org: ~50 requests/second
  - Lava: ~100 requests/second
- Risk of hitting rate limits during heavy indexing
- No request queuing or throttling

**Impact:**
- Indexing may fail during high-volume operations
- No graceful degradation when limits hit
- Potential IP bans from providers

**Recommendation:** Implement rate limiting with:
- Request queue per endpoint
- Configurable requests per second
- Exponential backoff on 429 errors
- Request prioritization

---

## Failover Logic Analysis

### RPCClientPool Failover (✅ IMPLEMENTED)

**How it works:**
1. Maintains health status for each endpoint
2. Tracks failures per endpoint
3. Marks endpoint unhealthy after 3 failures
4. Round-robin through healthy endpoints
5. Falls back to first endpoint if all unhealthy

**Code:**
```javascript
getHealthyEndpoint(chainId) {
  const endpoints = this.endpoints.get(chainId);
  
  // Try to find healthy endpoint
  while (attempts < endpoints.length) {
    const endpoint = endpoints[index];
    const health = this.endpointHealth.get(endpoint);
    
    if (health && health.healthy) {
      return endpoint;
    }
    attempts++;
  }
  
  // All unhealthy, use first anyway
  return endpoints[0];
}
```

**Issues:**
- ⚠️ Falls back to unhealthy endpoint if all fail
- ⚠️ No exponential backoff
- ⚠️ No request retry logic

### Individual Client Failover (❌ NOT IMPLEMENTED)

**Current State:**
- LiskRpcClient: No failover
- EthereumRpcClient: No failover
- StarknetRpcClient: No failover

**Impact:**
- Single point of failure per client
- No automatic recovery from RPC errors
- Indexing stops on RPC failure

---

## Health Monitoring Analysis

### RPCClientPool Health Checks (✅ IMPLEMENTED)

**Features:**
- Periodic health checks via `eth_blockNumber`
- Tracks response time
- Tracks failure count
- Configurable check interval

**Code:**
```javascript
async checkEndpoint(endpoint, health) {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    }),
    signal: AbortSignal.timeout(5000)
  });
  
  if (response.ok) {
    this.markEndpointHealthy(endpoint, responseTime);
  } else {
    this.markEndpointUnhealthy(endpoint, error);
  }
}
```

**Issues:**
- ⚠️ Health checks not automatically started
- ⚠️ No monitoring dashboard
- ⚠️ No alerts on endpoint failures
- ⚠️ 5 second timeout may be too long

---

## Deployment Block Finder Analysis

### Current Implementation (⚠️ BASIC)

**Location:** `mvp-workspace/src/services/DeploymentBlockFinder.js`

**Features:**
- ✅ Tries block explorer API first (Blockscout for Lisk)
- ✅ Falls back to estimation (30 days back)
- ✅ Binary search capability (not used)

**Issues:**
- ❌ Binary search not implemented (commented out)
- ❌ No RPC client passed to constructor
- ⚠️ Estimation may be inaccurate
- ⚠️ Only supports Lisk block explorer

**Current Logic:**
```javascript
async findDeploymentBlock(contractAddress, currentBlock, chain) {
  // Try block explorer
  const explorerBlock = await this.findViaBlockExplorer(contractAddress, chain);
  if (explorerBlock) return explorerBlock;
  
  // Fall back to estimation (30 days)
  const blocksPerDay = (24 * 60 * 60) / 12;
  const estimatedBlock = currentBlock - (blocksPerDay * 30);
  return estimatedBlock;
}
```

**Recommendation:**
- Implement binary search with RPC
- Add block explorers for Ethereum and Starknet
- Improve estimation accuracy

---

## Indexing Trigger Analysis

### Current Implementation (⚠️ BASIC)

**Location:** `mvp-workspace/src/api/routes/trigger-indexing.js`

**Features:**
- ✅ Gets RPC URL from environment
- ✅ Creates ethers provider
- ✅ Fetches logs for contract
- ✅ Limits by subscription tier

**Issues:**
- ❌ No failover (single RPC URL)
- ❌ No rate limiting
- ❌ No retry logic
- ⚠️ Looks back only 50k blocks
- ⚠️ No progress tracking for large ranges

**Current Logic:**
```javascript
const getRpcUrl = (chain) => {
  const urls = {
    ethereum: process.env.ETHEREUM_RPC_URL,
    lisk: process.env.LISK_RPC_URL1,
    starknet: process.env.STARKNET_RPC_URL1
  };
  return urls[chain.toLowerCase()];
};

const provider = new ethers.JsonRpcProvider(getRpcUrl(contract.chain));
const logs = await provider.getLogs({
  address: contract.address,
  fromBlock: startBlock,
  toBlock: currentBlock
});
```

**Recommendation:**
- Use RPCClientPool for failover
- Implement chunking for large block ranges
- Add progress tracking
- Add rate limiting

---

## Recommendations

### Priority 1: Critical (Do Immediately)

1. **Add Missing RPC Fallback URLs**
   ```env
   # Add to .env
   ETHEREUM_RPC_URL_FALLBACK=https://eth.llamarpc.com
   STARKNET_RPC_URL1=https://starknet-rpc.publicnode.com
   STARKNET_RPC_URL2=https://rpc.starknet.lava.build
   ```

2. **Refactor RPC Clients to Use Pool**
   - Update LiskRpcClient to use RPCClientPool
   - Update EthereumRpcClient to use RPCClientPool
   - Update StarknetRpcClient to use RPCClientPool

3. **Start Health Checks Automatically**
   ```javascript
   // In server startup
   const rpcPool = new RPCClientPool();
   rpcPool.initializeChain('lisk');
   rpcPool.initializeChain('ethereum');
   rpcPool.initializeChain('starknet');
   rpcPool.startHealthChecks();
   ```

### Priority 2: High (Do Soon)

4. **Implement Rate Limiting**
   - Add request queue per endpoint
   - Configure max requests per second
   - Handle 429 errors with backoff

5. **Add Retry Logic**
   - Exponential backoff on failures
   - Max retry attempts (3-5)
   - Different strategies per error type

6. **Improve Deployment Block Finder**
   - Implement binary search with RPC
   - Add Ethereum block explorer (Etherscan)
   - Add Starknet block explorer (Voyager)

### Priority 3: Medium (Nice to Have)

7. **Add Monitoring Dashboard**
   - RPC endpoint health status
   - Request rate per endpoint
   - Error rate tracking
   - Response time metrics

8. **Implement Request Prioritization**
   - High priority: User-initiated requests
   - Medium priority: Background indexing
   - Low priority: Historical data fetching

9. **Add Circuit Breaker Improvements**
   - Configurable threshold per endpoint
   - Automatic recovery testing
   - Half-open state for gradual recovery

---

## Testing Recommendations

### 1. RPC Endpoint Testing

Create test script to verify all endpoints:

```javascript
// test-rpc-endpoints.js
import { RPCClientPool } from './src/indexer/services/RPCClientPool.js';

async function testAllEndpoints() {
  const pool = new RPCClientPool();
  
  // Test Lisk
  pool.initializeChain('lisk');
  const liskEndpoint = pool.getHealthyEndpoint('lisk');
  console.log('Lisk endpoint:', liskEndpoint);
  
  // Test Ethereum
  pool.initializeChain('ethereum');
  const ethEndpoint = pool.getHealthyEndpoint('ethereum');
  console.log('Ethereum endpoint:', ethEndpoint);
  
  // Test Starknet
  pool.initializeChain('starknet');
  const starknetEndpoint = pool.getHealthyEndpoint('starknet');
  console.log('Starknet endpoint:', starknetEndpoint);
  
  // Check health
  const health = await pool.checkRPCHealth();
  console.log('Health status:', JSON.stringify(health, null, 2));
}

testAllEndpoints();
```

### 2. Failover Testing

Test failover by simulating endpoint failures:

```javascript
// test-rpc-failover.js
async function testFailover() {
  const pool = new RPCClientPool();
  pool.initializeChain('lisk');
  
  // Mark first endpoint as unhealthy
  const endpoints = pool.endpoints.get('lisk');
  pool.markEndpointUnhealthy(endpoints[0], new Error('Test failure'));
  pool.markEndpointUnhealthy(endpoints[0], new Error('Test failure'));
  pool.markEndpointUnhealthy(endpoints[0], new Error('Test failure'));
  
  // Should return second endpoint
  const healthyEndpoint = pool.getHealthyEndpoint('lisk');
  console.log('Failover endpoint:', healthyEndpoint);
  console.assert(healthyEndpoint === endpoints[1], 'Failover failed!');
}

testFailover();
```

### 3. Load Testing

Test RPC performance under load:

```javascript
// test-rpc-load.js
async function testLoad() {
  const pool = new RPCClientPool();
  pool.initializeChain('lisk');
  
  const requests = [];
  for (let i = 0; i < 100; i++) {
    requests.push(
      fetch(pool.getHealthyEndpoint('lisk'), {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: i
        })
      })
    );
  }
  
  const startTime = Date.now();
  const results = await Promise.allSettled(requests);
  const duration = Date.now() - startTime;
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Completed ${successful}/100 requests in ${duration}ms`);
  console.log(`Rate: ${(successful / duration * 1000).toFixed(2)} req/s`);
}

testLoad();
```

---

## Production Readiness Checklist

### RPC Configuration
- [ ] Add fallback URLs for all chains
- [ ] Configure at least 3 endpoints per chain
- [ ] Add API keys for priority access
- [ ] Test all endpoints for connectivity
- [ ] Document rate limits per endpoint

### Failover Implementation
- [ ] Refactor clients to use RPCClientPool
- [ ] Implement retry logic with exponential backoff
- [ ] Add circuit breaker for each endpoint
- [ ] Test failover scenarios
- [ ] Monitor failover events

### Rate Limiting
- [ ] Implement request queue per endpoint
- [ ] Configure max requests per second
- [ ] Handle 429 errors gracefully
- [ ] Add request prioritization
- [ ] Monitor rate limit hits

### Health Monitoring
- [ ] Start health checks automatically
- [ ] Add monitoring dashboard
- [ ] Set up alerts for endpoint failures
- [ ] Track response times
- [ ] Log health check results

### Testing
- [ ] Test all RPC endpoints
- [ ] Test failover scenarios
- [ ] Load test under production load
- [ ] Test rate limiting
- [ ] Test error handling

---

## Conclusion

The current RPC configuration has a solid foundation with the RPCClientPool implementation, but needs improvements to be production-ready:

**Immediate Actions Required:**
1. Add missing fallback URLs to .env
2. Refactor RPC clients to use the pool
3. Start health checks automatically
4. Implement rate limiting

**Estimated Work:**
- Priority 1 fixes: 4-6 hours
- Priority 2 improvements: 8-12 hours
- Priority 3 enhancements: 12-16 hours

**Total Estimated Time:** 24-34 hours for full production readiness

**Current Status:** ⚠️ PARTIALLY EFFECTIVE - Works for light usage but needs improvements for production-scale multi-chain indexing.

