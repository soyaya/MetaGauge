# Complete Flow Analysis - Continuous Indexer

## Overview
Comprehensive analysis of the entire flow from contract addition to metrics display, ensuring proper RPC routing and no missing pieces.

---

## Flow 1: User Onboarding (First Time)

### Step 1: User Registration
**Location**: `frontend/app/auth/register/page.tsx`
```
User fills form → POST /api/auth/register → User created in database
```

**Data Created**:
```javascript
{
  id: "user-id",
  email: "user@example.com",
  name: "User Name",
  tier: "free",
  onboarding: {
    completed: false,  // Not yet onboarded
    defaultContract: null
  }
}
```

---

### Step 2: User Login
**Location**: `frontend/app/auth/login/page.tsx`
```
User logs in → POST /api/auth/login → JWT token → Redirect to /dashboard
```

---

### Step 3: Onboarding Check
**Location**: `frontend/app/dashboard/page.tsx`
```
Dashboard loads → GET /api/onboarding/status → Check if onboarding.completed
```

**If NOT completed**: Redirect to `/onboarding`

---

### Step 4: Onboarding Form
**Location**: `frontend/app/onboarding/page.tsx`

**User Provides**:
1. Contract Address (e.g., `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`)
2. **Chain** (e.g., `lisk`, `ethereum`, `starknet`) ← **CRITICAL**
3. Contract Name
4. Contract Purpose
5. Category (defi, nft, gaming, etc.)
6. Start Date
7. Optional: ABI, Social Links, Logo

**Submission**:
```
POST /api/onboarding/complete
{
  contractAddress: "0x...",
  chain: "lisk",  ← CRITICAL: Determines which RPC to use
  contractName: "My Contract",
  purpose: "...",
  category: "defi",
  startDate: "2024-01-01",
  abi: "[...]",  // Optional
  socialLinks: { ... },
  logo: "..."
}
```

---

### Step 5: Backend Onboarding Processing
**Location**: `mvp-workspace/src/api/routes/onboarding.js`

**What Happens**:
```javascript
router.post('/complete', async (req, res) => {
  const { contractAddress, chain, contractName, ... } = req.body;
  
  // 1. Validate inputs
  if (!contractAddress || !chain || !contractName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // 2. Update user with onboarding data
  await UserStorage.update(req.user.id, {
    onboarding: {
      completed: true,
      defaultContract: {
        address: contractAddress,
        chain: chain,  // ← STORED: Will be used for RPC routing
        name: contractName,
        purpose: purpose,
        category: category,
        startDate: startDate,
        isIndexed: false,
        indexingProgress: 0
      }
    }
  });
  
  // 3. Create contract configuration
  const contractConfig = {
    userId: req.user.id,
    name: contractName,
    targetContract: {
      address: contractAddress,
      chain: chain,  // ← STORED: RPC routing key
      name: contractName,
      abi: abi
    },
    rpcConfig: getDefaultRpcConfig(),  // ← Gets ALL chain RPCs
    analysisParams: getDefaultAnalysisParams(),
    isDefault: true
  };
  
  await ContractStorage.create(contractConfig);
  
  // 4. Redirect to dashboard
  res.json({ message: 'Onboarding completed' });
});
```

**Data Created**:
```javascript
// User object updated
{
  onboarding: {
    completed: true,
    defaultContract: {
      address: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      chain: "lisk",  // ← KEY: Determines RPC routing
      name: "My Contract",
      isIndexed: false,
      indexingProgress: 0
    }
  }
}

// Contract config created
{
  id: "contract-config-id",
  userId: "user-id",
  targetContract: {
    address: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    chain: "lisk",  // ← KEY: RPC routing
    name: "My Contract"
  },
  rpcConfig: {
    ethereum: ["https://eth.rpc1.com", "https://eth.rpc2.com"],
    lisk: ["https://lisk.rpc1.com", "https://lisk.rpc2.com"],
    starknet: ["https://starknet.rpc1.com"]
  },
  isDefault: true
}
```

---

## Flow 2: Dashboard & Indexing

### Step 6: Dashboard Loads
**Location**: `frontend/app/dashboard/page.tsx`

```
Dashboard loads → GET /api/onboarding/status → onboarding.completed = true
                → GET /api/onboarding/default-contract → Get contract info
                → GET /api/onboarding/user-metrics → Get user stats
```

**Response from `/default-contract`**:
```javascript
{
  contract: {
    address: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    chain: "lisk",  // ← CRITICAL: Frontend knows which chain
    name: "My Contract",
    isIndexed: false,
    indexingProgress: 0
  },
  metrics: null,  // No metrics yet
  indexingStatus: {
    isIndexed: false,
    progress: 0
  }
}
```

