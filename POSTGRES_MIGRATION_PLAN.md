# PostgreSQL Migration Plan — Validated

## Strategy
- **PostgreSQL** = source of truth for all persistent user/business data
- **File system** = temporary cache only for: function analytics, wallet enrichment queue, ABI files, generated reports
- All API endpoints read/write from PostgreSQL after migration
- `DATABASE_TYPE=postgres` in `.env` activates the switch

---

## Complete Data Inventory

### Currently in `database/index.js` toggle (partially working)

| Data | File path | Storage class | PG table | PG class exists? |
|---|---|---|---|---|
| Users | `data/users.json` | `UserStorage` | `users` + `user_onboarding` + `user_preferences` | ✅ |
| Contracts | `data/users/{id}/contracts.json` | `ContractStorage` | `contracts` + `contract_competitors` + `contract_rpc_config` + `contract_analysis_params` | ✅ |
| Analyses | `data/users/{id}/analyses.json` | `AnalysisStorage` | `analyses` | ✅ |
| Chat sessions | `data/users/{id}/chat_sessions.json` | `ChatSessionStorage` | `chat_sessions` | ✅ |
| Chat messages | `data/users/{id}/chat_messages.json` | `ChatMessageStorage` | `chat_messages` | ✅ |
| Metrics snapshot | `data/users/{id}/metrics.json` | `MetricsStorage` | ❌ missing | ❌ missing |
| Metrics history | `data/users/{id}/metrics_history.json` | `MetricsHistoryStorage` | ❌ missing | ❌ missing |
| Live poll state | `data/users/{id}/live_poll.json` | `LivePollStorage` | ❌ missing | ❌ missing |

### Completely outside `database/index.js` (always file-based, must be migrated)

| Data | File path | Who writes it | Used by routes |
|---|---|---|---|
| Traction tasks | `data/users/{id}/traction.json` | `TractionStorage.js` | `traction.js` |
| AI learnings | `data/ai-knowledge/task-resolutions.json` | `TractionStorage.js` | `traction.js` |
| Alert configs | `data/alert-configs/{id}.json` | `AlertConfigurationStorage.js` | `alerts.js`, `analysis.js`, `trigger-indexing.js`, `competitive.js` |
| Triggered alerts | `data/alerts.json` | `alerts.js` inline, `AlertEngine.js` | `alerts.js`, `traction.js` |
| Agent config | `data/agent-configs.json` | `alerts.js` inline, `AgentService.js` | `alerts.js`, `agent.js` |
| Competitor raw data | `data/users/{id}/competitors/{addr}_{chain}.json` | `competitor-indexing.js` inline | `competitive.js`, `traction.js`, `ProactiveAgent.js`, `agent/tools/get_competitors.js` |
| Competitor metrics | `data/users/{id}/competitor_metrics.json` | `competitor-indexing.js` inline | `competitive.js` |
| Agent memory | `data/users/{id}/agent-memory.json` | `AgentMemory.js` | `ChatAIService.js`, `AgentService.js` |
| Social posts log | `data/social-posts/{id}.json` | `SocialMediaAgent.js` | `agent.js` |
| AI tasks | `data/ai-tasks.json` | `AITaskManager.js` | `agent/tools/create_task.js`, `agent/tools/get_tasks.js` |
| Briefings | `data/briefings.json` | `BriefingScheduler.js` | `advice.js`, `agent.js` |
| AI advice | `data/ai_advice.json` | `advice.js` inline, `AIGrowthAdvisor.js` | `advice.js` |
| AI insights | `data/ai_insights.json` | `SimpleAIService.js` | (internal) |
| Share tokens | `data/share_tokens.json` | `ShareTokenService.js` | (internal) |
| Feedback | `data/ai-knowledge/feedback.json` | `FeedbackProcessor.js` | `agent.js` |
| Abuse fingerprints | `data/abuse-fingerprints.json` | `AbuseDetectionService.js` | `auth.js` |
| Benchmarks | `data/benchmarks.json` | `BenchmarkingService.js` | (internal) |
| Email logs | `data/email-logs/{id}.json` | `EmailAutomation.js` | (internal) |
| External data cache | `data/external-cache.json` | `ExternalDataFetcher.js` | (internal) |
| Legacy competitors | `data/competitors.json` | `CompetitorStorage.js` | `contracts.js` |

### Stay as files (cache/temp — no DB needed)

