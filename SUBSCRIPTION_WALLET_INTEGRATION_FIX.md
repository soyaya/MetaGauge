# Subscription Wallet Integration Fix

## Problem
Dashboard shows "Free" subscription with 7 days of data, but Subscription Status widget shows "Pro" plan. This is because:

1. **Subscription Status Widget**: Reads from connected Web3 wallet → Shows "Pro" (correct)
2. **Onboarding/Indexing**: Doesn't have wallet address → Falls back to Free tier → Indexes only 7 days

## Root Cause
- `req.user.walletAddress` is `undefined` in onboarding route
- Onboarding form doesn't collect wallet address
- User database doesn't store wallet address
- Subscription check falls back to Free tier when wallet address is missing

## Current Flow (Broken)
```
User onboards → No wallet address collected
  ↓
Backend tries: req.user.walletAddress || '0x0000...'
  ↓
SubscriptionService.getSubscriptionInfo('0x0000...') → Fails
  ↓
Falls back to Free tier (7 days)
  ↓
Indexes only 7,000 blocks (7 days × 1,000 blocks/day)
```

## Required Flow (Fixed)
```
User connects wallet → Wallet address stored
  ↓
User onboards → Wallet address sent to backend
  ↓
Backend: SubscriptionService.getSubscriptionInfo(walletAddress)
  ↓
Gets "Pro" tier from smart contract
  ↓
Calculates: 90 days × 7,200 blocks/day = 648,000 blocks
  ↓
Indexes correct amount based on subscription
```

---

## Solution Overview

### Phase 1: Add Wallet Connection to Onboarding
1. Add Web3 wallet connection button
2. Detect connected wallet address
3. Send wallet address with onboarding data

### Phase 2: Update Backend
1. Add `walletAddress` field to user schema
2. Store wallet address during onboarding
3. Use stored wallet address for subscription checks

### Phase 3: Update Dashboard
1. Show subscription tier from smart contract
2. Match indexed data with subscription tier
3. Add "Upgrade" flow if mismatch detected

---

## Implementation Steps

### Step 1: Add Wallet Connection Hook

**File**: `mvp-workspace/frontend/hooks/use-wallet.ts` (NEW)

```typescript
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.listAccounts()
        if (accounts.length > 0) {
          setAddress(accounts[0].address)
          setIsConnected(true)
        }
      } catch (err) {
        console.error('Failed to check wallet connection:', err)
      }
    }
  }

  const connect = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('Please install MetaMask or another Web3 wallet')
      return
    }

    try {
      setIsConnecting(true)
      setError(null)
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      
      setAddress(address)
      setIsConnected(true)
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setAddress(null)
    setIsConnected(false)
  }

  return {
    address,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect
  }
}
```

### Step 2: Update Onboarding Form

**File**: `mvp-workspace/frontend/app/onboarding/page.tsx`

Add wallet connection to Step 1:

```typescript
import { useWallet } from '@/hooks/use-wallet'

// Inside component:
const { address: walletAddress, isConnected, connect, isConnecting } = useWallet()

// Add to Step 1 (Project Information):
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
  <h4 className="font-semibold mb-2">Connect Your Wallet</h4>
  <p className="text-sm text-muted-foreground mb-3">
    Connect your wallet to verify your subscription tier and unlock features
  </p>
  
  {!isConnected ? (
    <Button 
      type="button" 
      onClick={connect} 
      disabled={isConnecting}
      className="w-full"
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        'Connect Wallet'
      )}
    </Button>
  ) : (
    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-3">
      <div>
        <p className="text-sm font-medium text-green-800">Wallet Connected</p>
        <p className="text-xs text-green-600">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</p>
      </div>
      <CheckCircle className="h-5 w-5 text-green-600" />
    </div>
  )}
</div>

// Update onSubmit to include wallet address:
const onboardingData = {
  ...existingData,
  walletAddress: walletAddress || null,
};
```

### Step 3: Update Backend User Schema

**File**: `mvp-workspace/src/api/database/UserStorage.js`

Add `walletAddress` field:

```javascript
class UserStorage {
  constructor() {
    this.users = new Map();
    this.userSchema = {
      id: 'string',
      email: 'string',
      name: 'string',
      walletAddress: 'string', // ADD THIS
      tier: 'string',
      roles: 'array',
      // ... rest of schema
    };
  }
}
```

### Step 4: Update Onboarding Route

**File**: `mvp-workspace/src/api/routes/onboarding.js`

