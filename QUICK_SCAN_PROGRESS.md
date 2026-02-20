# ⚡ Quick Scan with Real-Time Progress Updates

## Overview
Quick Scan now provides real-time progress updates to both console and frontend UI, allowing users to track the scanning process as it happens.

---

## Features

### ✅ Console Progress Updates
- Step-by-step progress logging
- Percentage completion (0-100%)
- Real-time metrics (transactions, events, accounts, blocks)
- Deployment detection updates
- Completion summary

### ✅ Frontend UI Updates
- Live progress bar
- Real-time metrics display
- Step indicators with icons
- Deployment information
- Activity logs
- Completion summary

---

## Backend Implementation

### Progress Callback System

```javascript
// OptimizedQuickScan with progress callback
const quickScan = new OptimizedQuickScan(fetcher, {
  weekInBlocks: 50400,
  onProgress: (progressData) => {
    // progressData contains:
    // - step: 'init' | 'fetching' | 'processing' | 'deployment' | 'complete'
    // - progress: 0-100
    // - message: Human-readable message
    // - timestamp: ISO timestamp
    // - Additional data (transactions, events, accounts, blocks, etc.)
    
    console.log(`[${progressData.progress}%] ${progressData.message}`);
  }
});
```

### Progress Steps

| Step | Progress | Description |
|------|----------|-------------|
| **init** | 5-10% | Getting current block, calculating range |
| **fetching** | 20-60% | Fetching transactions and events |
| **processing** | 70-80% | Extracting accounts and blocks |
| **deployment** | 90-95% | Detecting contract deployment |
| **complete** | 100% | Scan finished |

---

## API Endpoint

### POST `/api/analysis/quick-scan`

**Request:**
```json
{
  "contractAddress": "0x05D032ac25d322df992303dCa074EE7392C117b9",
  "chain": "lisk",
  "contractName": "USDT"
}
```

**Response:**
```json
{
  "message": "Quick scan started",
  "analysisId": "abc123",
  "status": "pending",
  "estimatedTime": "60-90 seconds"
}
```

### GET `/api/analysis/:id/status`

**Response (Running):**
```json
{
  "id": "abc123",
  "status": "running",
  "progress": 60,
  "logs": [
    "Quick scan started",
    "[fetching] Fetching contract transactions and events...",
    "[fetching] Found 295 transactions and 485 events"
  ],
  "metadata": {
    "currentStep": "fetching",
    "message": "Found 295 transactions and 485 events",
    "transactions": 295,
    "events": 485,
    "lastUpdate": "2026-02-05T22:50:00.000Z"
  }
}
```

**Response (Completed):**
```json
{
  "id": "abc123",
  "status": "completed",
  "progress": 100,
  "results": {
    "summary": {
      "duration": "18.72s",
      "transactionsFound": 295,
      "eventsFound": 485,
      "accountsFound": 53,
      "blocksScanned": 292,
      "deploymentFound": true,
      "deploymentDate": "2024-01-15T10:30:00.000Z"
    },
    "contract": {
      "deployment": {
        "found": true,
        "date": "2024-01-15T10:30:00.000Z",
        "blockNumber": 11234567,
        "transactionHash": "0xabc...",
        "deployer": "0xdef..."
      }
    }
  }
}
```

---

## Frontend Usage

### Basic Usage

```tsx
import { QuickScanProgress } from "@/components/analyzer/quick-scan-progress"

export default function AnalyzerPage() {
  return (
    <QuickScanProgress
      contractAddress="0x05D032ac25d322df992303dCa074EE7392C117b9"
      chain="lisk"
      contractName="USDT"
      onComplete={(results) => {
        console.log("Scan complete!", results)
        // Handle results
      }}
    />
  )
}
```

### Component Features

**Visual Elements:**
- ✅ Progress bar (0-100%)
- ✅ Status badge (Ready/Scanning/Complete/Failed)
- ✅ Step icons (Clock, Database, Users, Calendar, CheckCircle)
- ✅ Real-time metrics cards
- ✅ Deployment information card
- ✅ Activity log (last 10 entries)
- ✅ Completion summary

