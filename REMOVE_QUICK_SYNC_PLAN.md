# Remove Quick Sync - Migration Plan

## Overview
Replace the current "Quick Sync" and "Marathon Sync" buttons with a single "Start Indexing" button that uses the continuous streaming indexer.

---

## Current State

### Two Sync Methods
1. **Quick Sync**: 
   - Looks back 1-2 days
   - ~30-60 seconds
   - One-time scan
   - Batch processing

2. **Marathon Sync**:
   - 50 cycles of comprehensive search
   - ~25-30 minutes
   - Continuous mode
   - Complex state management

### Problems
- Confusing for users (which one to use?)
- Quick Sync doesn't show full history
- Marathon Sync is too slow
- No real-time updates
- Metrics only appear after completion

---

## Target State

### Single "Start Indexing" Button
- Automatically finds deployment block
- Indexes from deployment → current (up to 1 month)
- Shows real-time progress and metrics
- Continues monitoring for new blocks (optional)
- Simple, clear UX

### User Flow
```
1. User completes onboarding
   ↓
2. Dashboard shows "Start Indexing" button
   ↓
3. User clicks button
   ↓
4. Indexing starts automatically:
   - Finds deployment block
   - Shows progress: "Indexing block 25,000,000 / 28,058,000 (89%)"
   - Metrics appear and update in real-time
   ↓
5. When complete:
   - Shows "Fully Indexed" badge
   - Option to "Enable Live Monitoring"
   ↓
6. (Optional) Live monitoring:
   - Watches for new blocks
   - Auto-updates metrics
   - Can be stopped anytime
```

---

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Rename/Refactor Quick Sync
**File**: `mvp-workspace/src/api/routes/onboarding.js`

**Changes**:
- Rename `POST /api/onboarding/refresh-default-contract` to `POST /api/onboarding/start-indexing`
- Remove `continuous` parameter (always use streaming approach)
- Integrate `DeploymentBlockFinder`
- Use chunk-based indexing with progress updates

**New Endpoint**:
```javascript
router.post('/start-indexing', async (req, res) => {
  // 1. Find deployment block
  // 2. Calculate block range (deployment → current, max 1 month)
  // 3. Start chunk-based indexing
  // 4. Save partial results after each chunk
  // 5. Return analysis ID
});
```

#### 1.2 Remove Marathon Sync
**Files**:
- `mvp-workspace/src/api/routes/onboarding.js`
- `mvp-workspace/src/api/routes/continuous-sync-improved.js`

**Changes**:
- Remove `performContinuousContractSync` function
- Remove marathon sync logic
- Remove 50-cycle complexity
- Simplify to single indexing approach

#### 1.3 Add Live Monitoring Endpoint
**File**: `mvp-workspace/src/api/routes/onboarding.js`

**New Endpoints**:
```javascript
// Start live monitoring (after indexing complete)
router.post('/start-live-monitoring', async (req, res) => {
  // Start polling for new blocks
  // Update metrics automatically
});

// Stop live monitoring
router.post('/stop-live-monitoring', async (req, res) => {
  // Stop polling
  // Keep existing data
});

// Get live monitoring status
router.get('/live-monitoring-status', async (req, res) => {
  // Return if monitoring is active
  // Last block indexed
  // Last update time
});
```

---

### Phase 2: Frontend Changes

#### 2.1 Update Dashboard UI
**File**: `mvp-workspace/frontend/app/dashboard/page.tsx`

**Remove**:
- Quick Sync button
- Marathon Sync button
- `quickSyncLoading` state
- `marathonSync` hook
- Complex sync state management

**Add**:
- Single "Start Indexing" button
- `indexingStatus` state
- Polling for progress updates
- Live monitoring toggle

