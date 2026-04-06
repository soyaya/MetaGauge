# MetaGauge API — Overview & Metrics Tab Endpoints

All endpoints require `Authorization: Bearer <token>`.  
Base URL: `http://localhost:5000`

---

## Overview Tab

### `GET /api/onboarding/default-contract`

Returns the user's default contract with all metrics needed by the Overview tab.

**Response shape**
```json
{
  "contract": { "address", "chain", "name", "category", "isIndexed", "indexingProgress" },
  "indexingStatus": { "isIndexed": true, "progress": 100 },
  "analysisHistory": { "total", "completed", "latest": { "id", "status", "createdAt" } },
  "fullResults": {
    "fullReport": {
      "summary": {
        "totalTransactions": 50,
        "uniqueUsers": 49,
        "successRate": "100.0",
        "failureRate": "0.0",
        "totalValueEth": 0.0013
      },
      "defiMetrics": {
        "dau": 49,
        "wau": 49,
        "mau": 49,
        "totalVolumeEth": 0.0013,
        "bounceRate": 98,
        "activationRate": 2,
        "avgTimeToFirstInteraction": "30m",
        "avgTimeToActivation": "2.0h",
        "protocolStickiness": 2
      },
      "gasAnalysis": {
        "gasEfficiencyScore": 100,
        "failedTransactions": 0,
        "failureRate": 0
      },
      "uxAnalysis": {
        "uxGrade": { "grade": "A", "completionRate": 1.0, "failureRate": 0 },
        "sessionDurations": { "averageDuration": "45m", "averageDurationMinutes": 45 }
      },
      "userLifecycle": {
        "summary": { "retentionRate": 2, "totalUsers": 49, "activeUsers": 49 }
      },
      "recommendations": ["string"],
      "alerts": [{ "severity": "warning", "message": "string" }],
      "transactions": [{ "hash", "from", "to", "value", "gasUsed", "status", "input" }]
    }
  }
}
```

**Overview tab metric → field path**
| Metric | Path |
|---|---|
| Total Transactions | `fullResults.fullReport.summary.totalTransactions` |
| Unique Users | `fullResults.fullReport.summary.uniqueUsers` |
| Total Volume (ETH) | `fullResults.fullReport.defiMetrics.totalVolumeEth` |
| Time to First Interaction | `fullResults.fullReport.defiMetrics.avgTimeToFirstInteraction` |
| UX Grade | `fullResults.fullReport.uxAnalysis.uxGrade.grade` |
| Session Duration | `fullResults.fullReport.uxAnalysis.sessionDurations.averageDuration` |
| Bounce Rate | `fullResults.fullReport.defiMetrics.bounceRate` |
| User Retention | `fullResults.fullReport.userLifecycle.summary.retentionRate` |
| DAU | `fullResults.fullReport.defiMetrics.dau` |
| Activation Rate | `fullResults.fullReport.defiMetrics.activationRate` |
| Tx Success Rate | `fullResults.fullReport.gasAnalysis.gasEfficiencyScore` |
| Time to Activation | `fullResults.fullReport.defiMetrics.avgTimeToActivation` |
| Tx Type Distribution | computed from `fullResults.fullReport.transactions[].input` |
| Recommendations | `fullResults.fullReport.recommendations[]` |
| Alerts | `fullResults.fullReport.alerts[]` |

**Notes**
- `sessionDuration` and `d1/d7/d30Retention` require `blockTimestamp` on transactions. Historical analyses indexed before live monitoring started will show `null`/`0` for these.
- Polling: dashboard polls this endpoint every 15s (indexed) or 5s (indexing in progress).

---

## Metrics Tab

### `GET /api/metrics/dashboard`

Returns all structured metric sections for the Metrics tab.  
If the stored analysis has no `fullReport` (legacy data), it builds one on-the-fly from raw transactions and persists it.

**Response shape**
```json
{
  "analysisId": "uuid",
  "contractAddress": "0x...",
  "chain": "ethereum",
  "lastUpdated": "2026-03-31T08:11:07Z",
  "summary": {
    "totalTransactions": 50,
    "uniqueUsers": 49,
    "successRate": "100.0",
    "totalValueEth": 0.0013
  },
  "defiMetrics": {
    "dau": 49, "wau": 49, "mau": 49,
    "averageTransactionSize": 0.000027,
    "functionSuccessRate": 100,
    "protocolStickiness": 2,
    "contractUtilization": 50,
    "interactionComplexity": "High"
  },
  "gasAnalysis": {
    "averageGasPrice": "1.2 Gwei",
    "averageGasPriceGwei": 1.2,
    "averageGasUsed": 218788,
    "totalGasCostUSD": 15.81,
    "averageGasCostUSD": 0.3162,
    "gasEfficiencyScore": 100,
    "failedTransactions": 0,
    "failureRate": 0
  },
  "userBehavior": {
    "loyaltyScore": 2,
    "whaleRatio": 0,
    "powerUserRate": 0,
    "botPct": 2,
    "avgSophistication": 1.04,
    "avgWalletQuality": 35,
    "userClassifications": { "whales": 0, "regular": 2, "one_time": 98 }
  },
  "activationMetrics": {
    "activationRate": 2,
    "avgTimeToActivation": "2.0h",
    "timeToValue": "2.0h",
    "activationFunnel": [
      { "step": "First Tx",  "users": 49, "pct": 100 },
      { "step": "Second Tx", "users": 1,  "pct": 2   },
      { "step": "Third Tx",  "users": 0,  "pct": 0   }
    ],
    "featureFirstUse": [
      { "feature": "Transfer", "count": 24, "pct": 49 }
    ],
    "avgGasToActivateETH": 0.000084,
    "avgGasToActivateUSD": 0.21
  },
  "retentionMetrics": {
    "d1Retention": 0,
    "d7Retention": 0,
    "d30Retention": 0,
    "churnRate": 100,
    "resurrectionRate": 0,
    "retentionRate": 2
  },
  "userQualityMetrics": {
    "powerUserRate": 0,
    "botPct": 2,
    "avgSophistication": 1.04,
    "avgWalletQuality": 35
  },
  "interactions": {
    "peakInteractionTimes": [{ "hour": 14, "count": 8 }]
  }
}
```

