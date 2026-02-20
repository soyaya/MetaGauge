# ✅ Quick Scan Integration with Onboarding

## Changes Made

The minimal server now stores and uses contract details from onboarding:

### 1. Contract Storage
```javascript
let onboardingContract = null; // Stores contract from onboarding
```

### 2. Onboarding Complete
When user completes onboarding, contract details are saved:
```javascript
app.post('/api/onboarding/complete', (req, res) => {
  onboardingCompleted = true;
  onboardingContract = req.body.contract; // Store contract
  ...
});
```

### 3. Quick Sync Uses Onboarding Contract
```javascript
app.post('/api/onboarding/start-quick-sync', (req, res) => {
  const contract = onboardingContract || defaultContract;
  // Quick sync now uses the actual contract from onboarding
  ...
});
```

### 4. Default Contract Returns Onboarding Data
```javascript
app.get('/api/onboarding/default-contract', (req, res) => {
  const contract = onboardingContract || defaultContract;
  // Returns the contract user configured in onboarding
  ...
});
```

---

## How It Works

**Flow:**
1. User completes onboarding with contract details (address, chain, name)
2. Server stores these details in `onboardingContract`
3. Quick Sync uses stored contract details
4. Dashboard shows the actual contract from onboarding

**Benefits:**
- ✅ Quick Sync analyzes the correct contract
- ✅ Dashboard shows user's actual contract
- ✅ Contract details persist during session
- ✅ No hardcoded mock data

---

## To Start Server

**Important:** Only run the minimal server, not the full server:

```bash
# Kill all servers
pkill -9 -f "node.*server"

# Start ONLY minimal server
cd /mnt/c/pr0/meta/mvp-workspace
node server-minimal.js
```

**Or use the script:**
```bash
./run-minimal-only.sh
```

---

## Verify It's Working

```bash
# 1. Check health
curl http://localhost:5000/health
# Should return: {"status":"ok",...}

# 2. Complete onboarding with contract
curl -X POST http://localhost:5000/api/onboarding/complete \
  -H "Content-Type: application/json" \
  -d '{"contract":{"name":"My Contract","address":"0xABC...","chain":"ethereum"}}'

# 3. Check default contract
curl http://localhost:5000/api/onboarding/default-contract
# Should return the contract you just sent

# 4. Start quick sync
curl -X POST http://localhost:5000/api/onboarding/start-quick-sync
# Should use your contract details
```

---

## Summary

✅ **Quick Scan now uses onboarding contract details**  
✅ **Contract data persists during session**  
✅ **Dashboard shows actual user contract**  
✅ **No more hardcoded mock data**  

**The integration is complete!** 🚀
