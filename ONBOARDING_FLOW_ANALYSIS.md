# Onboarding Flow Analysis - Current vs Expected

## 🎯 User's Concern

> "The flow after onboarding the RPC is supposed to keep fetching data until it hits monthly rate or subscription rate. Check the flow"

## 📊 Current Flow Analysis

### What Happens Now (After Onboarding)

```
1. User completes onboarding
   ├─> Contract details saved
   ├─> Subscription tier checked
   └─> Block range calculated based on tier

2. Automatic indexing starts (ONE-TIME)
   ├─> Fetches historical data based on subscription
   │   ├─> Free: Last 7 days (~50k blocks)
   │   ├─> Starter: Last 30 days (~216k blocks)
   │   ├─> Pro: Last 90 days (~648k blocks)
   │   └─> Enterprise: All history from deployment
   │
   ├─> Processes transactions and events
   ├─> Calculates metrics
   └─> Marks as "Fully Indexed" when complete

3. Indexing STOPS ❌
   ├─> No continuous monitoring
   ├─> No new block fetching
   ├─> Data becomes stale
   └─> User must manually refresh
```

### The Problem

**The system does NOT continue fetching data after initial indexing!**

- ❌ No continuous monitoring for new blocks
- ❌ No automatic updates
- ❌ No rate limit enforcement
- ❌ Data becomes stale immediately after indexing

## 🔄 Expected Flow (What Should Happen)

### Subscription-Based Continuous Monitoring

```
1. User completes onboarding
   ├─> Contract details saved
   ├─> Subscription tier checked
   └─> Block range calculated

2. Initial historical indexing (ONE-TIME)
   ├─> Fetches historical data based on tier
   └─> Marks as "Fully Indexed"

3. Continuous monitoring starts (ONGOING) ✅
   ├─> Polls for new blocks every 30 seconds
   ├─> Fetches new transactions as they occur
   ├─> Updates metrics incrementally
   ├─> Respects subscription rate limits
   └─> Continues until:
       ├─> Monthly API call limit reached
       ├─> User stops it manually
       └─> Subscription expires
```

## 📋 Subscription Tier Limits

### Free Tier
- **Historical Data**: 7 days
- **Continuous Monitoring**: ❌ Disabled
- **API Calls/Month**: 1,000
- **Behavior**: One-time indexing only, no updates

### Starter Tier
- **Historical Data**: 30 days
- **Continuous Monitoring**: ✅ Enabled
- **API Calls/Month**: 10,000
- **Behavior**: Initial indexing + continuous updates until limit

### Pro Tier
- **Historical Data**: 90 days
- **Continuous Monitoring**: ✅ Enabled
- **API Calls/Month**: 50,000
- **Behavior**: Initial indexing + continuous updates until limit

### Enterprise Tier
- **Historical Data**: All history
- **Continuous Monitoring**: ✅ Enabled
- **API Calls/Month**: 250,000
- **Behavior**: Complete history + continuous updates until limit

## 🔍 Current Implementation Issues

### Issue 1: No Continuous Monitoring After Onboarding

**File**: `mvp-workspace/src/api/routes/onboarding.js`

**Current Code** (in `startDefaultContractIndexing`):
```javascript
// After indexing completes:
await UserStorage.update(req.user.id, {
  onboarding: {
    ...user.onboarding,
    defaultContract: {
      ...contract,
      isIndexed: true,
      indexingProgress: 100,
      lastAnalysisId: analysis.id
    }
  }
});

// ❌ NO continuous monitoring started here!
// ❌ NO polling for new blocks!
// ❌ NO rate limit tracking!
```

**What's Missing**:
```javascript
// ✅ Should start continuous monitoring for paid tiers:
if (blockRange.continuousSync) {
  console.log('✅ Starting continuous monitoring...');
  startContinuousMonitoring(req.user.id, contract, blockRange);
}
```

### Issue 2: Continuous Sync Only Works Manually

**File**: `mvp-workspace/src/api/routes/continuous-sync-improved.js`

**Current Behavior**:
- Continuous sync exists but only runs when user clicks "Marathon Sync" button
- Runs for 50 cycles (~25-30 minutes) then stops
- NOT automatically started after onboarding
- NOT tied to subscription limits

**What It Should Do**:
- Automatically start after onboarding for paid tiers
- Continue indefinitely until:
  - Monthly API call limit reached
  - User manually stops it
  - Subscription expires
- Track API calls and enforce limits

### Issue 3: No Rate Limit Enforcement

**Current Code**:
```javascript
// Continuous sync runs 50 cycles regardless of subscription
const MAX_CYCLES = 50; // ❌ Hardcoded, ignores subscription

while (syncCycle <= MAX_CYCLES) {
  // Fetch data
  // No API call counting
  // No rate limit checking
  syncCycle++;
}
```