**User Experience:**
- Click "Start Quick Scan" button
- Watch progress bar fill up
- See metrics update in real-time
- View deployment info when detected
- See completion summary with all stats

---

## Console Output Example

```
⚡ OPTIMIZED QUICK SCAN - Contract-Focused Analysis
========================================================
📍 Contract: 0x05D032ac25d322df992303dCa074EE7392C117b9
🔗 Chain: lisk

   📊 [5%] Getting current block number...
📊 Current block: 27,822,321

   📊 [10%] Calculating block range...
📅 Scanning last ~7 days: 27,772,321 → 27,822,321
📦 Total blocks: 50,000

   📊 [20%] Fetching contract transactions and events...
🔍 Step 1/3: Fetching contract events...
   📊 [60%] Found 295 transactions and 485 events
   ✅ Found 485 events
   ✅ Found 295 transactions

   📊 [70%] Extracting accounts and blocks...
🔍 Step 2/3: Extracting accounts and blocks...
   📊 [80%] Extracted 53 accounts and 292 blocks
   ✅ Found 53 unique accounts
   ✅ Found 292 unique blocks

   📊 [90%] Detecting contract deployment...
🔍 Step 3/3: Detecting contract deployment...
   📊 [95%] Deployment detected!
   ✅ Deployment detected!
      📅 Date: 2024-01-15T10:30:00.000Z
      🧱 Block: 11,234,567
      🔗 Tx: 0xabc123...
      👤 Deployer: 0xdef456...

   📊 [100%] Quick scan complete!

📊 QUICK SCAN SUMMARY
========================================================
⏱️  Duration: 18.72s
📝 Transactions: 295
📋 Events: 485
👥 Accounts: 53
🧱 Blocks: 292
📅 Deployment: 2024-01-15T10:30:00.000Z
✅ Data Quality: high
```

---

## Integration Steps

### 1. Add Route to Server

```javascript
// In src/api/server.js
import quickScanRoutes from './routes/quick-scan.js';

app.use('/api/analysis', quickScanRoutes);
```

### 2. Use Component in Frontend

```tsx
// In your analyzer page
import { QuickScanProgress } from "@/components/analyzer/quick-scan-progress"

<QuickScanProgress
  contractAddress={address}
  chain={chain}
  contractName={name}
  onComplete={(results) => {
    // Navigate to results page or update state
    router.push(`/analysis/${results.id}`)
  }}
/>
```

### 3. Poll for Updates

The component automatically polls every 2 seconds for progress updates. No additional setup needed!

---

## Progress Data Structure

```typescript
interface QuickScanProgress {
  step: 'init' | 'fetching' | 'processing' | 'deployment' | 'complete'
  progress: number // 0-100
  message: string
  timestamp: string
  
  // Optional metrics (populated as scan progresses)
  transactions?: number
  events?: number
  accounts?: number
  blocks?: number
  deploymentDate?: string
  deploymentBlock?: number
  duration?: number
}
```

---

## Benefits

### For Users
- ✅ **Transparency** - See exactly what's happening
- ✅ **Confidence** - Know the scan is working
- ✅ **Engagement** - Watch metrics update in real-time
- ✅ **Information** - Get deployment info immediately

### For Developers
- ✅ **Debugging** - Easy to track where issues occur
- ✅ **Monitoring** - See performance metrics
- ✅ **Feedback** - Users can report specific step failures
- ✅ **UX** - Better user experience with progress visibility

---

## Files Created

1. **Backend:**
   - `src/services/OptimizedQuickScan.js` - Added progress callback
   - `src/api/routes/quick-scan.js` - New route with progress updates

2. **Frontend:**
   - `frontend/components/analyzer/quick-scan-progress.tsx` - Progress UI component

3. **Documentation:**
   - `QUICK_SCAN_PROGRESS.md` - This file

---

## Next Steps

1. ✅ Test quick scan with progress updates
2. ✅ Verify frontend UI displays correctly
3. ✅ Ensure polling works smoothly
4. ✅ Move to Marathon Scan specification

**Status:** ✅ Ready for testing
