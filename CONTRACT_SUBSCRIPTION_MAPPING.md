# Contract Subscription Tier Mapping

## Deployed Contract Details

**Network**: Lisk Sepolia (Chain ID: 4202)
**Subscription Contract**: `0x577d9A43D0fa564886379bdD9A56285769683C38`
**Token Contract**: `0xB51623F59fF9f2AA7d3bC1Afa99AE0fA8049ed3D`
**Payment Mode**: Token (MGT)

---

## Subscription Tiers from Smart Contract

### Tier 0: Free
```solidity
historicalData: 30 days
apiCallsPerMonth: 1,000
maxProjects: 5
maxAlerts: 3
teamMembers: 1
dataRefreshRate: 24 hours
```

### Tier 1: Starter
```solidity
historicalData: 90 days
apiCallsPerMonth: 10,000
maxProjects: 20
maxAlerts: 15
teamMembers: 3
dataRefreshRate: 12 hours
monthlyPrice: 0.01 MGT
yearlyPrice: 0.1 MGT
```

### Tier 2: Pro
```solidity
historicalData: 365 days (1 year)
apiCallsPerMonth: 50,000
maxProjects: 100
maxAlerts: 50
teamMembers: 10
dataRefreshRate: 6 hours
monthlyPrice: 0.034 MGT
yearlyPrice: 0.3 MGT
```

### Tier 3: Enterprise
```solidity
historicalData: 730 days (2 years)
apiCallsPerMonth: 250,000
maxProjects: 1,000
maxAlerts: 200
teamMembers: 50
dataRefreshRate: 1 hour
monthlyPrice: 0.103 MGT
yearlyPrice: 1.0 MGT
```

---

## Current Backend Configuration (WRONG)

**File**: `mvp-workspace/src/services/SubscriptionBlockRangeCalculator.js`

```javascript
export const SUBSCRIPTION_TIERS = {
  FREE: {
    tier: 0,
    name: 'Free',
    historicalDays: 7,  // ❌ WRONG - Contract says 30 days
    continuousSync: false,
    maxContracts: 1
  },
  STARTER: {
    tier: 1,
    name: 'Starter',
    historicalDays: 30,  // ❌ WRONG - Contract says 90 days
    continuousSync: true,
    maxContracts: 3
  },
  PRO: {
    tier: 2,
    name: 'Pro',
    historicalDays: 90,  // ❌ WRONG - Contract says 365 days
    continuousSync: true,
    maxContracts: 10
  },
  ENTERPRISE: {
    tier: 3,
    name: 'Enterprise',
    historicalDays: -1,  // ✅ CORRECT - All history
    continuousSync: true,
    maxContracts: -1
  }
};
```

---

## Corrected Backend Configuration

**File**: `mvp-workspace/src/services/SubscriptionBlockRangeCalculator.js`

```javascript
// Subscription tier definitions aligned with smart contract
export const SUBSCRIPTION_TIERS = {
  FREE: {
    tier: 0,
    name: 'Free',
    historicalDays: 30,  // ✅ FIXED - Matches contract (30 days)
    continuousSync: false,
    maxContracts: 5,     // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 1000,
    maxAlerts: 3,
    teamMembers: 1,
    dataRefreshRate: 24 * 60 * 60 // 24 hours in seconds
  },
  STARTER: {
    tier: 1,
    name: 'Starter',
    historicalDays: 90,  // ✅ FIXED - Matches contract (90 days)
    continuousSync: true,
    maxContracts: 20,    // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 10000,
    maxAlerts: 15,
    teamMembers: 3,
    dataRefreshRate: 12 * 60 * 60 // 12 hours in seconds
  },
  PRO: {
    tier: 2,
    name: 'Pro',
    historicalDays: 365, // ✅ FIXED - Matches contract (365 days / 1 year)
    continuousSync: true,
    maxContracts: 100,   // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 50000,
    maxAlerts: 50,
    teamMembers: 10,
    dataRefreshRate: 6 * 60 * 60 // 6 hours in seconds
  },
  ENTERPRISE: {
    tier: 3,
    name: 'Enterprise',
    historicalDays: 730, // ✅ FIXED - Matches contract (730 days / 2 years)
    continuousSync: true,
    maxContracts: 1000,  // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 250000,
    maxAlerts: 200,
    teamMembers: 50,
    dataRefreshRate: 1 * 60 * 60 // 1 hour in seconds
  }
};
```

