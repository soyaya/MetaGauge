# Quick Fix Guide for Critical Issues

## Issue #1: ContractConfig is not defined (CRITICAL)

**Location:** `/src/api/routes/contracts.js` lines 434, 496, 554, 576, 590

**Problem:** Code uses `ContractConfig` but only `ContractStorage` is imported

**Current Code:**
```javascript
const config = await ContractConfig.findOne({...});
```

**Fix:** Replace all instances of `ContractConfig` with `ContractStorage`

**Command to fix:**
```bash
cd /mnt/c/pr0/meta/mvp-workspace
sed -i 's/ContractConfig/ContractStorage/g' src/api/routes/contracts.js
```

---

## Issue #2: Missing Onboarding Start Endpoint (CRITICAL)

**Problem:** README documents `POST /api/onboarding/start` but it doesn't exist

**Solution Option A - Add the endpoint:**
Create a new endpoint in `/src/api/routes/onboarding.js`:

```javascript
router.post('/start', async (req, res) => {
  try {
    const { address, chain, name } = req.body;
    
    if (!address || !chain) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'address and chain are required'
      });
    }

    // Create contract via ContractStorage
    const contract = await ContractStorage.create({
      userId: req.user.id,
      name: name || 'My Contract',
      targetContract: { address, chain, name }
    });

    // Start indexing
    const onboardingId = `onboard_${Date.now()}`;
    
    return res.status(200).json({
      onboardingId,
      contractId: contract.id,
      status: 'started'
    });
  } catch (error) {
    console.error('Onboarding start error:', error);
    return res.status(500).json({
      error: 'Failed to start onboarding',
      message: error.message
    });
  }
});
```

**Solution Option B - Update documentation:**
Update README to show correct flow:
```markdown
### Onboarding Flow

1. Create contract:
   POST /api/contracts
   {
     "name": "My Contract",
     "targetContract": {
       "address": "0x...",
       "chain": "ethereum",
       "name": "Contract Name"
     }
   }

2. Complete onboarding:
   POST /api/onboarding/complete
   {
     "defaultContract": {
       "address": "0x...",
       "chain": "ethereum"
     }
   }

3. Check status:
   GET /api/onboarding/status
```

---

## Issue #3: Subscription Endpoints Missing (HIGH)

**Problem:** 
- `GET /api/subscription/status` doesn't exist
- `GET /api/subscription/usage` doesn't exist

**Actual endpoints:**
- `GET /api/subscription/status/:walletAddress`
- `GET /api/subscription/stats`

**Fix:** Update README documentation:

```markdown
### Subscription Endpoints

# Get subscription status (requires wallet address)
GET /api/subscription/status/:walletAddress

# Get usage statistics
GET /api/subscription/stats

# Get available plans
GET /api/subscription/plans
```

---

## Issue #4: Parameter Naming Inconsistencies (HIGH)

**Problems:**
1. Analysis endpoint expects `configurationId` not `contractId`
2. Chat endpoint expects `contractAddress + contractChain` not `contractId`

**Fix Option A - Update code to accept both:**

In `/src/api/routes/analysis.js`:
```javascript
router.post('/start', async (req, res) => {
  const configId = req.body.configurationId || req.body.contractId;
  if (!configId) {
    return res.status(400).json({
      error: 'Missing required field',
      message: 'configurationId or contractId is required'
    });
  }
  // ... rest of code
});
```

In `/src/api/routes/chat.js`:
```javascript
router.post('/sessions', async (req, res) => {
  let { contractAddress, contractChain, contractId } = req.body;
  
  // If contractId provided, look up address and chain
  if (contractId && !contractAddress) {
    const contract = await ContractStorage.findById(contractId);
    if (contract) {
      contractAddress = contract.targetContract.address;
      contractChain = contract.targetContract.chain;
    }
  }
  
  if (!contractAddress || !contractChain) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Either contractId OR (contractAddress + contractChain) required'
    });
  }
  // ... rest of code
});
```

**Fix Option B - Update documentation:**
Document the actual required parameters clearly.

---

## Issue #5: Response Format Inconsistencies (MEDIUM)

**Problem:** Some endpoints return arrays, others return objects with pagination

**Recommendation:** Keep current implementation but document it clearly:

```markdown
### Response Formats

#### Paginated Lists
Endpoints that return lists include pagination metadata:
```json
{
  "contracts": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

#### Single Resources
Endpoints that return single resources may wrap in object:
```json
{
  "user": {...}
}
```
or return directly:
```json
{
  "id": "...",
  "email": "..."
}
```

---

## Quick Fix Script

Run this to fix the most critical issues:

```bash
#!/bin/bash

echo "Fixing MetaGauge Critical Issues..."

# Fix 1: Replace ContractConfig with ContractStorage
echo "1. Fixing ContractConfig undefined error..."
sed -i 's/ContractConfig/ContractStorage/g' src/api/routes/contracts.js
echo "   ✅ Fixed ContractConfig references"

# Fix 2: Restart server to apply changes
echo "2. Restarting server..."
if [ -f backend.pid ]; then
  kill $(cat backend.pid) 2>/dev/null
  sleep 2
fi
npm run dev > backend.log 2>&1 &
echo $! > backend.pid
echo "   ✅ Server restarted"

echo ""
echo "Critical fixes applied!"
echo "Remaining issues require documentation updates or API changes."
echo "See COMPREHENSIVE_TEST_REPORT.md for details."
```

Save as `quick-fix-critical.sh` and run:
```bash
chmod +x quick-fix-critical.sh
./quick-fix-critical.sh
```

---

## Testing After Fixes

Run the comprehensive test again:
```bash
node comprehensive-feature-test.js
```

Expected improvements:
- ✅ Contract update should work
- ❌ Onboarding still needs endpoint or doc update
- ❌ Subscription still needs doc update
- ❌ Parameter naming still needs fix

---

## Priority Order

1. **Fix ContractConfig bug** (5 minutes) ⚡
2. **Update README API docs** (30 minutes) 📝
3. **Add parameter aliases** (1 hour) 🔧
4. **Add onboarding/start endpoint** (1 hour) ➕
5. **Standardize response formats** (2 hours) 🎨

Total estimated time: **4-5 hours**