**Metrics tab section → field path**
| Section | Metric | Path | Real data? |
|---|---|---|---|
| User Activity | DAU/WAU/MAU | `defiMetrics.dau/wau/mau` | ✅ |
| User Activity | Avg Tx Size | `defiMetrics.averageTransactionSize` | ✅ |
| Gas | Avg Gas Price | `gasAnalysis.averageGasPrice` | ✅ |
| Gas | Avg Gas Used | `gasAnalysis.averageGasUsed` | ✅ |
| Gas | Total Gas Cost USD | `gasAnalysis.totalGasCostUSD` | ✅ |
| Gas | Avg Gas Cost/Tx | `gasAnalysis.averageGasCostUSD` | ✅ |
| Gas | Success Rate | `gasAnalysis.gasEfficiencyScore` | ✅ |
| Gas | Failed Txs | `gasAnalysis.failedTransactions` | ✅ |
| Activation | Rate | `activationMetrics.activationRate` | ✅ |
| Activation | Time to Activate | `activationMetrics.avgTimeToActivation` | ✅ (requires timestamps) |
| Activation | Gas Cost | `activationMetrics.avgGasToActivateETH/USD` | ✅ |
| Activation | Funnel | `activationMetrics.activationFunnel[]` | ✅ |
| Activation | Feature First Use | `activationMetrics.featureFirstUse[]` | ✅ |
| Retention | D1/D7/D30 | `retentionMetrics.d1/d7/d30Retention` | ✅ (requires timestamps) |
| Retention | Churn Rate | `retentionMetrics.churnRate` | ✅ (requires timestamps) |
| Retention | Resurrection | `retentionMetrics.resurrectionRate` | ✅ (requires timestamps) |
| User Quality | Power User Rate | `userQualityMetrics.powerUserRate` | ✅ |
| User Quality | Bot % | `userQualityMetrics.botPct` | ✅ |
| User Quality | Sophistication | `userQualityMetrics.avgSophistication` | ✅ |
| User Quality | Wallet Quality | `userQualityMetrics.avgWalletQuality` | ✅ |
| Contract | Complexity | `defiMetrics.interactionComplexity` | ✅ |
| Contract | Utilization | `defiMetrics.contractUtilization` | ✅ |
| Contract | Peak Hour | `interactions.peakInteractionTimes[0].hour` | ✅ (requires timestamps) |
| TVL/Financial/Risk/DeFi | all | — | ❌ Requires protocol-specific ABI/events |

**Notes**
- `d1/d7/d30Retention`, `churnRate`, `resurrectionRate`, `sessionDuration`, `peakInteractionTimes`, and `avgTimeToActivation` all require `blockTimestamp` on stored transactions. The live monitoring phase (Phase 2 of indexing) enriches new transactions with timestamps. Historical transactions indexed without timestamps will show `0` for these metrics.
- `totalGasCostUSD` uses a hardcoded ETH price of $2500. No price oracle is integrated.
- On first call after a server restart, if the analysis has no `fullReport`, it is built on-the-fly (~50ms for 50 txs) and persisted. Subsequent calls return the cached version instantly.

### Other Metrics Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/metrics/analysis/:analysisId` | Metrics for a specific analysis by ID |
| `GET` | `/api/metrics/user` | Metrics for current user's latest analysis |
| `POST` | `/api/metrics/recalculate` | Recalculate metrics for all analyses |
| `GET` | `/api/metrics/summary` | Summary across all analyses (admin) |
| `GET` | `/api/metrics/glossary` | Metric definitions glossary |

---

## Known Limitations

| Limitation | Cause | Fix |
|---|---|---|
| D1/D7/D30 retention = 0 | No `blockTimestamp` in historical txs | Live monitoring phase adds timestamps to new txs |
| Session duration = null | Same as above | Same fix |
| Peak hours = empty | Same as above | Same fix |
| Gas cost USD uses $2500 | No price oracle | Integrate CoinGecko/Chainlink |
| TVL/Revenue/MEV = N/A | Requires protocol-specific event parsing | Future: ABI-based event decoder |
