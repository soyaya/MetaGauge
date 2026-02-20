# ✅ Onboarding Indexing Fix

**Date**: 2026-02-14  
**Issue**: Indexing not starting automatically after onboarding completion  
**Status**: 🟢 FIXED

---

## 🐛 Problem

When users completed onboarding, the automatic indexing failed with error:
```
contractConfig is not defined
```

This caused:
- ❌ Dashboard showing "Indexing 0%" forever
- ❌ No data displayed in analytics tabs
- ❌ Error message shown to users

---

## 🔍 Root Cause

In `/src/api/routes/onboarding.js` line 267-274, the code was trying to use:
```javascript
await indexerManager.startIndexing(
  req.user.id,
  contractConfig.targetContract.address,  // ❌ Wrong - contractConfig used before defined
  contractConfig.targetContract.chain,     // ❌ Wrong
  userTier
);
```

But `contractConfig` is a local variable that was already used to create the contract. The correct values are the request parameters.

---

## ✅ Solution

Changed to use the request parameters directly:
```javascript
await indexerManager.startIndexing(
  req.user.id,
  contractAddress,  // ✅ Correct - from req.body
  chain,            // ✅ Correct - from req.body
  userTier
);
```

---

## 📝 Changes Made

**File**: `src/api/routes/onboarding.js`  
**Lines**: 267-274

```diff
  await indexerManager.startIndexing(
    req.user.id,
-   contractConfig.targetContract.address,
-   contractConfig.targetContract.chain,
+   contractAddress,
+   chain,
    userTier
  );
```

Also added better error logging:
```javascript
} catch (error) {
  console.error(`❌ Failed to start streaming indexer:`, error);
  // Don't fail the onboarding if indexing fails
  console.error(error.stack);
}
```

---

## 🧪 Testing

### For New Users
1. Complete onboarding with a new contract
2. Indexing should start automatically
3. Dashboard should show real-time progress
4. After completion, analytics tabs should display data

### For Existing Users
Existing users who completed onboarding before this fix will need to:
1. Either re-onboard (delete and re-add contract)
2. Or manually trigger indexing using the trigger script

---

## 🎯 Expected Behavior After Fix

### Step 1: User Completes Onboarding
```
POST /api/onboarding/complete
{
  "contractAddress": "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
  "chain": "lisk",
  "contractName": "MyContract",
  ...
}
```

### Step 2: Backend Response
```json
{
  "message": "Onboarding completed successfully",
  "user": {...},
  "defaultContractId": "contract-123",
  "indexingStarted": true  ← Confirms indexing started
}
```

### Step 3: Backend Logs
```
🎯 Onboarding complete endpoint called
📋 Created contract config: contract-123
✅ User subscription tier: free
🚀 Starting streaming indexer for user user-456 (tier: free)
✅ Streaming indexer started successfully
```

### Step 4: Dashboard Shows Progress
```
┌─────────────────────────────────────────────────────────────┐
│ 🌐 MyContract                                               │
│ DEFI • lisk                                                 │
├─────────────────────────────────────────────────────────────┤
│ [⏳ Indexing 25%]                                          │
│ ▓▓▓▓▓░░░░░░░░░░░░░░░                                       │
│ Fetching Free tier data...                                 │
└─────────────────────────────────────────────────────────────┘
```

### Step 5: WebSocket Updates (Real-time)
```javascript
// Frontend receives:
{
  type: 'progress',
  userId: 'user-456',
  progress: 25,
  currentChunk: 1,
  totalChunks: 1,
  message: 'Processing chunk 1/1'
}
```

### Step 6: Indexing Complete
```
┌─────────────────────────────────────────────────────────────┐
│ [✅ Fully Indexed] [🟢 Live Monitoring]                    │
├─────────────────────────────────────────────────────────────┤
│ [Overview] [Metrics] [Users] [Transactions] [UX Analysis]  │
│                                                             │
│ 📊 Analytics data displayed here...                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment

### Backend Restart Required
```bash
# The backend will auto-restart with nodemon
# Or manually restart:
cd /mnt/c/pr0/meta/mvp-workspace
npm run dev
```

### No Frontend Changes Needed
The frontend already has the correct code to:
- Display indexing progress
- Show WebSocket updates
- Render analytics tabs when indexed

---

## ✅ Verification Checklist

- [x] Syntax check passed
- [x] Variable references corrected
- [x] Error logging improved
- [ ] Test with new user onboarding
- [ ] Verify WebSocket updates
- [ ] Confirm dashboard displays data
- [ ] Check analytics tabs render

---

## 📊 Impact

**Before Fix**:
- 0% success rate for automatic indexing
- All users stuck at "Indexing 0%"
- Manual intervention required

**After Fix**:
- 100% success rate expected
- Automatic indexing starts immediately
- Real-time progress updates
- No manual intervention needed

---

## 🔄 Next Steps

1. **Test the fix** with a new user signup
2. **Monitor logs** for successful indexing
3. **Verify dashboard** shows real-time progress
4. **Handle existing users** who need re-indexing

---

**Status**: ✅ Ready for testing
