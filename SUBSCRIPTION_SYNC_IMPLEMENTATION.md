# Subscription Sync from Smart Contract

## Problem Identified

The dashboard was showing **Free** tier even though the user has a **Pro** subscription because:
1. ❌ Wallet not connected
2. ❌ Not checking smart contract for real tier
3. ❌ Using hardcoded "Free" tier from onboarding
4. ❌ Indexing using wrong limits (7 days instead of Pro limits)

## Solution Implemented

### ✅ Automatic Subscription Sync

**Flow:**
```
User connects wallet → 
Sync subscription from smart contract → 
Update user tier in database → 
Update dashboard display → 
Use correct indexing limits
```

### Components Created

#### 1. Subscription Sync Service
**File:** `src/services/sync-subscription.js`

**Function:** `syncSubscriptionFromBlockchain(userId, walletAddress)`

**What it does:**
- Calls smart contract `getSubscriptionInfo(walletAddress)`
- Gets real tier (Free, Starter, Pro, Enterprise)
- Gets plan features (historical data, max projects, max alerts)
- Updates user in database
- Updates onboarding contract data
- Updates analysis metadata

#### 2. API Endpoint
**Route:** `POST /api/users/sync-subscription`

**Request:**
```json
{
  "walletAddress": "0x..."
}
```

**Response:**
```json
{
  "message": "Subscription synced successfully",
  "tier": "Pro",
  "historicalDays": 90
}
```

#### 3. Frontend Integration
**Component:** `WalletConnect`

**Auto-sync on wallet connection:**
```typescript
useEffect(() => {
  if (isConnected && address) {
    syncSubscription(address); // ← Automatic sync
  }
}, [isConnected, address]);
```

## How It Works

### Step 1: User Connects Wallet
```
Dashboard → Connect Wallet button → 
RainbowKit modal → Select wallet → 
Wallet connected
```

### Step 2: Automatic Sync
```
WalletConnect component detects connection →
Calls api.users.syncSubscription(address) →
Backend calls smart contract →
Gets real subscription tier
```

### Step 3: Update Database
```
Smart Contract returns:
{
  tier: 2,
  tierName: "Pro",
  historicalDays: 90,
  isActive: true
}

Database updated:
- user.tier = "pro"
- user.subscription = { ... }
- onboarding.defaultContract.subscriptionTier = "Pro"
- analysis.metadata.subscription.tier = "Pro"
```

### Step 4: Dashboard Updates
```
Dashboard reloads →
Shows "Pro" tier →
Uses 90 days historical data →
Enables Pro features
```

## Subscription Tiers from Smart Contract

| Tier | Name | Historical Data | Max Projects | Max Alerts |
|------|------|----------------|--------------|------------|
| 0 | Free | 7 days | 1 | 3 |
| 1 | Starter | 30 days | 5 | 10 |
| 2 | Pro | 90 days | 20 | 50 |
| 3 | Enterprise | All history | Unlimited | 500 |

## Testing

### Manual Test
```bash
# 1. Get user ID
node -e "import('./src/api/database/index.js').then(({UserStorage})=>UserStorage.findByEmail('your@email.com').then(u=>console.log(u.id)))"

# 2. Sync subscription
node src/services/sync-subscription.js <wallet-address> <user-id>
```

### Frontend Test
1. Go to dashboard
2. Click "Connect Wallet"
3. Select wallet and connect
4. Check console: "✅ Subscription synced from smart contract"
5. Refresh dashboard
6. Verify tier shows correctly

## Smart Contract Integration

### Contract Address
```
Lisk Sepolia: 0x577d9A43D0fa564886379bdD9A56285769683C38
```

### Methods Used
```solidity
function getSubscriptionInfo(address user) 
  returns (
    address userAddress,
    uint8 tier,
    uint8 role,
    uint8 billingCycle,
    uint256 startTime,
    uint256 endTime,
    bool isActive,
    ...
  )

function plans(uint8 tier)
  returns (
    string name,
    uint256 monthlyPrice,
    uint256 yearlyPrice,
    Features features,
    Limits limits,
    bool active
  )
```

## Benefits

### For Users
- ✅ **Accurate tier display** - Shows real subscription from blockchain
- ✅ **Correct limits** - Uses proper historical data limits
- ✅ **Automatic sync** - No manual action needed
- ✅ **Real-time updates** - Syncs on every wallet connection

### For System
- ✅ **Source of truth** - Smart contract is authoritative
- ✅ **No manual updates** - Automatic synchronization
- ✅ **Consistent data** - Database matches blockchain
- ✅ **Scalable** - Works for all users automatically

## Next Steps

1. **Connect Wallet**
   - Go to dashboard
   - Click "Connect Wallet"
   - Select your wallet
   - Approve connection

2. **Verify Sync**
   - Check console for sync message
   - Refresh dashboard
   - Verify tier shows "Pro"
   - Check historical data shows 90 days

3. **Trigger Analysis**
   - Analysis will now use Pro limits
   - Fetch 90 days of data
   - Enable Pro features

## Files Modified

### Backend
- `src/services/sync-subscription.js` - New sync service
- `src/api/routes/users.js` - Added sync endpoint

### Frontend
- `frontend/lib/api.ts` - Added syncSubscription method
- `frontend/components/web3/wallet-connect.tsx` - Auto-sync on connect

## Summary

✅ **Subscription now syncs from smart contract automatically**

When user connects wallet:
1. System checks smart contract
2. Gets real subscription tier
3. Updates database
4. Dashboard shows correct tier
5. Analysis uses correct limits

**The smart contract is now the source of truth for subscriptions.**
