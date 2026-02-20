# Subscription Tier Fix - Quick Guide

## What Was Wrong?

Your dashboard showed "Free" with 7 days of data, but your subscription widget showed "Pro" because the backend tier configuration didn't match the smart contract.

**Result**: Pro users were only getting 90 days of data instead of 365 days (75% less data than paid for!)

## What Was Fixed?

Updated backend tier configuration to match smart contract exactly:

| Tier | Old Days | New Days | Impact |
|------|----------|----------|--------|
| Free | 7 | 30 | +329% more data |
| Starter | 30 | 90 | +300% more data |
| Pro | 90 | 365 | +405% more data |
| Enterprise | All history | 730 | Defined limit |

## How to Apply the Fix

### Step 1: Restart Backend

```bash
cd mvp-workspace
npm run dev
```

### Step 2: Test Configuration

```bash
node test-subscription-tiers.js
```

Expected output:
```
✅ All tiers match contract configuration
✅ Block range calculation is correct
Your subscription: Pro
Historical data: 365 days (2,628,000 blocks)
```

### Step 3: Migrate Existing Users (Optional)

If you have existing users who onboarded with wrong configuration:

```bash
node migrate-existing-users.js
```

This will:
- Query smart contract for each user's real subscription
- Delete old analyses with wrong block ranges
- Mark users for re-indexing with correct configuration

### Step 4: Verify Dashboard

1. Open dashboard
2. Check "Contract Info" section
3. Should now show:
   - **Subscription**: Pro (or your actual tier)
   - **Historical Data**: 365 days (or your tier's days)
   - **Blocks Indexed**: Correct amount based on tier

## For New Users

New users onboarding after backend restart will automatically get:
- ✅ Correct historical data based on subscription
- ✅ Correct block ranges
- ✅ Correct tier limits

## For Existing Users

Existing users have two options:

### Option 1: Automatic (Recommended)
1. Backend restart applies new configuration
2. User refreshes dashboard
3. System detects old data and triggers re-indexing
4. User gets correct data automatically

### Option 2: Manual
1. User deletes current contract from dashboard
2. User onboards again
3. System uses new configuration
4. User gets correct data

## Verification

### Check Backend Configuration

```bash
node test-subscription-tiers.js
```

### Check User's Subscription

```bash
# In backend console
import SubscriptionService from './src/services/SubscriptionService.js';
const service = new SubscriptionService();
const info = await service.getSubscriptionInfo('0xYourWalletAddress');
console.log(info);
```

### Check Dashboard

1. Open dashboard
2. Look at "Contract Info" section
3. Verify:
   - Subscription tier matches widget
   - Historical days match tier
   - Blocks indexed match expected amount

## Expected Results

### Free Tier
- Historical Data: 30 days
- Blocks: ~216,000 (Lisk)
- Max Contracts: 5
- API Calls: 1,000/month

### Starter Tier
- Historical Data: 90 days
- Blocks: ~648,000 (Lisk)
- Max Contracts: 20
- API Calls: 10,000/month

### Pro Tier
- Historical Data: 365 days (1 year)
- Blocks: ~2,628,000 (Lisk)
- Max Contracts: 100
- API Calls: 50,000/month

### Enterprise Tier
- Historical Data: 730 days (2 years)
- Blocks: ~5,256,000 (Lisk)
- Max Contracts: 1,000
- API Calls: 250,000/month

## Troubleshooting

### Dashboard still shows wrong tier

1. Clear browser cache
2. Restart backend
3. Refresh dashboard
4. Check backend logs for errors

### User has no wallet address

User needs to:
1. Connect wallet in dashboard
2. Wallet address will sync to backend
3. Backend will query smart contract
4. Correct tier will be applied

### Migration script fails

Check:
1. Backend is running
2. Database is accessible
3. RPC URLs are configured in .env
4. Smart contract is deployed on Lisk Sepolia

## Files Modified

- `mvp-workspace/src/services/SubscriptionBlockRangeCalculator.js` - Fixed tier configuration

## Files Created

- `mvp-workspace/SUBSCRIPTION_TIER_FIX_COMPLETE.md` - Detailed fix documentation
- `mvp-workspace/test-subscription-tiers.js` - Test script
- `mvp-workspace/migrate-existing-users.js` - Migration script
- `mvp-workspace/SUBSCRIPTION_FIX_QUICK_GUIDE.md` - This guide

## Support

If you encounter issues:
1. Check backend logs
2. Run test script: `node test-subscription-tiers.js`
3. Verify smart contract: https://sepolia-blockscout.lisk.com/address/0x577d9A43D0fa564886379bdD9A56285769683C38

---

**Status**: ✅ Backend configuration fixed
**Date**: February 16, 2026
**Contract**: Lisk Sepolia - 0x577d9A43D0fa564886379bdD9A56285769683C38
