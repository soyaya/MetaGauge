# Quick Sync vs Marathon Sync - Complete Flow Documentation

## Overview

Your MetaGauge platform has **TWO distinct sync methods** for analyzing smart contracts:

1. **Quick Sync** - Fast, one-time analysis (2-3 minutes)
2. **Marathon Sync** - Continuous, comprehensive analysis (25-30 minutes)

---

## 🚀 QUICK SYNC FLOW

### Purpose
- **Fast initial analysis** of a smart contract
- **One-time execution** with immediate results
- **Standard search strategy** (250k blocks)
- **Best for**: Getting quick insights, testing, or when you need results fast

### Frontend Implementation
**Location**: `frontend/app/dashboard/page.tsx`

```typescript
const handleQuickSync = async () => {
  // 1. Initialize
  setQuickSyncLoading(true)
  setQuickSyncProgress(10)
  
  // 2. Start Quick Sync (continuous = false)
  const response = await api.onboarding.refreshDefaultContract(false)
  
  // 3. Monitor Progress (polling every 6 seconds)
  while (attempts < maxAttempts) {
    const contractData = await api.onboarding.getDefaultContract()
    
    // Check completion
    if (analysisHistory?.latest?.status === 'completed') {
      setQuickSyncProgress(100)
      window.location.reload() // Refresh to show results
      break
    }
    
    // Update progress
    setQuickSyncProgress(actualProgress)
  }
}
```

### Backend Implementation
**Location**: `mvp-workspace/src/api/routes/onboarding.js`

```javascript
router.post('/refresh-default-contract', async (req, res) => {
  const { continuous = false } = req.body; // Quick Sync: continuous = false
  
  // 1. Check for existing running analysis
  const runningAnalysis = allAnalyses.find(a => 
    (a.status === 'running' || a.status === 'pending') &&
    a.metadata?.isDefaultContract === true
  );
  
  // 2. Create or update analysis
  if (existingAnalysis) {
    // Update existing analysis
    await AnalysisStorage.update(existingAnalysis.id, {
      status: 'running',
      progress: 10,
      metadata: {
        isDefaultContract: true,
        isRefresh: true,
        continuous: false, // Quick Sync
        searchStrategy: 'standard'
      }
    });
  } else {
    // Create new analysis
    const analysisData = {
      userId: req.user.id,
      status: 'running',
      progress: 10,
      metadata: {
        isDefaultContract: true,
        continuous: false, // Quick Sync
        searchStrategy: 'standard'
      }
    };
    await AnalysisStorage.create(analysisData);
  }
  
  // 3. Start analysis asynchronously
  performDefaultContractRefresh(analysisId, defaultConfig, req.user.id)
    .then(() => console.log('✅ Quick Sync completed'))
    .catch(error => {
      console.error('❌ Quick Sync failed:', error);
      AnalysisStorage.update(analysisId, {
        status: 'failed',
        errorMessage: error.message
      });
    });
  
  // 4. Return immediately
  res.json({
    message: 'Default contract refresh started successfully',
    analysisId: analysisId,
    status: 'running',
    progress: 10,
    continuous: false
  });
});
```

### Analysis Execution
**Location**: `mvp-workspace/src/api/routes/onboarding.js`

```javascript
async function performDefaultContractRefresh(analysisId, config, userId) {
  const REFRESH_TIMEOUT = 2 * 60 * 1000; // 2 minutes timeout
  
  try {
    // 1. Initialize Analytics Engine
    const engine = new AnalyticsEngine();
    
    // 2. Run analysis with standard strategy
    const result = await engine.analyzeContract(
      config.targetContract.address,
      config.targetContract.chain,
      config.targetContract.name,
      null, // No fixed block range (uses smart search)
      'standard' // Search strategy: 250k blocks
    );
    
    // 3. Update progress during analysis
    await AnalysisStorage.update(analysisId, {
      progress: 50,
      metadata: { currentStep: 'Processing data...' }
    });
    
    // 4. Save results
    await AnalysisStorage.update(analysisId, {
      status: 'completed',
      progress: 100,
      results: { target: result },
      completedAt: new Date().toISOString()
    });
    
    // 5. Update user's default contract
    await UserStorage.update(userId, {
      onboarding: {
        defaultContract: {
          isIndexed: true,
          indexingProgress: 100,
          lastAnalysisId: analysisId
        }
      }
    });
    
  } catch (error) {
    // Handle errors
    await AnalysisStorage.update(analysisId, {
      status: 'failed',
      errorMessage: error.message
    });
  }
}
```

