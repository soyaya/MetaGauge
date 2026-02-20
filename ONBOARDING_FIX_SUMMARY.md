# ✅ Onboarding Indexing Fix

**Date**: 2026-02-14  
**Issue**: Indexing not starting automatically after onboarding  
**Status**: 🟢 FIXED

## Problem
Error: `contractConfig is not defined` when starting indexing after onboarding.

## Root Cause
Line 267-274 in `src/api/routes/onboarding.js` used `contractConfig.targetContract.address` before it was available.

## Solution
Changed to use request parameters directly:

```javascript
// Before (❌ Wrong)
await indexerManager.startIndexing(
  req.user.id,
  contractConfig.targetContract.address,
  contractConfig.targetContract.chain,
  userTier
);

// After (✅ Fixed)
await indexerManager.startIndexing(
  req.user.id,
  contractAddress,  // from req.body
  chain,            // from req.body
  userTier
);
```

## Expected Behavior
1. User completes onboarding
2. Indexing starts automatically
3. Dashboard shows real-time progress
4. After completion, analytics tabs display data

## Testing
- [x] Syntax verified
- [ ] Test with new user signup
- [ ] Verify dashboard shows progress
- [ ] Confirm analytics display after indexing

**Backend will auto-restart with nodemon.**