```javascript
router.post('/complete', async (req, res) => {
  const {
    walletAddress, // ADD THIS
    socialLinks = {},
    logo,
    contractAddress,
    chain,
    contractName,
    abi,
    purpose,
    category,
    startDate
  } = req.body;

  // Store wallet address in user
  if (walletAddress) {
    await UserStorage.update(req.user.id, {
      walletAddress: walletAddress
    });
  }

  // Get user's subscription tier using provided wallet address
  let userTier = 'free';
  const effectiveWalletAddress = walletAddress || req.user.walletAddress;
  
  try {
    const subscriptionService = new SubscriptionService();
    if (effectiveWalletAddress && effectiveWalletAddress !== '0x0000000000000000000000000000000000000000') {
      const subscriptionInfo = await subscriptionService.getSubscriptionInfo(effectiveWalletAddress);
      userTier = subscriptionInfo.tierName.toLowerCase();
      console.log(`✅ User subscription tier: ${userTier} (from wallet: ${effectiveWalletAddress})`);
    } else {
      console.warn('⚠️  No wallet address provided, using free tier');
    }
  } catch (error) {
    console.warn('Could not fetch subscription from contract, using free tier:', error.message);
  }

  // Calculate block range with correct wallet address
  const blockRange = await subscriptionBlockRangeCalculator.calculateBlockRange(
    effectiveWalletAddress || '0x0000000000000000000000000000000000000000',
    chain,
    deploymentBlock,
    currentBlock
  );
  
  console.log(`📊 Block range for ${userTier}: ${blockRange.startBlock} → ${blockRange.endBlock} (${blockRange.actualBlocks.toLocaleString()} blocks)`);
  
  // ... rest of onboarding logic
});
```

### Step 5: Add Wallet Address to Auth

**File**: `mvp-workspace/src/api/middleware/auth.js`

Ensure wallet address is included in JWT token:

```javascript
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress, // ADD THIS
      roles: user.roles
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
```

### Step 6: Update Dashboard to Show Mismatch Warning

**File**: `mvp-workspace/frontend/app/dashboard/page.tsx`

Add warning when subscription doesn't match indexed data:

```typescript
{/* Subscription Mismatch Warning */}
{defaultContract.subscription && (
  (() => {
    const expectedDays = defaultContract.subscription.historicalDays;
    const actualDays = Math.floor(defaultContract.blockRange.total / 7200); // Approximate
    const mismatch = expectedDays !== -1 && Math.abs(expectedDays - actualDays) > 5;
    
    return mismatch ? (
      <div className="mb-6">
        <Card className="border-orange-500/50 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Subscription Data Mismatch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700 mb-3">
              Your subscription tier is <strong>{defaultContract.subscription.tier}</strong> ({expectedDays} days),
              but only {actualDays} days of data were indexed.
            </p>
            <Button 
              size="sm" 
              onClick={async () => {
                // Trigger re-indexing with correct subscription
                await api.onboarding.refreshDefaultContract();
                window.location.reload();
              }}
            >
              Re-index with Correct Subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    ) : null;
  })()
)}
```

---

## Testing Checklist

### Before Fix:
- [ ] Dashboard shows "Free" subscription
- [ ] Only 7,000 blocks indexed
- [ ] Subscription widget shows "Pro"
- [ ] Mismatch between widget and dashboard

### After Fix:
- [ ] Onboarding asks to connect wallet
- [ ] Wallet address stored in database
- [ ] Backend fetches correct subscription tier
- [ ] Dashboard shows "Pro" subscription
- [ ] 648,000 blocks indexed (90 days for Pro)
- [ ] Subscription widget matches dashboard
- [ ] No mismatch warning

---

## Quick Fix (Temporary)

If you want to test immediately without implementing full wallet connection:

1. **Manually set wallet address in database**:
```javascript
// In backend console or script:
await UserStorage.update(userId, {
  walletAddress: '0xYourWalletAddress'
});
```

2. **Re-run onboarding**:
```bash
node clean-failed-analysis.js
# Then onboard again through UI
```

3. **Verify**:
- Check backend logs for subscription tier
- Check dashboard for correct block count

---

## Files to Modify

### Frontend:
1. ✅ `frontend/hooks/use-wallet.ts` (NEW)
2. ✅ `frontend/app/onboarding/page.tsx` (UPDATE)
3. ✅ `frontend/app/dashboard/page.tsx` (UPDATE - add mismatch warning)

### Backend:
4. ✅ `src/api/database/UserStorage.js` (UPDATE - add walletAddress field)
5. ✅ `src/api/routes/onboarding.js` (UPDATE - use wallet address)
6. ✅ `src/api/middleware/auth.js` (UPDATE - include wallet in JWT)

---

## Expected Result

After implementing this fix:

```
Dashboard Contract Info:
- Subscription: Pro
- Historical Data: 90 days
- Blocks Indexed: 648,000
- Block Range: 27,520,268 → 28,168,268

Subscription Status Widget:
- Current plan: Pro
- API Calls/Month: 5,000
- Max Projects: 10
- Time Remaining: 15 days

✅ Both match!
```

---

## Alternative: Use Subscription Widget's Wallet

If you don't want to add wallet connection to onboarding, you can:

1. Get wallet address from subscription widget
2. Send it to backend via API
3. Update user's wallet address
4. Trigger re-indexing

This is simpler but requires the user to have the subscription widget loaded first.