### Quick Sync Timeline
```
0s   - User clicks "Quick Sync" button
0s   - Frontend: setQuickSyncLoading(true), progress = 10%
1s   - Backend: Create/update analysis record
1s   - Backend: Start performDefaultContractRefresh()
1-2m - Backend: Analyze contract (standard strategy, 250k blocks)
2m   - Backend: Save results, mark as completed
2m   - Frontend: Detect completion via polling
2m   - Frontend: Reload page to show results
```

---

## 🏃 MARATHON SYNC FLOW

### Purpose
- **Comprehensive continuous analysis** of a smart contract
- **Multiple sync cycles** with progressive data gathering
- **Comprehensive search strategy** (1M blocks)
- **Best for**: Deep analysis, historical data, production monitoring

### Frontend Implementation
**Location**: `frontend/hooks/use-marathon-sync.ts`

```typescript
export function useMarathonSync(): MarathonSyncHook {
  const [syncState, setSyncState] = useState<MarathonSyncState>({
    isActive: false,
    analysisId: null,
    progress: 0,
    syncCycle: 0,
    totalTransactions: 0,
    uniqueUsers: 0,
    // ... more state
  });
  
  // 1. Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('marathon-sync-state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      setSyncState(parsed);
      
      // Resume monitoring if sync was active
      if (parsed.isActive && parsed.analysisId) {
        startPolling();
      }
    }
  }, []);
  
  // 2. Save state to localStorage on changes
  useEffect(() => {
    localStorage.setItem('marathon-sync-state', JSON.stringify(syncState));
  }, [syncState]);
  
  // 3. Start Marathon Sync
  const startMarathonSync = async () => {
    const response = await api.onboarding.refreshDefaultContract(true); // continuous = true
    
    updateSyncState({
      isActive: true,
      analysisId: response.analysisId,
      progress: 10,
      syncCycle: 1,
      startedAt: new Date().toISOString()
    });
    
    startPolling(); // Start monitoring
  };
  
  // 4. Poll for updates (every 3 seconds)
  const startPolling = () => {
    pollIntervalRef.current = setInterval(async () => {
      const [status, contractData] = await Promise.all([
        api.onboarding.getStatus(),
        api.onboarding.getDefaultContract()
      ]);
      
      // Check if still active
      const isStillActive = status.continuousSyncActive || 
                           (status.indexingProgress < 100 && status.continuousSync);
      
      // Check if completed
      const isCompleted = status.indexingProgress >= 100 ||
                         status.isIndexed ||
                         contractData.fullResults?.fullReport?.summary?.totalTransactions > 0;
      
      if (isCompleted) {
        stopPolling();
        updateSyncState({ isActive: false, progress: 100 });
        window.location.reload(); // Refresh to show results
        return;
      }
      
      // Update state
      updateSyncState({
        progress: status.indexingProgress,
        syncCycle: contractData.fullResults?.fullReport?.metadata?.syncCycle || 0,
        totalTransactions: contractData.fullResults?.fullReport?.summary?.totalTransactions || 0,
        uniqueUsers: contractData.fullResults?.fullReport?.summary?.uniqueUsers || 0
      });
    }, 3000); // Poll every 3 seconds
  };
  
  return {
    syncState,
    startMarathonSync,
    stopMarathonSync,
    refreshSyncState,
    clearSyncState,
    isLoading
  };
}
```

### Backend Implementation
**Location**: `mvp-workspace/src/api/routes/onboarding.js`

```javascript
router.post('/refresh-default-contract', async (req, res) => {
  const { continuous = false } = req.body; // Marathon Sync: continuous = true
  
  // 1. Check for existing running analysis
  const runningAnalysis = allAnalyses.find(a => 
    (a.status === 'running' || a.status === 'pending') &&
    a.metadata?.isDefaultContract === true
  );
  
  // 2. Create or update analysis
  if (existingAnalysis) {
    await AnalysisStorage.update(existingAnalysis.id, {
      status: 'running',
      progress: 10,
      metadata: {
        isDefaultContract: true,
        continuous: true, // Marathon Sync
        searchStrategy: 'comprehensive',
        syncCycle: (existingAnalysis.metadata?.syncCycle || 0) + 1
      }
    });
  } else {
    const analysisData = {
      userId: req.user.id,
      status: 'running',
      progress: 10,
      metadata: {
        isDefaultContract: true,
        continuous: true, // Marathon Sync
        searchStrategy: 'comprehensive',
        syncCycle: 1
      }
    };
    await AnalysisStorage.create(analysisData);
  }
  
  // 3. Start continuous sync asynchronously
  performContinuousContractSync(analysisId, defaultConfig, req.user.id)
    .then(() => console.log('✅ Marathon Sync completed'))
    .catch(error => {
      console.error('❌ Marathon Sync failed:', error);
      AnalysisStorage.update(analysisId, {
        status: 'failed',
        errorMessage: error.message,
        metadata: { continuous: false }
      });
    });
  
  // 4. Return immediately
  res.json({
    message: 'Continuous contract sync started successfully',
    analysisId: analysisId,
    status: 'running',
    progress: 10,
    continuous: true
  });
});
```

