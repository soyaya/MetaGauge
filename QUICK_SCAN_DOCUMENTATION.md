# 📊 Quick Scan Route - Complete Documentation

## 🎯 Overview

The Quick Scan route provides a **fast, optimized blockchain contract analysis** that scans approximately **1 week of blockchain data** (50,000-100,000 blocks) in **60-90 seconds**.

---

## 📍 Endpoint Details

### **POST** `/api/analysis/quick-scan`

**Authentication:** Required (JWT Bearer Token)

**Purpose:** Start an optimized quick scan of a smart contract to gather recent activity data

---

## 📥 Input (Request Body)

```json
{
  "contractAddress": "0x05D032ac25d322df992303dCa074EE7392C117b9",
  "chain": "lisk",
  "contractName": "USDT Token" // Optional, defaults to "Contract"
}
```

### Required Fields:
- **`contractAddress`** (string) - The smart contract address to analyze
- **`chain`** (string) - Blockchain network (lisk, ethereum, starknet)

### Optional Fields:
- **`contractName`** (string) - Human-readable name for the contract

---

## 📤 Output (Response)

### Immediate Response (202 Accepted)
```json
{
  "message": "Quick scan started",
  "analysisId": "analysis_1234567890",
  "status": "pending",
  "estimatedTime": "60-90 seconds"
}
```

### Progress Monitoring (GET `/api/analysis/{analysisId}/status`)
```json
{
  "id": "analysis_1234567890",
  "status": "running",
  "progress": 60,
  "logs": [
    "Quick scan started",
    "[init] Getting current block number...",
    "[fetching] Fetching contract transactions and events...",
    "[processing] Extracted 50 accounts and 200 blocks"
  ],
  "metadata": {
    "contractAddress": "0x05D032ac25d322df992303dCa074EE7392C117b9",
    "chain": "lisk",
    "contractName": "USDT Token",
    "currentStep": "processing",
    "message": "Extracting accounts and blocks...",
    "lastUpdate": "2026-02-07T12:30:00.000Z",
    "transactions": 150,
    "events": 300,
    "accounts": 50,
    "blocks": 200
  }
}
```

### Final Results (GET `/api/analysis/{analysisId}/results`)
```json
{
  "id": "analysis_1234567890",
  "status": "completed",
  "progress": 100,
  "results": {
    "scanType": "optimized_quick_scan",
    "contract": {
      "address": "0x05D032ac25d322df992303dCa074EE7392C117b9",
      "chain": "lisk",
      "name": "USDT Token",
      "deployment": {
        "found": true,
        "blockNumber": 8500000,
        "transactionHash": "0xabc123...",
        "deployer": "0x1234...",
        "date": "2025-12-15T10:30:00.000Z",
        "timestamp": 1734260400
      }
    },
    "data": {
      "transactions": [
        {
          "hash": "0xdef456...",
          "from": "0x1234...",
          "to": "0x05D032ac25d322df992303dCa074EE7392C117b9",
          "value": "1000000000000000000",
          "gasPrice": "20000000000",
          "gasUsed": "21000",
          "blockNumber": 8550000,
          "blockTimestamp": 1734346800,
          "status": true,
          "chain": "lisk",
          "events": [...]
        }
      ],
      "events": [
        {
          "address": "0x05D032ac25d322df992303dCa074EE7392C117b9",
          "topics": ["0x..."],
          "data": "0x...",
          "blockNumber": 8550000,
          "transactionHash": "0xdef456...",
          "logIndex": 0
        }
      ],
      "accounts": ["0x1234...", "0x5678..."],
      "blocks": [8550000, 8550001, 8550002]
    },
    "metrics": {
      "totalTransactions": 150,
      "totalEvents": 300,
      "uniqueAccounts": 50,
      "uniqueBlocks": 200,
      "scanDuration": 65.5,
      "blockRange": {
        "from": 8500000,
        "to": 8600000
      },
      "dataQuality": "high"
    },
    "statistics": {
      "efficiency": {
        "transactionsPerSecond": "2.29",
        "eventsPerSecond": "4.58",
        "blocksPerSecond": "3.05"
      },
      "coverage": {
        "blockRange": { "from": 8500000, "to": 8600000 },
        "totalBlocks": 100000,
        "daysScanned": "6.9"
      },
      "quality": {
        "dataQuality": "high",
        "completeness": "complete",
        "deploymentDetected": true
      }
    },
    "summary": {
      "duration": "65.50s",
      "transactionsFound": 150,
      "eventsFound": 300,
      "accountsFound": 50,
      "blocksScanned": 200,
      "deploymentFound": true,
      "deploymentDate": "2025-12-15T10:30:00.000Z",
      "dataQuality": "high"
    }
  },
  "completedAt": "2026-02-07T12:31:05.500Z"
}
```

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        QUICK SCAN DATA FLOW                      │
└─────────────────────────────────────────────────────────────────┘

