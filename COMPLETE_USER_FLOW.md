# Complete User Flow - Current vs Intended

## CURRENT FLOW (What Happens Now)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER AUTHENTICATION                                          │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> User logs in with email/password
   ├─> JWT token issued
   └─> Redirected to dashboard or onboarding
   
┌─────────────────────────────────────────────────────────────────┐
│ 2. ONBOARDING CHECK                                             │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> Check if user.onboarding.completed === true
   │
   ├─> IF NOT COMPLETED:
   │   └─> Redirect to /onboarding
   │
   └─> IF COMPLETED:
       └─> Show dashboard

┌─────────────────────────────────────────────────────────────────┐
│ 3. ONBOARDING PROCESS (if not completed)                        │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> Step 1: User enters contract details
   │   ├─> Contract address
   │   ├─> Chain (Ethereum, Lisk, Starknet)
   │   ├─> Contract name
   │   ├─> Category (DeFi, NFT, etc.)
   │   └─> Purpose description
   │
   ├─> Step 2: System validates contract
   │   ├─> Check if address is valid
   │   ├─> Check if contract exists on chain
   │   └─> Find deployment block
   │
   ├─> Step 3: Save to database
   │   ├─> Save contract config
   │   ├─> Mark onboarding.completed = true
   │   └─> Set onboarding.defaultContract = {...}
   │
   └─> Step 4: Start indexing (MANUAL - via Quick Sync button)
       ├─> ❌ NO automatic indexing
       ├─> ❌ NO subscription tier check
       ├─> ❌ NO block range calculation
       └─> User must click "Quick Sync" button

┌─────────────────────────────────────────────────────────────────┐
│ 4. DASHBOARD (after onboarding)                                 │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> Shows contract info
   ├─> Shows indexing status badge
   │   ├─> "Indexing X%" (if in progress)
   │   └─> "Fully Indexed" (if complete)
   │
   ├─> ❌ Quick Sync button (REMOVED)
   ├─> ❌ Marathon Sync button (REMOVED)
   │
   └─> Shows metrics tabs (if indexed)
       ├─> Overview
       ├─> Metrics
       ├─> Users
       ├─> Transactions
       └─> UX Analysis

┌─────────────────────────────────────────────────────────────────┐
│ 5. DATA FETCHING (when Quick Sync clicked - NOW REMOVED)        │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> Uses SmartBlockRangeSelector
   ├─> Hardcoded strategy: "standard" or "comprehensive"
   ├─> ❌ NO subscription tier check
   ├─> ❌ NO historical data limit enforcement
   │
   └─> Fetches ALL available data (ignores subscription)
