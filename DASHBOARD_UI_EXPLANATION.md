# Dashboard UI - What You're Seeing vs What You Should See

## Current Issue

You're seeing **OLD data** from a previous analysis that used the Marathon Sync system. The new subscription-aware UI code is in place, but it's displaying old data that doesn't have the new subscription metadata.

---

## What You're Currently Seeing (OLD DATA)

```
Defi
DEFI • lisk

Address: 0x1231DEB6...
Purpose: gjkhjhjhljlljklhkhjjhhhhgkjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj...
Started: Dec 22, 01:00 AM          ❌ Shows time (old format)

Indexed                             ❌ Old status badge
Marathon Sync (Cycle 0)             ❌ Old Marathon Sync UI (should be removed)
100%
21 transactions • 20 users
```

**Problems:**
1. ❌ Shows "Marathon Sync" - this was removed
2. ❌ Date shows time "01:00 AM" - should only show date
3. ❌ No subscription tier displayed
4. ❌ No deployment block shown
5. ❌ No block range information
6. ❌ No historical data limit shown

---

## What You SHOULD See (NEW DATA)

### For Free Tier User:
```
Defi
DEFI • lisk

Address: 0x1231DEB6...
Purpose: gjkhjhjhljlljklhkhjjhhhhgkjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj...
Started: Dec 22, 2024               ✅ Date only (no time)
Deployment Block: 1,234,567         ✅ NEW - shows deployment block

Subscription: Free                  ✅ NEW - shows tier
Historical Data: 7 days             ✅ NEW - shows limit
Blocks Indexed: 50,400              ✅ NEW - shows total blocks
Block Range: 1,450,000 → 1,500,000  ✅ NEW - shows range

[Fully Indexed]                     ✅ Clean status badge
```

### For Starter Tier User:
```
Subscription: Starter               ✅ Paid tier
Historical Data: 30 days            ✅ More history
Blocks Indexed: 216,000             ✅ More blocks
Block Range: 1,284,000 → 1,500,000  ✅ Larger range

[Fully Indexed] [Live Monitoring]   ✅ Shows continuous sync badge
```

### For Pro Tier User:
```
Subscription: Pro                   ✅ Pro tier
Historical Data: 90 days            ✅ Even more history
Blocks Indexed: 648,000             ✅ Even more blocks
Block Range: 852,000 → 1,500,000    ✅ Even larger range

[Fully Indexed] [Live Monitoring]   ✅ Shows continuous sync badge
```

### For Enterprise Tier User:
```
Subscription: Enterprise            ✅ Top tier
Historical Data: All history        ✅ Complete history
Blocks Indexed: 1,500,000           ✅ All blocks from deployment
Block Range: 500,000 → 2,000,000    ✅ Complete range

[Fully Indexed] [Live Monitoring]   ✅ Shows continuous sync badge
```

### During Indexing (Any Tier):
```
[Indexing 45%] ████████░░░░░░░░░░   ✅ Progress bar
Fetching Free tier data...          ✅ Shows tier being indexed
```

---

## Why You're Seeing Old Data

The dashboard displays data from the `analyses` collection. Your current analysis was created with the OLD Marathon Sync system, so it has:
- ❌ No `metadata.subscription` field
- ❌ No `metadata.blockRange` field
- ❌ Old Marathon Sync metadata

The NEW code expects:
```javascript
{
  metadata: {
    subscription: {
      tier: "Free",
      tierNumber: 0,
      historicalDays: 7,
      continuousSync: false
    },
    blockRange: {
      start: 1450000,
      end: 1500000,
      deployment: 1000000,
      total: 50400
    }
  }
}
```

---

## How to See the New UI

### Option 1: Fresh Onboarding (Recommended)

1. **Clear old data:**
   ```bash
   cd mvp-workspace
   node test-fresh-onboarding.js
   ```

2. **Start backend:**
   ```bash
   npm run dev
   ```

3. **Start frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Complete onboarding:**
   - Log in with your test user
   - Go through onboarding
   - Submit a contract
   - Watch the new subscription-aware indexing!

### Option 2: Manual Data Cleanup

Delete old analyses from the database:
```bash
# In mvp-workspace directory
node -e "
import('./src/api/database/index.js').then(async ({ AnalysisStorage, UserStorage }) => {
  const users = await UserStorage.findAll();
  const user = users[0];
  const analyses = await AnalysisStorage.findByUserId(user.id);
  for (const a of analyses) {
    await AnalysisStorage.delete(a.id);
  }
  console.log('Deleted', analyses.length, 'analyses');
});
"
```

Then complete onboarding again.

---

## What the Backend Logs Should Show

When you complete onboarding with the NEW code, you should see:

```
🎯 Onboarding complete endpoint called
✅ User subscription tier: free
📍 Deployment block: 1234567
📊 Calculating block range for 0x... on lisk
   Subscription: Free (Tier 0)
   Historical data: 7 days
   📅 7 days = 50,400 blocks
   🧱 Calculated start: 1,449,600
   🧱 Deployment block: 1,000,000
   ✅ Actual start: 1,449,600
📊 Block range: 1449600 → 1500000 (50,400 blocks)
📝 Created analysis record: abc123
✅ Subscription-aware indexing started
🔄 Fetching data for Free tier...
✅ Found 21 transactions
✅ Indexing complete for user xyz
```

---

## Frontend Console Logs

When the dashboard loads, you should see:

```
📊 Default contract data: {
  contract: { ... },
  subscription: {
    tier: "Free",
    tierNumber: 0,
    historicalDays: 7,
    continuousSync: false
  },
  blockRange: {
    start: 1449600,
    end: 1500000,
    deployment: 1000000,
    total: 50400
  },
  ...
}
   Subscription: { tier: "Free", ... }
   Block range: { start: 1449600, end: 1500000, ... }
```

If you see `Subscription: undefined` or `Block range: null`, then the old data is still being used.

---

## Summary

**Current State:**
- ✅ Frontend UI code is updated and ready
- ✅ Backend subscription-aware indexing is implemented
- ❌ You're viewing OLD data without subscription metadata

**Solution:**
Run `node test-fresh-onboarding.js` to clear old data, then complete onboarding again to see the new UI with subscription information!

**Expected Result:**
You'll see subscription tier, historical data limits, deployment block, block range, and clean status badges without any Marathon Sync references.