### Continuous Sync Execution
**Location**: `mvp-workspace/src/api/routes/continuous-sync-improved.js`

```javascript
export async function performContinuousContractSync(analysisId, config, userId) {
  let syncCycle = 1;
  const MAX_CYCLES = 50; // ~25-30 minutes
  
  // Continuous sync loop
  while (syncCycle <= MAX_CYCLES) {
    console.log(`🔄 Starting sync cycle ${syncCycle}/${MAX_CYCLES}`);
    
    try {
      // 1. Run analysis for this cycle
      const engine = new AnalyticsEngine();
      const result = await engine.analyzeContract(
        config.targetContract.address,
        config.targetContract.chain,
        config.targetContract.name,
        null, // No fixed block range
        'comprehensive' // Search strategy: 1M blocks
      );
      
      // 2. Update progress
      const progress = Math.min(95, 10 + (syncCycle / MAX_CYCLES) * 85);
      await AnalysisStorage.update(analysisId, {
        progress: progress,
        results: { target: result },
        metadata: {
          syncCycle: syncCycle,
          currentStep: `Cycle ${syncCycle}/${MAX_CYCLES}`,
          lastCycleStarted: new Date().toISOString()
        }
      });
      
      // 3. Update user's default contract
      await UserStorage.update(userId, {
        onboarding: {
          defaultContract: {
            indexingProgress: progress,
            lastAnalysisId: analysisId
          }
        }
      });
      
      // 4. Check if should continue
      const user = await UserStorage.findById(userId);
      if (!user.onboarding?.defaultContract?.continuousSync) {
        console.log('🛑 Continuous sync stopped by user');
        break;
      }
      
      syncCycle++;
      
      // 5. Wait before next cycle (30 seconds)
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (error) {
      console.error(`❌ Sync cycle ${syncCycle} failed:`, error);
      // Continue to next cycle
      syncCycle++;
    }
  }
  
  // Mark as completed
  await AnalysisStorage.update(analysisId, {
    status: 'completed',
    progress: 100,
    completedAt: new Date().toISOString(),
    metadata: { continuous: false }
  });
  
  await UserStorage.update(userId, {
    onboarding: {
      defaultContract: {
        isIndexed: true,
        indexingProgress: 100,
        continuousSync: false
      }
    }
  });
}
```

### Marathon Sync Timeline
```
0s    - User clicks "Marathon Sync" button
0s    - Frontend: Start polling, save state to localStorage
1s    - Backend: Create/update analysis with continuous=true
1s    - Backend: Start performContinuousContractSync()
0-30s - Backend: Cycle 1 - Analyze contract (comprehensive, 1M blocks)
30s   - Frontend: Poll shows progress ~12%, cycle 1 complete
30-60s - Backend: Cycle 2 - Analyze contract
60s   - Frontend: Poll shows progress ~24%, cycle 2 complete
...
25-30m - Backend: Cycle 50 complete, mark as finished
25-30m - Frontend: Detect completion, reload page
```

---

## 🔄 KEY DIFFERENCES

| Feature | Quick Sync | Marathon Sync |
|---------|-----------|---------------|
| **Duration** | 2-3 minutes | 25-30 minutes |
| **Execution** | One-time | Continuous (50 cycles) |
| **Search Strategy** | Standard (250k blocks) | Comprehensive (1M blocks) |
| **API Parameter** | `continuous: false` | `continuous: true` |
| **Progress Updates** | Every 6 seconds | Every 3 seconds |
| **State Persistence** | No | Yes (localStorage) |
| **Cycles** | 1 | Up to 50 |
| **Best For** | Quick insights | Deep analysis |
| **Can Resume** | No | Yes (after page refresh) |
| **Timeout** | 2 minutes | None (runs until complete) |

---

## 📊 PROGRESS TRACKING