**New UI**:
```typescript
// Before indexing
<Button onClick={startIndexing}>
  <Play className="mr-2 h-4 w-4" />
  Start Indexing
</Button>

// During indexing
<div className="space-y-2">
  <Badge variant="secondary" className="animate-pulse">
    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
    Indexing... {progress}%
  </Badge>
  <Progress value={progress} />
  <p className="text-xs text-muted-foreground">
    Block {currentBlock.toLocaleString()} / {totalBlocks.toLocaleString()}
  </p>
</div>

// After indexing
<div className="flex items-center gap-2">
  <Badge variant="success">
    <CheckCircle className="h-3 w-3 mr-1" />
    Fully Indexed
  </Badge>
  
  <Button
    variant="outline"
    size="sm"
    onClick={toggleLiveMonitoring}
  >
    {liveMonitoring ? (
      <>
        <Square className="mr-2 h-3 w-3" />
        Stop Live Monitoring
      </>
    ) : (
      <>
        <Activity className="mr-2 h-3 w-3" />
        Enable Live Monitoring
      </>
    )}
  </Button>
</div>
```

#### 2.2 Remove Marathon Sync Hook
**File**: `mvp-workspace/frontend/hooks/use-marathon-sync.ts`

**Action**: Delete this file (no longer needed)

#### 2.3 Simplify API Client
**File**: `mvp-workspace/frontend/lib/api.ts`

**Changes**:
```typescript
// Remove
refreshDefaultContract(continuous: boolean)

// Add
startIndexing()
startLiveMonitoring()
stopLiveMonitoring()
getLiveMonitoringStatus()
```

---

### Phase 3: Data Model Updates

#### 3.1 Analysis Object
**File**: `mvp-workspace/src/api/database/fileStorage.js`

**New Structure**:
```javascript
{
  id: "analysis-id",
  userId: "user-id",
  status: "indexing" | "indexed" | "live" | "failed",
  
  // Indexing metadata
  indexing: {
    deploymentBlock: 25000000,
    startBlock: 27000000,
    currentBlock: 28058361,
    lastIndexedBlock: 28050000,
    totalBlocks: 1058361,
    blocksIndexed: 1050000,
    progress: 99.2,
    chunksProcessed: 105,
    totalChunks: 106,
    isComplete: true,
    startedAt: "2026-02-11T21:00:00Z",
    completedAt: "2026-02-11T21:08:00Z"
  },
  
  // Live monitoring (optional)
  liveMonitoring: {
    enabled: false,
    lastCheck: "2026-02-11T21:45:00Z",
    newBlocksFound: 5,
    autoStopAt: "2026-02-12T21:00:00Z" // Auto-stop after 24 hours
  },
  
  // Metrics (cumulative)
  results: {
    target: {
      contract: { ... },
      metrics: {
        transactions: 15420,
        uniqueUsers: 3240,
        // ... other metrics
        lastUpdated: "2026-02-11T21:45:00Z"
      }
    }
  }
}
```

#### 3.2 User Onboarding Object
**File**: `mvp-workspace/src/api/database/fileStorage.js`

**Update**:
```javascript
{
  onboarding: {
    completed: true,
    defaultContract: {
      address: "0x...",
      chain: "lisk",
      name: "My Contract",
      // ... other fields
      
      // Indexing status
      isIndexed: true,
      indexingProgress: 100,
      lastAnalysisId: "analysis-id",
      
      // Remove these (no longer needed)
      // continuousSync: false,
      // continuousSyncStarted: null
    }
  }
}
```

---

### Phase 4: Remove Old Code

#### Files to Delete
```
mvp-workspace/src/api/routes/continuous-sync-improved.js
mvp-workspace/frontend/hooks/use-marathon-sync.ts
mvp-workspace/SYNC_FLOWS_DOCUMENTATION.md (outdated)
```

#### Files to Update
```
mvp-workspace/src/api/routes/onboarding.js
mvp-workspace/src/services/OptimizedQuickScan.js
mvp-workspace/frontend/app/dashboard/page.tsx
mvp-workspace/frontend/lib/api.ts
```

---

## Migration Steps

### Step 1: Backend Foundation
1. ✅ Create `DeploymentBlockFinder` (already done)
2. ⏳ Create `CumulativeMetricsCalculator`
3. ⏳ Modify `OptimizedQuickScan` to use chunks + cumulative metrics
4. ⏳ Update `/start-indexing` endpoint
5. ⏳ Test with real contract

### Step 2: Remove Old Sync Methods
1. ⏳ Comment out Quick Sync logic
2. ⏳ Comment out Marathon Sync logic
3. ⏳ Test that new indexing works
4. ⏳ Delete old code once confirmed

