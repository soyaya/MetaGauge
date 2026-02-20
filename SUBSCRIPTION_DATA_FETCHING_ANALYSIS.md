# Subscription-Based Data Fetching Analysis

## Current Status: ⚠️ PARTIALLY IMPLEMENTED

The app has subscription tier infrastructure but **does NOT currently fetch data according to subscription limits**. Here's what exists and what's missing:

---

## What EXISTS ✅

### 1. Subscription Service (`src/services/SubscriptionService.js`)
- ✅ Connects to smart contract on Lisk Sepolia
- ✅ Reads subscription info from blockchain
- ✅ Defines 4 tiers: Free (0), Starter (1), Pro (2), Enterprise (3)
- ✅ Has `getPlanInfo()` method that returns `limits.historicalData` (in days)
- ✅ Has `validateUserAccess()` method to check subscription status

### 2. Subscription Tier Definitions (`src/indexer/models/types.js`)
```javascript
export const SUBSCRIPTION_TIERS = {
  FREE: { name: 'free', historicalDays: 7, continuousSync: false, maxContracts: 1 },
  PRO: { name: 'pro', historicalDays: 30, continuousSync: true, maxContracts: 5 },
  ENTERPRISE: { name: 'enterprise', historicalDays: 90, continuousSync: true, maxContracts: -1 }
};
```

**⚠️ ISSUE**: Missing STARTER tier (should be 30 days)

### 3. Smart Contract Integration
The subscription smart contract has:
- ✅ `getSubscriptionInfo(address)` - Returns user's tier
- ✅ `plans(uint8 tier)` - Returns plan limits including `historicalData` (days)

---

## What's MISSING ❌

### 1. No Subscription-to-Block-Range Conversion
**Problem**: The app doesn't convert subscription tier → historical days → block range

**What's needed**:
```javascript
// Example: Convert subscription tier to block range
async function calculateBlockRangeFromSubscription(userAddress, chain) {
  // 1. Get user's subscription tier
  const subInfo = await subscriptionService.getSubscriptionInfo(userAddress);
  
  // 2. Get plan limits (historicalData in days)
  const planInfo = await subscriptionService.getPlanInfo(subInfo.tier);
  const historicalDays = planInfo.limits.historicalData;
  
  // 3. Convert days to blocks based on chain
  const blocksPerDay = getBlocksPerDay(chain); // e.g., 7200 for Ethereum
  const maxBlocks = historicalDays * blocksPerDay;
  
  // 4. Calculate start block
  const currentBlock = await fetcher.getCurrentBlockNumber(chain);
  const startBlock = Math.max(deploymentBlock, currentBlock - maxBlocks);
  
  return { startBlock, endBlock: currentBlock, historicalDays };
}
```

### 2. Data Fetching Doesn't Check Subscription
**Current behavior**: 
- `SmartContractFetcher` fetches data without checking subscription limits
- `SmartBlockRangeSelector` uses hardcoded strategies (quick, standard, comprehensive)
- No integration between subscription tier and block range selection

**What's needed**:
- Modify `SmartBlockRangeSelector` to accept subscription tier
- Add subscription-aware strategy selection
- Enforce block range limits based on tier

### 3. Onboarding Doesn't Use Subscription Limits
**Current behavior**:
- Onboarding completes without checking subscription
- Default contract indexing starts without tier-based limits
- No validation of historical data access

**What's needed**:
- Check subscription tier during onboarding
- Calculate allowed block range based on tier
- Pass limits to indexer/fetcher

### 4. Missing Tier Mapping
**Problem**: Inconsistent tier definitions

**Smart Contract Tiers** (from SubscriptionService.js):
```javascript
const SUBSCRIPTION_TIERS = {
  0: 'Free',      // 7 days
  1: 'Starter',   // 30 days
  2: 'Pro',       // 90 days
  3: 'Enterprise' // All history
};
```

**Backend Tiers** (from types.js):
```javascript
const SUBSCRIPTION_TIERS = {
  FREE: { historicalDays: 7 },
  PRO: { historicalDays: 30 },        // ❌ Should be STARTER
  ENTERPRISE: { historicalDays: 90 }  // ❌ Missing tier 3
};
```

**What's needed**: Align tier definitions across all files

---

## Blocks Per Day by Chain

For accurate conversion from days to blocks:

| Chain | Block Time | Blocks/Day | 7 Days | 30 Days | 90 Days |
|-------|-----------|------------|--------|---------|---------|
| Ethereum | ~12s | 7,200 | 50,400 | 216,000 | 648,000 |
| Lisk | ~12s | 7,200 | 50,400 | 216,000 | 648,000 |
| Starknet | ~6s | 14,400 | 100,800 | 432,000 | 1,296,000 |

---

## Required Implementation

