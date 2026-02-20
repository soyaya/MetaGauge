# RPC Client Enhancements

## Summary
Enhanced all three RPC clients (Lisk, Starknet, Ethereum) with caching, request queuing, error tracking, and improved timestamp fallback logic.

## New Services

### 1. RpcCache (`src/services/RpcCache.js`)
- **Purpose**: Cache RPC responses to reduce redundant calls
- **TTL**: 60 seconds (configurable)
- **Key**: Method + params combination
- **Methods**: `get()`, `set()`, `clear()`

### 2. RpcRequestQueue (`src/services/RpcRequestQueue.js`)
- **Purpose**: Rate limiting based on subscription tier
- **Tiers**:
  - **Free**: 2 concurrent, 30 requests/min
  - **Pro**: 5 concurrent, 100 requests/min
  - **Enterprise**: 10 concurrent, 300 requests/min
- **Methods**: `enqueue()`, `setTier()`

### 3. RpcErrorTracker (`src/services/RpcErrorTracker.js`)
- **Purpose**: Track error patterns and provide insights
- **Tracks**: Error message, code, RPC URL, method, params, timestamp, attempt
- **Methods**: `track()`, `getStats()`, `clear()`
- **Stats**: Total errors, last 5min errors, errors by URL, errors by method

## Enhanced RPC Clients

### LiskRpcClient
- ✅ Caching with 60s TTL
- ✅ Request queuing with tier-based rate limiting
- ✅ Error context tracking
- ✅ Block timestamp estimation (2s block time) instead of current time fallback
- ✅ Block timestamp caching
- ✅ New methods: `setTier()`, `getErrorStats()`, `clearCache()`

### StarknetRpcClient
- ✅ Caching with 60s TTL
- ✅ Request queuing with tier-based rate limiting
- ✅ Error context tracking
- ✅ Block timestamp estimation (6s block time) instead of current time fallback
- ✅ Block timestamp caching
- ✅ New methods: `setTier()`, `getErrorStats()`, `clearCache()`

### EthereumRpcClient
- ✅ Caching with 60s TTL (skips filter methods)
- ✅ Request queuing with tier-based rate limiting
- ✅ Error context tracking
- ✅ Block timestamp estimation (12s block time) instead of current time fallback
- ✅ Block timestamp caching
- ✅ New methods: `setTier()`, `getErrorStats()`, `clearCache()`, `getChain()`

## Usage Example

```javascript
// Initialize with tier
const client = new LiskRpcClient(rpcUrls, { tier: 'pro' });

// Change tier dynamically
client.setTier('enterprise');

// Get error statistics
const stats = client.getErrorStats();
console.log(stats.last5min); // Errors in last 5 minutes
console.log(stats.byUrl);    // Errors grouped by RPC URL
console.log(stats.byMethod); // Errors grouped by method

// Clear cache
client.clearCache();
```

## Benefits

1. **Performance**: Reduced redundant RPC calls via caching
2. **Rate Limiting**: Automatic tier-based throttling prevents provider limits
3. **Error Insights**: Track failure patterns to identify problematic providers
4. **Accurate Timestamps**: Estimation based on block time instead of current time
5. **Cost Optimization**: Fewer RPC calls = lower costs for paid providers
6. **Reliability**: Better error handling and context for debugging

## Block Time Estimates
- **Lisk**: 2 seconds per block
- **Starknet**: 6 seconds per block
- **Ethereum**: 12 seconds per block
