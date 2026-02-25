# Indexing Flow Issue & Fix

## Problem
After onboarding completes, the automatic background indexing doesn't trigger, leaving `blockRange: null` and no data in the dashboard.

## Root Cause
The `setImmediate()` callback in `/api/onboarding/complete` (line ~295) runs background indexing but:
1. No logs are generated (silent failure)
2. The `triggerDefaultContractIndexing` import might be failing
3. Errors are caught but not properly logged to console

## Current Flow (Broken)
```
User completes onboarding
  ↓
POST /api/onboarding/complete
  ↓
Response sent immediately ✅
  ↓
setImmediate(() => {
  // This part fails silently ❌
  triggerDefaultContractIndexing()
})
```

## Fix Options

### Option 1: Frontend Triggers Indexing (Recommended)
After onboarding completes, frontend should call the manual trigger endpoint:

**Frontend Change** (`frontend/app/onboarding/page.tsx`):
```typescript
// After onboarding success
const response = await api.post('/api/onboarding/complete', data);

// Immediately trigger indexing
await api.post('/api/onboarding/trigger-indexing');

// Then redirect to dashboard
router.push('/dashboard');
```

### Option 2: Fix Backend setImmediate
Make the background task more robust:

**Backend Change** (`src/api/routes/onboarding.js` line ~295):
```javascript
// Replace setImmediate with proper async handling
res.json({
  message: 'Onboarding completed successfully',
  user: { ...updatedUser },
  defaultContractId: savedConfig.id,
  indexingStarted: true
});

// Use process.nextTick with better error handling
process.nextTick(async () => {
  try {
    console.log('🚀 [ONBOARDING] Starting background indexing...');
    
    // Get subscription tier
    let userTier = 'free';
    try {
      if (req.user.walletAddress) {
        const subscriptionInfo = await SubscriptionService.getSubscriptionInfo(req.user.walletAddress);
        userTier = subscriptionInfo.tierName.toLowerCase();
        await UserStorage.update(req.user.id, { tier: userTier });
        console.log(`✅ [ONBOARDING] User tier: ${userTier}`);
      }
    } catch (error) {
      console.warn('[ONBOARDING] Subscription fetch failed:', error.message);
    }

    // Trigger indexing
    console.log(`🚀 [ONBOARDING] Triggering indexing for user ${req.user.id}`);
    await triggerDefaultContractIndexing(req, {
      json: (data) => console.log('✅ Indexing response:', data),
      status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
    });
    
    console.log('✅ [ONBOARDING] Background indexing completed');
  } catch (error) {
    console.error('❌ [ONBOARDING] Background indexing failed:', error);
    console.error('[ONBOARDING] Stack:', error.stack);
  }
});
```

### Option 3: Separate Indexing Service
Create a dedicated indexing queue/service that polls for unindexed contracts.

## Immediate Workaround

Users can manually trigger indexing from the dashboard by clicking a "Start Analysis" or "Refresh" button that calls:

```bash
POST /api/onboarding/trigger-indexing
```

## Recommended Implementation

**Use Option 1** - Frontend triggers indexing explicitly:

1. It's more reliable (no silent failures)
2. User gets immediate feedback
3. Easier to debug
4. Can show progress immediately

**Implementation Steps:**

1. Update `frontend/app/onboarding/page.tsx`:
   - After successful onboarding, call trigger endpoint
   - Show loading state during indexing
   - Redirect to dashboard when indexing starts

2. Update `frontend/app/dashboard/page.tsx`:
   - Add "Start Analysis" button if `blockRange === null`
   - Button calls `/api/onboarding/trigger-indexing`
   - Show progress during indexing

## Testing

After implementing the fix:

```bash
# 1. Complete onboarding
# 2. Check that indexing starts automatically
# 3. Verify logs show:
#    - "🚀 Manual indexing trigger for..."
#    - "📊 Fetching last X transactions for Y tier"
#    - Progress updates
```

## Current Tier-Based Limits

```javascript
const tierLimits = {
  free: 100,        // Last 100 transactions
  starter: 500,     // Last 500 transactions  
  pro: 2000,        // Last 2000 transactions
  enterprise: 10000 // Last 10000 transactions
};

const blockRanges = {
  free: 10000,      // Last 10k blocks (~2 days)
  starter: 50000,   // Last 50k blocks (~1 week)
  pro: 200000,      // Last 200k blocks (~1 month)
  enterprise: 500000 // Last 500k blocks (~3 months)
};
```

## Continuous Sync

After initial indexing completes, continuous sync should start automatically to keep data fresh. This is handled in `trigger-indexing.js` after the initial fetch completes.