### Step 1: Fix Tier Definitions
Update `src/indexer/models/types.js`:
```javascript
export const SUBSCRIPTION_TIERS = {
  FREE: { 
    tier: 0,
    name: 'Free', 
    historicalDays: 7, 
    continuousSync: false, 
    maxContracts: 1 
  },
  STARTER: { 
    tier: 1,
    name: 'Starter', 
    historicalDays: 30, 
    continuousSync: true, 
    maxContracts: 3 
  },
  PRO: { 
    tier: 2,
    name: 'Pro', 
    historicalDays: 90, 
    continuousSync: true, 
    maxContracts: 10 
  },
  ENTERPRISE: { 
    tier: 3,
    name: 'Enterprise', 
    historicalDays: -1, // All history from deployment
    continuousSync: true, 
    maxContracts: -1 // Unlimited
  }
};

export const BLOCKS_PER_DAY = {
  ethereum: 7200,
  lisk: 7200,
  starknet: 14400
};
```

### Step 2: Create Subscription-Aware Block Range Calculator
Create `src/services/SubscriptionBlockRangeCalculator.js`:
```javascript
export class SubscriptionBlockRangeCalculator {
  async calculateBlockRange(userAddress, chain, deploymentBlock) {
    // 1. Get subscription tier
    const subInfo = await subscriptionService.getSubscriptionInfo(userAddress);
    const tier = SUBSCRIPTION_TIERS[Object.keys(SUBSCRIPTION_TIERS)[subInfo.tier]];
    
    // 2. Get current block
    const currentBlock = await fetcher.getCurrentBlockNumber(chain);
    
    // 3. Calculate start block based on tier
    if (tier.historicalDays === -1) {
      // Enterprise: All history from deployment
      return { 
        startBlock: deploymentBlock, 
        endBlock: currentBlock,
        historicalDays: -1,
        tierName: tier.name
      };
    }
    
    // Calculate blocks from days
    const blocksPerDay = BLOCKS_PER_DAY[chain] || 7200;
    const maxBlocks = tier.historicalDays * blocksPerDay;
    const startBlock = Math.max(deploymentBlock, currentBlock - maxBlocks);
    
    return {
      startBlock,
      endBlock: currentBlock,
      historicalDays: tier.historicalDays,
      tierName: tier.name,
      maxBlocks
    };
  }
}
```

### Step 3: Integrate with Onboarding
Update `src/api/routes/onboarding.js`:
```javascript
router.post('/complete', async (req, res) => {
  // ... existing code ...
  
  // Calculate block range based on subscription
  const blockRangeCalc = new SubscriptionBlockRangeCalculator();
  const blockRange = await blockRangeCalc.calculateBlockRange(
    req.user.walletAddress,
    chain,
    deploymentBlock
  );
  
  console.log(`📊 Subscription: ${blockRange.tierName}`);
  console.log(`📅 Historical data: ${blockRange.historicalDays} days`);
  console.log(`🧱 Block range: ${blockRange.startBlock} - ${blockRange.endBlock}`);
  
  // Pass to indexer
  await startIndexing(contractAddress, chain, blockRange);
});
```

### Step 4: Update SmartContractFetcher
Modify `fetchTransactions()` to respect block range limits:
```javascript
async fetchTransactions(contractAddress, startBlock, endBlock, chain, subscriptionLimits = null) {
  // If subscription limits provided, enforce them
  if (subscriptionLimits) {
    startBlock = Math.max(startBlock, subscriptionLimits.startBlock);
    endBlock = Math.min(endBlock, subscriptionLimits.endBlock);
    
    console.log(`🔒 Subscription limit enforced: ${subscriptionLimits.tierName}`);
    console.log(`📊 Allowed range: ${startBlock} - ${endBlock}`);
  }
  
  // ... existing fetch logic ...
}
```

### Step 5: Update SmartBlockRangeSelector
Add subscription-aware strategy:
```javascript
getSubscriptionStrategy(tier) {
  switch(tier) {
    case 0: // Free - 7 days
      return 'quick';
    case 1: // Starter - 30 days
      return 'standard';
    case 2: // Pro - 90 days
      return 'comprehensive';
    case 3: // Enterprise - All history
      return 'comprehensive';
    default:
      return 'quick';
  }
}
```

---

## Testing Checklist

- [ ] Fix tier definitions in `types.js`
- [ ] Create `SubscriptionBlockRangeCalculator.js`
- [ ] Integrate with onboarding flow
- [ ] Update `SmartContractFetcher` to enforce limits
- [ ] Update `SmartBlockRangeSelector` with subscription strategies
- [ ] Test Free tier (7 days / ~50k blocks)
- [ ] Test Starter tier (30 days / ~216k blocks)
- [ ] Test Pro tier (90 days / ~648k blocks)
- [ ] Test Enterprise tier (all history from deployment)
- [ ] Verify UI shows subscription limits
- [ ] Test upgrade flow (tier change updates block range)

---

## Summary

**Current State**: The subscription infrastructure exists but is NOT connected to data fetching.

**Required Work**: 
1. Fix tier definitions (add STARTER, fix mapping)
2. Create block range calculator that uses subscription tier
3. Integrate calculator with onboarding and indexing
4. Enforce limits in fetcher and selector
5. Test all tiers

**Estimated Effort**: 4-6 hours of development + testing

**Priority**: HIGH - This is a core feature for the subscription model
