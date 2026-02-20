# 🚀 Minimal Backend Server - Quick Start

## Problem
The full backend server has RPC timeout issues preventing it from starting.

## Solution
Use a minimal backend server that responds immediately without RPC dependencies.

---

## Quick Start

### Option 1: Use Start Script (Recommended)
```bash
cd /mnt/c/pr0/meta/mvp-workspace
./start-minimal.sh
```

### Option 2: Manual Start
```bash
# Kill existing servers
pkill -9 -f "node.*server"

# Start minimal server
cd /mnt/c/pr0/meta/mvp-workspace
node server-minimal.js
```

---

## What It Does

The minimal server provides:
- ✅ `/health` - Health check endpoint
- ✅ `/api/onboarding/status` - Onboarding status
- ✅ `/api/users/dashboard` - Dashboard data
- ✅ `/api/onboarding/default-contract` - Default contract

**No RPC connections = Instant startup!**

---

## Verify It's Working

```bash
# Test health endpoint
curl http://localhost:5000/health

# Should return:
{
  "status": "ok",
  "timestamp": "2026-02-06T00:38:00.000Z",
  "version": "1.0.0"
}
```

---

## Frontend Connection

Once the minimal server is running:
1. ✅ Frontend will connect successfully
2. ✅ No more "Unable to connect to server" message
3. ✅ Dashboard will load (with mock data)
4. ✅ No console errors

---

## Difference from Full Server

| Feature | Full Server | Minimal Server |
|---------|-------------|----------------|
| **Startup Time** | 30-60s (with timeouts) | <1s |
| **RPC Connections** | Yes (Lisk, Starknet, Ethereum) | No |
| **Data Fetching** | Real blockchain data | Mock data |
| **Quick Scan** | ❌ Not available | ❌ Not available |
| **Dashboard** | ✅ Full features | ✅ Basic features |
| **Health Check** | ✅ Works | ✅ Works |

---

## When to Use

**Use Minimal Server:**
- ✅ Testing frontend UI
- ✅ Developing without blockchain data
- ✅ Quick prototyping
- ✅ When RPC providers are down

**Use Full Server:**
- ✅ Real blockchain analysis
- ✅ Quick Scan feature
- ✅ Marathon Scan feature
- ✅ Production deployment

---

## Upgrade to Full Server Later

When RPC issues are resolved:
```bash
# Stop minimal server
pkill -f "server-minimal"

# Start full server
npm start
```

---

## Files Created

1. `server-minimal.js` - Minimal backend server
2. `start-minimal.sh` - Start script
3. `MINIMAL_SERVER.md` - This guide

---

## Summary

✅ **Instant startup** - No RPC timeouts  
✅ **Frontend works** - All endpoints respond  
✅ **Clean console** - No errors  
✅ **Quick solution** - Get unblocked immediately  

**Run `./start-minimal.sh` and your frontend will work!** 🚀