---

## Block Calculations

### Blocks Per Day by Chain
```javascript
export const BLOCKS_PER_DAY = {
  ethereum: 7200,  // ~12 second blocks
  lisk: 7200,      // ~12 second blocks
  starknet: 14400  // ~6 second blocks
};
```

### Expected Block Ranges (Lisk)

**Free Tier (30 days)**:
- Days: 30
- Blocks: 30 × 7,200 = 216,000 blocks
- Current (WRONG): 7 × 7,200 = 50,400 blocks

**Starter Tier (90 days)**:
- Days: 90
- Blocks: 90 × 7,200 = 648,000 blocks
- Current (WRONG): 30 × 7,200 = 216,000 blocks

**Pro Tier (365 days)**:
- Days: 365
- Blocks: 365 × 7,200 = 2,628,000 blocks
- Current (WRONG): 90 × 7,200 = 648,000 blocks

**Enterprise Tier (730 days)**:
- Days: 730
- Blocks: 730 × 7,200 = 5,256,000 blocks
- Current: All history from deployment ✅

---

## Frontend Configuration

**File**: `mvp-workspace/frontend/lib/web3-config.ts`

Should match the contract exactly:

```typescript
export const SUBSCRIPTION_PLANS = {
  [SubscriptionTier.Free]: {
    name: 'Free',
    tier: SubscriptionTier.Free,
    features: {
      apiCallsPerMonth: 1000,
      maxProjects: 5,
      maxAlerts: 3,
      exportAccess: false,
      comparisonTool: false,
      walletIntelligence: false,
      apiAccess: false,
      prioritySupport: false,
      customInsights: false
    },
    limits: {
      historicalData: 30, // days
      teamMembers: 1,
      dataRefreshRate: 24 // hours
    },
    pricing: {
      monthly: 0,
      yearly: 0
    }
  },
  [SubscriptionTier.Starter]: {
    name: 'Starter',
    tier: SubscriptionTier.Starter,
    features: {
      apiCallsPerMonth: 10000,
      maxProjects: 20,
      maxAlerts: 15,
      exportAccess: true,
      comparisonTool: true,
      walletIntelligence: false,
      apiAccess: false,
      prioritySupport: false,
      customInsights: false
    },
    limits: {
      historicalData: 90, // days
      teamMembers: 3,
      dataRefreshRate: 12 // hours
    },
    pricing: {
      monthly: 0.01,
      yearly: 0.1
    }
  },
  [SubscriptionTier.Pro]: {
    name: 'Pro',
    tier: SubscriptionTier.Pro,
    features: {
      apiCallsPerMonth: 50000,
      maxProjects: 100,
      maxAlerts: 50,
      exportAccess: true,
      comparisonTool: true,
      walletIntelligence: true,
      apiAccess: true,
      prioritySupport: false,
      customInsights: false
    },
    limits: {
      historicalData: 365, // days (1 year)
      teamMembers: 10,
      dataRefreshRate: 6 // hours
    },
    pricing: {
      monthly: 0.034,
      yearly: 0.3
    }
  },
  [SubscriptionTier.Enterprise]: {
    name: 'Enterprise',
    tier: SubscriptionTier.Enterprise,
    features: {
      apiCallsPerMonth: 250000,
      maxProjects: 1000,
      maxAlerts: 200,
      exportAccess: true,
      comparisonTool: true,
      walletIntelligence: true,
      apiAccess: true,
      prioritySupport: true,
      customInsights: true
    },
    limits: {
      historicalData: 730, // days (2 years)
      teamMembers: 50,
      dataRefreshRate: 1 // hour
    },
    pricing: {
      monthly: 0.103,
      yearly: 1.0
    }
  }
};
```

