# Continuous Streaming Indexer - Implementation Plan

## Overview
Build a continuous blockchain indexer that starts from contract deployment, fetches all historical data up to 1 month, and keeps updating with new blocks in real-time while displaying metrics progressively.

---

## Current vs Target Behavior

### Current (Quick Sync)
```
1. Look back 1-2 days from current block
2. Fetch ~50,000 blocks
3. Calculate metrics once
4. Display results
5. Done (static data)
```

### Target (Continuous Indexer)
```
1. Find contract deployment block
2. Start indexing from deployment → current block
3. Process in chunks (e.g., 10,000 blocks per chunk)
4. Update metrics after each chunk
5. Display metrics in real-time
6. When caught up, keep monitoring for new blocks
7. Auto-update as new blocks arrive
```

---

## Architecture

### Phase 1: Historical Indexing (Deployment → Current)

#### 1.1 Find Deployment Block
**Goal**: Determine when the contract was deployed

**Approach**:
```javascript
// Binary search to find first transaction
async function findDeploymentBlock(contractAddress, chain) {
  const currentBlock = await getCurrentBlockNumber();
  const genesisBlock = 0; // or chain-specific genesis
  
  // Binary search for first transaction
  let left = genesisBlock;
  let right = currentBlock;
  let deploymentBlock = null;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const hasActivity = await checkBlockForActivity(contractAddress, mid);
    
    if (hasActivity) {
      deploymentBlock = mid;
      right = mid - 1; // Look for earlier activity
    } else {
      left = mid + 1;
    }
  }
  
  return deploymentBlock;
}
```

**Alternative**: Use block explorer API
```javascript
// Faster but requires API
const deploymentTx = await fetch(
  `https://blockscout.lisk.com/api/v2/addresses/${contractAddress}/transactions?filter=to`
);
const firstTx = deploymentTx.items[deploymentTx.items.length - 1];
const deploymentBlock = firstTx.block;
```

#### 1.2 Chunk-Based Indexing
**Goal**: Process historical data in manageable chunks

**Strategy**:
```javascript
const CHUNK_SIZE = 10000; // blocks per chunk
const MAX_HISTORY = 30 * 24 * 60 * 60 / 12; // ~1 month in blocks (12s per block)

async function indexHistoricalData(contractAddress, deploymentBlock, currentBlock) {
  // Limit to last 1 month
  const startBlock = Math.max(deploymentBlock, currentBlock - MAX_HISTORY);
  const totalBlocks = currentBlock - startBlock;
  const chunks = Math.ceil(totalBlocks / CHUNK_SIZE);
  
  console.log(`📊 Indexing ${totalBlocks} blocks in ${chunks} chunks`);
  
  for (let i = 0; i < chunks; i++) {
    const chunkStart = startBlock + (i * CHUNK_SIZE);
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, currentBlock);
    
    console.log(`🔍 Processing chunk ${i+1}/${chunks}: ${chunkStart}-${chunkEnd}`);
    
    // Fetch and process chunk
    const chunkData = await fetchChunkData(contractAddress, chunkStart, chunkEnd);
    
    // Calculate cumulative metrics
    const metrics = calculateCumulativeMetrics(chunkData, previousMetrics);
    
    // Save partial results
    await savePartialResults(analysisId, metrics, {
      chunksProcessed: i + 1,
      totalChunks: chunks,
      progress: ((i + 1) / chunks) * 100,
      lastBlockIndexed: chunkEnd,
      isComplete: false
    });
    
    // Emit progress event
    emitProgress(analysisId, metrics);
  }
  
  // Mark as complete
  await markIndexingComplete(analysisId);
}
```

#### 1.3 Cumulative Metrics Calculation
**Goal**: Build metrics incrementally as chunks are processed

**Implementation**:
```javascript
class CumulativeMetricsCalculator {
  constructor() {
    this.transactions = [];
    this.uniqueUsers = new Set();
    this.totalVolume = 0;
    this.totalGasUsed = 0;
    this.failedTxCount = 0;
    this.userActivity = new Map(); // address -> last activity timestamp
  }
  
