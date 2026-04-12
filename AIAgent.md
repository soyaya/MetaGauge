# MetaGauge AI Agent — Full Scale Architecture

## Overview

Single unified AI agent replacing all isolated Gemini calls across the app.
Uses Gemini function calling — the model decides what data it needs, calls tools, gets real data, then answers.
Powers: /chat, /analyzer (traction), /dashboard analysis, proactive monitoring, email automation, marketing content.

---

## Current State vs Target State

| Surface | Current | After Agent |
|---|---|---|
| /chat | BusinessAIEngine (RAG + manual prompt) | AgentService (function calling) |
| /analyzer tasks | Rule-based generateTasks() | Agent generates + enriches tasks |
| /analyzer recommendations | Direct Gemini, no RAG | Agent: search_learnings + market context |
| /analyzer task check | Direct Gemini | Agent: get_metrics + compare |
| Briefings | Mock data | Agent: real metrics + real analysis |
| Email | Not triggered by real events | EmailAutomation on real metric changes |
| Marketing | Does not exist | TractionNarrator via agent |

---

## Complete File Map

### New files

```
src/services/AgentService.js
src/services/agent/tools/index.js
src/services/agent/tools/get_metrics.js
src/services/agent/tools/get_tasks.js
src/services/agent/tools/get_history.js
src/services/agent/tools/get_competitors.js
src/services/agent/tools/get_transactions.js
src/services/agent/tools/resolve_task.js
src/services/agent/tools/search_learnings.js
src/services/agent/tools/get_market_context.js
src/services/agent/tools/create_task.js          ← NEW: agent creates tasks for /analyzer
src/services/agent/tools/get_analyzer_state.js   ← NEW: reads OPS score + pillar breakdown
src/services/EmailAutomation.js
src/services/FeedbackProcessor.js
src/services/ProactiveAgent.js
src/services/TractionNarrator.js
src/api/routes/agent.js
data/ai-knowledge/feedback.json
data/users/{userId}/email-log.json
```

### Modified files

```
src/api/routes/chat.js          swap businessAI.chat() → AgentService.run()
src/api/routes/traction.js      swap direct Gemini → AgentService.run() on recommendation + check
src/api/routes/agent.js         new route file
src/services/RAGContextBuilder.js  add feedback.json reading
src/services/BriefingScheduler.js  replace mock data with real AnalysisStorage reads
src/api/server.js               register /api/agent + ProactiveAgent.init()
```

---

## AgentService — Core Loop

File: src/services/AgentService.js

```
AgentService.run(userId, message, context)

context shape:
{
  contractAddress: string,
  chain: string,
  sessionId: string | null,
  sessionHistory: [{ role, content }],   // last 6 messages
  source: 'chat' | 'traction' | 'analyzer' | 'proactive' | 'marketing'
}

Loop:
  1. RAGContextBuilder.build()  → system prompt (metric boundaries, chain learnings, user patterns, market ctx, feedback patterns)
  2. Load tool schemas           → all 10 tool definitions
  3. Gemini call #1 (function calling mode, gemini-2.0-flash-exp)
  4. If response has functionCalls → execute tools → append results → Gemini call #2
  5. Repeat max 5 iterations until text response
  6. Parse JSON { content, components[] }
  7. Return { content, components, toolsUsed[], iterations }
```

---

## All 10 Tools

### Tool 1: get_metrics
File: src/services/agent/tools/get_metrics.js
Reads: AnalysisStorage.findByUserId(userId) → latest completed analysis
Returns: { summary, retentionMetrics, activationMetrics, gasAnalysis, defiMetrics, userBehavior, userQualityMetrics }
Gemini calls this when: user asks about performance, KPIs, retention, gas, TVL

### Tool 2: get_tasks
File: src/services/agent/tools/get_tasks.js
Reads: TractionStorage.getTraction(userId) + AITaskManager.getActiveTasks(userId)
Returns: { tractionTasks[], aiTasks[], openCount, resolvedCount, overdueCount }
Gemini calls this when: "what should I fix?", "open issues", task status

### Tool 3: get_history
File: src/services/agent/tools/get_history.js
Reads: MetricsHistoryStorage.findByUserId(userId)
Returns: { history[], trend: 'improving'|'declining'|'stable', deltaLast7d }
Gemini calls this when: trends, growth, "how has X changed"

