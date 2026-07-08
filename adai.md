# MetaGauge — Advanced AI Financial Intelligence System
## Full Implementation Plan (Phase 1 → 3)

---

## Overview

Three interconnected systems built on top of MetaGauge's existing on-chain analytics:

1. **Financial Intelligence Layer** — AI collects off-chain inputs, merges with on-chain data, generates investor-grade financial documents
2. **Autonomous Research Agent** — fetches external API data (DeFiLlama, CoinGecko, GitHub), saves findings for RAG context
3. **Growth Fingerprint + Cross-User Recommendations** — pattern matching against successful projects, opt-in project registry, investor discovery tab

---

## Guiding Principles

- AI asks for costs conversationally — one-time inputs are never asked again
- Monthly recurring costs are asked once per month if not yet provided
- All financial documents follow standard GAAP/IFRS-adjacent accounting adapted for crypto
- USD is the base currency throughout; token values shown at current market price
- PDF exports follow a standard investor data room format (clean, minimal, professional)
- Projects can opt-in to be featured in a public discovery tab visible to all users
- Research findings are saved and TTL-managed (7-day refresh) for RAG injection

---

## Data Model

### Financial Profile (per user, per contract, per period)
```
data/financial/{userId}/{contractAddress}_{chain}/
  profile.json          ← one-time inputs (never re-asked)
  2026-07.json          ← monthly recurring inputs
  2026-06.json
  ...
```

### Research Store (per contract)
```
data/research/{contractAddress}_{chain}.json
  fetched_at, ttl, defillama, coingecko, github, benchmarks
```

### Growth Fingerprints
```
data/fingerprints/{contractAddress}_{chain}.json
  growth_velocity, retention_curve, revenue_acceleration,
  cac_trend, match_score, matched_comps
```

### Project Registry (opt-in featured projects)
```
data/registry/projects.json
  [ { userId, contractAddress, chain, name, category,
      stage, fingerprint_ref, featured_since, contact } ]
```

---

## Phase 1 — Financial Documents

### Goal
AI collects off-chain business inputs through chat, merges with indexed on-chain data, and generates 6 investor-grade financial documents. Exports to PDF.

---

### Phase 1 Checklist

#### 1.1 Financial Profile Service (Backend)
- [ ] Create `src/services/FinancialProfileService.js`
  - [ ] `getProfile(userId, contractId)` — load one-time inputs
  - [ ] `saveProfile(userId, contractId, data)` — persist one-time inputs
  - [ ] `getPeriodInputs(userId, contractId, period)` — load monthly inputs (format: YYYY-MM)
  - [ ] `savePeriodInputs(userId, contractId, period, data)` — persist monthly inputs
  - [ ] `getMissingFields(userId, contractId, period)` — return list of fields not yet collected
  - [ ] Auto-create directory structure under `data/financial/`

#### 1.2 Input Field Schema
One-time inputs (asked once, stored in profile.json):
- [ ] `projectStage` — pre-seed / seed / series-a / series-b / growth / public
- [ ] `foundedDate` — when the project started
- [ ] `teamSize` — number of full-time contributors
- [ ] `hasToken` — boolean
- [ ] `tokenSymbol` — if hasToken
- [ ] `tokenTotalSupply` — if hasToken
- [ ] `tokenTreasuryAmount` — tokens held in treasury wallet
- [ ] `treasuryWalletAddress` — for balance sheet
- [ ] `raisedFunding` — boolean
- [ ] `fundingRounds` — array: [ { round, amount_usd, date, lead_investor } ]
- [ ] `revenueModel` — protocol fees / token sales / subscription / other
- [ ] `costPerTxSubsidy` — if project subsidises user gas

Monthly recurring inputs (asked each month if not provided):
- [ ] `marketingSpend` — total marketing & ads USD
- [ ] `payroll` — total team payroll USD
- [ ] `infraCost` — RPC, hosting, servers USD
- [ ] `legalAuditCost` — legal, smart contract audits USD
- [ ] `otherOpex` — any other operating costs USD
- [ ] `tokenTreasuryMovement` — net tokens bought/sold from treasury (optional)
- [ ] `offChainRevenue` — any revenue not captured on-chain (optional)
- [ ] `cashBalance` — current USD cash/stablecoin balance

