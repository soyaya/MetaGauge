# Flow Verification Report - MVP Workspace

**Date**: 2026-02-13  
**Status**: ⚠️ PARTIALLY IMPLEMENTED

---

## 🔍 Current Flow Analysis

### ✅ What EXISTS:

#### 1. Automatic Indexing Trigger
**Location**: `src/api/routes/onboarding.js` (line 250)
```javascript
// Start initial indexing/analysis
startDefaultContractIndexing(req.user.id, savedConfig.id, contractConfig);
```
- ✅ Indexing DOES start automatically after onboarding
- ✅ No manual button click required
- ✅ Function exists and is called

#### 2. Subscription Tier Infrastructure
**Location**: `src/indexer/models/types.js` (lines 50-54)
```javascript
export const SUBSCRIPTION_TIERS = {
  FREE: { name: 'free', historicalDays: 7, continuousSync: false, maxContracts: 1 },
  PRO: { name: 'pro', historicalDays: 30, continuousSync: true, maxContracts: 5 },
  ENTERPRISE: { name: 'enterprise', historicalDays: 90, continuousSync: true, maxContracts: -1 }
};
```
- ✅ Tier definitions exist
- ✅ Historical days configured (7/30/90)
- ✅ Continuous sync flags set

#### 3. Streaming Indexer with Tier Support
**Location**: `src/indexer/services/StreamingIndexer.js` (lines 89-100)
```javascript
determineStartBlock(tier) {
  const tierConfig = SUBSCRIPTION_TIERS[tier.toUpperCase()];
  if (!tierConfig) return this.deploymentBlock;

  const blocksBack = calculateBlocksForDays(this.chainId, tierConfig.historicalDays);
  const calculatedStart = this.currentBlock - blocksBack;

  return Math.max(calculatedStart, this.deploymentBlock);
}
```
- ✅ Tier-based block calculation exists
- ✅ Respects historical days limits
- ✅ Falls back to deployment block

#### 4. Chunk-Based Processing
**Location**: `src/indexer/services/ChunkManager.js`
- ✅ 200k block chunks configured
- ✅ Progress tracking implemented
- ✅ Chunk validation exists

#### 5. WebSocket Support
**Location**: `src/indexer/services/WebSocketManager.js`
- ✅ Real-time updates implemented
- ✅ Progress events configured
- ✅ Connection management exists

---

## ❌ What's BROKEN/MISSING:

### 1. **CRITICAL**: Wrong Indexing Function Called
**Location**: `src/api/routes/onboarding.js` (line 1045)

**Current Implementation**:
```javascript
async function startDefaultContractIndexing(userId, configId, config) {
  // ❌ Uses OLD quick scan (last 1000 blocks only)
  const startBlock = Math.max(0, currentBlock - 1000);
  
  // ❌ Does NOT use streaming indexer
  // ❌ Does NOT check subscription tier
  // ❌ Does NOT use 200k chunks
  // ❌ Does NOT use WebSocket updates
}
```

**Problem**: This function is a **legacy quick scan**, NOT the streaming indexer!

---

### 2. **CRITICAL**: No Subscription Tier Check
**Location**: `src/api/routes/onboarding.js` (line 250)

**Current Code**:
```javascript
startDefaultContractIndexing(req.user.id, savedConfig.id, contractConfig);
// ❌ No tier parameter passed
// ❌ No subscription check
// ❌ Always uses same 1000 blocks
```

**Should Be**:
```javascript
const userTier = req.user.tier || 'free';
await indexerManager.startIndexing(
  req.user.id,
  contractConfig.targetContract.address,
  contractConfig.targetContract.chain,
  userTier  // ← Pass tier here
);
```

---

### 3. **CRITICAL**: Streaming Indexer Not Integrated
**Location**: `src/api/routes/onboarding.js`

**What Exists**:
- ✅ `src/indexer/services/IndexerManager.js` - Complete implementation
- ✅ `src/indexer/services/StreamingIndexer.js` - Tier-aware indexing
- ✅ `src/api/routes/indexer.js` - API endpoints for indexer

**What's Missing**:
- ❌ Onboarding does NOT call `IndexerManager.startIndexing()`
- ❌ Onboarding uses old quick scan instead
- ❌ No connection between onboarding and streaming indexer

---

### 4. Subscription Tier from Smart Contract
**Location**: Missing entirely

**Current**:
```javascript
const user = await UserStorage.findById(req.user.id);
const tier = user.tier; // ❌ From database, not smart contract
```

**Should Be**:
```javascript
const subscriptionService = new SubscriptionService();
const subscriptionInfo = await subscriptionService.getSubscriptionInfo(userAddress);
const tier = subscriptionInfo.tier; // ✅ From smart contract
```

---

## 📊 Comparison Table