### Tool 4: get_competitors
File: src/services/agent/tools/get_competitors.js
Reads: data/users/{userId}/competitors/*.json
Returns: { competitors[], marketShare, benchmarks }
Gemini calls this when: competition, market position, "how do I compare"

### Tool 5: get_transactions
File: src/services/agent/tools/get_transactions.js
Reads: latest analysis transactions array
Args: { limit: number, filter: 'all'|'failed'|'whale' }
Returns: { transactions[], totalCount, failureRate, avgValue }
Gemini calls this when: specific transactions, failures, whale activity

### Tool 6: resolve_task
File: src/services/agent/tools/resolve_task.js
Writes: TractionStorage.resolveTask() + TractionStorage.saveLearning()
Returns: { task, saved: true }
Gemini calls this when: metric improved and task should be closed

### Tool 7: search_learnings
File: src/services/agent/tools/search_learnings.js
Reads: data/ai-knowledge/task-resolutions.json + data/ai-knowledge/feedback.json
Args: { query: string, metricName?: string }
Returns: { resolutions[], feedbackPatterns[], relevantCount }
Gemini calls this when: generating recommendations — "what worked before"

### Tool 8: get_market_context
File: src/services/agent/tools/get_market_context.js
Calls: ExternalDataFetcher.getProtocolContext(contractAddress, chain, category)
Returns: { chainTVL, categoryTVL, topProtocols[], ethPrice, tam, sam, som }
Gemini calls this when: market size, TAM/SAM/SOM, competitive landscape, token prices

### Tool 9: create_task  ← KEY FOR /analyzer
File: src/services/agent/tools/create_task.js
Writes: TractionStorage (via syncTasks) + AITaskManager.createTask()
Args: {
  title: string,
  description: string,
  metric: string,
  current: number,
  target: number,
  lowerBetter: boolean,
  pillar: string,
  priority: 'high'|'medium'|'low',
  action: string,
  deadlineDays: number
}
Returns: { task, taskId, created: true }
Gemini calls this when: source='analyzer', agent identifies a failing metric and creates an actionable task

### Tool 10: get_analyzer_state
File: src/services/agent/tools/get_analyzer_state.js
Reads: TractionStorage.getTraction(userId) + calculateOPS(fr, alerts) from traction route logic
Returns: {
  opsScore: number,
  opsLabel: string,
  pillars: { featureStability, responseToAlerts, resolutionEfficiency, taskCompletion, hygiene },
  openTasks: number,
  highPriorityTasks: number,
  productivityScore: number
}
Gemini calls this when: source='analyzer', agent needs current health state before creating tasks

---

## API Endpoints

File: src/api/routes/agent.js
All routes: authenticateToken middleware

### POST /api/agent/chat
Internal — called by chat route, not directly by frontend.
Body: { sessionId, message, contractAddress, chain }
Returns: { content, components[], toolsUsed[], sessionId }

### POST /api/agent/analyze
Agent-powered analyzer task generation. Called by /analyzer page on load or refresh.
Body: { contractAddress, chain }
Process:
  AgentService.run(userId, 'Analyze this contract. Identify all failing metrics. Create tasks for each one.', {
    source: 'analyzer', contractAddress, chain
  })
  Agent calls: get_metrics() → get_analyzer_state() → get_market_context() → create_task() × N
Returns: { tasks[], opsScore, insights[], components[] }

### POST /api/agent/feedback
Body: { messageId, sessionId, rating: 1|-1, note?: string, componentType?: string }
Process: FeedbackProcessor.save(userId, feedback)
Returns: { saved: true }

### GET /api/agent/digest
Query: ?type=daily|weekly|monthly
Returns: { briefing: { title, content, createdAt } }

### POST /api/agent/generate-content
Body: { type: 'investor_summary'|'twitter_thread'|'pitch_slide', contractAddress, chain }
Process: TractionNarrator.generate(userId, type, context)
Returns: { content, type, generatedAt }

---

## /analyzer Route Integration

The /analyzer page (frontend/app/analyzer/page.tsx) currently:
1. Calls GET /api/traction/dashboard → gets tasks from rule-based generateTasks()
2. Displays OPS score, tasks, growth metrics, retention

After agent integration:
1. Page still calls GET /api/traction/dashboard (unchanged — rule-based tasks still work as baseline)
2. NEW: Page also calls POST /api/agent/analyze → agent enriches tasks with:
   - Market context ("your D7 retention 8% vs category avg 18%")
   - Past learnings ("similar DeFi protocols fixed this with referral programs")
   - Priority reasoning ("this is high priority because it affects 3 OPS pillars")
   - Deadline suggestions based on metric severity
3. Agent-created tasks appear alongside rule-based tasks with an "AI Enhanced" badge
4. Task recommendations now come from agent (search_learnings + market context) not raw Gemini

### How create_task integrates with existing traction system

Existing: generateTasks(fr, ops) → rule-based task list → syncTasks(userId, tasks) → traction.json
Agent:    AgentService.run() → create_task tool → AITaskManager.createTask() → ai-tasks.json

Both task stores are read by get_tasks tool.
GET /api/traction/tasks returns merged view: rule-based tasks + AI-created tasks.
Frontend renders both with source indicator.

---

## Modified Route: chat.js

POST /api/chat/sessions/:id/messages

Before:
  const aiResponse = await businessAI.chat({ userId, message, contractAddress, chain, metrics, analysisData, sessionHistory });

After:
  const aiResponse = await AgentService.run(userId, messageContent, {
    contractAddress: session.contractAddress,
    chain: session.contractChain,
    sessionId,
    sessionHistory: chatHistory.map(m => ({ role: m.role, content: m.content })),
    source: 'chat'
  });

No frontend changes. Same response shape { content, components[] }.

---

## Modified Route: traction.js

GET /api/traction/tasks/:taskId/recommendation

Before:
  const gemini = new GeminiAIService();
  recommendation = await gemini.generateContent(prompt);

After:
  const result = await AgentService.run(userId,
    `Give me a recommendation for task: ${task.title}. Current ${task.metric}: ${task.current}. Target: ${task.target}`,
    { contractAddress: contract.address, chain: contract.chain, source: 'traction' }
  );
  // Agent calls search_learnings() + get_market_context() + get_metrics() automatically
  recommendation = result.content;
  components = result.components;

POST /api/traction/tasks/:taskId/check

Before:
  const guidance = await GeminiAIService.generateContent(prompt);

After:
  const result = await AgentService.run(userId,
    `Check if task "${task.title}" is complete. Current ${task.metric}: ${task.current}. Target: ${task.target}`,
    { contractAddress: contract.address, chain: contract.chain, source: 'traction' }
  );

---

## EmailAutomation

File: src/services/EmailAutomation.js
Event-driven — called by other services, not a scheduler.

Triggers:

| Event | Called from | Email |
|---|---|---|
| Task completed | AITaskManager._fireTaskAlert() | "Task resolved: {goal}" |
| Task overdue | AITaskManager._fireTaskAlert() | "Task overdue: {goal}" |
| Metric regression >20% | ProactiveAgent.checkMetricRegressions() | "{metric} dropped from X to Y" |
| Weekly digest | ProactiveAgent weekly cron | OPS score + top 3 tasks + wins |
| User inactive 7d | ProactiveAgent.checkInactiveUsers() | "5 unresolved issues on your contract" |
| Competitor spike | ProactiveAgent.checkCompetitorSpikes() | "{competitor} volume up 40%" |

Anti-spam guard:
  reads data/users/{userId}/email-log.json
  max 1 non-critical email per day per user
  critical (high severity, regression >20%) bypasses limit
  writes { type, sentAt } after each send

Reads user.email from: UserStorage.findById(userId) → user.email (exists in users.json)
Uses: EmailService.sendAlert() and EmailService.sendBriefing() (both already implemented)

---

## FeedbackProcessor

File: src/services/FeedbackProcessor.js

save(userId, { messageId, rating, note, componentType }):
  append to data/ai-knowledge/feedback.json
  if note: RAGContextBuilder.learn({ type: 'user', key: userId, finding: note })

getPatterns(userId):
  reads feedback.json
  groups by componentType + rating
  returns { disliked: ['recommendation',...], liked: ['chart',...] }

RAGContextBuilder change — add section 7 to build():
  const patterns = await FeedbackProcessor.getPatterns(userId)
  if patterns.disliked.length > 0:
    sections.push("Avoid these response types (user rated poorly): " + patterns.disliked.join(', '))
    sections.push("Prefer these response types: " + patterns.liked.join(', '))

---

## ProactiveAgent

File: src/services/ProactiveAgent.js
Initialized in server.js after server starts. Passed wsManager for WebSocket alerts.

Cron schedule:
  every 1 hour:   checkMetricRegressions()
  every day 8am:  checkInactiveUsers() + checkCompetitorSpikes() + generateDailyDigest()
  every Monday:   generateWeeklyReport()

checkMetricRegressions():
  for each user in UserStorage.findAll():
    latest   = AnalysisStorage.findByUserId(userId)[0]
    previous = MetricsHistoryStorage.findByUserId(userId)[0]
    if retentionRate dropped >20%:
      EmailAutomation.sendRegressionAlert(userId, metric, before, after)
      AlertEngine.create(userId, { severity: 'high', ... })
      wsManager.emitProgress(userId, { type: 'alert', alert })

checkInactiveUsers():
  for each user:
    if user.lastLogin < 7 days ago AND open tasks > 0:
      EmailAutomation.sendInactiveNudge(userId, openTaskCount)

generateDailyDigest():
  for each user with preferences.notifications.email = true:
    traction = TractionStorage.getTraction(userId)
    briefing = await BusinessAIEngine.brief({ userId, type: 'daily', contracts })
    EmailAutomation.sendDigest(userId, briefing)

BriefingScheduler fix:
  Replace getYesterdayMetrics() mock → AnalysisStorage.findByUserId(userId)[0]
  Replace getCompetitorMovements() mock → loadCompetitors(userId)
  Replace getWeeklyData() mock → MetricsHistoryStorage.findByUserId(userId)

---

## TractionNarrator (Marketing)

File: src/services/TractionNarrator.js

generate(userId, type, { contractAddress, chain }):
  loads traction data, latest analysis, competitor data

  type = 'investor_summary':
    AgentService.run(userId,
      'Generate an investor-ready traction summary with benchmarks vs category averages',
      { source: 'marketing', contractAddress, chain }
    )
    Agent calls: get_metrics() + get_competitors() + get_market_context()
    Returns: paragraph with benchmarks ("43% retention — top 20% of DeFi")

  type = 'twitter_thread':
    AgentService.run(userId,
      'Write a Twitter thread about this contract milestone using real numbers',
      { source: 'marketing', contractAddress, chain }
    )
    Agent calls: get_metrics() + get_history() + get_market_context()
    Returns: array of tweets with data points

  type = 'pitch_slide':
    AgentService.run(userId,
      'Generate pitch deck slide data: headline, 4 bullet metrics, one chart',
      { source: 'marketing', contractAddress, chain }
    )
    Agent calls: get_metrics() + get_competitors() + get_market_context()
    Returns: { headline, bullets[], chart_data }

---

## Data Files

### data/ai-knowledge/feedback.json (new)
[
  {
    "userId": "abc123",
    "messageId": "msg-xyz",
    "sessionId": "sess-abc",
    "rating": -1,
    "note": "Too many charts, just give me the number",
    "componentType": "chart",
    "savedAt": "2026-04-07T18:00:00Z"
  }
]

### data/users/{userId}/email-log.json (new)
[
  { "type": "digest", "sentAt": "2026-04-07T08:00:00Z" },
  { "type": "regression_alert", "sentAt": "2026-04-07T14:30:00Z" }
]

### data/ai-knowledge/task-resolutions.json (existing, already written by TractionStorage.saveLearning)
[
  {
    "taskId": "d7_ret",
    "feedback": "Added referral program — brought back churned users",
    "metricBefore": 8,
    "metricAfter": 22,
    "chain": "ethereum",
    "contractType": "defi",
    "savedAt": "2026-04-07T10:00:00Z"
  }
]

---

## server.js Changes

import AgentService from './services/AgentService.js';
import { ProactiveAgent } from './services/ProactiveAgent.js';
import agentRoutes from './api/routes/agent.js';

app.use('/api/agent', authenticateToken, agentRoutes);

server.listen(PORT, () => {
  ProactiveAgent.init(wsManager);
  console.log('ProactiveAgent started');
});

---

## End-to-End Flow: /analyzer Page Load

Frontend: GET /api/traction/dashboard
  → traction.js buildFR() → generateTasks() (rule-based) → syncTasks()
  → returns { ops, tasks[], growth, retentionMetrics, ... }
  → page renders OPS score + task list

Frontend: POST /api/agent/analyze  { contractAddress, chain }
  → agent.js → AgentService.run(userId, 'Analyze contract, create tasks for failing metrics', { source: 'analyzer' })
    → RAGContextBuilder.build()
    → Gemini call #1: decides to call get_metrics() + get_analyzer_state()
    → Tool results: metrics with status (red/yellow/green) + current OPS pillars
    → Gemini call #2: decides to call get_market_context() + search_learnings()
    → Tool results: category benchmarks + past solutions
    → Gemini call #3: calls create_task() × N for each red/yellow metric
      each task includes: market context ("8% vs 18% category avg"), past solutions, deadline
    → Gemini generates final response: { content: "I found 5 issues...", components: [insight_card, recommendation × 5] }
  → returns { tasks[], opsScore, insights[], components[] }
  → page merges agent tasks with rule-based tasks, shows "AI Enhanced" badge on agent tasks

---

## End-to-End Flow: Chat Message

Frontend: POST /api/chat/sessions/{id}/messages  { content: "What's my retention?" }
  → chat.js authenticateToken → subscriptionService.chargeMiddleware('ai_query')
  → ChatSessionStorage.findById(sessionId) → session
  → ChatMessageStorage.create({ role: 'user', content })
  → ChatAIService.getContractContext(userId, address, chain) → contractContext
  → ChatMessageStorage.getRecentContext(sessionId, 10) → chatHistory
  → AgentService.run(userId, "What's my retention?", { source: 'chat', sessionId, sessionHistory })
    → RAGContextBuilder.build() → system prompt
    → Gemini call #1: calls get_metrics() + get_tasks()
    → Tool results: retentionMetrics { d1:45, d7:22, d30:12 } + open tasks
    → Gemini generates: "Your D7 retention is 22%..." + [metric_card, chart, recommendation]
  → ChatMessageStorage.create({ role: 'assistant', content, components })
  → res.json({ userMessage, assistantMessage })
  → Frontend ChatMessage renders content + components

---

## End-to-End Flow: Traction Recommendation

Frontend: GET /api/traction/tasks/d7_ret/recommendation
  → traction.js buildFR() → task = { title: 'Improve D7 retention', current: 8, target: 15 }
  → AgentService.run(userId, 'Recommendation for: Improve D7 retention. Current: 8%. Target: 15%', { source: 'traction' })
    → Gemini call #1: calls search_learnings({ metricName: 'd7Retention' }) + get_market_context()
    → Tool results:
        resolutions: ["Added referral program → retention went 8% → 22%"]
        market: { categoryTVL, topProtocols, ethPrice }
    → Gemini call #2: calls get_metrics() for full context
    → Gemini generates: "Based on what worked for similar DeFi protocols: 1. Referral program..."
      + [recommendation component, insight_card]
  → res.json({ recommendation, components })

---

## End-to-End Flow: Proactive Email

ProactiveAgent (cron, every hour) → checkMetricRegressions()
  for each user:
    latest   = AnalysisStorage.findByUserId(userId)[0]
    previous = MetricsHistoryStorage.findByUserId(userId)[0]
    if retentionRate dropped >20%:
      EmailAutomation.sendRegressionAlert(userId, 'retentionRate', 22, 16)
        → UserStorage.findById(userId) → user.email
        → check email-log.json → not sent today?
        → EmailService.sendAlert(user.email, {
            severity: 'high',
            title: 'Retention dropped 27%',
            message: 'D7 retention fell from 22% to 16% since last analysis'
          })
        → append { type: 'regression_alert', sentAt } to email-log.json
      wsManager.emitProgress(userId, { type: 'alert', alert })
        → frontend WebSocket receives → shows toast notification

---

## End-to-End Flow: Marketing Content

Frontend: POST /api/agent/generate-content  { type: 'twitter_thread', contractAddress, chain }
  → agent.js → TractionNarrator.generate(userId, 'twitter_thread', { contractAddress, chain })
    → AgentService.run(userId, 'Write a Twitter thread about this contract milestone', { source: 'marketing' })
      → Gemini calls: get_metrics() + get_history() + get_market_context()
      → Tool results: real metrics + 30d trend + category benchmarks
      → Gemini generates thread:
          Tweet 1: "Our protocol just hit 1,000 unique wallets on Ethereum..."
          Tweet 2: "D7 retention: 22% — top 30% of DeFi protocols..."
          Tweet 3: "TVL grew 40% in 30 days while category grew 12%..."
  → res.json({ content: thread[], type: 'twitter_thread', generatedAt })

---

## Phase Delivery

### Phase 1 — Agent Core + 10 Tools
Files: AgentService.js, agent/tools/* (10 files)
What it unlocks: Agent works standalone, can be tested via POST /api/agent/chat
Zero impact on existing routes.
Test: node -e "import('./src/services/AgentService.js').then(m => m.default.run('test-user', 'hello', { contractAddress: '0x...', chain: 'ethereum', source: 'chat' }))"

### Phase 2 — Wire Agent into /chat + /traction + /analyzer
Files: Modify chat.js, traction.js. Create agent.js route.
What it unlocks:
  - Chat uses agent (function calling) instead of BusinessAIEngine
  - Traction recommendations use agent (search_learnings + market context)
  - /analyzer calls POST /api/agent/analyze → agent creates enriched tasks
  - Frontend /analyzer shows "AI Enhanced" tasks alongside rule-based tasks
Frontend change: analyzer/page.tsx adds one useEffect calling POST /api/agent/analyze

### Phase 3 — Feedback Loop + Email Automation
Files: FeedbackProcessor.js, EmailAutomation.js. Modify RAGContextBuilder.js.
What it unlocks:
  - Thumbs up/down on chat messages → feedback.json → personalises future responses
  - Email triggers on task complete/overdue (AITaskManager already fires events)
  - Email on metric regression (new)
Frontend change: chat-message.tsx adds thumbs up/down buttons calling POST /api/agent/feedback

### Phase 4 — Proactive Agent + Real Briefings
Files: ProactiveAgent.js. Modify BriefingScheduler.js, server.js.
What it unlocks:
  - Hourly metric regression checks → email + WebSocket alert
  - Daily inactive user nudges
  - Daily/weekly briefings use real analysis data (not mock)
  - Competitor spike detection
No frontend changes.

### Phase 5 — Marketing Content
Files: TractionNarrator.js. Add POST /api/agent/generate-content endpoint.
What it unlocks:
  - Investor summary generation
  - Twitter thread drafts from real metrics
  - Pitch deck slide data
Frontend change: analyzer/page.tsx adds "Generate Content" button section

---

## What Does NOT Change

- Frontend chat UI — zero changes until Phase 3 (feedback buttons)
- ChatAIService — kept for getContractContext() and generateSuggestedQuestions() only
- BusinessAIEngine — kept as fallback, briefings still use it
- GeminiAIService — kept for analysis interpretation (non-chat)
- All storage schemas — no changes
- WebSocket infrastructure — no changes
- Subscription charge middleware — stays on chat route
- generateTasks() rule-based logic — stays as baseline, agent enriches on top
- All existing API endpoints — no breaking changes

---

## Expansion Points (Future)

These are designed-in extension points for future phases:

1. New tool: get_wallet_intelligence
   Reads: data/wallet-enrichment/*.json
   Returns: whale movements, wallet classifications, bot clusters
   Enables: "Are whales leaving my contract or the whole sector?"

2. New tool: get_chain_state
   Calls: EthereumRpcClient.getCurrentBlockNumber() + gas price
   Returns: current block, gas price, network congestion
   Enables: "Is my gas cost high compared to current network conditions?"

3. New source: 'alert' in AgentService context
   ProactiveAgent calls AgentService with source='alert'
   Agent decides severity, creates tasks, sends email — fully autonomous

4. Multi-contract agent
   context.contracts = [{ address, chain }] array
   Agent calls get_metrics() for each, compares, generates cross-contract insights

5. Agent memory persistence
   Currently: session history passed per call (last 6 messages)
   Future: AgentMemory.js stores long-term per-user patterns beyond session
   Reads: data/users/{userId}/agent-memory.json

6. Streaming responses
   AgentService.stream(userId, message, context) → AsyncGenerator
   Frontend uses EventSource for real-time token streaming
   Requires: Gemini streaming API + SSE endpoint

7. Agent-to-agent delegation
   MarketingAgent, AnalysisAgent, MonitoringAgent as specialised sub-agents
   AgentService routes to sub-agent based on source + message intent
