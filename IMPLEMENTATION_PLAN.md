# MetaGauge Implementation Plan
# Bridging the Gap: Current App → Full idea.md Vision

---

## Current State (What Works)
- User auth (signup/login/JWT)
- Contract onboarding (address, chain, name, category)
- On-chain indexing (transactions, events, function calls)
- Basic metrics dashboard (overview, users, transactions)
- Reactive AI chat (Gemini)
- Function signature analytics (partial)

## Target State (Full idea.md Vision)
All 38 FRs implemented across 6 major modules.

---

## PHASE 1 — Foundation Fixes (Week 1-2)
*Fix what's broken before building new things*

### 1.1 Fix Real-Time Progress Updates (UI shows 20% while backend is at 45%)
**Problem:** `updateProgress()` only called at milestones (20%, 50%, 80%, 100%). Transaction batch processing progress not reflected in UI.

**Fix:**
- Pass `updateProgress` callback into `EthereumRpcClient.getTransactionsByAddress()`
- Call it after every batch (every 15 transactions)
- Map batch progress to 50-80% range in the overall progress scale

**Files:**
- `src/services/EthereumRpcClient.js` — add progressCallback to batch loop
- `src/api/routes/trigger-indexing.js` — wire callback through

---

### 1.2 Fix blockRange null on Dashboard
**Problem:** `blockRange` saved in `results.summary.blockRange` but frontend reads `metadata.blockRange`

**Fix:** In `trigger-indexing.js` after indexing completes, write blockRange to both locations:
```js
metadata: { ...analysis.metadata, blockRange: { start: startBlock, end: currentBlock } }
```

**Files:**
- `src/api/routes/trigger-indexing.js` line ~250

---

### 1.3 Switch DATABASE_TYPE to PostgreSQL
**Problem:** Currently using file storage. PostgreSQL is configured but not running.

**Steps:**
1. Start PostgreSQL service
2. Run `node scripts/create-schema.js`
3. Set `DATABASE_TYPE=postgres` in `.env`
4. Verify all 10 tables created

---

### 1.4 Role-Based Access Control (FR-01)
**Add roles:** Admin, Analyst, Viewer

**Backend:**
- Add `role` field to `users` table (default: `admin`)
- Add role middleware: `requireRole('admin')`
- Protect admin routes

**Frontend:**
- Show/hide UI elements based on role
- Role badge in header

---

## PHASE 2 — Wallet Intelligence (Week 3-4)
*FR-05, FR-06 — Deep wallet classification*

### 2.1 Wallet Classification Engine
Build `src/services/WalletClassificationEngine.js`

**Segments to implement:**
| Segment | Logic |
|---------|-------|
| New | First interaction within last 7 days |
| Active | Interacted in last 30 days |
| Churned | No interaction for 30+ days |
| Whale | Top 10 by transaction volume |
| Bot/Suspicious | >50 txs/day OR identical tx patterns |
| High-risk | Failed tx rate >40% |

**Metrics to calculate per wallet:**
- User Lifetime Value (LTV) = total gas spent + value transferred
- Revenue Per Active Wallet (RPAW) = total revenue / active wallets
- Revenue Concentration = top 10 wallets % of total revenue
- Dormancy score = days since last interaction

**Files:**
- `src/services/WalletClassificationEngine.js` (new)
- `src/api/routes/analysis.js` — expose wallet segments endpoint

---

### 2.2 Cohort Retention (D1, D7, D30, D90)
**Build proper cohort tables:**

```
cohort_date | d1_retained | d7_retained | d30_retained | d90_retained | cohort_size
```

**Logic:**
- Group wallets by first interaction week
- For each cohort, count wallets that returned on D1, D7, D30, D90
- Store in `metrics_snapshot` table

**Files:**
- `src/services/CohortCalculatorService.js` — enhance existing
- `scripts/create-schema.js` — add `cohort_retention` table

---

### 2.3 Bot Detection
**Heuristics:**
- Same wallet, same function, same value, <60s apart = bot
- >100 transactions in 24h = bot
- Identical input data across multiple txs = bot

**Files:**
- `src/services/BotDetectionService.js` (new)

---

## PHASE 3 — Alerts System (Week 5-6)
*FR-16 — Real-time alerts for retention drop, whale exit, revenue spike, bot surge, churn spike*

### 3.1 Alert Engine Backend
Build `src/services/AlertEngine.js`