**UI Shows**:
- Contract info card
- "Start Indexing" button (not indexed yet)
- No metrics (empty state)

---

### Step 7: User Clicks "Start Indexing"
**Location**: `frontend/app/dashboard/page.tsx`

```javascript
const startIndexing = async () => {
  setIndexing(true);
  
  // Call backend to start indexing
  const response = await api.onboarding.startIndexing();
  
  // Start polling for progress
  startPolling();
};
```

**API Call**:
```
POST /api/onboarding/start-indexing
{
  // No body needed - uses user's default contract
}
```

---

### Step 8: Backend Starts Indexing
**Location**: `mvp-workspace/src/api/routes/onboarding.js`

```javascript
router.post('/start-indexing', async (req, res) => {
  // 1. Get user's default contract
  const user = await UserStorage.findById(req.user.id);
  const defaultContract = user.onboarding.defaultContract;
  const contractAddress = defaultContract.address;
  const chain = defaultContract.chain;  // ← CRITICAL: "lisk"
  
  // 2. Get contract configuration
  const contractConfig = await ContractStorage.findByUserId(req.user.id)
    .find(c => c.isDefault);
  
  // 3. Initialize RPC client for the SPECIFIC chain
  const rpcConfig = contractConfig.rpcConfig[chain];  // ← Get ONLY lisk RPCs
  
  // 4. Create SmartContractFetcher with chain isolation
  const fetcher = new SmartContractFetcher({
    targetChain: chain,  // ← CRITICAL: Only initialize lisk providers
    rpcConfig: rpcConfig
  });
  
  // 5. Find deployment block
  const deploymentFinder = new DeploymentBlockFinder(fetcher);
  const currentBlock = await fetcher.getCurrentBlockNumber();
  const deploymentBlock = await deploymentFinder.findDeploymentBlockWithLimit(
    contractAddress,
    currentBlock,
    1  // 1 month back
  );
  
  // 6. Create analysis record
  const analysis = await AnalysisStorage.create({
    userId: req.user.id,
    configId: contractConfig.id,
    status: 'indexing',
    indexing: {
      deploymentBlock: deploymentBlock,
      startBlock: deploymentBlock,
      currentBlock: currentBlock,
      lastIndexedBlock: deploymentBlock,
      totalBlocks: currentBlock - deploymentBlock,
      blocksIndexed: 0,
      progress: 0,
      isComplete: false
    }
  });
  
  // 7. Start indexing in background
  startChunkBasedIndexing(analysis.id, contractConfig, chain);
  
  // 8. Return immediately
  res.json({
    message: 'Indexing started',
    analysisId: analysis.id,
    deploymentBlock: deploymentBlock,
    totalBlocks: currentBlock - deploymentBlock
  });
});
```

---

### Step 9: Chunk-Based Indexing (Background)
**Location**: `mvp-workspace/src/services/ContinuousIndexer.js` (NEW FILE)

```javascript
async function startChunkBasedIndexing(analysisId, contractConfig, chain) {
  const analysis = await AnalysisStorage.findById(analysisId);
  const { deploymentBlock, currentBlock } = analysis.indexing;
  
  const CHUNK_SIZE = 10000;
  const totalBlocks = currentBlock - deploymentBlock;
  const totalChunks = Math.ceil(totalBlocks / CHUNK_SIZE);
  
  // Initialize cumulative metrics calculator
  const metricsCalculator = new CumulativeMetricsCalculator();
  
  // Initialize RPC fetcher with SPECIFIC chain
  const fetcher = new SmartContractFetcher({
    targetChain: chain,  // ← CRITICAL: Only use this chain's RPCs
    rpcConfig: contractConfig.rpcConfig[chain]
  });
  
  // Process each chunk
  for (let i = 0; i < totalChunks; i++) {
    const chunkStart = deploymentBlock + (i * CHUNK_SIZE);
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, currentBlock);
    
    console.log(`🔍 Processing chunk ${i+1}/${totalChunks}: ${chunkStart}-${chunkEnd}`);
    
    // Fetch chunk data using chain-specific RPC
    const chunkData = await fetcher.fetchTransactions(
      contractConfig.targetContract.address,
      chunkStart,
      chunkEnd
    );
    
    // Calculate cumulative metrics
    const metrics = metricsCalculator.addChunk(chunkData);
    
    // Save partial results
    await AnalysisStorage.update(analysisId, {
      indexing: {
        ...analysis.indexing,
        lastIndexedBlock: chunkEnd,
        blocksIndexed: (i + 1) * CHUNK_SIZE,
        progress: ((i + 1) / totalChunks) * 100,
        chunksProcessed: i + 1,
        totalChunks: totalChunks
      },
      results: {
        target: {
          contract: contractConfig.targetContract,
          metrics: {
            ...metrics,
            isPartial: true,
            lastUpdated: new Date().toISOString()
          }
        }
      }
    });
    
    // Update user's indexing progress
    await UserStorage.update(analysis.userId, {
      'onboarding.defaultContract.indexingProgress': ((i + 1) / totalChunks) * 100
    });
  }
  
  // Mark as complete
  await AnalysisStorage.update(analysisId, {
    status: 'indexed',
    'indexing.isComplete': true,
    'indexing.completedAt': new Date().toISOString(),
    'results.target.metrics.isPartial': false
  });
  
  await UserStorage.update(analysis.userId, {
    'onboarding.defaultContract.isIndexed': true,
    'onboarding.defaultContract.indexingProgress': 100
  });
  
  console.log(`✅ Indexing complete for analysis ${analysisId}`);
}
```