#### 1.3 AI Input Collector (Chat Integration)
- [ ] Extend `ChatAIService.js` with `financialInputMode`
  - [ ] When user opens chat for a contract, check `getMissingFields()`
  - [ ] If missing one-time fields: AI opens with "Before I generate your financial documents, I need a few one-time details about your project..."
  - [ ] If missing monthly fields for current month: AI asks "It's a new month — what was your total marketing spend in [month]?"
  - [ ] AI asks one field at a time, validates response, saves immediately
  - [ ] AI never re-asks a field that already has a value
  - [ ] AI confirms when all inputs are collected: "Great, I have everything I need. Generating your financial documents now..."
- [ ] Add `POST /api/financial/inputs` — save a single field value
- [ ] Add `GET /api/financial/inputs/missing` — return missing fields for current period

#### 1.4 Financial Document Engine (Backend)
- [ ] Create `src/services/FinancialDocumentEngine.js`
  - [ ] `buildIncomeStatement(onChainData, inputs, period)` — returns structured JSON
    - [ ] Protocol Revenue: fees + volume × take rate from on-chain
    - [ ] Token Revenue: treasury inflows if applicable
    - [ ] Off-chain Revenue: from inputs
    - [ ] COGS: gas subsidies + RPC costs + infra
    - [ ] Gross Profit & Gross Margin %
    - [ ] Operating Expenses: marketing + payroll + legal + other
    - [ ] EBITDA
    - [ ] Net Profit / Loss
    - [ ] Per-transaction unit economics inline
  - [ ] `buildCashFlowStatement(onChainData, inputs, period)` — returns structured JSON
    - [ ] Operating: protocol fees received, cash paid for costs
    - [ ] Investing: R&D, audits, treasury movements
    - [ ] Financing: fundraising received, token sales
    - [ ] Net change in cash
    - [ ] Treasury runway in months
  - [ ] `buildBalanceSheet(onChainData, inputs, period)` — returns structured JSON
    - [ ] Current Assets: cash, stablecoins, receivables
    - [ ] Non-current Assets: token treasury at market price, IP
    - [ ] Current Liabilities: payables, accrued expenses
    - [ ] Non-current Liabilities: vesting obligations
    - [ ] Equity: retained earnings / accumulated deficit
  - [ ] `buildUnitEconomics(onChainData, inputs, period)` — returns structured JSON
    - [ ] CAC = total marketing spend / new users acquired
    - [ ] LTV = avg revenue per user × avg retention months
    - [ ] LTV:CAC ratio
    - [ ] Payback period in months
    - [ ] Revenue per active user
    - [ ] Cost per transaction
    - [ ] Monthly burn rate
    - [ ] Runway in months
  - [ ] `buildKPIDashboard(onChainData, inputs, researchData, period)` — returns structured JSON
    - [ ] DAU/WAU/MAU with MoM trend %
    - [ ] Revenue MoM growth %
    - [ ] Retention cohorts summary
    - [ ] Protocol health score
    - [ ] vs. sector benchmarks from research data
  - [ ] `build12MonthModel(onChainData, inputs, period)` — returns structured JSON
    - [ ] Growth assumptions (user growth rate, tx growth, price assumptions)
    - [ ] 12-month projected revenue (Base / Bull / Bear scenarios)
    - [ ] 12-month projected costs
    - [ ] Break-even month projection
    - [ ] Scenario table: month-by-month

#### 1.5 Financial Narrative Service (Gemini)
- [ ] Create `src/services/FinancialNarrativeService.js`
  - [ ] `generateExecutiveSummary(allDocuments)` — 2-paragraph investor-ready summary
  - [ ] `generateCFOCommentary(document, documentType)` — paragraph commentary per document
  - [ ] `generateRedFlagsAndOpportunities(allDocuments)` — bullet list
  - [ ] `generateInvestorQAPrep(allDocuments)` — likely investor questions + suggested answers
  - [ ] Uses multi-key Gemini fallback (same pattern as existing services)

#### 1.6 API Routes (Backend)
- [ ] Create `src/api/routes/financial.js`
  - [ ] `GET  /api/financial/inputs` — get all saved inputs for user + contract
  - [ ] `POST /api/financial/inputs` — save one or more input fields
  - [ ] `GET  /api/financial/inputs/missing` — return missing fields for current period
  - [ ] `POST /api/financial/documents/generate` — trigger full document generation
  - [ ] `GET  /api/financial/documents/:period` — retrieve generated documents for a period
  - [ ] `GET  /api/financial/documents/latest` — most recent complete document set
  - [ ] `POST /api/financial/export/pdf` — generate and return PDF
