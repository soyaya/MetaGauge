# Subscription Tier Fix - Deployment Checklist

## Pre-Deployment Verification

- [x] Backend tier configuration updated
- [x] All tier values match smart contract
- [x] Block calculations verified
- [x] Fallback values updated
- [x] Code has no syntax errors
- [x] Test script created
- [x] Migration script created
- [x] Documentation complete

## Deployment Steps

### Step 1: Backup Current State

```bash
# Backup database (if applicable)
cd mvp-workspace
cp -r data data.backup.$(date +%Y%m%d_%H%M%S)

# Backup .env file
cp .env .env.backup
```

### Step 2: Restart Backend

```bash
# Stop current backend
# (Ctrl+C if running in terminal)

# Start backend with new configuration
cd mvp-workspace
npm run dev
```

**Expected Output**:
```
✅ Server running on port 5000
✅ Database connected
✅ Subscription service initialized
```

### Step 3: Verify Configuration

```bash
# Run test script
node test-subscription-tiers.js
```

**Expected Output**:
```
✅ All tiers match contract configuration
✅ Block range calculation is correct
Your subscription: Pro
Historical data: 365 days (2,628,000 blocks)
```

**If test fails**:
- Check backend logs for errors
- Verify .env has correct RPC URLs
- Ensure smart contract is accessible

### Step 4: Test Dashboard

1. **Open Dashboard**
   - Navigate to: http://localhost:3000/dashboard
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Verify Contract Info Section**
   - [ ] Subscription shows "Pro" (not "Free")
   - [ ] Historical Data shows "365 days" (not "7 days" or "90 days")
   - [ ] Blocks Indexed shows ~2,628,000 (not ~50,400 or ~648,000)
   - [ ] Block Range is correct

3. **Verify Subscription Widget**
   - [ ] Current plan shows "Pro"
   - [ ] API Calls/Month shows "50,000"
   - [ ] Max Projects shows "100"
   - [ ] Max Alerts shows "50"

4. **Verify Both Match**
   - [ ] Dashboard tier = Widget tier
   - [ ] Dashboard data = Expected for tier
   - [ ] No mismatch warnings

### Step 5: Migrate Existing Users (Optional)

**Only if you have existing users with old data**:

```bash
# Run migration script
node migrate-existing-users.js
```

**Expected Output**:
```
📊 Found X users with default contracts
✅ Migrated: Y users
⏭️  Skipped: Z users
❌ Errors: 0
```

**If migration fails**:
- Check database connection
- Verify users have wallet addresses
- Check backend can query smart contract

### Step 6: Verify User Data

For each migrated user:

1. **Check Database**
   ```javascript
   // In backend console
   import { UserStorage } from './src/api/database/index.js';
   const user = await UserStorage.findById('user-id');
   console.log(user.onboarding.defaultContract);
   ```

2. **Verify Fields**
   - [ ] `isIndexed` is false (will re-index)
   - [ ] `indexingProgress` is 0
   - [ ] `lastAnalysisId` is null
   - [ ] `subscriptionTier` matches smart contract
   - [ ] `migrated` is true

3. **Trigger Re-indexing**
   - User refreshes dashboard
   - System detects old data
   - Automatic re-indexing starts
   - User gets correct data

## Post-Deployment Verification

### Immediate Checks (Within 5 minutes)

- [ ] Backend is running without errors
- [ ] Dashboard loads correctly
- [ ] Subscription tier displays correctly
- [ ] No console errors in browser
- [ ] No backend errors in logs

### Short-term Checks (Within 1 hour)

- [ ] New users can onboard successfully
- [ ] New users get correct tier data
- [ ] Existing users can refresh data
- [ ] Re-indexing completes successfully
- [ ] All metrics display correctly

### Long-term Checks (Within 24 hours)

- [ ] All users have correct tier data
- [ ] No subscription mismatches reported
- [ ] Indexing performance is acceptable
- [ ] No unexpected errors in logs
- [ ] User feedback is positive

## Rollback Plan (If Needed)

If something goes wrong:

### Step 1: Stop Backend
```bash
# Ctrl+C in terminal
```

### Step 2: Restore Backup
```bash
# Restore database
cd mvp-workspace
rm -rf data
mv data.backup.YYYYMMDD_HHMMSS data

# Restore .env
cp .env.backup .env
```