---

## Summary of Issues

### Issue 1: Wrong Historical Days
| Tier | Contract Says | Backend Has | Difference |
|------|--------------|-------------|------------|
| Free | 30 days | 7 days | -23 days ❌ |
| Starter | 90 days | 30 days | -60 days ❌ |
| Pro | 365 days | 90 days | -275 days ❌ |
| Enterprise | 730 days | All history | ✅ |

### Issue 2: Wrong Block Calculations
For Pro tier on Lisk:
- **Should index**: 365 × 7,200 = 2,628,000 blocks
- **Currently indexes**: 90 × 7,200 = 648,000 blocks
- **Missing**: 1,980,000 blocks (75% of data!)

### Issue 3: No Wallet Address Sync
- Frontend reads subscription from contract ✅
- Backend doesn't have wallet address ❌
- Backend falls back to wrong tier ❌

---

## Fix Implementation

### Step 1: Update Backend Configuration

**File**: `mvp-workspace/src/services/SubscriptionBlockRangeCalculator.js`

Replace the SUBSCRIPTION_TIERS constant with the corrected version above.

### Step 2: Add Wallet Sync

Follow the steps in `SIMPLE_WALLET_SYNC_FIX.md`:
1. Add wallet address column to users
2. Sync wallet when connected
3. Use wallet to query contract

### Step 3: Re-index Existing Users

For users who already onboarded with wrong tier:
1. Get their wallet address
2. Query contract for real subscription
3. Delete old analysis
4. Re-index with correct block range

---

## Testing

### Test Script

```javascript
// test-subscription-tiers.js
import SubscriptionService from './src/services/SubscriptionService.js';
import subscriptionBlockRangeCalculator from './src/services/SubscriptionBlockRangeCalculator.js';

async function testTiers() {
  const walletAddress = '0xYourWalletAddress';
  const chain = 'lisk';
  const deploymentBlock = 28168268;
  const currentBlock = 29559845;
  
  // Get subscription from contract
  const subscriptionService = new SubscriptionService();
  const subInfo = await subscriptionService.getSubscriptionInfo(walletAddress);
  
  console.log(`\n📊 Subscription from Contract:`);
  console.log(`   Tier: ${subInfo.tierName} (${subInfo.tier})`);
  console.log(`   Active: ${subInfo.isActive}`);
  console.log(`   Days Remaining: ${subInfo.daysRemaining}`);
  
  // Calculate block range
  const blockRange = await subscriptionBlockRangeCalculator.calculateBlockRange(
    walletAddress,
    chain,
    deploymentBlock,
    currentBlock
  );
  
  console.log(`\n📊 Block Range Calculation:`);
  console.log(`   Historical Days: ${blockRange.historicalDays}`);
  console.log(`   Start Block: ${blockRange.startBlock.toLocaleString()}`);
  console.log(`   End Block: ${blockRange.endBlock.toLocaleString()}`);
  console.log(`   Total Blocks: ${blockRange.actualBlocks.toLocaleString()}`);
  console.log(`   Expected Blocks: ${(blockRange.historicalDays * 7200).toLocaleString()}`);
}

testTiers().catch(console.error);
```

Run: `node test-subscription-tiers.js`

---

## Expected Results After Fix

### For Pro Tier User:
```
Dashboard Contract Info:
- Subscription: Pro
- Historical Data: 365 days (1 year)
- Blocks Indexed: 2,628,000
- Block Range: 26,931,845 → 29,559,845

Subscription Status Widget:
- Current plan: Pro
- API Calls/Month: 50,000
- Max Projects: 100
- Max Alerts: 50
- Historical Data: 365 days

✅ Both match the smart contract!
```