---

### Step 10: Frontend Polling
**Location**: `frontend/app/dashboard/page.tsx`

```javascript
useEffect(() => {
  if (!indexing) return;
  
  const pollInterval = setInterval(async () => {
    try {
      // Get updated contract data
      const data = await api.onboarding.getDefaultContract();
      
      // Update state
      setDefaultContract(data);
      setIndexingProgress(data.indexingStatus.progress);
      
      // Check if complete
      if (data.indexingStatus.isIndexed) {
        setIndexing(false);
        clearInterval(pollInterval);
        
        // Show success message
        toast.success('Indexing complete!');
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 3000);  // Poll every 3 seconds
  
  return () => clearInterval(pollInterval);
}, [indexing]);
```

---

## Critical: RPC Chain Routing

### How Chain Routing Works

#### 1. Chain Stored at Onboarding
```javascript
// User provides during onboarding
{
  contractAddress: "0x...",
  chain: "lisk"  // ← USER INPUT
}

// Stored in user object
user.onboarding.defaultContract.chain = "lisk"

// Stored in contract config
contractConfig.targetContract.chain = "lisk"
```

#### 2. RPC Config Structure
```javascript
// In contract config
{
  rpcConfig: {
    ethereum: [
      "https://eth.rpc1.com",
      "https://eth.rpc2.com"
    ],
    lisk: [
      "https://lisk.rpc1.com",
      "https://lisk.rpc2.com",
      "https://lisk.rpc3.com"
    ],
    starknet: [
      "https://starknet.rpc1.com"
    ]
  }
}
```

#### 3. RPC Selection During Indexing
```javascript
// Get the chain from contract
const chain = contractConfig.targetContract.chain;  // "lisk"

// Get ONLY the RPCs for that chain
const chainRpcs = contractConfig.rpcConfig[chain];  // ["https://lisk.rpc1.com", ...]

// Initialize fetcher with ONLY those RPCs
const fetcher = new SmartContractFetcher({
  targetChain: chain,  // "lisk"
  rpcConfig: chainRpcs  // Only lisk RPCs
});
```

#### 4. SmartContractFetcher Chain Isolation
**Location**: `mvp-workspace/src/services/SmartContractFetcher.js`