### Step 3: Revert Code Changes
```bash
# Revert SubscriptionBlockRangeCalculator.js
git checkout mvp-workspace/src/services/SubscriptionBlockRangeCalculator.js
```

### Step 4: Restart Backend
```bash
npm run dev
```

### Step 5: Investigate Issue
- Check backend logs
- Review error messages
- Test configuration
- Fix issues
- Try deployment again

## Monitoring

### Backend Logs to Watch

```bash
# Watch backend logs
tail -f mvp-workspace/logs/backend.log

# Look for:
✅ "Subscription: Pro" (correct tier)
✅ "Block range: X → Y (2,628,000 blocks)" (correct blocks)
❌ "Falling back to Free tier" (should not happen)
❌ "Error calculating block range" (should not happen)
```

### Database Queries

```javascript
// Check user subscriptions
import { UserStorage } from './src/api/database/index.js';
const users = await UserStorage.findAll();
users.forEach(user => {
  if (user.onboarding?.defaultContract) {
    console.log(`${user.email}: ${user.onboarding.defaultContract.subscriptionTier}`);
  }
});
```

### Frontend Console

```javascript
// Check subscription data
console.log('Dashboard data:', dashboardData);
console.log('Subscription:', dashboardData.subscription);
console.log('Block range:', dashboardData.blockRange);
```

## Success Criteria

### Must Have (Critical)

- [x] Backend tier configuration matches smart contract
- [ ] Backend restarts without errors
- [ ] Test script passes all checks
- [ ] Dashboard shows correct tier
- [ ] Dashboard shows correct historical days
- [ ] Dashboard shows correct block count
- [ ] No subscription mismatches

### Should Have (Important)

- [ ] Migration script runs successfully
- [ ] Existing users get correct data
- [ ] New users get correct data
- [ ] Re-indexing completes successfully
- [ ] Performance is acceptable

### Nice to Have (Optional)

- [ ] All documentation reviewed
- [ ] User feedback collected
- [ ] Metrics tracked
- [ ] Improvements identified

## Troubleshooting

### Issue: Dashboard still shows wrong tier

**Solution**:
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check backend logs
4. Verify backend restarted
5. Run test script

### Issue: Test script fails

**Solution**:
1. Check backend is running
2. Verify .env has RPC URLs
3. Test smart contract access
4. Check wallet address is valid
5. Review error message

### Issue: Migration script fails

**Solution**:
1. Check database connection
2. Verify users have wallet addresses
3. Test smart contract queries
4. Check backend logs
5. Run script with debug output

### Issue: Re-indexing doesn't start

**Solution**:
1. Check user has wallet address
2. Verify subscription is active
3. Check backend can query contract
4. Review backend logs
5. Manually trigger refresh

## Support

### Documentation

- `README_SUBSCRIPTION_FIX.md` - User guide
- `SUBSCRIPTION_FIX_QUICK_GUIDE.md` - Quick reference
- `SUBSCRIPTION_TIER_FIX_COMPLETE.md` - Technical details
- `BEFORE_AFTER_COMPARISON.md` - Visual comparison
- `SUBSCRIPTION_MISMATCH_RESOLVED.md` - Resolution summary

### Scripts

- `test-subscription-tiers.js` - Test configuration
- `migrate-existing-users.js` - Migrate users

### Smart Contract

- **Network**: Lisk Sepolia (Chain ID: 4202)
- **Contract**: 0x577d9A43D0fa564886379bdD9A56285769683C38
- **Explorer**: https://sepolia-blockscout.lisk.com/address/0x577d9A43D0fa564886379bdD9A56285769683C38

## Final Checklist

Before marking as complete:

- [ ] Backend restarted successfully
- [ ] Test script passes
- [ ] Dashboard verified
- [ ] Subscription widget verified
- [ ] Both show same tier
- [ ] Correct historical days
- [ ] Correct block count
- [ ] Migration completed (if needed)
- [ ] No errors in logs
- [ ] User feedback positive

## Sign-off

- [ ] Technical verification complete
- [ ] User acceptance complete
- [ ] Documentation complete
- [ ] Deployment successful

**Deployed By**: _________________
**Date**: _________________
**Status**: ☐ Success ☐ Partial ☐ Rollback

---

**Deployment Date**: February 16, 2026
**Status**: ✅ Ready for Deployment
**Expected Impact**: +405% more data for Pro tier users
