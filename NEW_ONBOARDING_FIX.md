# New Onboarding Fix - Preventing Old Contract Data Display

## Problem

When a user onboards a new contract, the dashboard was still showing the old contract data. This happened because:

1. **Multiple Default Contracts**: The system wasn't marking old contract configs as `isDefault: false` when creating a new default contract
2. **Multiple Default Analyses**: Old analyses with `metadata.isDefaultContract: true` weren't being marked as non-default
3. **Browser Caching**: The frontend was caching API responses, showing stale data
4. **No Hard Refresh**: After onboarding, the app used client-side routing which kept cached data in memory

## Solution Implemented

### Backend Changes (onboarding.js)

**Before new contract creation:**
```javascript
// Mark all old contract configs as NOT default
const allContracts = await ContractStorage.findByUserId(req.user.id);
for (const contract of allContracts) {
  if (contract.isDefault) {
    await ContractStorage.update(contract.id, { isDefault: false, isActive: false });
    console.log(`📋 Marked old contract ${contract.id} as not default`);
  }
}

// Mark all old analyses as NOT default contract
const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
for (const analysis of allAnalyses) {
  if (analysis.metadata?.isDefaultContract) {
    await AnalysisStorage.update(analysis.id, {
      metadata: {
        ...analysis.metadata,
        isDefaultContract: false,
        replacedByNewDefault: true,
        replacedAt: new Date().toISOString()
      }
    });
    console.log(`📋 Marked old analysis ${analysis.id} as not default`);
  }
}
```

This ensures:
- Only ONE contract config has `isDefault: true`
- Only ONE analysis has `metadata.isDefaultContract: true`
- Old data is preserved but marked as replaced

### Frontend Changes

#### 1. Cache-Busting (lib/api.ts)
```typescript
getDefaultContract: async () => {
  // Add cache-busting timestamp to prevent stale data
  const timestamp = Date.now();
  return apiRequest(`/api/onboarding/default-contract?_t=${timestamp}`);
},
```

#### 2. Hard Refresh After Onboarding (app/onboarding/page.tsx)
```typescript
if (status.isIndexed) {
  setTimeout(() => {
    // Force a hard refresh to clear any cached data
    window.location.href = '/dashboard';
  }, 2000);
}
```

This ensures:
- API calls always fetch fresh data
- After onboarding, the browser does a full page reload
- All cached data is cleared

#### 3. Removed Marathon Sync References (components/analyzer/ux-tab.tsx)
```typescript
// OLD: "Run a marathon sync or wait for more user interactions..."
// NEW: "Wait for more user interactions to generate comprehensive UX insights."
```

## Testing

Run the test script to verify the fix:
```bash
cd mvp-workspace
node test-new-onboarding-fix.js
```

Expected output:
- ✅ Single default contract
- ✅ Single default analysis
- ✅ New analysis has subscription data
- ✅ Old analyses marked as `replacedByNewDefault: true`

## User Flow After Fix

1. User onboards new contract
2. Backend marks all old contracts/analyses as non-default
3. Backend creates new contract config with `isDefault: true`
4. Backend starts subscription-aware indexing
5. Frontend polls for progress
6. When complete, frontend does hard refresh (`window.location.href`)
7. Dashboard loads fresh data showing ONLY the new contract

## What Users Should See

After onboarding a new contract, the dashboard should display:

```
Contract Name: [New Contract Name]
DEFI • lisk

Address: 0x1231DEB6...
Purpose: [New Purpose]
Started: [New Start Date]
Deployment Block: [Block Number]

Subscription: Free (or Starter/Pro/Enterprise)
Historical Data: 7 days (or 30/90/All history)
Blocks Indexed: [Number]
Block Range: [Start] → [End]

Status: Fully Indexed (or Indexing X%)
```

NO Marathon Sync references should appear.

## Files Modified

1. `mvp-workspace/src/api/routes/onboarding.js` - Mark old data as non-default
2. `mvp-workspace/frontend/lib/api.ts` - Add cache-busting
3. `mvp-workspace/frontend/app/onboarding/page.tsx` - Hard refresh after completion
4. `mvp-workspace/frontend/components/analyzer/ux-tab.tsx` - Remove Marathon Sync text

## Verification Steps

1. Check backend logs for:
   ```
   📋 Marked old contract [id] as not default
   📋 Marked old analysis [id] as not default
   📋 Created contract config: [new-id]
   ```

2. Check browser console for:
   ```
   📊 Default contract data: { subscription: {...}, blockRange: {...} }
   ```

3. Verify dashboard shows:
   - New contract name and address
   - Subscription tier information
   - Block range information
   - NO "Marathon Sync" text

## Rollback Plan

If issues occur, revert these commits:
1. Onboarding route changes
2. API cache-busting
3. Hard refresh change

The system will fall back to showing all default contracts (old behavior).
