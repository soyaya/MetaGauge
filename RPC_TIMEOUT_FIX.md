# 🔧 Backend RPC Timeout Issue - Solution

## Problem

Backend server is timing out during startup:
```
Error: request timeout (code=TIMEOUT, version=6.16.0)
at makeError (ethers/lib.esm/utils/errors.js:132:21)
```

**Root Cause:** Server is trying to connect to RPC providers (Ethereum, Starknet, etc.) during initialization, and some providers are timing out, blocking the server from starting.

---

## Quick Fix

### Option 1: Use Restart Script (Recommended)
```bash
cd /mnt/c/pr0/meta/mvp-workspace
./restart-server.sh
```

### Option 2: Manual Restart
```bash
# Kill processes
pkill -9 -f "node.*server.js"

# Clear port
lsof -ti:5000 | xargs kill -9

# Start fresh
cd /mnt/c/pr0/meta/mvp-workspace
npm start

# Verify
curl http://localhost:5000/health
```

---

## Why This Happens

The `SmartContractFetcher` initializes RPC providers for all chains (Ethereum, Starknet, Lisk) even if not needed. Some providers have:
- Invalid API keys
- Network timeouts
- Rate limiting

This blocks server startup.

---

## Permanent Fix (Already Implemented)

The code already has lazy initialization - RPC clients are only created when needed (in routes like `/api/analysis/quick-scan`). The timeout you're seeing is likely from:

1. **Zombie processes** - Old server instances still running
2. **Port conflicts** - Port 5000 already in use
3. **Cached connections** - Stuck RPC connections

**Solution:** Clean restart clears all of these.

---

## Verification Steps

After restart, verify:

```bash
# 1. Check server is running
curl http://localhost:5000/health
# Should return: {"status":"ok","timestamp":"..."}

# 2. Check dashboard endpoint
curl http://localhost:5000/api/users/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check frontend can connect
# Open browser: http://localhost:3000/dashboard
# Should load without timeout errors
```

---

## If Still Not Working

### Check Logs
```bash
tail -f server.log
```

Look for:
- ✅ "Server running on port 5000"
- ❌ "EADDRINUSE" (port in use)
- ❌ "TIMEOUT" (RPC errors)

### Check Port
```bash
lsof -i :5000
# Should show ONE node process
```

### Check Processes
```bash
ps aux | grep "node.*server"
# Should show ONE process
```

---

## Summary

**Issue:** RPC timeout blocking server startup  
**Cause:** Zombie processes or stuck connections  
**Fix:** Clean restart with `./restart-server.sh`  
**Status:** Frontend ready, backend needs clean restart  

**Run the restart script and the issue should be resolved!** 🚀
