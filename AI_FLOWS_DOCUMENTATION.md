# MetaGauge AI Flows - Complete Documentation

## Overview

MetaGauge has **4 distinct AI personas/flows**, each powered by Google Gemini but serving different purposes with unique system prompts and capabilities:

---

## 1. 💬 **Chat Assistant (General Business Advisor)**

### **Identity**
- **Persona:** General blockchain analyst and business advisor
- **Service:** `ChatAIService.js` + `BusinessAIEngine.js`
- **Route:** `/api/chat/*`
- **Model:** `gemini-2.5-flash-lite` (Chat) / `gemini-2.0-flash-exp` (Business)

### **Purpose**
Conversational AI for answering questions about contract analytics, metrics, and business intelligence.

### **Key Features**
- Natural language queries about contract data
- Context-aware responses using RAG (Retrieval Augmented Generation)
- Visual components generation (charts, tables, metric cards)
- Session-based conversation history
- Suggested questions based on available data
- Tool calling capabilities via `AgentService`

### **System Prompt Characteristics**
```
"You are an expert blockchain analyst AI assistant for contract {address} on {chain}.
Return responses with conversational content + visual components (charts, tables, metrics).
Answer using contract data, metrics, and market context."
```

### **Available Data Context**
- Latest analysis results
- Transaction history
- Metrics (retention, churn, gas, DeFi)
- User behavior patterns
- Competitor data
- Market context (TAM/SAM/SOM)
- Web search results (when relevant)

### **Response Format**
```json
{
  "content": "Conversational answer text",
  "components": [
    { "type": "chart|metric_card|table|alert|insight_card|recommendation", "data": {} }
  ]
}
```

### **Example Questions**
- "Who are my highest value customers by LTV?"
- "Which wallets are at risk of churning?"
- "Show me my retention cohort chart"
- "What is my TAM/SAM/SOM?"
- "How do I compare to competitors?"

---

## 2. 💰 **CFO (Financial Advisor)**

### **Identity**
- **Persona:** Senior CFO-level financial analyst named "CFO"
- **Service:** `FinancialChatSessionService.js` + `FinancialNarrativeService.js`
- **Route:** `/api/financial/chat`
- **Model:** `gemini-2.0-flash-exp`

### **Purpose**
Dedicated financial intelligence AI that collects financial inputs through conversation, generates investor-ready financial documents, and answers CFO-level questions.

### **Key Features**
- **3-stage conversation flow:**
  1. **Input Collection** - Collects one-time project details
  2. **Monthly Collection** - Gathers monthly operating costs
  3. **Financial Analysis** - Answers questions about generated documents

- **Document Generation:**
  - Income Statement
  - Cash Flow Statement
  - Balance Sheet
  - Unit Economics
  - KPI Dashboard
  - Forward Model (3-year projections)
  - Executive Summary
  - CFO Commentary
  - Red Flags & Opportunities
  - Investor Q&A prep

- **Persistent Memory:** Rolling context summary refreshed every 10 messages
- **SAVE Tag Mechanism:** `[[SAVE:field|value]]` tags persist data to database
- **One Question at a Time:** Conversational field collection

### **System Prompt Characteristics**
```
"You are CFO, MetaGauge's financial AI — a senior CFO-level analyst specialising 
in blockchain protocols. If asked your name, you are 'CFO'.

MODE: [input_collection | monthly_collection | analysis]
- Collect financial inputs conversationally, one field at a time
- Confirm values before saving
- Generate investor-grade financial documents
- Answer with CFO-level precision, citing specific line items"
```

### **Collected Inputs**

**One-Time Profile Fields:**
- Project stage (pre-seed, seed, series-a, etc.)
- Has token? Token symbol?
- Revenue model (subscription, transaction fees, etc.)
- Team size
- Raised funding? Funding rounds details

**Monthly Operating Costs:**
- Team salaries
- Infrastructure costs (RPC, hosting, database)
- Marketing spend
- Legal/compliance costs
- Gas/transaction subsidies
- R&D/development costs
- Misc operating expenses

### **Example Interactions**

**Input Collection Phase:**
```
AI: "What stage is your project at? (pre-seed, seed, series-a, etc.)"
User: "We're at seed stage"
AI: "Got it — seed stage. [[SAVE:project_stage|seed]]
     Does your project have a token? (yes/no)"
```

