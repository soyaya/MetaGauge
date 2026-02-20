# Backend Hang Diagnosis

## Problem
The backend server is hanging during startup and not responding to HTTP requests.

## Root Cause
The streaming indexer initialization in `src/api/server.js` is blocking:

```javascript
(async () => {
  try {
    const { indexerManager, components } = await initializeStreamingIndexer();
    streamingIndexer = indexerManager;
    // ...
  } catch (error) {
    console.error('⚠️  Failed to initialize streaming indexer:', error.message);
  }
})();
```

The `initializeStreamingIndexer()` function calls `rpcPool.startHealthChecks()` which initiates periodic RPC health checks. These checks are likely:
1. Timing out on slow/unresponsive RPC endpoints
2. Blocking the event loop
3. Preventing the server from completing startup

## Evidence
- Backend listens on port 5000 (connections not refused)
- All HTTP requests timeout after 3 seconds
- No response from `/health`, `/test`, or `/` endpoints
- Server never prints the "🚀 Multi-Chain Analytics API Server running" message

## Solutions

### Option 1: Add Timeout to Indexer Initialization (Recommended)
Wrap the indexer initialization in a timeout:

```javascript
const initPromise = initializeStreamingIndexer();
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Indexer initialization timeout')), 10000)
);

try {
  const { indexerManager, components } = await Promise.race([initPromise, timeoutPromise]);
  streamingIndexer = indexerManager;
  // ...
} catch (error) {
  console.error('⚠️  Failed to initialize streaming indexer:', error.message);
  console.log('⚠️  Server will start without streaming indexer');
}
```

### Option 2: Make Indexer Initialization Non-Blocking
Don't await the initialization - let it complete in the background:

```javascript
initializeStreamingIndexer()
  .then(({ indexerManager, components }) => {
    streamingIndexer = indexerManager;
    setStreamingIndexer(indexerManager);
    console.log('✅ Streaming indexer initialized');
  })
  .catch(error => {
    console.error('⚠️  Failed to initialize streaming indexer:', error.message);
  });
```

### Option 3: Disable Health Checks on Startup
Modify `RPCClientPool.js` to not start health checks immediately:

```javascript
// In initializeStreamingIndexer()
const rpcPool = new RPCClientPool();
// rpcPool.startHealthChecks(); // Comment this out
// Start health checks after server is running
setTimeout(() => rpcPool.startHealthChecks(), 5000);
```

### Option 4: Add Timeout to RPC Health Checks
In `RPCClientPool.js`, add a timeout to the fetch call:

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1
  }),
  signal: controller.signal
});

clearTimeout(timeoutId);
```

## Immediate Workaround
Restart the backend with one of the above fixes applied. The recommended approach is Option 2 (non-blocking initialization) as it allows the server to start immediately while the indexer initializes in the background.

## Next Steps
1. Apply one of the fixes above
2. Restart the backend
3. Verify with: `node simple-backend-test.js`
4. Once backend responds, run: `node test-weth-validation.js`