### Step 3: Frontend Updates
1. ⏳ Remove Quick Sync button
2. ⏳ Remove Marathon Sync button
3. ⏳ Add "Start Indexing" button
4. ⏳ Add polling for progress
5. ⏳ Test UI flow

### Step 4: Live Monitoring (Optional)
1. ⏳ Add live monitoring endpoints
2. ⏳ Add toggle in UI
3. ⏳ Test auto-updates
4. ⏳ Add auto-stop after 24 hours

### Step 5: Cleanup
1. ⏳ Delete old files
2. ⏳ Update documentation
3. ⏳ Remove unused dependencies
4. ⏳ Final testing

---

## Benefits of This Approach

### Simpler UX
- ✅ One button instead of two
- ✅ Clear purpose: "Start Indexing"
- ✅ No confusion about which to use
- ✅ Progressive disclosure (live monitoring is optional)

### Better Performance
- ✅ Indexes full history (up to 1 month)
- ✅ Shows real-time progress
- ✅ Metrics appear immediately
- ✅ More efficient than 50 cycles

### Easier Maintenance
- ✅ Less code to maintain
- ✅ Simpler state management
- ✅ Fewer edge cases
- ✅ Clearer architecture

### Better User Experience
- ✅ See metrics building up in real-time
- ✅ Know exactly what's happening
- ✅ Can enable live monitoring if desired
- ✅ Always up-to-date data

---

## Risks & Mitigation

### Risk 1: Longer Initial Index
**Problem**: Indexing 1 month may take 5-10 minutes
**Mitigation**: 
- Show clear progress
- Allow backgrounding (user can navigate away)
- Save progress (resume on refresh)

### Risk 2: Breaking Existing Users
**Problem**: Users with existing Quick/Marathon sync data
**Mitigation**:
- Migrate existing analyses to new format
- Keep old data, just change UI
- Provide "Re-index" option

### Risk 3: RPC Rate Limits
**Problem**: Indexing may hit rate limits
**Mitigation**:
- Add delays between chunks
- Use multiple RPC endpoints
- Implement exponential backoff

---

## Testing Checklist

### Backend
- [ ] Deployment block finder works
- [ ] Chunk-based indexing works
- [ ] Cumulative metrics accurate
- [ ] Progress updates save correctly
- [ ] Handles RPC failures gracefully

### Frontend
- [ ] "Start Indexing" button works
- [ ] Progress updates in real-time
- [ ] Metrics appear progressively
- [ ] Polling stops on completion
- [ ] Live monitoring toggle works

### End-to-End
- [ ] Full indexing completes successfully
- [ ] Metrics match expected values
- [ ] Can resume after page refresh
- [ ] Live monitoring updates automatically
- [ ] No memory leaks or performance issues

---

## Timeline

### Week 1: Core Implementation
- Day 1-2: Backend indexing with chunks
- Day 3-4: Frontend UI updates
- Day 5: Testing and bug fixes

### Week 2: Live Monitoring
- Day 1-2: Live monitoring backend
- Day 3-4: Live monitoring frontend
- Day 5: Testing and polish

### Week 3: Migration & Cleanup
- Day 1-2: Migrate existing data
- Day 3-4: Remove old code
- Day 5: Final testing and deployment

---

## Success Criteria

### Performance
- ✅ First metrics visible within 30 seconds
- ✅ Full 1-month index in < 10 minutes
- ✅ Live monitoring detects new blocks within 30 seconds
- ✅ UI remains responsive during indexing

### User Experience
- ✅ Clear, simple interface
- ✅ Real-time feedback
- ✅ No confusion about what to do
- ✅ Metrics always up-to-date

### Reliability
- ✅ Handles errors gracefully
- ✅ Can resume after interruption
- ✅ Accurate metrics
- ✅ No data loss

---

## Next Actions

1. **Review this plan** - Confirm approach
2. **Create CumulativeMetricsCalculator** - Build metrics incrementally
3. **Modify OptimizedQuickScan** - Use chunks + deployment block
4. **Update frontend** - Single button, polling, progress
5. **Test thoroughly** - Ensure everything works
6. **Remove old code** - Clean up Quick/Marathon sync
7. **Deploy** - Roll out to production

---

**Status**: Plan Complete - Ready for Implementation
**Estimated Time**: 2-3 weeks
**Priority**: High - Significant UX improvement