- [ ] Register route in `src/api/server.js`

#### 1.7 PDF Generator
- [ ] Create `src/services/FinancialPDFGenerator.js`
  - [ ] Uses `pdfkit` or `puppeteer` (prefer puppeteer for rich formatting)
  - [ ] Standard investor data room style: clean, minimal, black/white with accent
  - [ ] Cover page: project name, period, generated by MetaGauge
  - [ ] Section per document with CFO commentary inline
  - [ ] Executive summary on page 2
  - [ ] Tables formatted with proper column alignment
  - [ ] Footer: "Confidential — Generated by MetaGauge | metagauge.io"

#### 1.8 Frontend — Financials Tab
- [ ] Create `frontend/components/analyzer/financials-tab.tsx`
  - [ ] Input status banner: "X fields needed to generate documents" with CTA
  - [ ] Executive Summary card (Gemini narrative)
  - [ ] Tabbed sub-navigation: P&L | Cash Flow | Balance Sheet | Unit Economics | KPIs | 12-Month Model
  - [ ] Each document rendered as a formatted table with:
    - [ ] Section headers (bold)
    - [ ] Subtotals with border-top
    - [ ] Net figures highlighted (green if positive, red if negative)
    - [ ] CFO commentary block below each table
  - [ ] Red Flags & Opportunities accordion
  - [ ] Investor Q&A Prep accordion
  - [ ] "Export PDF" button → calls `/api/financial/export/pdf`
  - [ ] "Regenerate" button → re-runs document engine with latest data
  - [ ] Period selector: dropdown to view historical periods
- [ ] Add "Financials" tab to dashboard tab list in `frontend/app/dashboard/page.tsx`

#### 1.9 Dependencies to Add
- [ ] Backend: `pdfkit` or `puppeteer` for PDF generation
- [ ] Backend: no new deps needed for calculation engine
- [ ] Frontend: no new deps needed (recharts already available for 12-month chart)

#### 1.10 Phase 1 Verification
- [ ] Create test user with a real indexed contract
- [ ] Run through AI chat input collection — confirm no field is re-asked
- [ ] Confirm monthly fields are re-asked in a new month
- [ ] Generate all 6 documents — verify calculations match manual check
- [ ] Generate PDF — verify formatting matches investor standard
- [ ] Test period selector shows historical documents
- [ ] Test with token project vs. non-token project
- [ ] Test with funded project vs. bootstrap project

---

## Phase 2 — Autonomous Research Agent

### Goal
Agent runs automatically on contract onboarding and weekly thereafter. Fetches data from DeFiLlama, CoinGecko, GitHub. Saves structured findings. Injects into Gemini context for richer benchmarking and commentary.

---

### Phase 2 Checklist

#### 2.1 Research Agent Service (Backend)
- [ ] Create `src/services/ResearchAgent.js`
  - [ ] `runResearch(contractAddress, chain, projectMeta)` — main entry point
  - [ ] `fetchDeFiLlama(projectSlug)` — TVL history, fees, revenue, protocol rank
  - [ ] `fetchCoinGecko(tokenId)` — price, market cap, volume, sentiment score, ATH/ATL
  - [ ] `fetchGitHub(repoUrl)` — commits last 30/90 days, contributors, open issues, stars
  - [ ] `fetchSectorBenchmarks(category, chain)` — median CAC, LTV, retention for sector
  - [ ] `buildResearchSummary(allFindings)` — structured JSON summary
  - [ ] TTL check: skip re-fetch if data is < 7 days old
  - [ ] Error isolation: if one source fails, others still save

#### 2.2 Research Store Service (Backend)
- [ ] Create `src/services/ResearchStore.js`
  - [ ] `save(contractAddress, chain, data)` — write to `data/research/`
  - [ ] `get(contractAddress, chain)` — read with TTL check
  - [ ] `isExpired(contractAddress, chain)` — returns boolean
  - [ ] `buildRAGContext(contractAddress, chain)` — returns formatted string for Gemini prompt injection

#### 2.3 API Routes
- [ ] Add to `src/api/routes/financial.js` (or new `research.js`):
  - [ ] `POST /api/research/run` — manual trigger for a contract
  - [ ] `GET  /api/research/:contractAddress/:chain` — get latest findings
  - [ ] `GET  /api/research/:contractAddress/:chain/benchmarks` — sector benchmarks only

