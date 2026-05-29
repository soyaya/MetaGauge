# MetaGauge AI Agent — Architecture & Design

## System Overview

```
┌─────────────────────────────────────────────────────┐
│              Frontend (Next.js — reused)             │
│  Dashboard │ Project Submit │ Chat │ Alerts          │
└─────────────────────────────────────────────────────┘
                        ↕ REST + WebSocket
┌─────────────────────────────────────────────────────┐
│              AI Agent Backend (Express.js)           │
│  Auth (reused) │ Projects │ Analysis │ Agent │ Alerts│
└─────────────────────────────────────────────────────┘
                        ↕
┌──────────────┬──────────────┬────────────────────────┐
│  Gemini AI   │   MongoDB    │   External Data APIs   │
│  (analysis)  │  (storage)   │  RPC │ GitHub │ Twitter│
└──────────────┴──────────────┴────────────────────────┘
```

---

## Folder Structure

```
AIAgent/
├── requirements.md
├── design.md
├── tasks.md
└── src/
    ├── server.js
    ├── config/
    │   └── env.js
    ├── models/              ← Mongoose schemas (no Project — main app owns it)
    │   ├── Analysis.js
    │   └── Alert.js
    ├── routes/
    │   ├── analysis.js      ← trigger, status, results
    │   ├── agent.js         ← chat + autonomous run
    │   ├── alerts.js
    │   └── admin.js         ← queue, API health, usage
    ├── services/
    │   ├── AgentService.js          ← Gemini agentic loop
    │   ├── OnChainCollector.js      ← EVM + Solana data
    │   ├── GitHubAnalyzer.js        ← repo metrics
    │   ├── SentimentAnalyzer.js     ← Twitter/X sentiment
    │   ├── RiskDetector.js          ← scam/rug signals
    │   ├── WalletIntelligence.js    ← whale/smart money
    │   ├── ScoringEngine.js         ← compute all scores
    │   └── ReportGenerator.js       ← AI report builder
    └── agent/
        └── tools/
            ├── get_onchain_metrics.js
            ├── get_github_activity.js
            ├── get_social_sentiment.js
            ├── get_risk_signals.js
            ├── get_wallet_intelligence.js
            ├── generate_report.js
            ├── compare_projects.js
            └── index.js
```

---

## Core Services

### AgentService
- Gemini function-calling loop (max 5 iterations)
- Same pattern as main app's AgentService
- Tools injected via `TOOL_SCHEMAS` + `TOOL_EXECUTORS`
- System prompt includes project context + market data
- Returns `{ content, components[], toolsUsed, iterations }`

### OnChainCollector
- EVM chains: ethers.js via public RPC (with failover)
- Solana: `@solana/web3.js`
- Collects: holder count, tx volume, liquidity, whale txs, burn/mint
- Caches results in MongoDB, refreshes every 6h

### ScoringEngine
Computes all scores from aggregated data:
```
tractionScore      = f(walletGrowth, txVolume, liquidityTrend)
riskScore          = f(ownerConcentration, lpWithdrawals, devActivity)
sustainabilityScore = f(liquidityDepth, devHealth, communityHealth)
communityHealthScore = f(sentimentScore, botRatio, holderGrowth)
growthProbability  = Gemini prediction based on historical patterns
```

### RiskDetector
Signals checked:
- Top 10 wallets hold >50% supply → HIGH concentration risk
- LP removed >20% in 7 days → rug signal
- Zero commits in 30 days → abandoned
- Circular tx patterns → wash trading
- Contract owner not renounced → ownership risk

### ReportGenerator
Calls Gemini with all collected metrics + scores, produces:
- Plain-English summary
- Per-metric explanation
- Risk breakdown
- Opportunity signals
- Structured JSON for frontend rendering

---

## API Endpoints

```
POST /api/analysis/:projectId        — trigger analysis run
GET  /api/analysis/:projectId/status — polling status
GET  /api/analysis/:projectId/results — full results + report
GET  /api/projects/:id/scores        — traction, risk, growth scores (Module 12)
GET  /api/projects/:id/report        — full AI report
GET  /api/projects/:id/wallet-intelligence — whale/smart money
GET  /api/projects/:id/sentiment     — social sentiment metrics

POST /api/agent/chat                 — conversational agent
POST /api/agent/research/:projectId  — autonomous research run

GET  /api/alerts                     — user alerts
PUT  /api/alerts/:id/read            — mark read

GET  /api/admin/health               — API + queue health (Module 11)
```

---

## MongoDB Schemas

### Project
```js
{
  contractAddress: String (required),
  chain: String (enum: ethereum|base|bnb|arbitrum|solana),
  name: String,
  symbol: String,
  githubUrl: String,
  twitterHandle: String,
  websiteUrl: String,
  submittedBy: String (userId),
  status: String (enum: pending|analyzing|complete|failed),
  lastAnalyzedAt: Date,
  createdAt: Date
}
```

### Analysis
```js
{
  projectId: ObjectId (ref: Project),
  runAt: Date,
  status: String (enum: running|complete|failed),
  tractionScore: Number,       // 0-100
  riskScore: Number,           // 0-100
  sustainabilityScore: Number, // 0-100
  communityHealthScore: Number,// 0-100
  growthProbability: Number,   // 0-100
  confidenceInterval: Number,  // 0-100
  aiSummary: String,
  riskLevel: String,           // low|medium|high|critical
  onChainMetrics: Object,
  githubMetrics: Object,
  sentimentMetrics: Object,
  riskSignals: [String],
  walletIntelligence: Object,
  components: Array            // frontend render components
}
```

---

## Analysis Pipeline

```
Project submitted
      ↓
OnChainCollector.collect(contract, chain)
      ↓ (parallel)
GitHubAnalyzer.analyze(githubUrl)
SentimentAnalyzer.analyze(twitterHandle)
WalletIntelligence.analyze(contract, chain)
      ↓
RiskDetector.detect(onChainData)
      ↓
ScoringEngine.score(allData)
      ↓
ReportGenerator.generate(scores + allData)  ← Gemini call
      ↓
Save Analysis to MongoDB
      ↓
Emit WebSocket update to user
```

---

## Agent Tools

| Tool | Input | Output |
|------|-------|--------|
| `get_onchain_metrics` | projectId | holder count, volume, liquidity, whale activity |
| `get_github_activity` | projectId | commits, contributors, dev health score |
| `get_social_sentiment` | projectId | sentiment score, bot ratio, trend |
| `get_risk_signals` | projectId | risk signals array, risk level |
| `get_wallet_intelligence` | projectId | whale clusters, smart money movements |
| `generate_report` | projectId | full AI report with components |
| `compare_projects` | [projectId] | side-by-side score comparison |

---

## Environment Variables

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/metagauge-agent
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

# RPC endpoints
ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com
BASE_RPC_URL=https://base-rpc.publicnode.com
BNB_RPC_URL=https://bsc-rpc.publicnode.com
ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# External APIs
GITHUB_TOKEN=...
TWITTER_BEARER_TOKEN=...

# Auth (shared with main app)
JWT_SECRET=...
```

---

## Hackathon Demo Flow

1. User logs in (existing auth)
2. Submits a token contract (e.g. a real Ethereum ERC-20)
3. System collects on-chain data + GitHub + Twitter
4. AI scores the project (traction, risk, growth)
5. Dashboard shows scores + charts + AI report
6. User chats with agent: "Why is the risk score high?"
7. Agent explains using real data from tools
8. Alert fires if whale movement detected
