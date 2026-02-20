# Backend Server Diagnosis and Solution

## Problem Summary

The backend server starts and listens on port 5000, but **does not respond to any HTTP requests**. All requests timeout after 60 seconds.

## Root Cause Analysis

### What We Found

1. **Server IS listening**: Process 5816 is listening on port 5000
2. **Connections are established**: 12 TCP connections are in "Established" state
3. **But requests hang**: No responses are sent, connections just wait
4. **Event loop is blocked**: The Node.js event loop cannot process incoming requests

### Why This Happens

The server's event loop is blocked during startup by **synchronous or long-running operations** that prevent it from processing HTTP requests. Even though `server.listen()` is called and the server prints "Server running on port 5000", the event loop is stuck and cannot handle incoming connections.

### Confirmed Working

- ✅ Node.js itself works fine
- ✅ Basic HTTP server works (tested with bare minimum server on port 5001)
- ✅ Network and ports are accessible
- ✅ Express can be imported

### The Culprit

The issue is likely in one of these areas:
1. **Streaming Indexer initialization** - Even though it's in a `.then()` block, it might be blocking
2. **RPC Client Pool** - Starts health checks immediately which might block
3. **Ethers.js providers** - Creating providers can block if network is slow
4. **File I/O during module load** - Some module might be doing synchronous file operations

## Solutions

### Solution 1: Use Simplified Server (RECOMMENDED FOR TESTING)

I've created a simplified server that excludes the streaming indexer:

```powershell
# In PowerShell (in mvp-workspace directory)
.\restart-with-simple-server.ps1
```

This will:
1. Kill the hung server on port 5000
2. Start a simplified server on port 5002
3. Server includes: Auth routes, Faucet routes, Database
4. Server excludes: Streaming indexer, WebSocket, Complex initialization

**Test it:**
```bash
# In another terminal
curl http://localhost:5002/health
curl http://localhost:5002/test
```

**Update frontend to use port 5002:**
Edit `mvp-workspace/frontend/lib/api.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';
```

### Solution 2: Fix The Full Server

To fix the full server with all features, we need to identify and fix the blocking operation.

#### Step 1: Kill the hung server

```powershell
# Find and kill process on port 5000
$process = Get-NetTCPConnection -LocalPort 5000 | Select-Object -First 1 -ExpandProperty OwningProcess
Stop-Process -Id $process -Force
```

#### Step 2: Add more aggressive lazy loading

The streaming indexer should be loaded ONLY when actually needed, not during server startup.

**Modify `src/api/server.js`:**

```javascript
// REMOVE these lines (around line 33-50):
console.log('🔄 Starting streaming indexer initialization...');
initializeStreamingIndexer()
  .then(({ indexerManager, components }) => {
    // ...
  })
  .catch(error => {
    // ...
  });

// REPLACE with lazy initialization:
let streamingIndexer = null;
let wsManager = null;

async function getStreamingIndexer() {
  if (!streamingIndexer) {
    console.log('🔄 Initializing streaming indexer (lazy)...');
    const { indexerManager, components } = await initializeStreamingIndexer();
    streamingIndexer = indexerManager;
    wsManager = new WebSocketManager(wss);
    components.wsManager = wsManager;
    setStreamingIndexer(indexerManager);
    console.log('✅ Streaming indexer initialized');
  }
  return streamingIndexer;
}

// Then in routes that need it, call getStreamingIndexer()
```

#### Step 3: Make RPC health checks optional

**Modify `src/indexer/services/RPCClientPool.js`:**

```javascript
// Don't start health checks automatically
// rpcPool.startHealthChecks(); // REMOVE THIS

// Instead, start them after server is listening:
// In server.js after server.listen():
server.listen(PORT, () => {
  console.log('Server running...');
  // NOW start background tasks
  if (rpcPool) {
    rpcPool.startHealthChecks();
  }
});
```

### Solution 3: Disable Streaming Indexer Entirely (Quick Fix)

If you don't need the streaming indexer right now:

**Edit `src/api/server.js`:**

```javascript
// Comment out streaming indexer import and initialization
// import { initializeStreamingIndexer } from '../indexer/index.js';

// Comment out the initialization block (lines ~33-50)
/*
console.log('🔄 Starting streaming indexer initialization...');
initializeStreamingIndexer()
  .then(...)
  .catch(...);
*/

// Set to null
let streamingIndexer = null;
let wsManager = null;
```

## Testing After Fix

### 1. Test Health Endpoint
```bash
curl http://localhost:5000/health
```

Should respond immediately with:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-19T...",
  "version": "1.0.0"
}
```

### 2. Test Registration
```bash
node test-signup-flow.js
```

Should complete all 5 tests in < 10 seconds.

### 3. Test Frontend
Open `http://localhost:3000/signup` and try to register.
Should work without timeout.

## Current Status

- ❌ Full server (port 5000) is hung and not responding
- ✅ Simplified server (port 5002) is ready to use
- ✅ Bare minimum HTTP server works (port 5001)
- ✅ Node.js and network are working fine

## Recommended Next Steps

1. **Immediate**: Use the simplified server on port 5002 for testing
2. **Short term**: Disable streaming indexer in full server to get it working
3. **Long term**: Implement proper lazy loading for all heavy initialization

## Files Created

- `server-no-indexer.js` - Simplified server without indexer
- `restart-with-simple-server.ps1` - Script to restart with simple server
- `test-bare-minimum.js` - Bare minimum HTTP server test
- `diagnose-startup.js` - Startup diagnosis script
- `test-signup-flow.js` - Complete signup flow test

## Key Insight

The problem is NOT with:
- The lazy initialization fix for FaucetService (that was correct)
- Node.js or the network
- Express itself
- The database

The problem IS with:
- Heavy initialization happening during module load or server startup
- Blocking the event loop before the server can process requests
- Most likely the streaming indexer or RPC client pool

---

**Action Required**: Choose one of the solutions above and implement it.