| Feature | Intended | Current Status | Location |
|---------|----------|----------------|----------|
| **Automatic Indexing** | ✅ Yes | ✅ Yes | `onboarding.js:250` |
| **Subscription Tier Check** | ✅ Yes | ❌ No | Missing |
| **Tier from Smart Contract** | ✅ Yes | ❌ No | Missing |
| **Block Range by Tier** | ✅ Yes | ❌ No | Uses fixed 1000 blocks |
| **200k Chunk Processing** | ✅ Yes | ❌ No | Not called |
| **WebSocket Updates** | ✅ Yes | ❌ No | Not connected |
| **Streaming Indexer** | ✅ Yes | ❌ No | Not integrated |
| **Deployment Block Finder** | ✅ Yes | ❌ No | Not used |
| **Continuous Monitoring** | ✅ Yes | ❌ No | Not implemented |

---

## 🔧 What Needs to be Fixed

### Fix #1: Replace Quick Scan with Streaming Indexer
**File**: `src/api/routes/onboarding.js`

**Current (line 250)**:
```javascript
startDefaultContractIndexing(req.user.id, savedConfig.id, contractConfig);
```

**Replace With**:
```javascript
// Import at top
import { initializeStreamingIndexer } from '../../indexer/index.js';

// In /complete endpoint (after line 248)
const { indexerManager } = await initializeStreamingIndexer();
const userTier = req.user.tier || 'free';

await indexerManager.startIndexing(
  req.user.id,
  contractConfig.targetContract.address,
  contractConfig.targetContract.chain,
  userTier
);
```

---

### Fix #2: Get Tier from Smart Contract
**File**: `src/api/routes/onboarding.js`

**Add Before Starting Indexing**:
```javascript
import SubscriptionService from '../../services/SubscriptionService.js';

// In /complete endpoint
const subscriptionService = new SubscriptionService();
let userTier = 'free';

try {
  // Get tier from smart contract
  const subscriptionInfo = await subscriptionService.getSubscriptionInfo(req.user.walletAddress);
  userTier = subscriptionInfo.tierName.toLowerCase();
  
  // Update user tier in database
  await UserStorage.update(req.user.id, { tier: userTier });
} catch (error) {
  console.warn('Could not fetch subscription from contract, using free tier:', error);
}
```

---

### Fix #3: Remove Legacy Quick Scan Function
**File**: `src/api/routes/onboarding.js`

**Delete** (lines 1045-1150):
```javascript
async function startDefaultContractIndexing(userId, configId, config) {
  // ❌ DELETE THIS ENTIRE FUNCTION
}
```

---

### Fix #4: Update Dashboard to Show Indexing Progress
**File**: `frontend/app/dashboard/page.tsx`

**Add WebSocket Connection**:
```typescript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:5000/ws');
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'register', userId: user.id }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'progress') {
      setIndexingProgress(data.progress);
      setIndexingStatus(data.message);
    }
  };
  
  return () => ws.close();
}, [user.id]);
```

---

## 🎯 Expected Behavior After Fixes

### User Flow:
1. ✅ User logs in
2. ✅ User completes onboarding form
3. ✅ System fetches subscription tier from smart contract
4. ✅ System calculates block range:
   - Free: Last 7 days (~50k blocks)
   - Pro: Last 30 days (~216k blocks)
   - Enterprise: Last 90 days (~648k blocks)
5. ✅ Streaming indexer starts automatically
6. ✅ Processing in 200k block chunks
7. ✅ WebSocket sends real-time progress
8. ✅ Dashboard shows live progress bar
9. ✅ Metrics appear as data is processed
10. ✅ Continuous monitoring (for paid tiers)

---

## 📝 Summary

### Current State: ⚠️ BROKEN
- Automatic trigger exists BUT calls wrong function
- Uses legacy 1000-block quick scan
- Ignores subscription tiers
- Doesn't use streaming indexer
- No WebSocket updates
- No real-time progress

### Root Cause:
**The onboarding endpoint calls the OLD quick scan function instead of the NEW streaming indexer.**

### Solution:
Replace 3 lines of code in `onboarding.js` to call `indexerManager.startIndexing()` instead of `startDefaultContractIndexing()`.

---

## ✅ Verification Checklist

After implementing fixes:

- [ ] Onboarding calls `indexerManager.startIndexing()`
- [ ] Subscription tier fetched from smart contract
- [ ] Block range calculated based on tier
- [ ] 200k chunks used for processing
- [ ] WebSocket sends progress updates
- [ ] Dashboard shows real-time progress
- [ ] Metrics appear progressively
- [ ] Continuous monitoring works (paid tiers)
- [ ] Legacy quick scan function deleted

---

**Conclusion**: The infrastructure exists, but the onboarding endpoint is calling the wrong function. A simple 10-line fix will connect everything properly.
