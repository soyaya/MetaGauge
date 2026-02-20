# Request Timeout Fixes

## Problem
The application was experiencing request timeout errors from ethers.js and the frontend fetch API:

```
Error: request timeout (code=TIMEOUT, version=6.16.0)
TypeError: Failed to fetch
```

These errors occurred because:
1. **Backend RPC calls** were using short default timeouts (30s)
2. **No retry logic** was in place for transient network failures
3. **Frontend API calls** had no timeout protection or retry mechanism
4. Slow blockchain operations exceeded available timeouts

## Solutions Implemented

### 1. Backend: Enhanced RpcClientService (`src/services/RpcClientService.js`)

**Timeout Improvements:**
- Increased default timeout from 30s to 60s for transactions
- Increased block timeout from 10s to 30s
- Added 45s default timeout for general operations

**Retry Logic:**
- Increased max retries from 3 to 5 attempts
- Implemented exponential backoff: 2s × 2^attempt (up to 30s max)
- Added random jitter (0-1s) to prevent thundering herd problem
- Retries only for transient errors (network, timeout, rate limit)

**Code:**
```javascript
this.retryConfig = {
  maxRetries: 5,      // Increased from 3
  baseDelay: 2000,    // Increased from 1000ms
  maxDelay: 30000     // Increased from 10000ms
};
this.timeouts = {
  transaction: 60000, // Increased from 30s
  block: 30000,       // Increased from 10s
  default: 45000      // New default
};
```

### 2. Backend: Enhanced SubscriptionService (`src/services/SubscriptionService.js`)

**Added Timeout Protection:**
- Wrapped contract calls with `_callWithRetry()` method
- Implemented timeout and retry logic for all contract interactions
- 4 retry attempts with exponential backoff
- 20-30s timeout per call

**Methods Protected:**
- `isSubscriberActive()`
- `getSubscriptionInfo()`

### 3. Backend: Enhanced FaucetService (`src/services/FaucetService.js`)

**Added Timeout Protection:**
- Wrapped all contract read operations with retry logic
- 4 retry attempts with exponential backoff
- 25s timeout for faucet operations

**Methods Protected:**
- `balanceOf()`
- `totalSupply()`
- `maxSupply()`
- `owner()`

### 4. Backend: Improved Error Handling (`src/api/middleware/errorHandler.js`)

**Added Timeout Error Handling:**
```javascript
// RPC/Blockchain timeout errors → 504 Gateway Timeout
if (err.message.includes('timeout') || err.code === 'TIMEOUT') {
  return res.status(504).json({
    error: 'Gateway Timeout',
    message: 'Blockchain network request timed out. Please try again.',
    code: 'TIMEOUT',
    retryable: true
  });
}

// Network errors → 503 Service Unavailable
if (err.message.includes('ECONNREFUSED') || err.message.includes('Network')) {
  return res.status(503).json({
    error: 'Service Unavailable',
    message: 'Unable to connect to blockchain network. Please try again later.',
    code: 'NETWORK_ERROR',
    retryable: true
  });
}
```

### 5. Frontend: Enhanced API Client (`frontend/lib/api.ts`)

**Timeout Protection:**
- 30s timeout per API request (configurable)
- Automatic retry with exponential backoff
- Smart retry detection (only for timeout/network errors)

**Retry Configuration:**
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 10000,      // 10 seconds
  timeout: 30000        // 30 seconds
};
```

**Retryable Errors:**
- Timeout errors
- Failed to fetch
- Network errors (ECONNREFUSED, ENOTFOUND)
- Connection refused errors

**Non-Retryable Errors:**
- 4xx HTTP errors (validation, auth, not found)
- Malformed requests
- Invalid credentials

**Exponential Backoff with Jitter:**
```typescript
const exponentialDelay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
const jitter = Math.random() * 500;
const delay = Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelay);
```

## Deployment Notes

### Environment Variables (if customization needed)
```env
# Backend (in .env)
LISK_SEPOLIA_RPC=https://rpc.sepolia-api.lisk.com

# Frontend (in .env.local)
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Testing the Fixes

1. **Monitor logs** for retry attempts:
   ```
   [RPC ethereum] getTransactionsByAddress failed (attempt 1/5): timeout. Retrying in 2150ms...
   ```

2. **Check response times** - expect longer times due to retries, but better reliability

3. **Test with slow networks** - simulate slow RPC endpoints:
   ```bash
   # Use network throttling in DevTools to test
   ```

## Performance Impact

- **Slight latency increase**: Timeouts are now longer (30-60s vs 10-30s)
- **Better reliability**: Failed requests are automatically retried
- **Distributed load**: Jitter prevents simultaneous retries
- **Graceful degradation**: Clear error messages for persistent failures

## Future Improvements

1. **Caching**: Add response caching for repeated queries
2. **Circuit breaker**: Skip retries if RPC endpoint is consistently down
3. **Connection pooling**: Reuse connections to RPC endpoints
4. **Monitoring**: Add metrics for timeout/retry rates
5. **Redis queuing**: For async operations instead of blocking
6. **WebSocket subscriptions**: Replace polling for real-time data

## Troubleshooting

### Still Getting Timeouts?
1. Check RPC endpoint availability
2. Monitor server CPU/memory usage
3. Check network connectivity to RPC provider
4. Increase `RETRY_CONFIG.maxRetries` if transient failures are frequent

### Retries Not Triggering?
1. Verify error message matches retry detection logic
2. Check browser console for exact error text
3. Ensure network conditions allow for retry delays

### Slow Response Times?
1. This is expected due to longer timeouts
2. Monitor actual failure rates vs timeout duration trade-off
3. Adjust timeout values based on RPC provider performance