**Analysis Phase:**
```
User: "What's my burn rate?"
AI: "Based on your Cash Flow Statement for January 2025, your monthly burn 
     rate is $45,000. This includes $30k team salaries, $8k infrastructure, 
     $5k marketing, and $2k legal. At this rate, with $500k in the bank, 
     your runway is 11 months."
```

### **PDF Export**
Generates investor-ready PDF reports with all financial documents, narratives, and CFO commentary.

---

## 3. 🎯 **Agent Service (Autonomous AI Agent)**

### **Identity**
- **Persona:** Autonomous AI agent with function-calling tools
- **Service:** `AgentService.js` with RAG via `RAGContextBuilder.js`
- **Route:** `/api/agent/*`
- **Model:** `gemini-2.0-flash-exp`

### **Purpose**
Function-calling AI agent that can autonomously execute tasks by calling specialized tools. Acts as the orchestration layer for complex operations.

### **Available Tools** (10 function-calling tools)

1. **`get_metrics`** - Fetch comprehensive contract analytics
2. **`get_tasks`** - Retrieve active tasks and action items
3. **`get_history`** - Historical trend analysis
4. **`get_competitors`** - Competitive benchmarking data
5. **`get_transactions`** - Transaction deep dive with filters
6. **`resolve_task`** - Mark task as complete and save learnings
7. **`search_learnings`** - Query AI knowledge base
8. **`get_market_context`** - External market data (TVL, prices)
9. **`get_analyzer_state`** - OPS score and task counts
10. **`create_task`** - Generate new actionable tasks

### **System Prompt Characteristics**
```
"You are an autonomous AI agent with access to tools for analyzing blockchain contracts.
Use tools to gather data, create tasks, and provide actionable insights.
RAG Context: [Chain learnings, user learnings, task history, competitor data]"
```

### **Key Features**
- **Function Calling Loop:** Max 5 iterations to complete complex queries
- **RAG-Grounded:** Every call includes learned context from past analyses
- **Task Management:** Can create and resolve tasks autonomously
- **Knowledge Base:** Learns from task outcomes and feedback
- **Multi-Source Data:** Combines on-chain, market, and competitor data

### **Use Cases**
- Analyzing contracts and creating tasks automatically
- Answering complex questions requiring multiple data sources
- Proactive monitoring and alerting
- Market research with external data
- Task automation and tracking

### **Example Agent Flow**
```
User: "Analyze my contract and create tasks for underperforming metrics"

Agent Execution:
1. Calls get_metrics() → sees D7 retention at 15% (bad)
2. Calls get_market_context() → category average is 35%
3. Calls create_task() → creates "Improve D7 retention to 35% in 30 days"
4. Returns summary + tasks created
```

---

## 4. 📊 **Business Intelligence Engine**

### **Identity**
- **Persona:** Business intelligence analyst (embedded in Business AI)
- **Service:** `BusinessIntelligenceEngine.js`
- **Route:** `/api/agent/business-intelligence`
- **Model:** `gemini-2.0-flash-exp` (for narratives)

### **Purpose**
Deep analytical engine that computes advanced business metrics not available in standard analytics. Provides investor-grade intelligence.

### **Computed Metrics**

**Customer Lifetime Value (LTV)**
- High/Mid/Low value wallet segmentation
- Per-wallet LTV in USD
- Total portfolio value

**Churn Risk Detection**
- High risk wallets (inactive 14+ days)
- Medium risk (7-14 days)
- Days since last interaction

**Session Analysis**
- Session length distribution
- Sessions per wallet
- Inter-session time gaps

**Feature Adoption Funnel**
- Function signature usage analysis
- Drop-off rates between steps
- Completion rates

**Time Patterns**
- Peak usage hours
- Day-of-week patterns
- Weekend vs weekday activity

**Revenue Forecasting**
- 30/60/90 day projections
- Trend-based predictions
- Confidence intervals

**Pattern Recognition**
- Viral loops detection
- Whale behavior patterns
- Bot detection heuristics

**Smart Money Detection**
- High-skill wallet identification
- Early mover analysis
- Portfolio diversity signals