| Data | File path | Reason |
|---|---|---|
| Function analytics | `data/function-analytics/{addr}_{chain}/` | Rebuilt from raw txs, cache only |
| Wallet enrichment cache | `data/wallet-enrichment/{addr}_{chain}.json` | Cache, rebuilt from RPC |
| Wallet pipeline queue | `data/wallet-pipeline/{addr}_{chain}_queue.json` | In-flight job queue |
| ABI files | `data/abis/` | Static config files |
| Generated reports | `reports/` | Output artifacts |
| Analysis debug log | `analysis-debug.log` | Dev log |

---

## New Tables Needed (add to `create-schema.js`)

```
metrics              — per user, JSONB blob, UNIQUE(user_id)
metrics_history      — per user per day, JSONB blob, UNIQUE(user_id, date)
live_poll            — per user, JSONB blob, UNIQUE(user_id)
traction             — per user, tasks JSONB + score, UNIQUE(user_id)
alert_configs        — per user, one row per config, indexed by (user_id)
alerts               — per user, triggered notifications, indexed by (user_id, is_read)
agent_configs        — per user, JSONB blob, UNIQUE(user_id)
competitor_data      — per user per contract, JSONB blob, UNIQUE(user_id, address, chain)
competitor_metrics   — per user, JSONB blob, UNIQUE(user_id)
agent_memory         — per user, JSONB blob, UNIQUE(user_id)
social_posts         — per user, append-only log
ai_tasks             — global, one row per task
briefings            — per user, append-only log
ai_advice            — per user, append-only log
ai_insights          — per user, append-only log
share_tokens         — global, one row per token
feedback             — per user, append-only log
abuse_fingerprints   — global, JSONB blob (single row)
benchmarks           — global, JSONB blob
ai_learnings         — global, append-only log
```

---

## New Storage Classes Needed (add to `postgresStorage.js`)

| Class | Table | Key methods |
|---|---|---|
| `PostgresMetricsStorage` | `metrics` | `get(userId)`, `save(userId, data)` |
| `PostgresMetricsHistoryStorage` | `metrics_history` | `append(userId, snapshot)`, `get(userId)` |
| `PostgresLivePollStorage` | `live_poll` | `get(userId)`, `save(userId, data)`, `getAllActive()` |
| `PostgresTractionStorage` | `traction` | `get(userId)`, `save(userId, data)`, `syncTasks(userId, tasks)`, `resolveTask(userId, taskId, opts)`, `reopenTask(userId, taskId)` |
| `PostgresAlertConfigStorage` | `alert_configs` | `create(data)`, `findById(id)`, `findByUserId(userId)`, `findByUserAndContract(userId, contractId)`, `update(id, data)`, `delete(id)` |
| `PostgresAlertsStorage` | `alerts` | `findByUserId(userId)`, `create(data)`, `acknowledge(id, userId)`, `readAll(userId)` |
| `PostgresAgentConfigStorage` | `agent_configs` | `get(userId)`, `save(userId, data)` |
| `PostgresCompetitorDataStorage` | `competitor_data` | `get(userId, address, chain)`, `save(userId, address, chain, data)`, `findByUserId(userId)`, `delete(userId, address, chain)` |
| `PostgresCompetitorMetricsStorage` | `competitor_metrics` | `get(userId)`, `save(userId, data)` |
| `PostgresAgentMemoryStorage` | `agent_memory` | `read(userId)`, `write(userId, data)`, `buildContext(userId)` |
| `PostgresSocialPostsStorage` | `social_posts` | `readLog(userId)`, `appendLog(userId, entry)` |
| `PostgresAITasksStorage` | `ai_tasks` | `readAll()`, `write(tasks)`, `findByUserId(userId)` |
| `PostgresBriefingsStorage` | `briefings` | `readAll()`, `append(entry)`, `findByUserId(userId, type)` |
| `PostgresAIAdviceStorage` | `ai_advice` | `readAll()`, `append(entry)`, `findByUserId(userId)` |
| `PostgresAIInsightsStorage` | `ai_insights` | `readAll()`, `append(entry)`, `findByUserId(userId)` |
| `PostgresShareTokensStorage` | `share_tokens` | `readAll()`, `append(token)`, `findByToken(token)`, `revoke(token)` |
| `PostgresFeedbackStorage` | `feedback` | `readAll()`, `append(entry)`, `findByUserId(userId)` |
| `PostgresAbuseFingerprintsStorage` | `abuse_fingerprints` | `read()`, `write(data)` |
| `PostgresBenchmarksStorage` | `benchmarks` | `read()`, `write(data)` |
| `PostgresAILearningsStorage` | `ai_learnings` | `getAll()`, `append(entry)`, `getForTask(taskId)` |

