# MetaGauge AI Agent — Step-by-Step Build Plan

## Pre-Build State (confirmed)

- GEMINI_API_KEY: set ✅
- GEMINI_MODEL: gemini-2.0-flash-exp ✅
- AI_DISABLED: true ← must flip to false before Phase 1 test
- DATABASE_TYPE: file ✅
- AgentService: does not exist
- src/services/agent/: does not exist
- data/ai-knowledge/feedback.json: does not exist
- RAGContextBuilder: importable ✅
- AITaskManager: importable ✅
- TractionStorage: importable ✅
- ExternalDataFetcher: importable ✅
- EmailService: importable ✅

---

## Phase 1 — Agent Core + Tools
Goal: AgentService works standalone. Zero changes to existing routes.

### Step 1.1 — Flip AI_DISABLED
File: .env
Change: AI_DISABLED=true → AI_DISABLED=false
Why: Everything else is blocked until this is off.

### Step 1.2 — Create tool registry
File: src/services/agent/tools/index.js
What: Exports TOOL_SCHEMAS (array of Gemini function declarations) and TOOL_EXECUTORS (map of name → async fn).
Depends on: nothing yet (schemas only, executors wired in later steps)

### Step 1.3 — Create get_metrics tool
File: src/services/agent/tools/get_metrics.js
Reads: AnalysisStorage.findByUserId(userId) → latest completed analysis
Returns: { summary, retentionMetrics, activationMetrics, gasAnalysis, defiMetrics, userBehavior, userQualityMetrics }
Depends on: AnalysisStorage (already importable)

### Step 1.4 — Create get_tasks tool
File: src/services/agent/tools/get_tasks.js
Reads: TractionStorage.getTraction(userId) + AITaskManager.getActiveTasks(userId)
Returns: { tractionTasks[], aiTasks[], openCount, resolvedCount, overdueCount }
Depends on: TractionStorage, AITaskManager (both importable)

### Step 1.5 — Create get_history tool
File: src/services/agent/tools/get_history.js
Reads: MetricsHistoryStorage.findByUserId(userId)
Returns: { history[], trend, deltaLast7d }
Depends on: MetricsHistoryStorage (importable via database/index.js)