**Alert types:**
| Alert | Trigger | Default Threshold |
|-------|---------|-------------------|
| Retention Drop | D7 retention < threshold | 15% |
| Whale Exit | Top 10 wallet inactive 7 days | - |
| Revenue Spike/Dip | Daily revenue change | ±30% |
| Bot Surge | Bot % of total activity | >20% |
| Churn Spike | Weekly churn increase | >20% |

**Architecture:**
```
Cron job (every hour)
  → AlertEngine.checkAllAlerts(userId)
  → Compare current metrics vs previous snapshot
  → If threshold crossed → create alert record
  → Notify via WebSocket + email
```

**Database table:**
```sql
alerts (
  id, user_id, contract_id, alert_type,
  severity, message, metric_value, threshold,
  triggered_at, acknowledged_at, is_read
)
```

**Files:**
- `src/services/AlertEngine.js` (new)
- `src/api/routes/alerts.js` — add GET /alerts, PATCH /alerts/:id/acknowledge
- `scripts/create-schema.js` — add alerts table

---

### 3.2 Alert Configuration UI
**Frontend page:** `/alerts`

- List of active alerts with severity badges
- Configure thresholds per alert type
- Mark as read / acknowledge
- Alert history

**Files:**
- `frontend/app/alerts/page.tsx` (new)
- `frontend/components/alerts/alert-list.tsx` (new)
- `frontend/components/alerts/alert-config.tsx` (new)

---

## PHASE 4 — Competitive Intelligence (Week 7-9)
*FR-24 to FR-29 — Entire competitive module*

### 4.1 Competitor Management (FR-24)
**Backend:**
- Add `competitors` table (already in schema)
- `POST /api/contracts/:id/competitors` — add competitor
- `DELETE /api/contracts/:id/competitors/:competitorId` — remove
- `GET /api/contracts/:id/competitors` — list

**Auto-suggest competitors:**
- Query contracts in same category
- Rank by user overlap (wallets interacting with both)

**Files:**
- `src/api/routes/contracts.js` — add competitor CRUD endpoints
- `src/services/CompetitorSuggestionEngine.js` (new)

---

### 4.2 Competitor Indexing
**When a competitor is added:**
1. Trigger background indexing for competitor contract
2. Store results in `analyses` table with `type: 'competitor'`
3. Schedule periodic re-indexing (every 24h)

**Files:**
- `src/services/CompetitorIndexer.js` (new)
- `src/indexer/index.js` — add competitor indexing job

---

### 4.3 Competitive Dashboard (FR-25)
**Frontend tabs on dashboard:**

**Side-by-side comparison:**
- Table: metric | your project | competitor 1 | competitor 2 | category avg
- Metrics: active wallets, D7 retention, revenue, growth rate, churn

**Leaderboard:**
- Rank all tracked competitors by each metric
- Show user's position (e.g., "You rank #3 of 6 in D7 retention")

**Historical trends:**
- Line chart: 7d/30d/90d for all competitors on same chart

**Files:**
- `frontend/components/analyzer/competitive-tab.tsx` — enhance existing
- `src/api/routes/analysis.js` — add `/api/analysis/competitive/:contractId`

---

### 4.4 Competitive Alerts (FR-26)
**New alert types:**
| Alert | Trigger |
|-------|---------|
| Retention Surge | Competitor D7 retention +15% in 7 days |
| Churn Reduction | Competitor churn drops >25% |
| User Acquisition Spike | Competitor new wallets +50% in 24h |
| Feature Adoption Surge | Competitor function usage 3x spike |
| Whale Migration | Top competitor wallet now active on your contract |
| TVL/Volume Overtake | Competitor surpasses you in key metric |
| Momentum Shift | Competitor growth rate >2x yours for 7 days |

**Files:**
- `src/services/AlertEngine.js` — add competitive alert checks
- `src/services/CompetitorIndexer.js` — trigger alert checks after each index

---

### 4.5 Opportunity Scoring (FR-27)
Build `src/services/OpportunityScorer.js`

**Scores to calculate:**
| Opportunity | Logic |
|-------------|-------|
| Feature Gap | Functions used by competitors but not in your contract |
| Market Entry | High-growth category you don't serve |
| User Overlap | Wallets on competitors not on your contract |
| Retention Play | Competitors with high D1 but low D30 (capture churned users) |

**Output:** Ranked list of opportunities with score 0-100 and recommended action