```

---

## INTENDED FLOW (What Should Happen - From Spec)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER AUTHENTICATION                                          │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> User logs in with email/password
   ├─> JWT token issued
   ├─> ✅ Check wallet address (for subscription)
   └─> Redirected to dashboard or onboarding

┌─────────────────────────────────────────────────────────────────┐
│ 2. SUBSCRIPTION CHECK (NEW)                                     │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> Read subscription from smart contract
   │   ├─> subscriptionService.getSubscriptionInfo(walletAddress)
   │   └─> Get tier: 0=Free, 1=Starter, 2=Pro, 3=Enterprise
   │
   ├─> Get plan limits
   │   ├─> Free: 7 days historical data
   │   ├─> Starter: 30 days historical data
   │   ├─> Pro: 90 days historical data
   │   └─> Enterprise: All history from deployment
   │
   └─> Store in session/context for later use

┌─────────────────────────────────────────────────────────────────┐
│ 3. ONBOARDING PROCESS                                           │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> Step 1: User enters contract details
   │   ├─> Contract address
   │   ├─> Chain (Ethereum, Lisk, Starknet)
   │   ├─> Contract name
   │   ├─> Category (DeFi, NFT, etc.)
   │   └─> Purpose description
   │
   ├─> Step 2: System validates contract
   │   ├─> Check if address is valid
   │   ├─> Check if contract exists on chain
   │   └─> ✅ Find deployment block (DeploymentBlockFinder)
   │
   ├─> Step 3: ✅ Calculate block range based on subscription
   │   ├─> Get user's subscription tier
   │   ├─> Get historical days limit (7, 30, 90, or all)
   │   ├─> Convert days to blocks:
   │   │   ├─> Ethereum/Lisk: ~7,200 blocks/day
   │   │   └─> Starknet: ~14,400 blocks/day
   │   ├─> Calculate start block:
   │   │   ├─> Free: currentBlock - (7 * 7200) = ~50k blocks
   │   │   ├─> Starter: currentBlock - (30 * 7200) = ~216k blocks
   │   │   ├─> Pro: currentBlock - (90 * 7200) = ~648k blocks
   │   │   └─> Enterprise: deploymentBlock (all history)
   │   └─> Ensure startBlock >= deploymentBlock
   │
   ├─> Step 4: Save to database
   │   ├─> Save contract config
   │   ├─> Save subscription limits
   │   ├─> Save calculated block range
   │   ├─> Mark onboarding.completed = true
   │   └─> Set onboarding.defaultContract = {...}
   │
   └─> Step 5: ✅ AUTOMATIC INDEXING STARTS
       ├─> Create IndexerSession
       ├─> Initialize StreamingIndexer
       ├─> Start chunked indexing (200k blocks per chunk)
       └─> Send real-time updates via WebSocket

┌─────────────────────────────────────────────────────────────────┐
│ 4. STREAMING INDEXER (NEW - Automatic)                          │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> ChunkManager divides range into 200k block chunks
   │   Example for Free tier (50k blocks):
   │   └─> Chunk 1: blocks 0-50,000 (single chunk)
   │
   │   Example for Starter tier (216k blocks):
   │   ├─> Chunk 1: blocks 0-200,000
   │   └─> Chunk 2: blocks 200,000-216,000
   │
   │   Example for Pro tier (648k blocks):
   │   ├─> Chunk 1: blocks 0-200,000
   │   ├─> Chunk 2: blocks 200,000-400,000
   │   ├─> Chunk 3: blocks 400,000-600,000
   │   └─> Chunk 4: blocks 600,000-648,000
   │
   ├─> Process each chunk sequentially
   │   ├─> Fetch transactions (SmartContractFetcher)
   │   ├─> Fetch events (EventFetcher)
   │   ├─> Calculate metrics (MetricsCalculator)
   │   ├─> Validate chunk (ChunkValidator)
   │   └─> Store results (FileStorage)
   │
   ├─> HorizontalValidator checks boundaries
   │   ├─> Verify no gaps between chunks
   │   ├─> Verify no duplicate transactions
   │   └─> Verify transaction ordering
   │
   ├─> WebSocketServer sends real-time updates
   │   ├─> Progress: "Chunk 1/4 - 25% complete"
   │   ├─> Metrics: "Found 1,234 transactions, 567 users"
   │   └─> Completion: "Indexing complete!"
   │
   └─> On completion:
       ├─> Mark session as completed
       ├─> Update user.onboarding.defaultContract.isIndexed = true
       └─> Start continuous monitoring (if tier allows)

┌─────────────────────────────────────────────────────────────────┐
│ 5. DASHBOARD (Real-time Updates)                                │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> WebSocket connection established
   │   └─> Listens for indexing progress updates
   │
   ├─> Shows real-time status
   │   ├─> "Indexing Chunk 1/4 - 25%"
   │   ├─> "Found 1,234 transactions so far..."
   │   └─> Progress bar updates in real-time
   │
   ├─> Shows subscription info
   │   ├─> Current tier (Free, Starter, Pro, Enterprise)
   │   ├─> Historical data limit (7, 30, 90 days, or all)
   │   └─> Block range being indexed
   │
   └─> When indexing completes:
       ├─> Badge changes to "Fully Indexed"
       ├─> Metrics tabs become available
       └─> Shows "Live Monitoring" badge (if tier allows)

┌─────────────────────────────────────────────────────────────────┐
│ 6. CONTINUOUS MONITORING (For Starter/Pro/Enterprise)           │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─> Polls for new blocks every 30 seconds
   │
   ├─> When new block detected:
   │   ├─> Fetch new transactions
   │   ├─> Update metrics incrementally
   │   ├─> Send WebSocket update to frontend
   │   └─> Update "Last updated: X seconds ago"
   │
   └─> Maintains sliding window
       ├─> Free: Always shows last 7 days
       ├─> Starter: Always shows last 30 days
       ├─> Pro: Always shows last 90 days
       └─> Enterprise: Shows all history + new data
```

---

## DETAILED FLOW COMPARISON

### Current Flow Issues ❌

1. **No Automatic Indexing**
   - User must manually click "Quick Sync" button
   - Confusing UX - users don't know what to do
   - Buttons have been removed, leaving no way to start indexing

2. **No Subscription Integration**
   - Subscription service exists but isn't used
   - All users get same data regardless of tier
   - No enforcement of historical data limits

3. **No Real-time Updates**
   - Frontend polls backend every few seconds
   - Inefficient and creates server load
   - Progress updates are delayed

4. **Manual Sync Buttons**
   - Quick Sync and Marathon Sync buttons
   - User has to understand the difference
   - Now removed, breaking the flow

### Intended Flow Benefits ✅

1. **Automatic Indexing**
   - Starts immediately after onboarding
   - No user action required
   - Clear progress indication

2. **Subscription-Aware**
   - Respects tier limits automatically
   - Free users get 7 days (fast indexing)
   - Enterprise users get all history
   - Fair usage enforcement

3. **Real-time Updates**
   - WebSocket connection for instant updates
   - Shows progress as it happens
   - Efficient server usage

4. **Continuous Monitoring**
   - Automatically tracks new blocks
   - Keeps data fresh
   - No manual refresh needed

---

## USER EXPERIENCE COMPARISON

### Current Experience (Broken)

```
User: "I just added my contract, where's my data?"
System: "..." (no indexing happening)
User: "There used to be sync buttons, where did they go?"
System: "..." (buttons removed)
User: "How do I get my analytics?"
System: "..." (no clear path forward)
```

### Intended Experience (Smooth)

