# Application Inconsistencies Report

## Date: February 16, 2026

This document identifies all inconsistencies found in the application related to subscription tiers, data flow, and user experience.

---

## 1. Subscription Tier Configuration Mismatch ✅ FIXED

### Issue
Backend tier configuration didn't match smart contract values.

### Impact
- Users getting 75% less data than paid for
- Dashboard showing wrong subscription tier
- Inconsistent data between dashboard and subscription widget

### Status
✅ **FIXED** - Updated `SubscriptionBlockRangeCalculator.js` to match smart contract

### Details
See: `SUBSCRIPTION_TIER_FIX_COMPLETE.md`

---

## 2. Missing Wallet Address Sync ⚠️ NEEDS IMPLEMENTATION

### Issue
Backend doesn't have user's wallet address, so it can't query smart contract for subscription.

### Current State
- Frontend has wallet address (from wagmi/wallet connection)
- Backend has no wallet address field
- Backend falls back to Free tier when it can't query contract

### Impact
- Dashboard shows wrong subscription tier
- Backend can't verify user's actual subscription
- Mismatch between frontend and backend subscription data

### Solution Required
Implement wallet address sync as described in `SIMPLE_WALLET_SYNC_FIX.md`:

1. **Add wallet address endpoint** (MISSING)
   - POST `/api/users/wallet-address` - Save wallet address
   - GET `/api/users/wallet-address` - Get wallet address

2. **Update frontend to sync wallet** (MISSING)
   - Add effect in dashboard to sync wallet when connected
   - Call API to save wallet address

3. **Update onboarding to use wallet** (PARTIALLY DONE)
   - Onboarding already checks `req.user.walletAddress`
   - But wallet address is never saved to user

### Files Needed
- Create: `mvp-workspace/src/api/routes/user.js` (wallet endpoints)
- Update: `mvp-workspace/src/api/index.js` (register routes)
- Update: `mvp-workspace/frontend/app/dashboard/page.tsx` (sync wallet)
- Update: `mvp-workspace/frontend/lib/api.ts` (add wallet methods)

### Status
⚠️ **NEEDS IMPLEMENTATION** - Wallet sync not implemented

---

## 3. Profile Page Subscription Data ⚠️ INCONSISTENT

### Issue
Profile page shows subscription data from backend, which may not match smart contract.

### Current Flow
```
Profile Page
  ↓
  Calls api.onboarding.getUserMetrics()
  ↓
  Backend returns user.subscription (from database)
  ↓
  May not match smart contract
```

### Impact
- Profile page may show wrong subscription tier
- Inconsistent with subscription widget
- Inconsistent with dashboard

### Solution Required
Profile page should query smart contract directly (like subscription widget does) OR backend should sync subscription from contract.

### Files Affected
- `mvp-workspace/frontend/app/profile/page.tsx`
- `mvp-workspace/src/api/routes/onboarding.js` (getUserMetrics endpoint)

### Status
⚠️ **NEEDS FIX** - Profile page uses stale subscription data

---

## 4. API Limits Hardcoded ⚠️ INCONSISTENT

### Issue
API limits are hardcoded in multiple places with different values.

### Locations
1. **users.js** (dashboard endpoint):
   ```javascript
   limits: {
     free: 10,
     pro: 100,
     enterprise: -1
   }
   ```

2. **users.js** (usage endpoint):
   ```javascript
   limits: {
     free: 10,
     pro: 100,
     enterprise: -1
   }
   ```

3. **onboarding.js** (user-metrics endpoint):
   ```javascript
   limits: {
     monthly: user.subscription?.isActive && user.subscription?.features?.apiCallsPerMonth 
       ? user.subscription.features.apiCallsPerMonth 
       : (user.tier === 'free' ? 10 : user.tier === 'pro' ? 100 : user.tier === 'starter' ? 1000 : -1)
   }
   ```

4. **Smart Contract** (actual values):
   ```
   Free: 1,000 API calls/month
   Starter: 10,000 API calls/month
   Pro: 50,000 API calls/month
   Enterprise: 250,000 API calls/month
   ```

### Impact
- Users see wrong API limits
- Limits don't match what they paid for
- Inconsistent across different pages

### Solution Required
Use values from `SUBSCRIPTION_TIERS` constant in `SubscriptionBlockRangeCalculator.js`.

### Status
⚠️ **NEEDS FIX** - API limits are wrong and inconsistent

---

## 5. Profile Page API Missing ⚠️ INCOMPLETE

### Issue
Profile page calls `api.users.getProfile()` but the backend returns `{ user: userProfile }` while frontend expects just the user object.

### Current Backend Response
```javascript
res.json({ user: userProfile });
```

### Frontend Expects
```typescript
const profileResponse = await api.users.getProfile();
setProfile(profileResponse); // Expects user object directly
```

### Impact
- Profile page may not load correctly
- Data structure mismatch

### Solution Required
Either:
1. Backend returns user object directly: `res.json(userProfile)`
2. Frontend extracts user: `setProfile(profileResponse.user)`

### Status
⚠️ **NEEDS FIX** - API response structure mismatch

---

## 6. Subscription Widget vs Dashboard ⚠️ DIFFERENT DATA SOURCES

### Issue
Subscription widget and dashboard get subscription data from different sources.

### Current Flow

**Subscription Widget**:
```
Widget
  ↓
  Reads from Smart Contract (via wagmi)
  ↓
  Shows: Pro ✅ (correct)
```

**Dashboard**:
```
Dashboard
  ↓
  Calls api.onboarding.getDefaultContract()
  ↓
  Backend returns subscription from analysis metadata
  ↓
  May be stale or wrong
```

### Impact
- Dashboard and widget show different subscription tiers
- User confusion
- Inconsistent user experience

