# Subscription Limits and Indexing Mapping

## ✅ YES - Indexing Follows Subscription

The indexing system uses your subscription tier to determine:
1. **How much historical data** to fetch (block range)
2. **How many RPC calls** you can make
3. **How often** to refresh data
4. **How many contracts** you can analyze

## Pro Subscription Limits

Based on your Pro plan, here's what you get:

### 📊 Current Pro Plan Features

| Feature | Limit | What It Means |
|---------|-------|---------------|
| **API Calls/Month** | 5,000 | ~10-50 analyses per month |
| **Max Projects** | 10 | Track 10 contracts simultaneously |
| **Max Alerts** | 50 | 50 custom alert configurations |
| **Historical Data** | 90 days | Index last 90 days of blockchain data |
| **Data Refresh** | 6 hours | Re-index every 6 hours (4x/day) |
| **Export Access** | ✓ | Download reports (CSV, JSON, PDF) |
| **Comparison Tool** | ✓ | Compare multiple contracts |
| **Wallet Intelligence** | ✓ | Advanced wallet analysis |
| **API Access** | ✓ | REST API access |

## How Limits Map to Indexing

### 1. Historical Data → Block Range

**Pro: 90 days**

```
Lisk blocks per day: ~43,200 (2 sec/block)
90 days = 3,888,000 blocks

Your indexing will fetch:
- Start: Current block - 3,888,000
- End: Current block
- Total: 3,888,000 blocks of data
```

**Example:**
```
Current block: 28,175,268
Start block: 24,287,268 (90 days ago)
End block: 28,175,268 (now)
Blocks indexed: 3,888,000
```

### 2. API Calls → Analysis Budget

**Pro: 5,000 calls/month**

```
Each analysis makes:
- Block range query: 1 call
- Get logs: 10-50 calls (depending on range)
- Get transactions: 50-200 calls
- Get receipts: 50-200 calls
- Total per analysis: ~100-500 calls

Your monthly budget:
5,000 calls ÷ 200 avg = ~25 analyses/month
```

**Usage tracking:**
- Dashboard shows: "API Calls: 1,234 / 5,000"
- Resets monthly
- Alerts when approaching limit

### 3. Max Projects → Contracts

**Pro: 10 contracts**

```
You can track:
- 10 different smart contracts
- Each with its own analysis
- Each with its own alerts
- Each with its own dashboard

Example:
1. USDT on Lisk
2. Your DeFi protocol
3. Competitor A
4. Competitor B
... up to 10 total
```

### 4. Max Alerts → Alert Rules

**Pro: 50 alerts**

```
You can configure:
- 50 different alert rules
- Per contract or global
- Custom thresholds
- Multiple notification channels

Example alerts:
1. Gas price > 100 gwei
2. TVL drops > 20%
3. Whale transaction > $100k
4. User dropoff > 25%
... up to 50 total
```

### 5. Data Refresh → Re-indexing

**Pro: Every 6 hours**

```
Automatic re-indexing:
- 00:00 UTC
- 06:00 UTC
- 12:00 UTC
- 18:00 UTC

Keeps your data fresh:
- New transactions
- Updated metrics
- Latest alerts
- Current trends
```

## Indexing Flow with Pro Subscription

### Step 1: User Connects Wallet
```
Dashboard → Connect Wallet →
System checks smart contract →
Detects Pro subscription
```

### Step 2: Subscription Sync
```
Smart contract returns:
{
  tier: 2,
  tierName: "Pro",
  historicalDays: 90,
  apiCallsPerMonth: 5000,
  maxProjects: 10,
  maxAlerts: 50,
  dataRefreshRate: 6
}
```

### Step 3: Indexing Configuration
```
System calculates:
- Block range: 90 days = 3,888,000 blocks
- RPC budget: 5,000 calls/month
- Refresh schedule: Every 6 hours
```

### Step 4: Data Fetching
```
Indexer fetches:
- Blocks: 24,287,268 → 28,175,268
- Transactions: All in range
- Events: All contract events
- Users: All unique addresses
- Metrics: TVL, volume, gas, etc.
```

### Step 5: Dashboard Display
```
Shows:
- Subscription: Pro
- Historical Data: 90 days
- Blocks Indexed: 3,888,000
- Block Range: 24,287,268 → 28,175,268
- Status: Fully Indexed
```

## Comparison: Free vs Pro

| Feature | Free | Pro | Difference |
|---------|------|-----|------------|
| Historical Data | 7 days | 90 days | **13x more data** |
| Blocks Indexed | ~302,400 | ~3,888,000 | **13x more blocks** |
| API Calls | 1,000 | 5,000 | **5x more calls** |
| Analyses/Month | ~2-5 | ~10-50 | **10x more analyses** |
| Max Projects | 1 | 10 | **10x more contracts** |
| Max Alerts | 3 | 50 | **17x more alerts** |
| Data Refresh | 24 hours | 6 hours | **4x more frequent** |
| Export | ✗ | ✓ | **Enabled** |
| Comparison | ✗ | ✓ | **Enabled** |
| API Access | ✗ | ✓ | **Enabled** |

## What You Should Offer Users

### Free Tier (Tier 0)
**Target:** Hobbyists, students, testers
- 7 days historical data
- 1 contract
- 3 alerts
- Basic metrics
- Daily refresh

**Use case:** "Try before you buy"

### Starter Tier (Tier 1)
**Target:** Individual developers, small projects
- 30 days historical data
- 5 contracts
- 10 alerts
- Standard metrics
- 12-hour refresh

**Use case:** "Personal projects"

### Pro Tier (Tier 2) ← **Your Current Plan**
**Target:** Professional developers, growing projects
- 90 days historical data
- 10 contracts
- 50 alerts
- Advanced metrics
- 6-hour refresh
- Export, comparison, API access

**Use case:** "Production applications"

### Enterprise Tier (Tier 3)
**Target:** Large organizations, institutions
- All historical data
- Unlimited contracts
- 500 alerts
- Custom metrics
- 1-hour refresh
- Priority support, custom insights

**Use case:** "Mission-critical systems"

## Recommendations

### For Your Pro Plan:

1. **Maximize Historical Data**
   - Use full 90 days for trend analysis
   - Compare month-over-month metrics
   - Identify seasonal patterns

2. **Track Multiple Contracts**
   - Your main contract
   - 3-5 competitors
   - Related protocols
   - Total: 5-7 contracts (within 10 limit)

3. **Set Strategic Alerts**
   - Critical: Security issues (5 alerts)
   - High: Performance problems (10 alerts)
   - Medium: Growth metrics (15 alerts)
   - Low: Informational (20 alerts)
   - Total: 50 alerts

4. **Optimize API Usage**
   - Schedule analyses strategically
   - Use 6-hour auto-refresh
   - Manual analyses when needed
   - Stay within 5,000 calls/month

5. **Leverage Pro Features**
   - Export reports for presentations
   - Compare with competitors
   - Use API for integrations
   - Build custom dashboards

## Summary

✅ **YES - Indexing follows your subscription**

Your Pro subscription gives you:
- **90 days** of blockchain data
- **3.8 million blocks** indexed
- **10 contracts** to track
- **50 alert rules**
- **5,000 API calls/month**
- **4x daily refresh**

The system automatically uses these limits when indexing your contracts. No manual configuration needed - just connect your wallet and the smart contract determines everything!