```
User: "I just added my contract"
System: "✅ Contract validated! Starting indexing..."
        "📊 Your Free tier includes 7 days of history"
        "⏳ Indexing chunk 1/1 - 45%..."
        "📈 Found 234 transactions, 89 users so far..."
        "✅ Indexing complete! View your analytics below."

User: "That was easy! Can I get more history?"
System: "Upgrade to Starter for 30 days, Pro for 90 days, 
         or Enterprise for complete history!"
```

---

## SUBSCRIPTION TIER EXAMPLES

### Free Tier (7 Days)
```
User subscribes: Free tier
Contract deployed: Block 1,000,000
Current block: 1,500,000

Calculation:
- Historical days: 7
- Blocks per day: 7,200
- Max blocks: 7 × 7,200 = 50,400
- Start block: 1,500,000 - 50,400 = 1,449,600
- End block: 1,500,000

Indexing:
- Single chunk: 1,449,600 → 1,500,000 (50,400 blocks)
- Time: ~2-3 minutes
- Result: Last 7 days of data
```

### Starter Tier (30 Days)
```
User subscribes: Starter tier
Contract deployed: Block 1,000,000
Current block: 1,500,000

Calculation:
- Historical days: 30
- Blocks per day: 7,200
- Max blocks: 30 × 7,200 = 216,000
- Start block: 1,500,000 - 216,000 = 1,284,000
- End block: 1,500,000

Indexing:
- Chunk 1: 1,284,000 → 1,484,000 (200,000 blocks)
- Chunk 2: 1,484,000 → 1,500,000 (16,000 blocks)
- Time: ~8-10 minutes
- Result: Last 30 days of data
- Continuous monitoring: ✅ Enabled
```

### Pro Tier (90 Days)
```
User subscribes: Pro tier
Contract deployed: Block 1,000,000
Current block: 1,500,000

Calculation:
- Historical days: 90
- Blocks per day: 7,200
- Max blocks: 90 × 7,200 = 648,000
- Start block: 1,500,000 - 648,000 = 852,000
- But deployment was at 1,000,000
- So start block: 1,000,000 (can't go before deployment)
- End block: 1,500,000

Indexing:
- Chunk 1: 1,000,000 → 1,200,000 (200,000 blocks)
- Chunk 2: 1,200,000 → 1,400,000 (200,000 blocks)
- Chunk 3: 1,400,000 → 1,500,000 (100,000 blocks)
- Time: ~15-20 minutes
- Result: All available data (contract is only 500k blocks old)
- Continuous monitoring: ✅ Enabled
```

### Enterprise Tier (All History)
```
User subscribes: Enterprise tier
Contract deployed: Block 500,000
Current block: 2,000,000

Calculation:
- Historical days: -1 (unlimited)
- Start block: 500,000 (deployment block)
- End block: 2,000,000

Indexing:
- Chunk 1: 500,000 → 700,000 (200,000 blocks)
- Chunk 2: 700,000 → 900,000 (200,000 blocks)
- Chunk 3: 900,000 → 1,100,000 (200,000 blocks)
- Chunk 4: 1,100,000 → 1,300,000 (200,000 blocks)
- Chunk 5: 1,300,000 → 1,500,000 (200,000 blocks)
- Chunk 6: 1,500,000 → 1,700,000 (200,000 blocks)
- Chunk 7: 1,700,000 → 1,900,000 (200,000 blocks)
- Chunk 8: 1,900,000 → 2,000,000 (100,000 blocks)
- Time: ~45-60 minutes
- Result: Complete history from deployment
- Continuous monitoring: ✅ Enabled
```

---

## IMPLEMENTATION STATUS

| Component | Current | Intended | Status |
|-----------|---------|----------|--------|
| Authentication | ✅ Working | ✅ Working | Complete |
| Onboarding | ✅ Working | ✅ Working | Complete |
| Subscription Service | ✅ Exists | ✅ Integrated | **Needs Integration** |
| Block Range Calculator | ❌ Missing | ✅ Required | **To Build** |
| Automatic Indexing | ❌ Missing | ✅ Required | **To Build** |
| Streaming Indexer | ❌ Missing | ✅ Required | **To Build** |
| Chunk Manager | ❌ Missing | ✅ Required | **To Build** |
| WebSocket Updates | ❌ Missing | ✅ Required | **To Build** |
| Continuous Monitoring | ⚠️ Partial | ✅ Required | **Needs Completion** |
| Dashboard UI | ✅ Working | ⚠️ Needs WS | **Needs Update** |

---

## NEXT STEPS

To implement the intended flow, we need to execute the tasks in:
`.kiro/specs/multi-chain-streaming-indexer/tasks.md`

Key tasks:
1. **Task 1**: Subscription-aware block range calculator
2. **Task 2**: Streaming indexer core
3. **Task 3**: Chunk manager with 200k block chunks
4. **Task 4**: WebSocket server for real-time updates
5. **Task 5**: Integrate with onboarding
6. **Task 6**: Update dashboard UI for WebSocket
7. **Task 7**: Continuous monitoring service

Would you like to start implementing these tasks?