**Predictive Analytics**
- Next action prediction per wallet
- User growth forecasting
- Retention prediction

### **System Prompt (for narrative generation)**
```
"Analyze this blockchain protocol's performance and provide business intelligence.
Generate: SWOT, insights, tasks, learnings.
Be specific, cite numbers, create actionable recommendations."
```

### **Output Format**
```json
{
  "summary": "Executive summary",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "opportunities": ["..."],
  "risks": ["..."],
  "insights": [
    { "metric": "...", "status": "GOOD|WARN|BAD", "finding": "...", "action": "..." }
  ],
  "createdTasks": [...],
  "learnings": [...]
}
```

---

## AI Flow Routing Summary

| User Action | Route | AI Persona | Purpose |
|------------|-------|------------|---------|
| Click "Chat" in dashboard | `/api/chat/sessions` | **Chat Assistant** | Ask questions about contract |
| Send chat message | `/api/chat/sessions/:id/messages` | **Chat Assistant** → calls **Agent Service** | Conversational analysis |
| Open Financial page | `/api/financial/chat` | **CFO** | Financial inputs & documents |
| Click "Analyze" in analyzer | `/api/agent/analyze` | **Agent Service** | Create tasks via tools |
| View Business Intelligence | `/api/agent/business-intelligence` | **BI Engine** | Deep metrics |
| Request briefing | `/api/agent/digest` | **Business AI** | Daily/weekly summaries |
| Generate marketing content | `/api/agent/generate-content` | **Agent Service** → TractionNarrator | Investor summaries, tweets |

---

## AI Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                         │
├────────────────────────────────────────────────────────────────┤
│  Chat Page  │  Financial Page  │  Analyzer  │  Dashboard       │
└──────┬──────┴────────┬─────────┴──────┬─────┴────────┬─────────┘
       │               │                │              │
       v               v                v              v
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Chat         │ │ Financial    │ │ Agent        │ │ Business     │
│ Assistant    │ │ CFO          │ │ Service      │ │ Intelligence │
│              │ │              │ │              │ │ Engine       │
│ Gemini       │ │ Gemini       │ │ Gemini       │ │ Gemini       │
│ 2.5-flash    │ │ 2.0-flash    │ │ 2.0-flash    │ │ 2.0-flash    │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                 │
       │                │                └─────────────────┤
       │                │                                  │
       v                v                                  v
┌─────────────────────────────────────────────────────────────────┐
│                     RAG CONTEXT BUILDER                          │
│  • Chain learnings   • User learnings   • Task history           │
│  • Competitor data   • Market context   • Analysis results       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           v
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                                │
│  • AnalysisStorage  • MetricsHistory  • Competitors              │
│  • ExternalData     • WebSearch       • ResearchAgent           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Differences Between AI Personas

| Feature | Chat Assistant | CFO | Agent Service | BI Engine |
|---------|---------------|-----|---------------|-----------|
| **Model** | gemini-2.5-flash-lite | gemini-2.0-flash-exp | gemini-2.0-flash-exp | gemini-2.0-flash-exp |
| **Persona** | General analyst | CFO named "CFO" | Autonomous agent | BI analyst |
| **Memory** | Session history | Rolling summary (10 msg refresh) | RAG context | Stateless |
| **Tools** | Via Agent Service | None (conversational only) | 10 function-calling tools | None |
| **Outputs** | Text + components | Text + SAVE tags | Text + components + tasks | Metrics + narratives |
| **Primary Use** | Q&A | Financial docs | Automation | Deep analytics |
| **State** | Per-session | Persistent profile | RAG knowledge base | Per-request |
| **Document Generation** | No | Yes (6 docs) | No | No |

---

## RAG Context Builder

**ALL AI flows** (except basic chat) use `RAGContextBuilder.js` to inject learned context into prompts:

### **Learned Context Types**

1. **Chain Learnings** - General insights about blockchain (Ethereum, Lisk, Starknet)
2. **User Learnings** - Project-specific patterns and outcomes
3. **Task History** - What worked/didn't work in past actions
4. **Competitor Intel** - Benchmarks and market positioning
5. **External Market Data** - TVL, prices, category averages

### **Learning Mechanism**
- Tasks completed → outcome saved as learning
- User feedback → patterns extracted
- Analysis results → insights persisted
- Competitor changes → market shifts recorded