  addChunk(chunkData) {
    // Process transactions
    for (const tx of chunkData.transactions) {
      this.transactions.push(tx);
      this.uniqueUsers.add(tx.from);
      this.totalVolume += parseFloat(tx.value || 0);
      this.totalGasUsed += parseInt(tx.gasUsed || 0);
      
      if (tx.status === 'failed') {
        this.failedTxCount++;
      }
      
      // Track user activity
      this.userActivity.set(tx.from, tx.timestamp);
    }
    
    return this.getMetrics();
  }
  
  getMetrics() {
    const now = Date.now() / 1000;
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    
    // Active users (last 30 days)
    const activeUsers = Array.from(this.userActivity.entries())
      .filter(([_, lastActivity]) => lastActivity > thirtyDaysAgo)
      .length;
    
    return {
      transactions: this.transactions.length,
      uniqueUsers: this.uniqueUsers.size,
      activeUsers: activeUsers,
      totalVolume: this.totalVolume,
      avgGasUsed: this.totalGasUsed / this.transactions.length,
      failureRate: this.failedTxCount / this.transactions.length,
      recentTransactions: this.transactions.slice(-10), // Last 10
      topUsers: this.getTopUsers(10)
    };
  }
  
  getTopUsers(limit) {
    const userVolumes = new Map();
    
    for (const tx of this.transactions) {
      const current = userVolumes.get(tx.from) || 0;
      userVolumes.set(tx.from, current + parseFloat(tx.value || 0));
    }
    
    return Array.from(userVolumes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([address, volume]) => ({ address, volume }));
  }
}
```

---

### Phase 2: Real-Time Monitoring (Keep Up-to-Date)

#### 2.1 Block Listener
**Goal**: Monitor for new blocks and index them automatically

**Approach 1: Polling** (Simple)
```javascript
async function startBlockMonitoring(contractAddress, analysisId) {
  let lastIndexedBlock = await getLastIndexedBlock(analysisId);
  
  setInterval(async () => {
    const currentBlock = await getCurrentBlockNumber();
    
    if (currentBlock > lastIndexedBlock) {
      console.log(`🆕 New blocks detected: ${lastIndexedBlock + 1} → ${currentBlock}`);
      
      // Index new blocks
      const newData = await fetchChunkData(
        contractAddress, 
        lastIndexedBlock + 1, 
        currentBlock
      );
      
      // Update metrics
      const updatedMetrics = metricsCalculator.addChunk(newData);
      
      // Save updated results
      await savePartialResults(analysisId, updatedMetrics, {
        lastBlockIndexed: currentBlock,
        lastUpdated: new Date().toISOString()
      });
      
      // Emit update event
      emitMetricsUpdate(analysisId, updatedMetrics);
      
      lastIndexedBlock = currentBlock;
    }
  }, 15000); // Check every 15 seconds (slightly longer than block time)
}
```

**Approach 2: WebSocket** (Advanced)
```javascript
async function startBlockMonitoringWS(contractAddress, analysisId) {
  const provider = new ethers.WebSocketProvider(LISK_WS_URL);
  
  provider.on('block', async (blockNumber) => {
    console.log(`🆕 New block: ${blockNumber}`);
    
    // Check if block has contract activity
    const blockData = await fetchBlockData(contractAddress, blockNumber);
    
    if (blockData.transactions.length > 0) {
      // Update metrics
      const updatedMetrics = metricsCalculator.addChunk(blockData);
      
      // Save and emit
      await savePartialResults(analysisId, updatedMetrics);
      emitMetricsUpdate(analysisId, updatedMetrics);
    }
  });
}
```

#### 2.2 Auto-Update Strategy
**Goal**: Keep metrics fresh without manual refresh

**Options**:

**Option A: Continuous Mode** (Always running)
- Starts on first Quick Sync
- Runs indefinitely in background
- Updates metrics every 15-30 seconds
- Pros: Always up-to-date
- Cons: Resource intensive

**Option B: On-Demand Mode** (User controlled)
- User clicks "Start Live Sync"
- Runs for X hours or until stopped
- Pros: User control, less resource usage
- Cons: Data may be stale

**Option C: Hybrid Mode** (Recommended)
- Quick Sync: One-time historical index
- Live Sync: Optional continuous monitoring
- Auto-stop after 24 hours of inactivity
- Pros: Balance of freshness and resources
- Cons: More complex

---

### Phase 3: Frontend Real-Time Display

#### 3.1 Polling for Updates
**File**: `mvp-workspace/frontend/app/dashboard/page.tsx`

```typescript
useEffect(() => {
  if (!quickSyncLoading && !liveSync) return;
  
  const pollInterval = setInterval(async () => {
    try {
      const data = await api.onboarding.getDefaultContract();
      
      // Update metrics
      if (data.metrics) {
        setDefaultContract(prev => ({
          ...prev,
          metrics: data.metrics,
          indexingStatus: data.indexingStatus
        }));
        
        // Animate metric changes
        animateMetricChanges(prev?.metrics, data.metrics);
      }
      
      // Check if indexing is complete
      if (data.indexingStatus?.isComplete && !data.indexingStatus?.liveSync) {
        setQuickSyncLoading(false);
        clearInterval(pollInterval);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 3000); // Poll every 3 seconds
  
  return () => clearInterval(pollInterval);
}, [quickSyncLoading, liveSync]);
```

#### 3.2 Live Sync UI
```typescript
<div className="flex items-center gap-2">
  {indexingStatus?.isComplete ? (
    <>
      <Badge variant="success">
        <CheckCircle className="h-3 w-3 mr-1" />
        Fully Indexed
      </Badge>
      
      {indexingStatus?.liveSync && (
        <Badge variant="outline" className="animate-pulse">
          <Activity className="h-3 w-3 mr-1" />
          Live Monitoring
        </Badge>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={toggleLiveSync}
      >
        {indexingStatus?.liveSync ? 'Stop Live Sync' : 'Start Live Sync'}
      </Button>
    </>
  ) : (
    <Badge variant="secondary" className="animate-pulse">
      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      Indexing... {indexingStatus?.progress}%
      ({indexingStatus?.chunksProcessed}/{indexingStatus?.totalChunks})
    </Badge>
  )}
</div>
```

#### 3.3 Metric Animation
```typescript
function animateMetricChanges(oldMetrics, newMetrics) {
  if (!oldMetrics) return;
  
  // Animate transaction count
  if (newMetrics.transactions > oldMetrics.transactions) {
    animateNumber('transaction-count', oldMetrics.transactions, newMetrics.transactions);
  }
  
  // Animate volume
  if (newMetrics.totalVolume > oldMetrics.totalVolume) {
    animateNumber('total-volume', oldMetrics.totalVolume, newMetrics.totalVolume);
  }
  
  // Flash indicator for new data
  flashElement('metrics-container');
}

function animateNumber(elementId, from, to, duration = 1000) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const start = Date.now();
  const range = to - from;
  
  function update() {
    const now = Date.now();
    const progress = Math.min((now - start) / duration, 1);
    const current = from + (range * progress);
    
    element.textContent = Math.floor(current).toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}
```

---

## Data Model Updates

### Analysis Object Structure
```javascript
{
  id: "analysis-id",
  userId: "user-id",
  status: "indexing" | "complete" | "live",
  
  // Indexing progress
  indexing: {
    deploymentBlock: 25000000,
    startBlock: 27000000, // May skip old blocks if > 1 month
    currentBlock: 28058361,
    lastIndexedBlock: 28050000,
    totalBlocks: 1058361,
    blocksIndexed: 1050000,
    progress: 99.2,
    chunksProcessed: 105,
    totalChunks: 106,
    isComplete: false,
    liveSync: false,
    lastUpdated: "2026-02-11T21:45:00Z"
  },
  
  // Cumulative metrics
  results: {
    target: {
      contract: { ... },
      metrics: {
        transactions: 15420,
        uniqueUsers: 3240,
        activeUsers: 1850,
        totalVolume: 4250000,
        avgGasUsed: 125000,
        failureRate: 0.023,
        recentTransactions: [...],
        topUsers: [...],
        
        // Time-based metrics
        dailyTransactions: [...],
        weeklyActiveUsers: [...],
        
        // Metadata
        isPartial: true,
        lastUpdated: "2026-02-11T21:45:00Z"
      }
    }
  }
}
```

---

## Implementation Timeline

### Week 1: Core Indexing
- ✅ Find deployment block logic
- ✅ Chunk-based historical indexing
- ✅ Cumulative metrics calculation
- ✅ Save partial results
- ✅ Test with real contract

### Week 2: Real-Time Monitoring
- ✅ Block polling mechanism
- ✅ Auto-update logic
- ✅ Live sync start/stop
- ✅ Resource management
- ✅ Error handling

### Week 3: Frontend Integration
- ✅ Polling for updates
- ✅ Real-time metric display
- ✅ Animations and indicators
- ✅ Live sync controls
- ✅ Progress visualization

### Week 4: Polish & Optimization
- ✅ Performance tuning
- ✅ Error recovery
- ✅ User testing
- ✅ Documentation
- ✅ Deployment

---

## Key Differences from Original Plan

### Original Plan (Quick Sync Streaming)
- Look back 1-2 days
- One-time scan
- Show partial results during scan
- Complete and done

### New Plan (Continuous Indexer)
- Start from deployment (up to 1 month history)
- Continuous monitoring
- Always up-to-date
- Never "done" (optional live mode)

---

## Technical Challenges

### 1. Long Initial Index
**Problem**: Indexing 1 month of data may take 5-10 minutes
**Solution**: 
- Show clear progress (chunks processed)
- Allow backgrounding (user can navigate away)
- Resume on page refresh

### 2. Resource Usage
**Problem**: Continuous monitoring uses server resources
**Solution**:
- Auto-stop after 24 hours
- User can manually stop
- Efficient polling (only check new blocks)

### 3. Data Consistency
**Problem**: Metrics change while user is viewing
**Solution**:
- Smooth animations
- Clear "last updated" timestamp
- Option to pause updates

### 4. Multiple Users
**Problem**: Each user's contract needs separate indexer
**Solution**:
- One indexer per contract
- Share indexer if multiple users have same contract
- Queue system for resource management

---

## Success Criteria

### Performance
- ✅ Index 10,000 blocks in < 30 seconds
- ✅ Full 1-month index in < 10 minutes
- ✅ New block detection within 30 seconds
- ✅ Metric updates every 3-5 seconds

### User Experience
- ✅ See first metrics within 30 seconds
- ✅ Clear progress indication
- ✅ Smooth metric animations
- ✅ Easy start/stop controls

### Reliability
- ✅ Handle RPC failures gracefully
- ✅ Resume after crashes
- ✅ Accurate cumulative metrics
- ✅ No data loss

---

## Next Steps

1. **Validate Approach**: Confirm this matches your vision
2. **Prioritize Features**: 
   - Must-have: Historical indexing + real-time display
   - Nice-to-have: Live monitoring, WebSocket
3. **Start Implementation**: Begin with deployment block detection
4. **Iterate**: Test and refine based on real usage

---

## Questions

1. ✅ Should we index full history or limit to 1 month?
   - **Recommendation**: Limit to 1 month for performance

2. ✅ Should live monitoring be always-on or user-controlled?
   - **Recommendation**: User-controlled with auto-stop

3. ✅ How often should we check for new blocks?
   - **Recommendation**: Every 15-30 seconds

4. ✅ Should we support multiple contracts per user?
   - **Recommendation**: Yes, one indexer per contract

5. ✅ What happens if indexing fails mid-way?
   - **Recommendation**: Resume from last indexed block

---

This plan transforms Quick Sync into a true continuous indexer that provides real-time, always-up-to-date metrics!