---

## Files to Modify — Route/Service Layer

Each file below has direct `fs` calls that must be replaced with the storage class from `database/index.js`:

### Routes

| File | Direct fs data | Replace with |
|---|---|---|
| `routes/alerts.js` | `data/alerts.json` (readFileSync/writeFileSync) | `AlertsStorage` |
| `routes/alerts.js` | `data/agent-configs.json` (readFileSync/writeFileSync) | `AgentConfigStorage` |
| `routes/traction.js` | `data/alerts.json` (readFileSync) | `AlertsStorage` |
| `routes/traction.js` | `data/users/{id}/competitors/` (readdir/readFile) | `CompetitorDataStorage` |
| `routes/competitive.js` | `data/users/{id}/competitors/` (readdir/readFile) | `CompetitorDataStorage` |
| `routes/competitive.js` | `data/users/{id}/competitors/{id}.json` (delete) | `CompetitorDataStorage.delete()` |
| `routes/competitor-indexing.js` | `data/users/{id}/competitors/{id}.json` (readFile/writeFile) | `CompetitorDataStorage` |
| `routes/competitor-indexing.js` | `data/users/{id}/competitor_metrics.json` (writeFile/readFile) | `CompetitorMetricsStorage` |
| `routes/agent.js` | `data/briefings.json` (readFile) | `BriefingsStorage` |
| `routes/advice.js` | `data/ai_advice.json` (readFileSync/writeFileSync) | `AIAdviceStorage` |
| `routes/advice.js` | `data/briefings.json` (readFileSync/writeFileSync) | `BriefingsStorage` |

### Services

| File | Direct fs data | Replace with |
|---|---|---|
| `services/TractionStorage.js` | `data/users/{id}/traction.json` | `TractionStorage` from `database/index.js` |
| `services/TractionStorage.js` | `data/ai-knowledge/task-resolutions.json` | `AILearningsStorage` |
| `services/AlertConfigurationStorage.js` | `data/alert-configs/{id}.json` | `AlertConfigStorage` from `database/index.js` |
| `services/AlertEngine.js` | `data/alerts.json` | `AlertsStorage` |
| `services/AgentMemory.js` | `data/users/{id}/agent-memory.json` | `AgentMemoryStorage` |
| `services/AgentService.js` | `data/agent-configs.json` | `AgentConfigStorage` |
| `services/SocialMediaAgent.js` | `data/social-posts/{id}.json` | `SocialPostsStorage` |
| `services/AITaskManager.js` | `data/ai-tasks.json` | `AITasksStorage` |
| `services/BriefingScheduler.js` | `data/briefings.json` | `BriefingsStorage` |
| `services/SimpleAIService.js` | `data/ai_insights.json` | `AIInsightsStorage` |
| `services/ShareTokenService.js` | `data/share_tokens.json` | `ShareTokensStorage` |
| `services/FeedbackProcessor.js` | `data/ai-knowledge/feedback.json` | `FeedbackStorage` |
| `services/AbuseDetectionService.js` | `data/abuse-fingerprints.json` | `AbuseFingerprintsStorage` |
| `services/BenchmarkingService.js` | `data/benchmarks.json` | `BenchmarksStorage` |
| `services/AIGrowthAdvisor.js` | `data/ai_advice.json` | `AIAdviceStorage` |
| `services/EmailAutomation.js` | `data/email-logs/{id}.json` | `EmailLogsStorage` (new table) OR keep as file (low priority) |
| `services/ExternalDataFetcher.js` | `data/external-cache.json` | Keep as file cache (external API cache) |
| `services/RAGContextBuilder.js` | `data/ai-knowledge/chain-learnings.json` | `AILearningsStorage` or keep as file |
| `services/agent/tools/get_competitors.js` | `data/users/{id}/competitors/` | `CompetitorDataStorage` |
| `services/ProactiveAgent.js` | `data/users/{id}/competitors/` | `CompetitorDataStorage` |
| `database/CompetitorStorage.js` | `data/competitors.json` (legacy global) | Delete — merge into `contract_competitors` table |

---

## `database/index.js` — Export All Classes for Both Modes

Currently exports 8 classes. After migration must export all 28:

