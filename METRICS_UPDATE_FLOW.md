# Metrics Update Flow: RPC → Frontend

## Current Implementation

### ❌ NOT Real-Time (Polling-Based)

The metrics are **NOT automatically pushed** to the frontend during RPC fetching. Instead:

## How It Works Now

### 1. Backend (RPC Fetching)
```javascript
// trigger-indexing.js
setImmediate(async () => {
  // Fetch data from RPC
  const logs = await provider.getLogs({...});
  
  // Process data
  const results = processLogs(logs);
  
  // Update database ONCE at the end
  await AnalysisStorage.update(analysis.id, {
    status: 'completed',
    progress: 100,
    results: results
  });
  
  // Update user contract status ONCE
  await UserStorage.update(req.user.id, {
    onboarding: {
      defaultContract: {
        isIndexed: true,
        indexingProgress: 100
      }
    }
  });
});
```

**Key Points:**
- ❌ No progress updates during fetching
- ❌ No metrics sent incrementally
- ✅ Only updates database when complete
- ✅ All-or-nothing approach

### 2. Frontend (Polling)
```javascript
// dashboard/page.tsx
useEffect(() => {
  const pollInterval = setInterval(async () => {
    await loadDefaultContractData(); // Polls every 5 seconds
  }, 5000);
}, []);
```

**Key Points:**
- ✅ Polls `/api/onboarding/default-contract` every 5 seconds
- ✅ Checks `indexingProgress` field
- ❌ Only sees updates when backend writes to database
- ❌ No real-time metrics during indexing

## The Problem

```
User Flow:
1. Complete onboarding (567ms) ✅
2. Redirect to dashboard ✅
3. Dashboard polls every 5s ✅
4. Backend fetching data... (2-5 minutes) ⏳
5. Progress stuck at 0% ❌
6. Suddenly jumps to 100% when complete ❌
```

**Why Progress Stays at 0%:**
- Backend doesn't update `indexingProgress` during fetching
- Only updates when ALL data is fetched
- Frontend polls but sees no changes

## Available Infrastructure (Not Used)

### WebSocket Support Exists ✅
```javascript
// WebSocketManager.js
emitProgress(userId, data)    // ✅ Available
emitMetrics(userId, metrics)  // ✅ Available
```

**But:**
- ❌ Not connected to onboarding flow
- ❌ Not used during RPC fetching
- ❌ Frontend doesn't have WebSocket client

## Solutions

### Option 1: Add Progress Updates (Quick Fix)
Update `indexingProgress` during fetching:

```javascript
// During RPC fetching
await UserStorage.update(req.user.id, {
  onboarding: {
    defaultContract: {
      indexingProgress: 30,
      currentStep: 'Fetching events...'
    }
  }
});

// Fetch events...

await UserStorage.update(req.user.id, {
  onboarding: {
    defaultContract: {
      indexingProgress: 60,
      currentStep: 'Processing transactions...'
    }
  }
});
```

**Pros:**
- ✅ Works with existing polling
- ✅ No frontend changes needed
- ✅ Quick to implement

**Cons:**
- ❌ Still polling (5s delay)
- ❌ Extra database writes
- ❌ Not truly real-time

### Option 2: Enable WebSocket (Better)
Connect WebSocket to indexing flow:

```javascript
// Backend
wsManager.emitProgress(userId, {
  progress: 30,
  step: 'Fetching events...',
  metrics: { eventsFound: 1000 }
});

// Frontend
useWebSocket((message) => {
  if (message.type === 'progress') {
    setProgress(message.data.progress);
  }
  if (message.type === 'metrics') {
    setMetrics(message.data);
  }
});
```

**Pros:**
- ✅ True real-time updates
- ✅ No polling overhead
- ✅ Can send partial metrics
- ✅ Better UX

**Cons:**
- ❌ Requires frontend WebSocket client
- ❌ More complex implementation
- ❌ Need to handle reconnection

### Option 3: Show Partial Data (Best UX)
Display data as it arrives:

```javascript
// Backend - Update incrementally
const batchSize = 100;
for (let i = 0; i < transactions.length; i += batchSize) {
  const batch = transactions.slice(i, i + batchSize);
  
  // Process batch
  const partialMetrics = calculateMetrics(batch);
  
  // Update database with partial results
  await AnalysisStorage.update(analysis.id, {
    progress: (i / transactions.length) * 100,
    results: {
      ...existingResults,
      transactions: [...existingResults.transactions, ...batch],
      metrics: partialMetrics
    }
  });
}
```

**Pros:**
- ✅ Users see data immediately
- ✅ Progressive enhancement
- ✅ Works with polling
- ✅ Best perceived performance

**Cons:**
- ❌ More complex metric calculation
- ❌ Need to handle partial state
- ❌ More database writes

## Current Status

### What Works ✅
- Onboarding completes instantly
- Background indexing starts
- Frontend polls for updates
- Database updates when complete

### What Doesn't Work ❌
- No progress during indexing
- Metrics only appear when 100% complete
- User sees "0%" for minutes
- No incremental data display

## Recommendation

**Implement Option 1 first (Quick Fix):**
1. Add 3-4 progress checkpoints during indexing
2. Update `indexingProgress` at each checkpoint
3. Works with existing polling system
4. Can be done in 30 minutes

**Then consider Option 3 (Best UX):**
1. Show partial data as it arrives
2. Update metrics incrementally
3. Much better user experience
4. Requires more refactoring

**Skip Option 2 for now:**
- WebSocket adds complexity
- Polling works fine for 5s intervals
- Can add later if needed