```javascript
constructor(config = {}) {
  this.config = {
    targetChain: config.targetChain || null,  // "lisk"
    ...config
  };
  
  // Provider configs by chain
  this.providerConfigs = {
    ethereum: [...],
    lisk: [...],
    starknet: [...]
  };
  
  this._initializeProviders();
}

_initializeProviders() {
  // If target chain specified, only initialize that chain
  if (this.config.targetChain) {
    console.log(`🎯 Chain Isolation: Initializing ONLY ${this.config.targetChain} providers`);
    
    const chainConfigs = this.providerConfigs[this.config.targetChain];
    this._initializeChainProviders(this.config.targetChain, chainConfigs);
    
    console.log(`✅ Initialized ${chainConfigs.length} providers for ${this.config.targetChain}`);
    console.log(`⚠️  Other chains will NOT be initialized`);
  } else {
    // Initialize all chains (for multi-chain analysis)
    this._initializeAllChains();
  }
}
```

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ONBOARDING                                          │
├─────────────────────────────────────────────────────────────┤
│ User Input:                                                 │
│   - Contract Address: 0x1231...                            │
│   - Chain: "lisk" ← CRITICAL                               │
│   - Name, Purpose, Category, etc.                          │
│                                                             │
│ Stored in Database:                                         │
│   user.onboarding.defaultContract.chain = "lisk"           │
│   contractConfig.targetContract.chain = "lisk"             │
│   contractConfig.rpcConfig = { lisk: [...], eth: [...] }  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. DASHBOARD LOADS                                          │
├─────────────────────────────────────────────────────────────┤
│ GET /api/onboarding/default-contract                       │
│   Returns: { contract: { chain: "lisk", ... } }           │
│                                                             │
│ UI Shows:                                                   │
│   - Contract info (chain: lisk)                            │
│   - "Start Indexing" button                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. USER CLICKS "START INDEXING"                            │
├─────────────────────────────────────────────────────────────┤
│ POST /api/onboarding/start-indexing                        │
│                                                             │
│ Backend:                                                    │
│   1. Get contract config                                   │
│   2. Extract chain: "lisk"                                 │
│   3. Get lisk RPCs: contractConfig.rpcConfig["lisk"]      │
│   4. Initialize SmartContractFetcher(targetChain: "lisk") │
│   5. Find deployment block (using lisk RPCs)              │
│   6. Create analysis record                                │
│   7. Start background indexing                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. BACKGROUND INDEXING                                      │
├─────────────────────────────────────────────────────────────┤
│ For each chunk (10,000 blocks):                            │
│   1. Fetch transactions (using ONLY lisk RPCs)            │
│   2. Calculate cumulative metrics                          │
│   3. Save partial results to database                      │
│   4. Update progress                                        │
│                                                             │
│ SmartContractFetcher ensures:                              │
│   - Only lisk providers initialized                        │
│   - Only lisk RPCs called                                  │
│   - Automatic failover between lisk RPCs                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. FRONTEND POLLING                                         │
├─────────────────────────────────────────────────────────────┤
│ Every 3 seconds:                                            │
│   GET /api/onboarding/default-contract                     │
│   - Get updated metrics                                     │
│   - Get progress percentage                                 │
│   - Update UI in real-time                                  │
│                                                             │
│ When complete:                                              │
│   - Stop polling                                            │
│   - Show "Fully Indexed" badge                             │
│   - Display all metrics                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points to NOT Miss

### ✅ 1. Chain Storage
- Store chain during onboarding
- Store in both user object and contract config
- Use as key for RPC routing

### ✅ 2. RPC Configuration
- Store RPCs for ALL chains in config
- Select ONLY the contract's chain RPCs during indexing
- Pass `targetChain` to SmartContractFetcher

### ✅ 3. Chain Isolation
- SmartContractFetcher must respect `targetChain`
- Only initialize providers for that chain
- Never call RPCs for other chains

### ✅ 4. Deployment Block Finding
- Use chain-specific RPC client
- Block explorer API must match chain
- Binary search uses correct chain

### ✅ 5. Progress Updates
- Save after each chunk
- Update both analysis and user objects
- Include progress percentage

### ✅ 6. Frontend Polling
- Poll every 2-3 seconds
- Stop when complete
- Handle errors gracefully

### ✅ 7. Metrics Calculation
- Cumulative approach
- Mark as partial until complete
- Include lastUpdated timestamp

### ✅ 8. Error Handling
- RPC failures → try next RPC
- Chunk failures → retry with backoff
- Save progress → can resume

---

## Files That Need Chain Awareness

### Backend
1. ✅ `src/api/routes/onboarding.js` - Extract chain, pass to fetcher
2. ✅ `src/services/SmartContractFetcher.js` - Respect targetChain
3. ✅ `src/services/DeploymentBlockFinder.js` - Use correct chain API
4. ⏳ `src/services/ContinuousIndexer.js` - NEW: Chunk-based indexing
5. ⏳ `src/services/CumulativeMetricsCalculator.js` - NEW: Metrics calculation

### Frontend
1. ✅ `frontend/app/onboarding/page.tsx` - Collect chain from user
2. ✅ `frontend/app/dashboard/page.tsx` - Display chain, poll for updates
3. ✅ `frontend/lib/api.ts` - API client methods

---

## Testing Checklist

### Chain Routing
- [ ] Lisk contract uses only Lisk RPCs
- [ ] Ethereum contract uses only Ethereum RPCs
- [ ] Starknet contract uses only Starknet RPCs
- [ ] No cross-chain RPC calls
- [ ] Failover works within same chain

### Indexing
- [ ] Deployment block found correctly
- [ ] Chunks processed in order
- [ ] Progress updates saved
- [ ] Metrics calculated correctly
- [ ] Completes successfully

### Frontend
- [ ] Chain displayed correctly
- [ ] Progress updates in real-time
- [ ] Metrics appear progressively
- [ ] Polling stops on completion
- [ ] Error handling works

---

**Status**: Complete Flow Documented
**Next**: Implement ContinuousIndexer and CumulativeMetricsCalculator