```js
// Already exported (both modes):
UserStorage, ContractStorage, AnalysisStorage,
ChatSessionStorage, ChatMessageStorage,
MetricsStorage, LivePollStorage, MetricsHistoryStorage

// Add for both modes:
TractionStorage, AlertConfigStorage, AlertsStorage,
AgentConfigStorage, CompetitorDataStorage, CompetitorMetricsStorage,
AgentMemoryStorage, SocialPostsStorage, AITasksStorage,
BriefingsStorage, AIAdviceStorage, AIInsightsStorage,
ShareTokensStorage, FeedbackStorage, AbuseFingerprintsStorage,
BenchmarksStorage, AILearningsStorage
```

---

## `migrate-data.js` — What to Migrate

Current script only reads old flat `data/analyses.json`. Must be extended to:

1. Walk `data/users/{uuid}/` for each user in `data/users.json`
2. Per user: `analyses.json`, `chat_sessions.json`, `chat_messages.json`, `metrics.json`, `metrics_history.json`, `live_poll.json`, `traction.json`, `agent-memory.json`
3. `data/alert-configs/*.json` → `alert_configs` table
4. `data/alerts.json` → `alerts` table
5. `data/agent-configs.json` → `agent_configs` table
6. `data/users/{id}/competitors/*.json` → `competitor_data` table
7. `data/users/{id}/competitor_metrics.json` → `competitor_metrics` table
8. `data/social-posts/{id}.json` → `social_posts` table
9. `data/ai-tasks.json` → `ai_tasks` table
10. `data/briefings.json` → `briefings` table
11. `data/ai_advice.json` → `ai_advice` table
12. `data/ai_insights.json` → `ai_insights` table
13. `data/share_tokens.json` → `share_tokens` table
14. `data/ai-knowledge/feedback.json` → `feedback` table
15. `data/abuse-fingerprints.json` → `abuse_fingerprints` table
16. `data/ai-knowledge/task-resolutions.json` → `ai_learnings` table

---

## Execution Phases

### Phase 1 — Schema (1 file, ~1h)
**File**: `scripts/create-schema.js`
Add 20 new tables. Run: `npm run db:schema`

### Phase 2 — Storage classes (1 file, ~3h)
**File**: `src/api/database/postgresStorage.js`
Add 20 new PostgreSQL storage classes (all JSONB-based for simplicity).

### Phase 3 — Fix `database/index.js` (1 file, ~30min)
**File**: `src/api/database/index.js`
Export all 28 storage classes for both file and postgres modes.

### Phase 4 — Refactor services (16 files, ~3h)
Replace direct `fs` calls in services with storage class imports from `database/index.js`.
Priority order (most used first):
1. `AlertEngine.js` — used by indexing
2. `AgentMemory.js` — used by chat
3. `TractionStorage.js` — used by traction route
4. `AlertConfigurationStorage.js` — used by 4 routes
5. `AgentService.js` — used by agent route
6. `SocialMediaAgent.js`
7. `AITaskManager.js`
8. `BriefingScheduler.js`
9. `SimpleAIService.js`
10. `ShareTokenService.js`
11. `FeedbackProcessor.js`
12. `AbuseDetectionService.js`
13. `BenchmarkingService.js`
14. `AIGrowthAdvisor.js`
15. `agent/tools/get_competitors.js`
16. `ProactiveAgent.js`

### Phase 5 — Refactor routes (5 files, ~2h)
1. `routes/alerts.js` — alerts + agent-configs
2. `routes/traction.js` — alerts + competitors
3. `routes/competitive.js` — competitors
4. `routes/competitor-indexing.js` — competitors + competitor_metrics
5. `routes/advice.js` — advice + briefings
6. `routes/agent.js` — briefings

### Phase 6 — Complete `migrate-data.js` (1 file, ~1h)
Extend to cover all 16 data sources listed above.

### Phase 7 — Test & Cutover (~1h)
```bash
npm run db:schema          # create all 30 tables
npm run db:migrate         # migrate all data
npm run db:verify-migration

# In .env:
DATABASE_TYPE=postgres

npm run dev                # start server
npm run verify:system      # smoke test
npm run verify:routes
npm run verify:flow
```

---

## Summary

| | Count |
|---|---|
| New DB tables | 20 |
| New PG storage classes | 20 |
| Services to refactor | 16 |
| Routes to refactor | 6 |
| Data sources to migrate | 16 |
| Files that stay as-is (cache) | 5 |
| Total estimated time | ~9h |
