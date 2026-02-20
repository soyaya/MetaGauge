# Subscription Tier Configuration Fix - COMPLETE

## Issue Summary

The dashboard was showing "Free" with 7 days of data while the subscription widget showed "Pro" because:

1. **Backend tier configuration was wrong** - Didn't match smart contract values
2. **Missing data** - Users were getting 75% less data than they paid for

## Smart Contract Reference

**Network**: Lisk Sepolia (Chain ID: 4202)
**Subscription Contract**: `0x577d9A43D0fa564886379bdD9A56285769683C38`
**Token Contract**: `0xB51623F59fF9f2AA7d3bC1Afa99AE0fA8049ed3D`

## What Was Fixed

### File: `mvp-workspace/src/services/SubscriptionBlockRangeCalculator.js`

Updated `SUBSCRIPTION_TIERS` constant to match smart contract exactly:

| Tier | Old Days | New Days | Old Contracts | New Contracts | Old API Calls | New API Calls |
|------|----------|----------|---------------|---------------|---------------|---------------|
| Free | 7 ❌ | 30 ✅ | 1 ❌ | 5 ✅ | N/A | 1,000 ✅ |
| Starter | 30 ❌ | 90 ✅ | 3 ❌ | 20 ✅ | N/A | 10,000 ✅ |
| Pro | 90 ❌ | 365 ✅ | 10 ❌ | 100 ✅ | N/A | 50,000 ✅ |
| Enterprise | All history ❌ | 730 ✅ | Unlimited ❌ | 1,000 ✅ | N/A | 250,000 ✅ |

### Block Calculations (Lisk - 7,200 blocks/day)

| Tier | Days | Blocks | Old Blocks | Difference |
|------|------|--------|------------|------------|
| Free | 30 | 216,000 | 50,400 | +165,600 (329% more) |
| Starter | 90 | 648,000 | 216,000 | +432,000 (300% more) |
| Pro | 365 | 2,628,000 | 648,000 | +1,980,000 (405% more) |
| Enterprise | 730 | 5,256,000 | All history | Depends on deployment |

### Example: Pro Tier User

**Before Fix**:
- Historical Days: 90 days
- Blocks Indexed: 648,000 blocks
- Missing: 1,980,000 blocks (75% of data!)

**After Fix**:
- Historical Days: 365 days (1 year)
- Blocks Indexed: 2,628,000 blocks
- Complete: 100% of paid data ✅

## Changes Made

### 1. Updated SUBSCRIPTION_TIERS Constant

```javascript
export const SUBSCRIPTION_TIERS = {
  FREE: {
    tier: 0,
    name: 'Free',
    historicalDays: 30, // Was 7
    continuousSync: false,
    maxContracts: 5, // Was 1
    apiCallsPerMonth: 1000,
    maxAlerts: 3,
    teamMembers: 1,
    dataRefreshRate: 24 * 60 * 60
  },
  STARTER: {
    tier: 1,
    name: 'Starter',
    historicalDays: 90, // Was 30
    continuousSync: true,
    maxContracts: 20, // Was 3
    apiCallsPerMonth: 10000,
    maxAlerts: 15,
    teamMembers: 3,
    dataRefreshRate: 12 * 60 * 60
  },
  PRO: {
    tier: 2,
    name: 'Pro',
    historicalDays: 365, // Was 90
    continuousSync: true,
    maxContracts: 100, // Was 10
    apiCallsPerMonth: 50000,
    maxAlerts: 50,
    teamMembers: 10,
    dataRefreshRate: 6 * 60 * 60
  },
  ENTERPRISE: {
    tier: 3,
    name: 'Enterprise',
    historicalDays: 730, // Was -1 (all history)
    continuousSync: true,
    maxContracts: 1000, // Was -1 (unlimited)
    apiCallsPerMonth: 250000,
    maxAlerts: 200,
    teamMembers: 50,
    dataRefreshRate: 1 * 60 * 60
  }
};
```

### 2. Simplified Block Range Calculation

Removed special case for Enterprise tier (-1 days). Now all tiers use the same calculation logic:

