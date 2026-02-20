# Simple Wallet Address Sync Fix

## Problem
Dashboard shows "Free" but Subscription widget shows "Pro" because:
- Subscription widget: Uses connected wallet → Reads from smart contract → Shows "Pro" ✅
- Dashboard: Backend has no wallet address → Falls back to Free → Shows "Free" ❌

## Simple Solution
1. Add `walletAddress` to user database
2. Frontend sends wallet address to backend when available
3. Backend queries smart contract with that wallet address
4. Both show same subscription from smart contract

---

## Implementation

### Step 1: Add API Endpoint to Save Wallet Address

**File**: `mvp-workspace/src/api/routes/user.js` (NEW or UPDATE)

```javascript
import express from 'express';
import { UserStorage } from '../database/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Update user's wallet address
 */
router.post('/wallet-address', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    // Update user with wallet address
    const updatedUser = await UserStorage.update(req.user.id, {
      walletAddress: walletAddress
    });

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    console.log(`✅ Updated wallet address for user ${req.user.id}: ${walletAddress}`);

    res.json({
      message: 'Wallet address updated successfully',
      walletAddress: updatedUser.walletAddress
    });

  } catch (error) {
    console.error('Error updating wallet address:', error);
    res.status(500).json({
      error: 'Failed to update wallet address',
      message: error.message
    });
  }
});

/**
 * Get user's wallet address
 */
router.get('/wallet-address', authenticateToken, async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      walletAddress: user.walletAddress || null
    });

  } catch (error) {
    console.error('Error getting wallet address:', error);
    res.status(500).json({
      error: 'Failed to get wallet address',
      message: error.message
    });
  }
});

export default router;
```

### Step 2: Register User Routes

**File**: `mvp-workspace/src/api/index.js`

```javascript
import userRoutes from './routes/user.js';

// ... existing code ...

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/user', userRoutes); // ADD THIS
app.use('/api/subscription', subscriptionRoutes);
// ... rest of routes
```

### Step 3: Frontend - Send Wallet Address When Connected

**File**: `mvp-workspace/frontend/app/dashboard/page.tsx`

Add this effect to sync wallet address:

```typescript
import { useAccount } from 'wagmi'

export default function DashboardPage() {
  const { address: walletAddress } = useAccount()
  
  // Sync wallet address to backend when connected
  useEffect(() => {
    if (walletAddress && isAuthenticated) {
      syncWalletAddress(walletAddress)
    }
  }, [walletAddress, isAuthenticated])

  const syncWalletAddress = async (address: string) => {
    try {
      await api.user.updateWalletAddress(address)
      console.log('✅ Wallet address synced to backend')
      
      // Reload contract data to get updated subscription
      await loadDefaultContractData()
    } catch (error) {
      console.error('Failed to sync wallet address:', error)
    }
  }

  // ... rest of component
}
```

### Step 4: Add API Method

**File**: `mvp-workspace/frontend/lib/api.ts`