### Step 1.6 — Create get_competitors tool
File: src/services/agent/tools/get_competitors.js
Reads: data/users/{userId}/competitors/*.json (fs.readdir)
Returns: { competitors[], marketShare, benchmarks }
Depends on: fs/promises only

### Step 1.7 — Create get_transactions tool
File: src/services/agent/tools/get_transactions.js
Reads: latest analysis transactions array from AnalysisStorage
Args: { limit, filter: 'all'|'failed'|'whale' }
Returns: { transactions[], totalCount, failureRate, avgValue }
Depends on: AnalysisStorage

### Step 1.8 — Create resolve_task tool
File: src/services/agent/tools/resolve_task.js
Writes: TractionStorage.resolveTask() + TractionStorage.saveLearning()
Returns: { task, saved: true }
Depends on: TractionStorage

### Step 1.9 — Create search_learnings tool
File: src/services/agent/tools/search_learnings.js
Reads: data/ai-knowledge/task-resolutions.json + data/ai-knowledge/feedback.json
Args: { query, metricName? }
Returns: { resolutions[], feedbackPatterns[], relevantCount }
Depends on: fs/promises only

### Step 1.10 — Create get_market_context tool
File: src/services/agent/tools/get_market_context.js
Calls: ExternalDataFetcher.getProtocolContext(contractAddress, chain, category)
Returns: { chainTVL, categoryTVL, topProtocols[], ethPrice }
Depends on: ExternalDataFetcher (importable)

### Step 1.11 — Create get_analyzer_state tool
File: src/services/agent/tools/get_analyzer_state.js
Reads: TractionStorage.getTraction(userId) for OPS + task counts
Returns: { opsScore, opsLabel, pillars{}, openTasks, highPriorityTasks, productivityScore }
Depends on: TractionStorage

### Step 1.12 — Create create_task tool
File: src/services/agent/tools/create_task.js
Writes: AITaskManager.createTask() → data/ai-tasks.json
Args: { title, description, metric, current, target, lowerBetter, pillar, priority, action, deadlineDays }
Returns: { task, taskId, created: true }
Depends on: AITaskManager

### Step 1.13 — Wire all tools into registry
File: src/services/agent/tools/index.js (update from Step 1.2)
What: Import all 10 tool files, build TOOL_SCHEMAS array + TOOL_EXECUTORS map
Each executor signature: async (userId, args, context) => result

### Step 1.14 — Create AgentService
File: src/services/AgentService.js
What:
  - Imports GoogleGenAI from @google/genai
  - Imports RAGContextBuilder, TOOL_SCHEMAS, TOOL_EXECUTORS
  - run(userId, message, context) method:
      1. RAGContextBuilder.build() → systemPrompt
      2. First Gemini call with tools
      3. Tool execution loop (max 5 iterations)
      4. Parse final JSON { content, components[] }
      5. Return { content, components, toolsUsed[], iterations }
  - Graceful fallback if GEMINI_API_KEY missing or AI_DISABLED=true
Depends on: Steps 1.2–1.13, RAGContextBuilder, @google/genai (already in package.json)

### Step 1.15 — Smoke test Phase 1
Command: node -e "
import('./src/services/AgentService.js').then(async m => {
  const result = await m.default.run('test-user', 'What tools do you have?', {
    contractAddress: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    chain: 'ethereum',
    source: 'chat'
  });
  console.log('content:', result.content?.slice(0,100));
  console.log('toolsUsed:', result.toolsUsed);
});
"
Expected: content printed, toolsUsed array populated, no crash

---

## Phase 2 — Wire Agent into Routes
Goal: /chat, /traction, /analyzer all use AgentService. No frontend changes except analyzer page.

### Step 2.1 — Create agent route file
File: src/api/routes/agent.js
Endpoints:
  POST /api/agent/chat       → AgentService.run(userId, message, { source: 'chat', ... })
  POST /api/agent/analyze    → AgentService.run(userId, analyze_prompt, { source: 'analyzer', ... })
  POST /api/agent/feedback   → FeedbackProcessor.save() [stub — FeedbackProcessor created in Phase 3]
  GET  /api/agent/digest     → reads data/briefings.json filtered by userId + type
  POST /api/agent/generate-content → TractionNarrator.generate() [stub — Phase 5]
Depends on: AgentService (Phase 1)

### Step 2.2 — Register agent route in server.js
File: src/api/server.js
Add after existing route registrations:
  import agentRoutes from './routes/agent.js';
  app.use('/api/agent', authenticateToken, agentRoutes);
Depends on: Step 2.1

### Step 2.3 — Swap chat.js to use AgentService
File: src/api/routes/chat.js
Change lines 373–384 (the businessAI.chat() call):
  Before: const aiResponse = await businessAI.chat({ userId, message, ... })
  After:  const aiResponse = await AgentService.run(userId, messageContent, {
            contractAddress: session.contractAddress,
            chain: session.contractChain,
            sessionId,
            sessionHistory: chatHistory.map(m => ({ role: m.role, content: m.content })),
            source: 'chat'
          });
Keep: ChatAIService.getContractContext() and generateSuggestedQuestions() unchanged
Depends on: AgentService (Phase 1)

### Step 2.4 — Swap traction.js recommendation to use AgentService
File: src/api/routes/traction.js
Change GET /api/traction/tasks/:taskId/recommendation (lines 393–408):
  Remove: dynamic import of GeminiAIService + gemini.generateContent()
  Add:    AgentService.run(userId, recommendation_prompt, { source: 'traction', ... })
  Return: result.content as recommendation + result.components
Depends on: AgentService (Phase 1)

### Step 2.5 — Swap traction.js task check to use AgentService
File: src/api/routes/traction.js
Change POST /api/traction/tasks/:taskId/check (line 628):
  Remove: dynamic import of GeminiAIService
  Add:    AgentService.run(userId, check_prompt, { source: 'traction', ... })
Depends on: AgentService (Phase 1)

### Step 2.6 — Add analyzer integration to frontend
File: frontend/app/analyzer/page.tsx
Add one useEffect after the existing getDashboard() call:
  useEffect(() => {
    if (isAuthenticated && data) {
      api.agent.analyze({ contractAddress: data.contract.address, chain: data.contract.chain })
        .then(r => setAgentTasks(r.tasks || []))
        .catch(() => {})
    }
  }, [isAuthenticated, data])
Add agentTasks state, render them in the task list with "AI Enhanced" badge
Depends on: Step 2.1 (POST /api/agent/analyze endpoint)

### Step 2.7 — Add api.agent to frontend API client
File: frontend/lib/api.ts
Add agent section:
  agent: {
    analyze: (body) => apiRequest('/api/agent/analyze', { method: 'POST', body }),
    feedback: (body) => apiRequest('/api/agent/feedback', { method: 'POST', body }),
    generateContent: (body) => apiRequest('/api/agent/generate-content', { method: 'POST', body }),
    getDigest: (type) => apiRequest(`/api/agent/digest?type=${type}`),
  }
Depends on: Step 2.1

### Step 2.8 — Integration test Phase 2
Tests:
  1. Send chat message → verify toolsUsed in response metadata
  2. GET /api/traction/tasks/d7_ret/recommendation → verify components[] in response
  3. POST /api/agent/analyze → verify tasks[] returned with market context
  4. /analyzer page loads → verify "AI Enhanced" tasks appear

---

## Phase 3 — Feedback Loop + Email Automation
Goal: Users can rate AI responses. Emails fire on real events.

### Step 3.1 — Create feedback.json
File: data/ai-knowledge/feedback.json
Content: []
Why: search_learnings tool already tries to read this (Step 1.9). Needs to exist.

### Step 3.2 — Create FeedbackProcessor
File: src/services/FeedbackProcessor.js
Methods:
  save(userId, { messageId, rating, note, componentType })
    → append to feedback.json
    → if note: RAGContextBuilder.learn({ type: 'user', key: userId, finding: note })
  getPatterns(userId)
    → reads feedback.json, groups by componentType + rating
    → returns { disliked[], liked[] }
Depends on: RAGContextBuilder (importable)

### Step 3.3 — Wire feedback into RAGContextBuilder
File: src/services/RAGContextBuilder.js
Add section 7 to build():
  import FeedbackProcessor
  const patterns = await FeedbackProcessor.getPatterns(userId)
  if patterns.disliked.length > 0:
    sections.push("Avoid: " + patterns.disliked.join(', '))
    sections.push("Prefer: " + patterns.liked.join(', '))
Depends on: Step 3.2

### Step 3.4 — Wire feedback endpoint in agent route
File: src/api/routes/agent.js
Update POST /api/agent/feedback stub (from Step 2.1):
  import FeedbackProcessor
  body: { messageId, sessionId, rating, note, componentType }
  FeedbackProcessor.save(userId, body)
  res.json({ saved: true })
Depends on: Step 3.2

### Step 3.5 — Add feedback buttons to chat UI
File: frontend/components/chat/chat-message.tsx
Add thumbs up/down buttons below each assistant message:
  onClick: api.agent.feedback({ messageId: message.id, sessionId, rating: 1 or -1 })
  Show filled icon after rating (local state)
Depends on: Step 2.7 (api.agent.feedback)

### Step 3.6 — Create email-log schema
File: data/users/{userId}/email-log.json (created on first send, not pre-created)
Schema: [{ type: string, sentAt: ISO string }]
Why: EmailAutomation reads this before sending to enforce anti-spam

### Step 3.7 — Create EmailAutomation
File: src/services/EmailAutomation.js
Methods:
  canSend(userId, type) → reads email-log.json, returns bool (max 1/day non-critical)
  logSent(userId, type) → appends to email-log.json
  sendRegressionAlert(userId, metric, before, after)
    → UserStorage.findById(userId) → user.email
    → canSend() check
    → EmailService.sendAlert(email, { severity:'high', title, message })
    → logSent()
  sendTaskAlert(userId, task, type: 'completed'|'overdue')
    → same pattern
  sendInactiveNudge(userId, openTaskCount)
    → same pattern
  sendDigest(userId, briefing)
    → EmailService.sendBriefing(email, briefing)
    → logSent()
Depends on: EmailService (importable), UserStorage (importable)

### Step 3.8 — Wire EmailAutomation into AITaskManager
File: src/services/AITaskManager.js
In _fireTaskAlert() (already fires on task complete/overdue):
  import EmailAutomation
  await EmailAutomation.sendTaskAlert(task.userId, task, type)
Depends on: Step 3.7

### Step 3.9 — Test Phase 3
Tests:
  1. Rate a chat message thumbs down → check feedback.json updated
  2. Rate with note → check user-learnings.json updated
  3. Send second chat message → verify response avoids disliked component type
  4. Manually trigger AITaskManager._fireTaskAlert() → verify email sent (check SMTP logs)

---

## Phase 4 — Proactive Agent + Real Briefings
Goal: Always-on monitoring. Briefings use real data.

### Step 4.1 — Fix BriefingScheduler mock data
File: src/services/BriefingScheduler.js
Replace getYesterdayMetrics() mock:
  import AnalysisStorage
  return AnalysisStorage.findByUserId(userId).then(a => a[0]?.results?.target?.metrics || {})
Replace getCompetitorMovements() mock:
  import fs from 'fs/promises'
  read data/users/{userId}/competitors/*.json
Replace getWeeklyData() mock:
  import MetricsHistoryStorage
  return MetricsHistoryStorage.findByUserId(userId).then(h => h.slice(-7))
Depends on: AnalysisStorage, MetricsHistoryStorage (both importable)

### Step 4.2 — Create ProactiveAgent
File: src/services/ProactiveAgent.js
Methods:
  init(wsManager)
    → starts 3 setInterval timers (1h, daily 8am, weekly Monday)
  checkMetricRegressions()
    → UserStorage.findAll() → for each user:
       latest   = AnalysisStorage.findByUserId(userId)[0]
       previous = MetricsHistoryStorage.findByUserId(userId)[0]
       if retentionRate dropped >20%: EmailAutomation.sendRegressionAlert() + wsManager.emitProgress()
  checkInactiveUsers()
    → for each user: if lastLogin > 7d ago AND open tasks > 0: EmailAutomation.sendInactiveNudge()
  checkCompetitorSpikes()
    → reads competitor files, compares vs cached market context, emails if spike >30%
  generateDailyDigest()
    → for each user with preferences.notifications.email=true:
       briefing = await BusinessAIEngine.brief({ userId, type:'daily', contracts })
       EmailAutomation.sendDigest(userId, briefing)
Depends on: EmailAutomation (Step 3.7), UserStorage, AnalysisStorage, MetricsHistoryStorage, BusinessAIEngine

### Step 4.3 — Register ProactiveAgent in server.js
File: src/api/server.js
Add after server.listen():
  import { ProactiveAgent } from './services/ProactiveAgent.js';
  server.listen(PORT, () => {
    ProactiveAgent.init(wsManager);
  });
Depends on: Step 4.2

### Step 4.4 — Test Phase 4
Tests:
  1. Call ProactiveAgent.checkMetricRegressions() manually → verify no crash
  2. Call ProactiveAgent.generateDailyDigest() → verify briefing uses real metrics not mock
  3. Check BriefingScheduler.generateDailyBrief() → verify content references real contract data

---

## Phase 5 — Marketing Content
Goal: Users can generate investor summaries, Twitter threads, pitch slides.

### Step 5.1 — Create TractionNarrator
File: src/services/TractionNarrator.js
Methods:
  generate(userId, type, { contractAddress, chain })
    → loads traction + analysis + competitor data
    → builds prompt based on type
    → AgentService.run(userId, prompt, { source: 'marketing', contractAddress, chain })
    → returns { content, type, generatedAt }
  Types:
    'investor_summary' → agent calls get_metrics + get_competitors + get_market_context
    'twitter_thread'   → agent calls get_metrics + get_history + get_market_context
    'pitch_slide'      → agent calls get_metrics + get_competitors + get_market_context
Depends on: AgentService (Phase 1)

### Step 5.2 — Wire generate-content endpoint
File: src/api/routes/agent.js
Update POST /api/agent/generate-content stub (from Step 2.1):
  import TractionNarrator
  const result = await TractionNarrator.generate(userId, type, { contractAddress, chain })
  res.json(result)
Depends on: Step 5.1

### Step 5.3 — Add Generate Content UI to /analyzer
File: frontend/app/analyzer/page.tsx
Add "Generate Content" section below task list:
  3 buttons: Investor Summary | Twitter Thread | Pitch Slide
  onClick: api.agent.generateContent({ type, contractAddress, chain })
  Show result in modal or expandable card
Depends on: Step 2.7 (api.agent.generateContent)

### Step 5.4 — Test Phase 5
Tests:
  1. POST /api/agent/generate-content { type: 'investor_summary' } → verify real metrics cited
  2. POST /api/agent/generate-content { type: 'twitter_thread' } → verify tweet array returned
  3. /analyzer page → click "Investor Summary" → verify modal shows content

---

## Build Order Summary

```
Phase 1 (Agent Core)
  1.1  Flip AI_DISABLED=false in .env
  1.2  src/services/agent/tools/index.js          (registry skeleton)
  1.3  src/services/agent/tools/get_metrics.js
  1.4  src/services/agent/tools/get_tasks.js
  1.5  src/services/agent/tools/get_history.js
  1.6  src/services/agent/tools/get_competitors.js
  1.7  src/services/agent/tools/get_transactions.js
  1.8  src/services/agent/tools/resolve_task.js
  1.9  src/services/agent/tools/search_learnings.js
  1.10 src/services/agent/tools/get_market_context.js
  1.11 src/services/agent/tools/get_analyzer_state.js
  1.12 src/services/agent/tools/create_task.js
  1.13 src/services/agent/tools/index.js          (wire all tools)
  1.14 src/services/AgentService.js
  1.15 Smoke test

Phase 2 (Wire Routes)
  2.1  src/api/routes/agent.js                    (new route file)
  2.2  src/api/server.js                          (register /api/agent)
  2.3  src/api/routes/chat.js                     (swap businessAI → AgentService)
  2.4  src/api/routes/traction.js                 (swap recommendation)
  2.5  src/api/routes/traction.js                 (swap task check)
  2.6  frontend/app/analyzer/page.tsx             (add agent tasks)
  2.7  frontend/lib/api.ts                        (add api.agent)
  2.8  Integration test

Phase 3 (Feedback + Email)
  3.1  data/ai-knowledge/feedback.json            (create empty [])
  3.2  src/services/FeedbackProcessor.js
  3.3  src/services/RAGContextBuilder.js          (add feedback section)
  3.4  src/api/routes/agent.js                    (wire feedback endpoint)
  3.5  frontend/components/chat/chat-message.tsx  (thumbs up/down)
  3.6  (email-log.json auto-created on first send)
  3.7  src/services/EmailAutomation.js
  3.8  src/services/AITaskManager.js              (wire email on task events)
  3.9  Test

Phase 4 (Proactive + Real Briefings)
  4.1  src/services/BriefingScheduler.js          (replace mock data)
  4.2  src/services/ProactiveAgent.js
  4.3  src/api/server.js                          (register ProactiveAgent)
  4.4  Test

Phase 5 (Marketing)
  5.1  src/services/TractionNarrator.js
  5.2  src/api/routes/agent.js                    (wire generate-content)
  5.3  frontend/app/analyzer/page.tsx             (Generate Content UI)
  5.4  Test
```

---

## Dependencies Between Steps

```
1.1 → everything (AI_DISABLED must be false)
1.2 → 1.13 (registry needs all tools)
1.3–1.12 → 1.13 (all tools → registry)
1.13 → 1.14 (registry → AgentService)
1.14 → 2.1, 2.3, 2.4, 2.5 (AgentService → all route changes)
2.1 → 2.2 (route file → server registration)
2.1 → 2.7 (route file → frontend api client)
2.7 → 2.6 (api client → frontend page)
3.2 → 3.3, 3.4 (FeedbackProcessor → RAG + route)
3.7 → 3.8 (EmailAutomation → AITaskManager wire)
3.7 → 4.2 (EmailAutomation → ProactiveAgent)
4.2 → 4.3 (ProactiveAgent → server registration)
1.14 → 5.1 (AgentService → TractionNarrator)
5.1 → 5.2 (TractionNarrator → route)
2.7 → 5.3 (api client → frontend)
```

---

## Parallel Work Possible

Phase 1 steps 1.3–1.12 (the 10 tools) are fully independent of each other.
They can be built in any order or simultaneously.

Phase 2 steps 2.3, 2.4, 2.5 are independent of each other (different route files).

Phase 3 steps 3.2 and 3.7 are independent of each other.

---

## Risk Points

1. AI_DISABLED=true — must flip before any test. Currently blocks all AI.
2. Gemini function calling format — @google/genai uses tools[] not functions[]. Verify schema format matches SDK version (^1.38.0).
3. Two task systems (ai-tasks.json vs traction.json) — get_tasks tool must merge both. create_task writes to ai-tasks.json only. Frontend must handle both sources.
4. AgentService loop limit — max 5 iterations prevents infinite tool call loops. If Gemini keeps calling tools, it returns partial result after 5.
5. Email in dev — SMTP_HOST/SMTP_USER/SMTP_PASS not set in .env. EmailAutomation must not crash if email fails — wrap in try/catch, log only.

---

## Total Files

New:     16 files (AgentService + 10 tools + 4 services + 1 route)
Modified: 7 files (chat.js, traction.js, server.js, RAGContextBuilder.js, BriefingScheduler.js, AITaskManager.js, analyzer/page.tsx)
Frontend: 3 files (analyzer/page.tsx, chat-message.tsx, api.ts)
Data:     1 file (feedback.json)