```javascript
// Calculate blocks from days
const blocksPerDay = BLOCKS_PER_DAY[chain.toLowerCase()] || 7200;
maxBlocks = tierConfig.historicalDays * blocksPerDay;
const calculatedStart = currentBlock - maxBlocks;

// Ensure we don't go before deployment
startBlock = Math.max(deploymentBlock, calculatedStart);
```

### 3. Updated Fallback Values

Changed fallback from 7 days to 30 days when subscription check fails:

```javascript
// Fallback to Free tier (30 days)
const maxBlocks = 30 * blocksPerDay; // Was 7 * blocksPerDay
```

## Testing

### Test Current Configuration

```bash
node mvp-workspace/test-subscription-tiers.js
```

Expected output for Pro tier user:
```
📊 Subscription from Contract:
   Tier: Pro (2)
   Active: true
   Days Remaining: 15

📊 Block Range Calculation:
   Historical Days: 365
   Start Block: 26,931,845
   End Block: 29,559,845
   Total Blocks: 2,628,000
   Expected Blocks: 2,628,000
```

### Verify Dashboard

After backend restart, dashboard should show:
- **Subscription**: Pro
- **Historical Data**: 365 days (1 year)
- **Blocks Indexed**: 2,628,000
- **Block Range**: Correct range based on 365 days

## Next Steps

### For Existing Users

Users who already onboarded with wrong tier configuration need to be re-indexed:

1. **Option 1: Manual Re-onboarding**
   - User deletes current contract
   - User onboards again
   - System will use correct tier configuration

2. **Option 2: Migration Script** (Recommended)
   ```bash
   node mvp-workspace/migrate-existing-users.js
   ```
   This script will:
   - Get all users with default contracts
   - Query smart contract for real subscription
   - Delete old analyses with wrong block ranges
   - Trigger re-indexing with correct configuration

### For New Users

New users onboarding after this fix will automatically get:
- Correct historical data based on their subscription
- Correct block ranges
- Correct tier limits

## Impact

### Free Tier Users
- **Before**: 7 days (50,400 blocks)
- **After**: 30 days (216,000 blocks)
- **Benefit**: 329% more data

### Starter Tier Users
- **Before**: 30 days (216,000 blocks)
- **After**: 90 days (648,000 blocks)
- **Benefit**: 300% more data

### Pro Tier Users
- **Before**: 90 days (648,000 blocks)
- **After**: 365 days (2,628,000 blocks)
- **Benefit**: 405% more data

### Enterprise Tier Users
- **Before**: All history from deployment
- **After**: 730 days (5,256,000 blocks)
- **Note**: Now has a defined limit matching contract

## Files Modified

1. `mvp-workspace/src/services/SubscriptionBlockRangeCalculator.js`
   - Updated SUBSCRIPTION_TIERS constant
   - Simplified block range calculation
   - Updated fallback values

## Files to Review

1. `mvp-workspace/CONTRACT_SUBSCRIPTION_MAPPING.md` - Complete contract mapping
2. `mvp-workspace/SIMPLE_WALLET_SYNC_FIX.md` - Wallet address sync guide

## Verification Checklist

- [x] Backend tier configuration matches smart contract
- [x] Free tier: 30 days, 5 contracts, 1,000 API calls
- [x] Starter tier: 90 days, 20 contracts, 10,000 API calls
- [x] Pro tier: 365 days, 100 contracts, 50,000 API calls
- [x] Enterprise tier: 730 days, 1,000 contracts, 250,000 API calls
- [x] Block calculations correct for all tiers
- [x] Fallback values updated to 30 days
- [ ] Backend restarted to apply changes
- [ ] Existing users migrated to new configuration
- [ ] Dashboard shows correct subscription data

## Status

✅ **Backend Configuration Fixed** - Tier values now match smart contract exactly

⏳ **Pending**: 
- Backend restart to apply changes
- Existing user migration
- Wallet address sync implementation (see SIMPLE_WALLET_SYNC_FIX.md)

---

**Date**: February 16, 2026
**Fixed By**: Kiro AI Assistant
**Contract Reference**: Lisk Sepolia - 0x577d9A43D0fa564886379bdD9A56285769683C38