1. Frontend Request
   ↓
   POST /api/analysis/quick-scan
   {
     contractAddress: "0x...",
     chain: "lisk",
     contractName: "USDT"
   }

2. Route Handler (quick-scan.js)
   ↓
   - Validates input (contractAddress, chain required)
   - Creates analysis record in AnalysisStorage
   - Returns 202 Accepted with analysisId
   - Starts async performQuickScan()

3. OptimizedQuickScan Service
   ↓
   Step 1: Get current block number
   Step 2: Calculate scan range (last ~7 days / 50k-100k blocks)
   Step 3: Fetch contract events via SmartContractFetcher
   Step 4: Extract accounts and blocks from transactions
   Step 5: Detect contract deployment

4. SmartContractFetcher
   ↓
   - Manages multi-provider failover
   - Delegates to chain-specific RPC client
   - Handles rate limiting (10 req/sec)

5. LiskRpcClient (or chain-specific client)
   ↓
   RPC Calls:
   - eth_blockNumber → Get current block
   - eth_getLogs → Fetch all contract events
   - eth_getTransactionByHash → Get transaction details
   - eth_getTransactionReceipt → Get receipts
   - eth_getBlockByNumber → Get block timestamps

6. Data Processing
   ↓
   - Extracts unique accounts (from/to addresses)
   - Extracts unique blocks
   - Detects deployment transaction
   - Calculates metrics and statistics

7. Storage Update
   ↓
   - Updates AnalysisStorage with progress (0-100%)
   - Stores final results
   - Logs each step

8. Frontend Polling
   ↓
   GET /api/analysis/{analysisId}/status (every 2 seconds)
   - Monitors progress
   - Updates UI with real-time metrics
   - Fetches final results when completed
```

---

## 🎨 Frontend Integration

### Component: `QuickScanProgress`

**Location:** `frontend/components/analyzer/quick-scan-progress.tsx`

**Usage:**
```tsx
import { QuickScanProgress } from "@/components/analyzer/quick-scan-progress"

<QuickScanProgress
  contractAddress="0x05D032ac25d322df992303dCa074EE7392C117b9"
  chain="lisk"
  contractName="USDT Token"
  onComplete={(results) => {
    console.log("Scan complete:", results)
  }}