### Quick Sync Progress
```javascript
// Frontend polling (every 6 seconds)
const contractData = await api.onboarding.getDefaultContract()
const progress = contractData.indexingStatus.progress

// Progress stages:
// 10%  - Started
// 30%  - Fetching data
// 50%  - Processing
// 90%  - Finalizing
// 100% - Complete
```

### Marathon Sync Progress
```javascript
// Frontend polling (every 3 seconds)
const [status, contractData] = await Promise.all([
  api.onboarding.getStatus(),
  api.onboarding.getDefaultContract()
])

// Progress calculation:
// progress = 10 + (syncCycle / MAX_CYCLES) * 85
// 
// Cycle 1:  ~12%
// Cycle 10: ~27%
// Cycle 25: ~52%
// Cycle 50: ~95%
// Complete: 100%
```

---

## 🛑 STOPPING SYNC

### Quick Sync
- **Cannot be stopped** - runs to completion or timeout
- **Timeout**: 2 minutes
- **On error**: Marks analysis as failed

### Marathon Sync
```javascript
// Frontend
const stopMarathonSync = async () => {
  await api.onboarding.stopContinuousSync()
  stopPolling()
  updateSyncState({ isActive: false, progress: 100 })
}

// Backend
router.post('/stop-continuous-sync', async (req, res) => {
  const user = await UserStorage.findById(req.user.id);
  
  // Update user to stop continuous sync
  await UserStorage.update(req.user.id, {
    onboarding: {
      defaultContract: {
        continuousSync: false,
        continuousSyncStopped: new Date().toISOString()
      }
    }
  });
  
  // Find and stop running analysis
  const runningAnalysis = allAnalyses.find(a => 
    a.status === 'running' && 
    a.metadata?.continuous === true
  );
  
  if (runningAnalysis) {
    await AnalysisStorage.update(runningAnalysis.id, {
      status: 'completed',
      progress: 100,
      metadata: { continuous: false }
    });
  }
  
  res.json({ message: 'Continuous sync stopped successfully' });
});
```

---

## 🔍 MONITORING & DEBUGGING

### Check Sync Status
```javascript
// Get onboarding status
GET /api/onboarding/status

Response:
{
  completed: true,
  hasDefaultContract: true,
  isIndexed: true,
  indexingProgress: 75,
  currentStep: "Cycle 25/50",
  continuousSync: true,
  continuousSyncActive: true
}
```

### Debug Analysis
```javascript
// Get debug information
GET /api/onboarding/debug-analysis

Response:
{
  user: { id, onboarding },
  analyses: {
    total: 5,
    running: 1,
    continuous: 1,
    defaultContract: 3
  },
  runningAnalyses: [{
    id: "analysis-123",
    status: "running",
    progress: 75,
    continuous: true,
    syncCycle: 25
  }]
}
```

---

## 🐛 COMMON ISSUES & FIXES

### Issue 1: Quick Sync Stuck at 30%
**Symptom**: Progress stays at 30% for more than 2 minutes

**Fix**:
```javascript
// Frontend auto-recovery
if (progress === 30 && 
    Date.now() - startTime > 2 * 60 * 1000) {
  console.log('🚨 Forcing completion due to timeout at 30%');
  setQuickSyncProgress(100);
  window.location.reload();
}
```

### Issue 2: Marathon Sync Not Resuming After Page Refresh
**Symptom**: Marathon sync state lost after refresh

**Fix**: Check localStorage
```javascript
// Should persist in localStorage
const savedState = localStorage.getItem('marathon-sync-state');
console.log('Saved marathon sync state:', savedState);

// If missing, state was cleared - restart sync
```

### Issue 3: Corrupted JSON Response
**Symptom**: "Unexpected token '\u0000'" error

**Fix**: Check data files
```bash
# Check for null bytes in users.json
cd mvp-workspace/data
file users.json  # Should say "JSON data"

# If corrupted, recreate
echo "[]" > users.json
```

---

## 📝 SUMMARY

### Quick Sync
- **Fast** (2-3 minutes)
- **One-time** execution
- **Standard** search (250k blocks)
- **No persistence** across page refreshes
- **Best for**: Quick insights, testing

### Marathon Sync
- **Comprehensive** (25-30 minutes)
- **Continuous** execution (50 cycles)
- **Deep** search (1M blocks)
- **Persists** across page refreshes
- **Best for**: Production monitoring, deep analysis

Both sync methods use the same underlying `AnalyticsEngine` but with different parameters:
- **Quick Sync**: `continuous: false`, `searchStrategy: 'standard'`
- **Marathon Sync**: `continuous: true`, `searchStrategy: 'comprehensive'`