**What's Missing**:
```javascript
// ✅ Should track API calls and respect limits:
let apiCallsThisMonth = await getMonthlyApiCallCount(userId);
const monthlyLimit = subscription.apiCallsPerMonth;

while (apiCallsThisMonth < monthlyLimit) {
  // Fetch data
  apiCallsThisMonth++;
  await updateApiCallCount(userId, apiCallsThisMonth);
  
  if (apiCallsThisMonth >= monthlyLimit) {
    console.log('🛑 Monthly API limit reached');
    break;
  }
}
```

## 🎯 What Needs to Be Fixed

### Fix 1: Auto-Start Continuous Monitoring After Onboarding

**Location**: `mvp-workspace/src/api/routes/onboarding.js`

**In `startDefaultContractIndexing()` function, after initial indexing completes**:

```javascript
// After marking as indexed:
await UserStorage.update(req.user.id, {
  onboarding: {
    ...user.onboarding,
    defaultContract: {
      ...contract,
      isIndexed: true,
      indexingProgress: 100,
      lastAnalysisId: analysis.id
    }
  }
});

// ✅ ADD THIS: Start continuous monitoring for paid tiers
if (blockRange.continuousSync) {
  console.log(`✅ Starting continuous monitoring for ${blockRange.tierName} tier`);
  
  // Start continuous monitoring in background
  setImmediate(async () => {
    try {
      await startContinuousMonitoring(
        req.user.id,
        contract,
        blockRange,
        analysis.id
      );
    } catch (error) {
      console.error('❌ Continuous monitoring failed:', error);
    }
  });
}
```

### Fix 2: Create Continuous Monitoring Service

**New File**: `mvp-workspace/src/services/ContinuousMonitoringService.js`

```javascript
/**
 * Continuous Monitoring Service
 * Automatically monitors contracts for new blocks and respects subscription limits
 */

export class ContinuousMonitoringService {
  constructor() {
    this.activeMonitors = new Map(); // userId -> monitor state
  }

  /**
   * Start continuous monitoring for a user's contract
   */
  async startMonitoring(userId, contract, subscription, analysisId) {
    // Check if already monitoring
    if (this.activeMonitors.has(userId)) {
      console.log(`⚠️ Already monitoring for user ${userId}`);
      return;
    }

    // Check if tier allows continuous monitoring
    if (!subscription.continuousSync) {
      console.log(`❌ Tier ${subscription.tierName} does not support continuous monitoring`);
      return;
    }

    console.log(`🚀 Starting continuous monitoring for user ${userId}`);
    console.log(`   Tier: ${subscription.tierName}`);
    console.log(`   Monthly limit: ${subscription.apiCallsPerMonth} calls`);

    const monitor = {
      userId,
      contract,
      subscription,
      analysisId,
      isActive: true,
      apiCallsThisMonth: await this.getMonthlyApiCallCount(userId),
      lastBlockProcessed: null,
      startedAt: new Date()
    };

    this.activeMonitors.set(userId, monitor);

    // Start monitoring loop
    this.runMonitoringLoop(monitor);
  }

  /**
   * Monitoring loop - polls for new blocks every 30 seconds
   */
  async runMonitoringLoop(monitor) {
    while (monitor.isActive) {
      try {
        // Check if monthly limit reached
        if (monitor.apiCallsThisMonth >= monitor.subscription.apiCallsPerMonth) {
          console.log(`🛑 Monthly API limit reached for user ${monitor.userId}`);
          await this.stopMonitoring(monitor.userId, 'monthly_limit_reached');
          break;
        }

        // Check if subscription still active
        const currentSub = await this.checkSubscription(monitor.userId);
        if (!currentSub.isActive || !currentSub.continuousSync) {
          console.log(`🛑 Subscription changed for user ${monitor.userId}`);
          await this.stopMonitoring(monitor.userId, 'subscription_changed');
          break;
        }

        // Fetch new blocks
        const newData = await this.fetchNewBlocks(monitor);
        
        if (newData.hasNewBlocks) {
          // Update metrics
          await this.updateMetrics(monitor, newData);
          
          // Increment API call count
          monitor.apiCallsThisMonth++;
          await this.updateApiCallCount(monitor.userId, monitor.apiCallsThisMonth);
          
          console.log(`✅ Processed new blocks for user ${monitor.userId}`);
          console.log(`   API calls: ${monitor.apiCallsThisMonth}/${monitor.subscription.apiCallsPerMonth}`);
        }

        // Wait 30 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 30000));

      } catch (error) {
        console.error(`❌ Monitoring error for user ${monitor.userId}:`, error);
        // Continue monitoring despite errors
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  /**
   * Stop monitoring for a user
   */
  async stopMonitoring(userId, reason) {
    const monitor = this.activeMonitors.get(userId);
    if (!monitor) return;

    monitor.isActive = false;
    this.activeMonitors.delete(userId);

    console.log(`🛑 Stopped monitoring for user ${userId}: ${reason}`);

    // Update user record
    await UserStorage.update(userId, {
      onboarding: {
        defaultContract: {
          continuousMonitoring: false,
          monitoringStoppedAt: new Date(),
          monitoringStopReason: reason
        }
      }
    });
  }

  /**
   * Get monthly API call count for user
   */
  async getMonthlyApiCallCount(userId) {
    const user = await UserStorage.findById(userId);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    if (user.usage?.month === currentMonth && user.usage?.year === currentYear) {
      return user.usage.apiCalls || 0;
    }

    // New month, reset counter
    return 0;
  }

  /**
   * Update API call count for user
   */
  async updateApiCallCount(userId, count) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    await UserStorage.update(userId, {
      usage: {
        apiCalls: count,
        month: currentMonth,
        year: currentYear,
        lastUpdated: new Date()
      }
    });
  }
}
```