```typescript
export const api = {
  // ... existing methods ...
  
  user: {
    updateWalletAddress: async (walletAddress: string) => {
      const response = await fetch(`${API_URL}/api/user/wallet-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ walletAddress })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update wallet address')
      }
      
      return response.json()
    },
    
    getWalletAddress: async () => {
      const response = await fetch(`${API_URL}/api/user/wallet-address`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to get wallet address')
      }
      
      return response.json()
    }
  },
  
  // ... rest of api methods
}
```

### Step 5: Update Onboarding to Use Wallet Address

**File**: `mvp-workspace/src/api/routes/onboarding.js`

In the `/complete` endpoint, use the stored wallet address:

```javascript
router.post('/complete', async (req, res) => {
  // ... existing code ...

  // Get user to check for wallet address
  const user = await UserStorage.findById(req.user.id);
  const effectiveWalletAddress = user.walletAddress || '0x0000000000000000000000000000000000000000';
  
  console.log(`🔍 Using wallet address: ${effectiveWalletAddress}`);

  // Get user's subscription tier from smart contract
  let userTier = 'free';
  try {
    const subscriptionService = new SubscriptionService();
    if (effectiveWalletAddress && effectiveWalletAddress !== '0x0000000000000000000000000000000000000000') {
      const subscriptionInfo = await subscriptionService.getSubscriptionInfo(effectiveWalletAddress);
      userTier = subscriptionInfo.tierName.toLowerCase();
      console.log(`✅ User subscription tier: ${userTier}`);
    } else {
      console.warn('⚠️  No wallet address found, using free tier');
    }
  } catch (error) {
    console.warn('Could not fetch subscription from contract, using free tier:', error.message);
  }

  // Calculate block range with wallet address
  const blockRange = await subscriptionBlockRangeCalculator.calculateBlockRange(
    effectiveWalletAddress,
    chain,
    deploymentBlock,
    currentBlock
  );
  
  console.log(`📊 Block range for ${userTier}: ${blockRange.startBlock} → ${blockRange.endBlock} (${blockRange.actualBlocks.toLocaleString()} blocks)`);
  
  // ... rest of onboarding logic
});
```

### Step 6: Update `/default-contract` Endpoint

**File**: `mvp-workspace/src/api/routes/onboarding.js`

```javascript
router.get('/default-contract', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    
    // ... existing code to get contract and analysis ...

    // Get fresh subscription info from smart contract if wallet is connected
    let subscriptionFromContract = null;
    if (user.walletAddress && user.walletAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        const subscriptionService = new SubscriptionService();
        const subInfo = await subscriptionService.getSubscriptionInfo(user.walletAddress);
        
        subscriptionFromContract = {
          tier: subInfo.tierName,
          tierNumber: subInfo.tier,
          historicalDays: getTierHistoricalDays(subInfo.tier),
          continuousSync: subInfo.tier > 0, // Starter and above
          isActive: subInfo.isActive,
          endTime: subInfo.endTime,
          daysRemaining: subInfo.daysRemaining
        };
        
        console.log(`✅ Fetched subscription from contract: ${subInfo.tierName}`);
      } catch (error) {
        console.warn('Could not fetch subscription from contract:', error.message);
      }
    }

    res.json({
      contract: defaultContract,
      metrics: latestAnalysis?.results?.target?.metrics || null,
      fullResults: latestAnalysis?.results?.target || null,
      indexingStatus: {
        isIndexed: defaultContract.isIndexed,
        progress: defaultContract.indexingProgress
      },
      // Use subscription from contract if available, otherwise from metadata
      subscription: subscriptionFromContract || latestAnalysis?.metadata?.subscription || {
        tier: 'Free',
        tierNumber: 0,
        historicalDays: 7,
        continuousSync: false
      },
      blockRange: latestAnalysis?.metadata?.blockRange || null,
      analysisHistory: {
        total: defaultContractAnalyses.length,
        completed: defaultContractAnalyses.filter(a => a.status === 'completed').length,
        latest: latestAnalysis ? {
          id: latestAnalysis.id,
          status: latestAnalysis.status,
          createdAt: latestAnalysis.createdAt,
          completedAt: latestAnalysis.completedAt,
          hasError: !!(latestAnalysis.results?.target?.metrics?.error)
        } : null
      },
      analysisError: latestAnalysis?.results?.target?.metrics?.error || null
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get default contract data',
      message: error.message
    });
  }
});

// Helper function
function getTierHistoricalDays(tier) {
  const days = {
    0: 7,    // Free
    1: 30,   // Starter
    2: 90,   // Pro
    3: -1    // Enterprise (all history)
  };
  return days[tier] || 7;
}
```

---

## Testing Steps

### 1. Connect Wallet
- Open dashboard
- Wallet should auto-connect (if using Wagmi)
- Check browser console for: "✅ Wallet address synced to backend"

### 2. Verify Backend Has Wallet
Check backend logs for:
```
✅ Updated wallet address for user <id>: 0x...
```

### 3. Re-onboard or Refresh
- Delete old analysis: `node clean-failed-analysis.js`
- Onboard again
- Backend should log:
```
🔍 Using wallet address: 0x...
✅ User subscription tier: pro
📊 Block range for pro: ... (648,000 blocks)
```

### 4. Check Dashboard
Both should now show:
- **Contract Info**: Subscription: Pro, Historical Data: 90 days
- **Subscription Widget**: Current plan: Pro

---

## Quick Test Script

**File**: `mvp-workspace/test-wallet-sync.js`

```javascript
import { UserStorage } from './src/api/database/index.js';
import SubscriptionService from './src/services/SubscriptionService.js';

async function testWalletSync() {
  console.log('🧪 Testing Wallet Sync...\n');
  
  // 1. Set wallet address for user
  const userId = 'your-user-id'; // Replace with actual user ID
  const walletAddress = '0xYourWalletAddress'; // Replace with your wallet
  
  console.log(`1️⃣ Setting wallet address for user ${userId}...`);
  await UserStorage.update(userId, { walletAddress });
  console.log(`✅ Wallet address set\n`);
  
  // 2. Fetch subscription from contract
  console.log(`2️⃣ Fetching subscription from smart contract...`);
  const subscriptionService = new SubscriptionService();
  const subInfo = await subscriptionService.getSubscriptionInfo(walletAddress);
  
  console.log(`✅ Subscription Info:`);
  console.log(`   Tier: ${subInfo.tierName}`);
  console.log(`   Active: ${subInfo.isActive}`);
  console.log(`   Days Remaining: ${subInfo.daysRemaining}`);
  console.log(`\n✅ Test complete!`);
}

testWalletSync().catch(console.error);
```

Run: `node test-wallet-sync.js`

---

## Result

After this fix:
- ✅ Wallet address stored in database
- ✅ Backend queries smart contract with wallet address
- ✅ Dashboard shows correct subscription (Pro, 90 days)
- ✅ Subscription widget shows same (Pro)
- ✅ Correct amount of data indexed (648,000 blocks for Pro)
- ✅ Both sources match!