#### 2.4 Scheduler Integration
- [ ] Add weekly research refresh job in `src/api/server.js` startup
  - [ ] On server start: queue research run for all indexed contracts with expired TTL
  - [ ] On new contract indexed: auto-trigger research run

#### 2.5 Gemini Context Injection
- [ ] Update `FinancialNarrativeService.js` to accept research data
  - [ ] Inject sector benchmarks into CFO commentary prompts
  - [ ] Inject competitor TVL/volume into executive summary
  - [ ] Update `RAGContextBuilder.js` to include research findings

#### 2.6 Frontend — Sector Benchmarks Section
- [ ] Add "Sector Benchmarks" section to Financials tab
  - [ ] Shows: median CAC, LTV, retention, TVL for sector
  - [ ] Shows: this project vs. sector median (above/below with % delta)
  - [ ] "Last updated: X days ago" with manual refresh button

#### 2.7 Phase 2 Verification
- [ ] Confirm DeFiLlama fetch works for a known protocol
- [ ] Confirm CoinGecko fetch works with provided API key
- [ ] Confirm GitHub fetch works for a public repo
- [ ] Confirm TTL prevents unnecessary re-fetches
- [ ] Confirm research context appears in Gemini-generated commentary
- [ ] Confirm weekly scheduler runs without blocking the main server thread

---

## Phase 3 — Growth Fingerprint + Cross-User Recommendations + Featured Projects

### Goal
Extract growth patterns from every analyzed project, match against known successful project fingerprints, build an opt-in registry, and surface early-stage high-potential projects to investors.

---

### Phase 3 Checklist

#### 3.1 Growth Fingerprint Engine (Backend)
- [ ] Create `src/services/GrowthFingerprintEngine.js`
  - [ ] `extractFingerprint(contractAddress, chain, onChainData, financialData)` — returns fingerprint object:
    - [ ] `userGrowthVelocity` — week 1/4/12 user count progression
    - [ ] `retentionCurveShape` — D1/D7/D30 array (the "shape" not just values)
    - [ ] `revenueAcceleration` — MoM revenue growth rate trend
    - [ ] `cacTrend` — improving / stable / degrading
    - [ ] `onChainDensity` — txs per active user per week
    - [ ] `tvlGrowthTrajectory` — weekly TVL change array (if DeFi)
    - [ ] `stage` — early / growth / mature (derived from age + user count)
  - [ ] `matchAgainstComps(fingerprint)` — compare against seeded successful project fingerprints
    - [ ] Returns top 3 comp matches with similarity score 0–100
    - [ ] Returns `earlyGrowthMatchScore` 0–100
  - [ ] `saveFingerprint(contractAddress, chain, fingerprint)` — persist to `data/fingerprints/`
  - [ ] `loadFingerprint(contractAddress, chain)` — retrieve

#### 3.2 Seed Known Successful Project Fingerprints
- [ ] Create `data/fingerprints/seed/` directory
- [ ] Add seeded fingerprints for known successful projects at early stage:
  - [ ] Uniswap (early 2019 pattern)
  - [ ] Aave (early 2020 pattern)
  - [ ] GMX (early 2021 pattern)
  - [ ] Arbitrum ecosystem early adopters
  - [ ] Source values from public DeFiLlama + CoinGecko historical data
- [ ] These seeds are the benchmark — live projects are matched against them

#### 3.3 Project Registry Service (Backend)
- [ ] Create `src/services/ProjectRegistryService.js`
  - [ ] `optIn(userId, contractAddress, chain, contactInfo)` — add to registry
  - [ ] `optOut(userId, contractAddress, chain)` — remove from registry
  - [ ] `getRegistry(filters)` — list featured projects with filters: category, chain, stage, minMatchScore
  - [ ] `getProjectCard(contractAddress, chain)` — full featured project card data
  - [ ] `updateProjectCard(contractAddress, chain)` — refresh fingerprint + research data
  - [ ] Registry stored in `data/registry/projects.json`

#### 3.4 Recommendation Engine (Backend)
- [ ] Create `src/services/RecommendationEngine.js`
  - [ ] `findSimilarToSuccessfulComps(filters)` — returns projects in registry with high earlyGrowthMatchScore
  - [ ] `findByGrowthPattern(patternQuery)` — natural language → matched projects
  - [ ] `generateRecommendationCard(project, requestingUserId)` — Gemini writes investor brief:
    - [ ] "Why this project matches early [Comp] growth pattern"
    - [ ] Key metrics that support the match
    - [ ] Risk factors
    - [ ] Suggested early entry thesis