**Files:**
- `src/services/OpportunityScorer.js` (new)
- `src/api/routes/analysis.js` — add `/api/analysis/opportunities/:contractId`
- `frontend/components/analyzer/competitive-tab.tsx` — add opportunities section

---

### 4.6 Landscape Positioning Map (FR-28)
**Visualization:** Scatter plot — X axis: acquisition rate, Y axis: retention rate
- Each dot = one project (yours highlighted)
- Quadrants: Stars (high acq + high ret), Leaky Bucket (high acq + low ret), etc.

**Files:**
- `frontend/components/analyzer/competitive-tab.tsx` — add positioning chart
- Uses Recharts ScatterChart

---

## PHASE 5 — Export & Sharing (Week 10)
*FR-18, FR-19*

### 5.1 CSV Export
- Export transactions, wallet segments, cohort data as CSV
- Button on each data table

**Files:**
- `src/api/routes/analysis.js` — add `GET /api/analysis/:id/export/csv`
- `frontend/components/ui/export-button.tsx` (new)

---

### 5.2 PDF Report Generation
- Investor-ready summary PDF
- Include: key metrics, growth chart, retention cohorts, competitive position

**Library:** `pdfkit` or `puppeteer`

**Files:**
- `src/services/ReportGenerator.js` — enhance existing
- `src/api/routes/analysis.js` — add `GET /api/analysis/:id/export/pdf`

---

### 5.3 Shareable Read-Only Links (FR-19)
- Generate a token-based read-only URL: `/share/:token`
- Token stored in DB with expiry
- No auth required to view

**Files:**
- `src/api/routes/analysis.js` — add `POST /api/analysis/:id/share`
- `frontend/app/share/[token]/page.tsx` (new)

---

## PHASE 6 — AI Growth Advisor (Week 11-14)
*FR-30 to FR-38 — Proactive AI advisor, not just reactive chat*

### 6.1 Proactive Advice Engine (FR-33)
Build `src/services/AIGrowthAdvisor.js`

**Triggers → Advice:**
| Trigger | Advice Generated |
|---------|-----------------|
| D7 retention < category avg | Retention optimization advice |
| Competitor acquisition spike | Acquisition opportunity advice |
| Feature gap detected | Feature prioritization roadmap |
| Churn rate increasing | Churn intervention advice |
| Revenue per wallet declining | Revenue strategy advice |
| Bot activity >20% | Tokenomics/incentive advice |

**Architecture:**
```
Cron job (daily)
  → AIGrowthAdvisor.generateDailyBrief(userId)
  → Pull user metrics + competitor metrics
  → Build context prompt
  → Call Gemini API
  → Store advice in `ai_advice` table
  → Deliver via WebSocket + email
```

**Files:**
- `src/services/AIGrowthAdvisor.js` (new)
- `src/api/routes/chat.js` — add proactive advice endpoints

---

### 6.2 Scheduled Briefings (FR-33.3)
**Types:**
- Daily Brief: key metric changes + one actionable insight
- Weekly Strategy: deep dive on one area + competitive landscape
- Monthly Board Summary: investor-ready metrics summary

**Delivery:** Email (via nodemailer) + in-app notification

**Files:**
- `src/services/BriefingScheduler.js` (new)
- `src/services/EmailService.js` (new)

---

### 6.3 Multi-Channel Delivery (FR-31)
**Phase 6.3a:** Email integration
- Daily/weekly briefings via email
- Alert notifications via email
- Library: `nodemailer`

**Phase 6.3b (future):** Telegram bot
- `/brief` command → get daily brief
- `/alert` command → get latest alerts
- Library: `node-telegram-bot-api`

**Files:**
- `src/services/EmailService.js` (new)
- `src/api/routes/users.js` — add notification preferences endpoint

---

### 6.4 AI Feedback Loop (FR-37)
- Thumbs up/down on each AI insight
- "Why this?" explanation request
- Track which advice was implemented
- Store feedback in `ai_feedback` table

**Files:**
- `src/api/routes/chat.js` — add feedback endpoints
- `frontend/components/chat/message-feedback.tsx` (new)

---

### 6.5 Scenario Modeling (FR-28 "What if")
- User inputs: "What if I improve retention to 25%?"
- AI models projected impact on growth, revenue, user count
- Based on similar protocol data patterns