/>
```

**Features:**
- Real-time progress bar (0-100%)
- Live metrics display (transactions, events, accounts, blocks)
- Step-by-step status updates
- Deployment detection indicator
- Error handling and retry logic
- Automatic polling every 2 seconds

---

## 🔍 What Data is Collected

### 1. **Transactions** (from RPC)
- Transaction hash
- From/to addresses
- Value transferred
- Gas price and gas used
- Block number and timestamp
- Transaction status (success/failed)
- Input data
- Transaction type (legacy, EIP-1559)

### 2. **Events/Logs** (from RPC)
- Event address (contract)
- Topics (event signatures)
- Event data
- Block number
- Transaction hash
- Log index

### 3. **Accounts** (extracted)
- All unique addresses that interacted with the contract
- Includes both senders (from) and receivers (to)

### 4. **Blocks** (extracted)
- All unique block numbers containing contract activity
- Block timestamps

### 5. **Deployment Info** (detected)
- Deployment block number
- Deployment transaction hash
- Deployer address
- Deployment date/timestamp

### 6. **Metrics** (calculated)
- Total transactions count
- Total events count
- Unique accounts count
- Unique blocks count
- Scan duration
- Block range scanned
- Data quality assessment

---

## ⚙️ Configuration

### Default Settings (OptimizedQuickScan)
```javascript
{
  weekInBlocks: 50400,      // ~7 days (12 sec blocks)
  maxScanBlocks: 100000,    // Max 100k blocks
  minScanBlocks: 50000,     // Min 50k blocks
  batchSize: 10,            // Batch transaction fetching
  onProgress: callback      // Progress callback function
}
```

### SmartContractFetcher Settings
```javascript
{
  maxRequestsPerSecond: 10,  // Rate limiting
  failoverTimeout: 60000     // 60 seconds timeout
}
```

---

## 🚀 Performance

### Typical Execution Time
- **60-90 seconds** for 50,000-100,000 blocks
- **~2-5 transactions per second** processing
- **~4-8 events per second** processing

### Optimization Strategy
1. **Event-first approach** - Uses `eth_getLogs` to efficiently find all contract activity
2. **Batch processing** - Fetches transaction details in batches of 10
3. **Minimal block scanning** - Only scans blocks with known activity
4. **Parallel RPC calls** - Uses Promise.all for concurrent requests
5. **Smart deployment detection** - Uses earliest transaction instead of binary search

---

## 🔐 Security & Authentication

- **JWT Authentication Required** - All requests must include valid Bearer token
- **User-scoped Storage** - Analysis results tied to authenticated user
- **Rate Limiting** - Protected by API rate limits (100 req/15min)
- **Input Validation** - Validates contract address and chain parameters

---

## 🐛 Error Handling

### Common Errors

**400 Bad Request**
```json
{
  "error": "Missing required fields",
  "message": "contractAddress and chain are required"
}
```

**401 Unauthorized**
```json
{
  "error": "Authentication required",
  "message": "No token provided"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to start quick scan",
  "message": "RPC provider unavailable"
}
```

### Failed Analysis Status
```json
{
  "status": "failed",
  "errorMessage": "All lisk providers failed for fetchTransactions",
  "completedAt": "2026-02-07T12:31:00.000Z"
}
```

---

## 📊 Use Cases

1. **Quick Contract Overview** - Get recent activity snapshot in under 2 minutes
2. **Deployment Detection** - Find when and by whom a contract was deployed
3. **User Activity Analysis** - Identify unique users interacting with contract
4. **Event Monitoring** - Track all contract events in recent history
5. **Performance Baseline** - Establish baseline metrics for monitoring

---

## 🔗 Related Endpoints

- `GET /api/analysis/{id}/status` - Monitor scan progress
- `GET /api/analysis/{id}/results` - Get final results
- `POST /api/analysis/start` - Full comprehensive analysis (slower, more detailed)
- `GET /api/analysis/history` - View past analyses

---

## 💡 Key Differences: Quick Scan vs Full Analysis

| Feature | Quick Scan | Full Analysis |
|---------|-----------|---------------|
| **Duration** | 60-90 seconds | 5-30 minutes |
| **Block Range** | ~7 days (50k-100k blocks) | Configurable (up to millions) |
| **Data Source** | RPC only | RPC + AI insights |
| **Deployment Detection** | Yes | Yes |
| **Competitive Analysis** | No | Yes |
| **AI Interpretation** | No | Yes |
| **User Behavior Analysis** | Basic | Advanced |
| **Financial Metrics** | Basic | Comprehensive |
| **Progress Updates** | Real-time | Real-time |

---

## ✅ Data Verification

**All data is fetched from real RPC providers:**
- ✅ No mock data
- ✅ No dummy transactions
- ✅ No hardcoded events
- ✅ Direct blockchain queries via eth_* RPC methods
- ✅ Multi-provider failover for reliability

**RPC Methods Used:**
- `eth_blockNumber` - Current blockchain height
- `eth_getLogs` - Contract events/logs
- `eth_getTransactionByHash` - Transaction details
- `eth_getTransactionReceipt` - Transaction receipts
- `eth_getBlockByNumber` - Block data with timestamps

---

## 📝 Storage

Analysis results are stored in **file-based storage**:
- Location: `./data/analyses/`
- Format: JSON
- Indexed by: `analysisId`
- Includes: Full results, progress logs, metadata
- Retention: Permanent (until manually deleted)

---

## 🎯 Summary

The Quick Scan route provides a **fast, efficient way to analyze recent smart contract activity** by:
1. Accepting contract address and chain as input
2. Scanning ~7 days of blockchain data (50k-100k blocks)
3. Fetching all transactions and events via RPC
4. Detecting contract deployment
5. Calculating comprehensive metrics
6. Providing real-time progress updates
7. Delivering results in 60-90 seconds

**Perfect for:** Quick insights, deployment detection, recent activity monitoring, and baseline metrics establishment.