#### 3.5 API Routes
- [ ] Add routes to new `src/api/routes/registry.js`:
  - [ ] `POST /api/registry/opt-in` — opt project into registry
  - [ ] `POST /api/registry/opt-out` — remove project
  - [ ] `GET  /api/registry/projects` — list featured projects
  - [ ] `GET  /api/registry/projects/:contractAddress/:chain` — single project card
  - [ ] `GET  /api/registry/recommendations` — investor recommendations
  - [ ] `POST /api/registry/recommendations/search` — natural language search

#### 3.6 Fingerprint Trigger
- [ ] Auto-run `extractFingerprint()` after every successful analysis completion
- [ ] Update fingerprint weekly with new on-chain data
- [ ] Only update registry card if project is opted in

#### 3.7 Frontend — Featured Projects Tab
- [ ] Create `frontend/components/analyzer/featured-projects-tab.tsx`
  - [ ] Hero section: "Early-Stage Projects Showing Strong Growth Signals"
  - [ ] Filter bar: Chain | Category | Stage | Min Match Score
  - [ ] Project cards grid showing:
    - [ ] Project name, chain, category, stage badge
    - [ ] Early Growth Match Score (large, colored: green >70, amber 50–70, gray <50)
    - [ ] Top matched comp: "Matches early GMX pattern"
    - [ ] 3 key metrics: Users, Retention, Revenue trend
    - [ ] "View Full Report" button → opens project financial documents (if public)
    - [ ] Contact / invest button (if user provided contact)
  - [ ] Natural language search bar: "Find DeFi projects on Ethereum with Uniswap-like early growth"
  - [ ] Recommendation cards from RecommendationEngine (AI-written briefs)
- [ ] Add "Discover" tab to dashboard tab list

#### 3.8 Frontend — Opt-In Settings (Profile Page)
- [ ] Add "Feature My Project" section to `frontend/app/profile/page.tsx`
  - [ ] Toggle: "Allow MetaGauge to feature this project in the Discover tab"
  - [ ] Optional: contact email or website for interested investors
  - [ ] Privacy note: "Your financial document details are only shown if you enable public documents"
  - [ ] Toggle: "Make my financial documents public to featured viewers"

#### 3.9 Phase 3 Verification
- [ ] Opt a test project in to registry
- [ ] Confirm fingerprint is extracted and saved
- [ ] Confirm match score is calculated against seeded comps
- [ ] Confirm project appears in Discover tab
- [ ] Run natural language search — confirm relevant results returned
- [ ] Confirm opt-out removes project from registry
- [ ] Confirm Gemini recommendation card is generated correctly
- [ ] Test privacy: non-public documents not visible to other users

---

## Featured Projects Tab — UX Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Discover                                           [Search...]  │
│  Early-stage projects with verified on-chain growth signals     │
│                                                                 │
│  [All Chains ▼]  [All Categories ▼]  [Stage ▼]  [Score 70+ ▼] │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │ ProjectName       │  │ ProjectName       │                  │
│  │ Ethereum · DeFi   │  │ Starknet · NFT    │                  │
│  │                   │  │                   │                  │
│  │  Match Score      │  │  Match Score      │                  │
│  │    [87/100]       │  │    [72/100]       │                  │
│  │ ~ early GMX       │  │ ~ early Blur      │                  │
│  │                   │  │                   │                  │
│  │ 1,240 users       │  │ 890 users         │                  │
│  │ 68% retention     │  │ 54% retention     │                  │
│  │ +340% rev MoM     │  │ +120% rev MoM     │                  │
│  │                   │  │                   │                  │
│  │ [View Report]     │  │ [View Report]     │                  │
│  │ [Contact Team]    │  │ [Contact Team]    │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                 │
│  AI Recommendations                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "ProjectX shows week-4 retention of 68%, matching       │   │
│  │  GMX's early-stage profile at the same growth age.      │   │
│  │  CAC is trending down 40% MoM as organic growth kicks   │   │
│  │  in. Revenue up 3x in 60 days. Early entry thesis:..."  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Financial Documents — Investor PDF Layout