**Files:**
- `src/services/ScenarioModeler.js` (new)
- `frontend/components/chat/scenario-input.tsx` (new)

---

## PHASE 7 — SDK & API (Week 15)
*FR-20, FR-21*

### 7.1 Public API Documentation
- OpenAPI/Swagger spec for all endpoints
- API key authentication (already exists)
- Rate limiting per tier

**Files:**
- `src/api/docs/openapi.yaml` (new)
- `src/api/server.js` — serve swagger UI at `/api-docs`

---

### 7.2 JavaScript SDK
```js
import MetaGauge from '@metagauge/sdk'
const mg = new MetaGauge({ apiKey: 'your-key' })
const metrics = await mg.getMetrics('0xContractAddress', 'ethereum')
const wallets = await mg.getWalletSegments('0xContractAddress')
```

**Files:**
- `sdk/index.js` (new package)
- `sdk/package.json`
- `sdk/README.md`

---

## PHASE 8 — Category Benchmarking (Week 16)
*FR-12, FR-13*

### 8.1 Category Averages
- Group all indexed contracts by category (DeFi, NFT, DAO, Gaming, Infra)
- Calculate category averages for key metrics
- Show user's percentile rank within category

**Database:**
```sql
category_benchmarks (
  category, metric_name, avg_value,
  p25_value, p50_value, p75_value, p90_value,
  calculated_at, sample_size
)
```

**Files:**
- `src/services/BenchmarkingService.js` (new)
- `src/api/routes/analysis.js` — add `/api/benchmarks/:category`
- `frontend/components/analyzer/metrics-tab.tsx` — add percentile indicators

---

## Implementation Priority Order

| Priority | Phase | FRs | Effort | Impact |
|----------|-------|-----|--------|--------|
| 1 | Phase 1 - Foundation Fixes | FR-01 | 1 week | High |
| 2 | Phase 2 - Wallet Intelligence | FR-05, FR-06 | 2 weeks | High |
| 3 | Phase 3 - Alerts | FR-16 | 2 weeks | High |
| 4 | Phase 4 - Competitive Intel | FR-24–29 | 3 weeks | Very High |
| 5 | Phase 5 - Export/Share | FR-18, FR-19 | 1 week | Medium |
| 6 | Phase 6 - AI Advisor | FR-30–38 | 4 weeks | Very High |
| 7 | Phase 7 - SDK/API | FR-20, FR-21 | 1 week | Medium |
| 8 | Phase 8 - Benchmarking | FR-12, FR-13 | 1 week | Medium |

**Total estimated effort: 15-16 weeks**

---

## Database Schema Additions Needed

```sql
-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  contract_id UUID REFERENCES contracts(id),
  alert_type VARCHAR(50),
  severity VARCHAR(20),
  message TEXT,
  metric_value DECIMAL,
  threshold DECIMAL,
  triggered_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  is_read BOOLEAN DEFAULT false
);

-- Cohort Retention
CREATE TABLE cohort_retention (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id),
  cohort_week DATE,
  cohort_size INTEGER,
  d1_retained INTEGER,
  d7_retained INTEGER,
  d30_retained INTEGER,
  d90_retained INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Competitor tracking
CREATE TABLE competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_contract_id UUID REFERENCES contracts(id),
  competitor_address VARCHAR(255),
  competitor_chain VARCHAR(50),
  metrics JSONB,
  indexed_at TIMESTAMP DEFAULT NOW()
);

-- AI advice
CREATE TABLE ai_advice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  advice_type VARCHAR(50),
  content TEXT,
  trigger_metric VARCHAR(100),
  trigger_value DECIMAL,
  delivered_at TIMESTAMP,
  feedback VARCHAR(20),
  implemented BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Share tokens
CREATE TABLE share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analyses(id),
  token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Category benchmarks
CREATE TABLE category_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50),
  metric_name VARCHAR(100),
  avg_value DECIMAL,
  p25_value DECIMAL,
  p50_value DECIMAL,
  p75_value DECIMAL,
  p90_value DECIMAL,
  sample_size INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Quick Wins (Can ship in days, not weeks)

1. **Fix progress bar** — 1 day (Phase 1.1)
2. **Fix blockRange null** — 2 hours (Phase 1.2)
3. **CSV export** — 1 day (Phase 5.1)
4. **Alert config UI** — 2 days (Phase 3.2)
5. **Competitor add/remove** — 2 days (Phase 4.1)