### Solution Required
Both should read from smart contract OR backend should sync from contract regularly.

### Status
⚠️ **NEEDS FIX** - Different data sources cause inconsistency

---

## 7. Missing Wallet Address Field in Database ⚠️ CRITICAL

### Issue
User database schema doesn't have `walletAddress` field.

### Current State
- Onboarding checks `req.user.walletAddress`
- But this field is never set
- Always undefined or null

### Impact
- Backend can't query smart contract
- Falls back to Free tier
- Wrong subscription data

### Solution Required
Add `walletAddress` field to user schema and implement sync.

### Status
⚠️ **CRITICAL** - Wallet address field missing from database

---

## 8. Subscription Sync Not Implemented ⚠️ MISSING

### Issue
No mechanism to sync subscription from smart contract to backend.

### Current State
- Frontend reads from contract ✅
- Backend never reads from contract ❌
- Backend uses stale data from database ❌

### Impact
- Backend always out of sync
- Dashboard shows wrong data
- Profile shows wrong data

### Solution Required
Implement subscription sync:
1. When user connects wallet → sync subscription
2. When user onboards → sync subscription
3. Periodic sync (daily) → keep subscription updated

### Status
⚠️ **MISSING** - No subscription sync mechanism

---

## 9. Profile Page Upgrade Button ⚠️ BROKEN LINK

### Issue
Profile page has "Upgrade Plan" button that links to `/subscription` page.

### Current State
```typescript
<Button className="w-full" variant="outline" asChild>
  <a href="/subscription">Upgrade Plan</a>
</Button>
```

### Impact
- Link may not work if subscription page doesn't exist
- User can't upgrade

### Solution Required
Verify `/subscription` page exists or update link to correct page.

### Status
⚠️ **NEEDS VERIFICATION** - Subscription page may not exist

---

## 10. Account Actions Not Implemented ⚠️ INCOMPLETE

### Issue
Profile page has buttons for actions that aren't implemented:
- Resend Verification
- Change Password
- Delete Account

### Current State
```typescript
<Button variant="outline" className="w-full">
  <Mail className="h-4 w-4 mr-2" />
  Resend Verification
</Button>

<Button variant="outline" className="w-full">
  Change Password
</Button>

<Button variant="destructive" className="w-full">
  Delete Account
</Button>
```

### Impact
- Buttons don't do anything
- User can't perform these actions
- Poor user experience

### Solution Required
Implement handlers for these actions or remove buttons.

### Status
⚠️ **INCOMPLETE** - Account actions not implemented

---

## Summary of Issues

### Critical (Must Fix)
1. ✅ **Subscription tier configuration** - FIXED
2. ⚠️ **Missing wallet address sync** - NEEDS IMPLEMENTATION
3. ⚠️ **Missing wallet address field** - NEEDS DATABASE UPDATE

### High Priority (Should Fix)
4. ⚠️ **Profile page subscription data** - INCONSISTENT
5. ⚠️ **API limits hardcoded** - WRONG VALUES
6. ⚠️ **Different data sources** - CAUSES INCONSISTENCY
7. ⚠️ **No subscription sync** - MISSING FEATURE

### Medium Priority (Nice to Fix)
8. ⚠️ **Profile API response structure** - MISMATCH
9. ⚠️ **Upgrade button link** - NEEDS VERIFICATION
10. ⚠️ **Account actions** - NOT IMPLEMENTED

---

## Recommended Fix Order

### Phase 1: Critical Fixes (Do First)
1. ✅ Update subscription tier configuration - DONE
2. Implement wallet address sync
3. Add wallet address field to database
4. Test subscription flow end-to-end

### Phase 2: High Priority Fixes
5. Fix API limits to use correct values
6. Implement subscription sync mechanism
7. Update profile page to use smart contract data
8. Ensure all pages use same data source

### Phase 3: Polish
9. Fix profile API response structure
10. Verify/fix upgrade button link
11. Implement or remove account action buttons

---

## Files That Need Changes

### Backend
- [ ] `mvp-workspace/src/api/routes/user.js` - CREATE (wallet endpoints)
- [ ] `mvp-workspace/src/api/index.js` - UPDATE (register user routes)
- [ ] `mvp-workspace/src/api/routes/users.js` - UPDATE (fix API limits)
- [ ] `mvp-workspace/src/api/routes/onboarding.js` - UPDATE (use wallet address)
- [ ] `mvp-workspace/src/api/database/UserStorage.js` - UPDATE (add walletAddress field)

### Frontend
- [ ] `mvp-workspace/frontend/app/dashboard/page.tsx` - UPDATE (sync wallet)
- [ ] `mvp-workspace/frontend/app/profile/page.tsx` - UPDATE (fix data source)
- [ ] `mvp-workspace/frontend/lib/api.ts` - UPDATE (add wallet methods)

### Documentation
- [x] `SUBSCRIPTION_TIER_FIX_COMPLETE.md` - CREATED
- [x] `SIMPLE_WALLET_SYNC_FIX.md` - CREATED
- [x] `APP_INCONSISTENCIES_REPORT.md` - THIS FILE

---

## Testing Checklist

After implementing fixes:

- [ ] Backend tier configuration matches smart contract
- [ ] Wallet address syncs from frontend to backend
- [ ] Backend can query smart contract with wallet address
- [ ] Dashboard shows correct subscription tier
- [ ] Profile page shows correct subscription tier
- [ ] Subscription widget shows correct subscription tier
- [ ] All three match each other
- [ ] API limits are correct
- [ ] Subscription syncs regularly
- [ ] No mock data anywhere
- [ ] All pages use same data source

---

**Status**: 1/10 issues fixed, 9 remaining
**Priority**: Implement wallet address sync next
**Estimated Work**: 2-3 hours for Phase 1, 3-4 hours for Phase 2