### Fix 3: Update Continuous Sync to Respect Limits

**File**: `mvp-workspace/src/api/routes/continuous-sync-improved.js`

**Change from**:
```javascript
const MAX_CYCLES = 50; // ❌ Hardcoded

while (syncCycle <= MAX_CYCLES) {
  // Run cycle
  syncCycle++;
}
```

**To**:
```javascript
// ✅ Check subscription limits
const user = await UserStorage.findById(userId);
const subscription = await getSubscriptionInfo(user.walletAddress);
let apiCallsThisMonth = await getMonthlyApiCallCount(userId);

while (apiCallsThisMonth < subscription.apiCallsPerMonth) {
  // Run cycle
  apiCallsThisMonth++;
  await updateApiCallCount(userId, apiCallsThisMonth);
  
  // Check if should continue
  if (apiCallsThisMonth >= subscription.apiCallsPerMonth) {
    console.log('🛑 Monthly API limit reached');
    break;
  }
  
  syncCycle++;
}
```

## 📊 Correct Flow After Fixes

### Free Tier Flow
```
1. Onboarding complete
2. Initial indexing (7 days historical)
3. Indexing complete ✅
4. NO continuous monitoring (tier doesn't support it)
5. Data remains static until manual refresh
```

### Paid Tier Flow (Starter/Pro/Enterprise)
```
1. Onboarding complete
2. Initial indexing (30/90/all days historical)
3. Indexing complete ✅
4. Continuous monitoring starts automatically ✅
   │
   ├─> Every 30 seconds:
   │   ├─> Check for new blocks
   │   ├─> Fetch new transactions
   │   ├─> Update metrics
   │   ├─> Increment API call counter
   │   └─> Check if limit reached
   │
   ├─> Continue until:
   │   ├─> Monthly API limit reached (1000/10000/50000/250000)
   │   ├─> User manually stops
   │   └─> Subscription expires
   │
   └─> When stopped:
       ├─> Save final state
       ├─> Notify user
       └─> Show "Monitoring Paused" badge
```

## 🎯 Summary

### Current State ❌
- Initial indexing works correctly
- Subscription tiers are checked
- Block ranges are calculated properly
- **BUT**: No continuous monitoring after indexing
- **BUT**: No rate limit enforcement
- **BUT**: Data becomes stale immediately

### What Needs to Be Done ✅

1. **Auto-start continuous monitoring** after onboarding for paid tiers
2. **Create ContinuousMonitoringService** to handle ongoing data fetching
3. **Track API calls** per month per user
4. **Enforce rate limits** based on subscription tier
5. **Stop monitoring** when limits reached
6. **Update UI** to show monitoring status and API usage

### Files to Modify

1. `mvp-workspace/src/api/routes/onboarding.js`
   - Add auto-start of continuous monitoring after indexing

2. `mvp-workspace/src/services/ContinuousMonitoringService.js` (NEW)
   - Create service for continuous monitoring
   - Implement rate limit tracking
   - Implement automatic stopping

3. `mvp-workspace/src/api/routes/continuous-sync-improved.js`
   - Update to respect subscription limits
   - Add API call counting
   - Remove hardcoded MAX_CYCLES

4. `mvp-workspace/src/api/database/fileStorage.js`
   - Add usage tracking fields to user model
   - Track monthly API calls

5. `mvp-workspace/frontend/app/dashboard/page.tsx`
   - Show monitoring status
   - Show API usage (X/Y calls this month)
   - Show "Monitoring Active" or "Limit Reached" badge

## 🚀 Next Steps

Would you like me to:
1. Implement the ContinuousMonitoringService?
2. Update the onboarding flow to auto-start monitoring?
3. Add rate limit tracking and enforcement?
4. Update the UI to show monitoring status?

All of these changes are needed to make the system work as expected: **continuously fetching data until subscription limits are reached**.
