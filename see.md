# MetaGauge Business AI — RAG Architecture

## What We're Building

A RAG (Retrieval-Augmented Generation) business AI that:
- Consults a defined knowledge base before every response (never acts on its own)
- Has metric boundaries — every metric has good/warn/bad ranges enforced in prompts
- Learns from each analysis and documents findings per chain, per user
- Calls external APIs (DeFiLlama, CoinGecko, Etherscan, web search) to enrich context
- Assigns tasks to users based on observed metric gaps
- Observes on-chain data to check if tasks are completed
- Fires alerts when tasks complete, go overdue, or metrics breach thresholds
- Generates daily/weekly/monthly briefings
- Goal: automate data intelligence to help users scale and grow

---

## Architecture

```
data/ai-knowledge/
├── metrics-definitions.json     ← boundaries for every metric
├── chain-learnings.json          ← what AI learned per chain
├── user-learnings.json           ← per-user patterns
└── market-context.json           ← cached external data

src/services/
├── RAGContextBuilder.js          ← assembles context for every AI prompt
├── ExternalDataFetcher.js        ← DeFiLlama, CoinGecko, Etherscan, web
├── BusinessAIEngine.js           ← unified AI engine (replaces scattered services)
└── AITaskManager.js              ← task creation + on-chain observation

data/
├── ai-tasks.json                 ← tasks AI assigned to users
└── ai-knowledge/                 ← persistent AI memory
```

---

## Components

### 1. metrics-definitions.json
Every metric with: `definition`, `goodRange`, `warnRange`, `badRange`, `unit`, `alertThreshold`, `interpretation`

Metrics covered:
- retentionRate7d, retentionRate30d
- successRate, failureRate
- botRatio, whaleConcentration
- dau, mau, newUsers, churnRate
- tvl, volume, fees, revenue
- gasEfficiency, avgGasUsed
- liquidityUtilization, volumeToTvlRatio
- engagementScore, userLifecycleScore

### 2. RAGContextBuilder.js
Assembles the full context block injected into every AI prompt:
- Metric definitions + boundaries for metrics present in current data
- Chain learnings for this contract's chain
- User-specific patterns and history
- Recent market context (cached, refreshed every 6h)
- Previous AI decisions and outcomes

### 3. ExternalDataFetcher.js
External API integrations:
- **DeFiLlama** — TVL, protocol rankings, chain data
- **CoinGecko** — token prices, market cap, volume
- **Etherscan** — contract verification, ABI, labels
- **Brave Search / SerpAPI** — web search for protocol news
- Results cached in `data/ai-knowledge/market-context.json`

### 4. BusinessAIEngine.js
Single unified AI engine. Methods:
- `analyze(userId, contractId, metrics)` — full analysis with RAG context
- `chat(userId, sessionId, message, contractContext)` — chat with memory
- `learn(source, chain, data, outcome)` — write findings to knowledge base
- `brief(userId, type)` — daily/weekly/monthly briefing
- `generateTasks(userId, contractId, metrics)` — create tasks from metric gaps
- `evaluateTask(taskId, currentMetrics)` — check if task is done on-chain

### 5. AITaskManager.js
- `createTask(userId, contractId, goal, targetMetric, targetValue, deadlineDays)`
- `observeAllTasks(userId, currentMetrics)` — called after every analysis
- `markComplete(taskId)` / `markOverdue(taskId)`
- Fires AlertEngine when task status changes

---

## Task Flow

```
1. Analysis runs → metrics computed
2. BusinessAIEngine.analyze() called with RAG context
3. AI identifies gaps (e.g. retention 18% < 20% threshold)
4. AITaskManager.createTask() → "Re-engage churned wallets"
   - targetMetric: retentionRate7d
   - targetValue: 30%
   - deadline: 14 days
5. Next analysis cycle → observeAllTasks() checks metrics
6. If retentionRate7d >= 30% → task complete → alert user ✅
7. If deadline passed → task overdue → alert user ⚠️
8. BusinessAIEngine.learn() → documents outcome in chain-learnings.json
```

---