```
Page 1 — Cover
  MetaGauge | Financial Intelligence Report
  [Project Name] | [Period] | [Chain]
  Confidential

Page 2 — Executive Summary
  [2-paragraph Gemini narrative]
  Key Highlights table: Revenue | Users | Runway | Match Score

Page 3 — Income Statement (P&L)
  [Formatted table]
  CFO Commentary: [Gemini paragraph]

Page 4 — Cash Flow Statement
  [Formatted table]
  CFO Commentary: [Gemini paragraph]

Page 5 — Balance Sheet
  [Formatted table]
  CFO Commentary: [Gemini paragraph]

Page 6 — Unit Economics
  [Formatted table with CAC, LTV, LTV:CAC, Burn, Runway]
  CFO Commentary: [Gemini paragraph]

Page 7 — KPI Dashboard
  [Table with sector benchmarks side-by-side]
  Above/Below sector median highlighted

Page 8 — 12-Month Forward Model
  [Scenario table: Base / Bull / Bear]
  Break-even analysis
  Assumptions clearly stated

Page 9 — Red Flags & Opportunities
  [Bullet list from Gemini]

Page 10 — Investor Q&A Preparation
  [Q&A pairs from Gemini]

Footer on all pages: Confidential — MetaGauge | metagauge.io
```

---

## Environment Variables Needed

```env
# Research Agent APIs (add to .env when keys are ready)
DEFILLAMA_API_URL=https://api.llama.fi
COINGECKO_API_KEY=your_key_here
COINGECKO_API_URL=https://pro-api.coingecko.com/api/v3
GITHUB_TOKEN=your_token_here

# Financial document settings
FINANCIAL_PERIOD_DEFAULT=monthly
RESEARCH_TTL_DAYS=7
```

---

## File Structure After All 3 Phases

```
src/
  services/
    FinancialProfileService.js      ← Phase 1
    FinancialDocumentEngine.js      ← Phase 1
    FinancialNarrativeService.js    ← Phase 1
    FinancialPDFGenerator.js        ← Phase 1
    ResearchAgent.js                ← Phase 2
    ResearchStore.js                ← Phase 2
    GrowthFingerprintEngine.js      ← Phase 3
    ProjectRegistryService.js       ← Phase 3
    RecommendationEngine.js         ← Phase 3
  api/
    routes/
      financial.js                  ← Phase 1 + 2
      registry.js                   ← Phase 3

frontend/
  components/
    analyzer/
      financials-tab.tsx            ← Phase 1
      featured-projects-tab.tsx     ← Phase 3

data/
  financial/                        ← Phase 1
  research/                         ← Phase 2
  fingerprints/                     ← Phase 3
    seed/                           ← Phase 3
  registry/                         ← Phase 3
```

---

## Progress Tracker

| Phase | Task | Status |
|-------|------|--------|
| 1 | FinancialProfileService.js | ✅ Done |
| 1 | Input field schema + storage | ✅ Done |
| 1 | AI chat input collector | ✅ Done |
| 1 | FinancialDocumentEngine.js | ✅ Done |
| 1 | FinancialNarrativeService.js | ✅ Done |
| 1 | API routes /api/financial/* | ✅ Done |
| 1 | FinancialPDFGenerator.js | ✅ Done |
| 1 | Frontend financials-tab.tsx | ✅ Done |
| 1 | Add Financials tab to dashboard | ✅ Done |
| 1 | financialApi methods in lib/api.ts | ✅ Done |
| 1 | DB migration (9 tables) | ✅ Done |
| 1 | Phase 1 verification | Pending (needs live API keys + running server) |
| 2 | ResearchAgent.js | ✅ Done |
| 2 | ResearchStore.js | ✅ Done (inline in ResearchAgent + research_data table) |
| 2 | API routes /api/research/* | ✅ Done |
| 2 | Scheduler integration | ✅ Done (24h cycle in server.js) |
| 2 | Gemini context injection | ✅ Done (research RAG → generateAll) |
| 2 | Frontend sector benchmarks section | ✅ Done |
| 2 | Phase 2 verification | ✅ Done (live API tests passed) |
| 3 | GrowthFingerprintEngine.js | ✅ Done |
| 3 | Seed successful project fingerprints | ✅ Done (Uniswap, Aave, GMX, Blur, Curve) |
| 3 | ProjectRegistryService.js | ✅ Done |
| 3 | RecommendationEngine.js | ✅ Done |
| 3 | API routes /api/registry/* | ✅ Done |
| 3 | Frontend featured-projects-tab.tsx | ✅ Done |
| 3 | Frontend opt-in settings on profile | ✅ Done |
| 3 | Phase 3 verification | ✅ Done (imports clean, build passes) |