---

## Response Component Types

Both Chat Assistant and Agent Service can return rich UI components:

| Component | Purpose | Data Schema |
|-----------|---------|-------------|
| `metric_card` | Single metric display | `{ title, value, unit, change, trend, description }` |
| `chart` | Visual data | `{ title, type, data: [{label, value}], description }` |
| `table` | Tabular data | `{ title, headers: [], rows: [[]] }` |
| `alert` | Notifications | `{ severity, title, message, actionable }` |
| `insight_card` | AI insight | `{ title, insight, confidence, category }` |
| `recommendation` | Action item | `{ title, description, priority, impact, effort }` |

---

## AI Enablement & Configuration

### **Environment Variables**
```bash
# Enable/disable AI globally
AI_DISABLED=false

# Primary Gemini API key
GEMINI_API_KEY=your-key-here

# Fallback keys (automatic rotation on quota limits)
GEMINI_API_KEY_2=backup-key-1
GEMINI_API_KEY_3=backup-key-2

# Model selection
GEMINI_MODEL=gemini-2.0-flash-exp
```

### **Rate Limiting**
- **Chat:** 100 messages per 15 minutes per user
- **Financial:** No explicit rate limit (soft charge via subscription)
- **Agent:** Controlled by subscription tier
- **BI:** No limit (computed locally)

### **Fallback Behavior**
When AI is disabled or quota exceeded:
- Chat: Returns friendly error with actionable components
- CFO: Returns prompt to configure API key
- Agent: Returns empty components array
- BI: Returns computed metrics without narratives

---

## Subscription Integration

### **AI Query Charging**
```javascript
// Hard charge before AI call
const charge = await subscriptionService.charge(userId, 'ai_query');
if (!charge.allowed) {
  return res.status(402).json({
    error: 'Free quota exhausted',
    message: 'Top up at /subscription to continue',
    balance: charge.balance
  });
}
```

**Pricing:**
- $0.05 per AI query (chat/agent/financial)
- Free tier: Limited quota per month
- Paid tiers: Higher quotas + balance system

---

## Future Enhancements (Planned)

Based on `BUILD_PLAN.md` and `IMPLEMENTATION_PLAN.md`:

1. **Proactive Agent** - Background monitoring with alerts
2. **Email Automation** - Briefings and alerts via email
3. **Feedback Loop** - Thumbs up/down on AI responses
4. **Context Summary Refresh** - Gemini maintains rolling memory
5. **Social Media Agent** - Auto-generate Twitter/LinkedIn posts
6. **Scenario Modeling** - "What if" financial projections
7. **Marketing Content Generator** - Investor summaries, pitch decks

---

## Validation & Testing

### **To Test AI Flows:**

**1. Chat Assistant**
```bash
# Test general chat
POST /api/chat/sessions
POST /api/chat/sessions/:id/messages
{
  "content": "What's my retention rate?"
}
```

**2. CFO**
```bash
# Test financial chat
POST /api/financial/chat
{
  "contractAddress": "0x...",
  "chain": "ethereum",
  "message": "What stage is your project at?"
}

# Generate documents
POST /api/financial/documents/generate
```

**3. Agent Service**
```bash
# Test autonomous analysis
POST /api/agent/analyze
{
  "contractAddress": "0x...",
  "chain": "ethereum"
}

# Test direct agent call
POST /api/agent/chat
{
  "message": "Create tasks for underperforming metrics",
  "contractAddress": "0x..."
}
```

**4. Business Intelligence**
```bash
# Get all BI metrics
GET /api/agent/business-intelligence

# Get specific section
GET /api/agent/business-intelligence?section=ltv
```

---

## Summary

MetaGauge has **4 distinct AI flows**, each optimized for different use cases:

1. **💬 Chat Assistant** - General Q&A about contract analytics
2. **💰 CFO** - Financial intelligence and investor-ready documents
3. **🎯 Agent Service** - Autonomous task execution with tools
4. **📊 Business Intelligence** - Deep analytical metrics

All powered by **Google Gemini**, with **RAG context**, **persistent memory**, **function calling**, and **rich UI components**.

The AI architecture is production-ready, quota-managed, subscription-integrated, and designed for scale.