## RAG Prompt Structure

Every AI call gets this context block prepended:

```
=== KNOWLEDGE BASE ===
[Metric definitions with boundaries for metrics in current data]

=== CHAIN LEARNINGS (ethereum) ===
[What AI has learned from previous ethereum contract analyses]

=== USER PATTERNS ===
[This user's historical contract behavior and outcomes]

=== MARKET CONTEXT ===
[Latest DeFiLlama/CoinGecko data for relevant tokens/protocols]

=== TASK HISTORY ===
[Previous tasks assigned, completed, and their outcomes]

=== YOUR ROLE ===
You are a business intelligence AI. You MUST:
- Only draw conclusions supported by the data above
- Reference specific metric values and their boundaries
- Assign actionable tasks with measurable targets
- Learn from outcomes and update your knowledge
```

---

## Build Order

- [x] Plan documented (this file)
- [x] 1. `data/ai-knowledge/metrics-definitions.json`
- [x] 2. `src/services/RAGContextBuilder.js`
- [x] 3. `src/services/ExternalDataFetcher.js`
- [x] 4. `src/services/BusinessAIEngine.js`
- [x] 5. `src/services/AITaskManager.js`
- [x] 6. All AI endpoints wired to BusinessAIEngine (see table below)
- [ ] 7. Frontend: task panel in dashboard

## All AI Endpoints — Now RAG-Grounded

| Endpoint | Method | Engine |
|----------|--------|--------|
| `/api/analysis/:id/interpret` | POST | `businessAI.analyze()` |
| `/api/analysis/:id/quick-insights` | GET | `businessAI.analyze()` |
| `/api/analysis/:id/recommendations` | POST | `businessAI.analyze()` |
| `/api/analysis/:id/alerts` | POST | `businessAI.analyze()` |
| `/api/analysis/:id/sentiment` | POST | `businessAI.analyze()` |
| `/api/analysis/:id/optimizations` | POST | `businessAI.analyze()` |
| `/api/chat/sessions/:id/messages` | POST | `businessAI.chat()` |
| `/api/ai/insights/:contractId` | POST | `businessAI.analyze()` |
| `/api/ai/chat/:contractId` | POST | `businessAI.chat()` |
| `/api/ai/health-check/:contractId` | POST | `businessAI.analyze()` |
| `/api/ai/check-anomalies/:contractId` | POST | `businessAI.analyze()` |
| `/api/ai/assignments/:contractId` | GET | `AITaskManager` |
| `/api/advice/briefings` | GET | stored briefings |
| `/api/advice/briefings` | POST | `businessAI.brief()` |
| `/api/tasks` | GET | `AITaskManager.getAllTasks()` |
| `/api/tasks/active` | GET | `AITaskManager.getActiveTasks()` |
| `/api/tasks/:id` | DELETE | `AITaskManager.dismissTask()` |

---

## Files Modified / Created

| File | Action | Purpose |
|------|--------|---------|
| `data/ai-knowledge/metrics-definitions.json` | Create | Metric boundaries knowledge base |
| `data/ai-knowledge/chain-learnings.json` | Create | Per-chain AI memory |
| `data/ai-knowledge/user-learnings.json` | Create | Per-user AI memory |
| `data/ai-knowledge/market-context.json` | Create | Cached external data |
| `data/ai-tasks.json` | Create | Active AI-assigned tasks |
| `src/services/RAGContextBuilder.js` | Create | Context assembler |
| `src/services/ExternalDataFetcher.js` | Create | External API caller |
| `src/services/BusinessAIEngine.js` | Create | Unified AI engine |
| `src/services/AITaskManager.js` | Create | Task lifecycle manager |
| `src/api/routes/analysis.js` | Modify | Use BusinessAIEngine |
| `src/api/routes/chat.js` | Modify | Use BusinessAIEngine |
| `src/api/routes/simple-ai.js` | Modify | Use BusinessAIEngine |
| `src/api/routes/tasks.js` | Create | Task CRUD API |
| `frontend/components/analyzer/tasks-panel.tsx` | Create | Task UI in dashboard |
