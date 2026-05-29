# MetaGauge AI Agent — Hackathon Requirements

## What We're Building

A standalone AI-powered blockchain intelligence agent that analyzes on-chain activity, developer behavior, and social sentiment to identify high-potential Web3 projects. Built for investors, founders, and launchpads.

> **Modules 1 & 2 (User Management + Project Submission) are already handled by the main MetaGauge app.**
> The agent reuses that auth layer and assumes a project/contract is already onboarded.

---

## MVP Scope (Hackathon Only)

### In Scope
- AI analysis via Gemini (growth patterns, risk scoring, confidence score)
- Growth score + Risk score + Sustainability score + Community Health score
- Scam / rug pull detection
- Smart wallet / whale tracking
- GitHub developer activity analysis
- Social sentiment analysis (Twitter/X)
- Explainable AI reports
- Intelligence dashboard with charts
- AI agent — autonomous research + conversational interface
- Alert & monitoring system
- MongoDB for analysis storage
- Hosted demo

### Out of Scope
- User registration / login (main app)
- Project submission / contract onboarding (main app)
- Portfolio management
- Trading tools
- DAO governance
- Mobile app
- Payment systems
- Exchange integrations

---

## Module 3 — AI Intelligence Engine

### 3.1 AI Pattern Analysis
Gemini analyzes:
- Wallet behavior patterns
- Holder growth trends
- Liquidity consistency
- Developer activity signals
- Social momentum

Produces:
- Confidence score (0–100)
- Growth similarity vs historical projects
- Structured analysis output

### 3.2 Predictive Intelligence
AI calculates:
- **Traction Score** (0–100) — overall growth momentum
- **Risk Score** (0–100) — probability of rug/scam/abandonment
- **Growth Probability** — estimated adoption trajectory
- **Sustainability Score** — long-term viability
- **Community Health Score** — organic vs bot activity
- **Confidence Interval** — certainty of prediction

AI detects momentum signals and ecosystem expansion patterns.

### 3.3 Explainable AI Reporting
AI explains:
- Why each score was assigned
- Which metrics influenced predictions
- Key risk indicators
- Positive momentum signals

Reports are readable by non-technical users and exportable as JSON/PDF.

---

## Module 4 — Risk Detection System

### 4.1 Scam Detection
Detect:
- Rug pull patterns (LP withdrawal signals)
- Wallet concentration (top 10 wallets >50% supply)
- Wash trading (circular transaction patterns)
- Fake engagement (bot-like wallet behavior)
- Inactive development (no commits 30+ days)
- Contract ownership risks (unrenounced owner)

Output: risk level (low / medium / high / critical) + plain-English explanation

### 4.2 Smart Wallet Intelligence
Track:
- Known VC / smart money wallets
- Whale accumulation patterns
- Ecosystem fund wallets
- Unusual wallet movements

Output: wallet cluster map + movement timeline

---

## Module 5 — Social Intelligence

### 5.1 Sentiment Analysis
Sources: Twitter/X

Detect:
- Organic growth vs bot amplification
- Narrative velocity (conversation growth rate)
- Influencer impact
- Sentiment direction (positive / neutral / negative)

Output: Sentiment Score + bot likelihood estimate + trend direction

---

## Module 6 — Developer Intelligence

### 6.1 Repository Analysis
Analyze:
- Commit frequency (last 30/90 days)
- Contributor count + growth
- Issue resolution speed
- Deployment frequency
- Code activity trends
- Abandoned project detection

Output: **Development Health Score** (0–100) + inactivity alerts

---

## Module 7 — AI Agent System

### 7.1 Autonomous Research Agent
Agent autonomously:
- Collects project intelligence from all sources
- Aggregates and normalizes metrics
- Runs AI analysis pipeline
- Generates structured reports

Agent supports:
- Conversational interaction ("Why is the risk score high?")
- Analysis history memory within session

Agent tools:
- `get_onchain_metrics`
- `get_github_activity`
- `get_social_sentiment`
- `get_risk_signals`
- `get_wallet_intelligence`
- `generate_report`
- `compare_projects`

---

## Module 8 — Dashboard

### 8.1 Intelligence Dashboard
Display per project:
- Growth score card
- Risk score card
- Wallet trend chart (line)
- Sentiment trend chart (line)
- Liquidity health chart (bar)
- Developer activity timeline
- AI-generated summary card
- Ecosystem activity heatmap

Data updates in near real-time (WebSocket or polling).

---

## Module 9 — Alert & Monitoring System

### 9.1 AI Alerts
Trigger when:
- Whale accumulation spikes (>10% supply movement in 24h)
- Sentiment shifts sharply (>30% change)
- Developer activity increases significantly
- Liquidity drops >20% in 24h
- Risk score crosses threshold

Delivery: email (MVP), push/Telegram (post-hackathon)
False positives minimized via confidence thresholds.

---

## Module 10 — Portfolio Intelligence (Lite)

Track user's submitted projects as a watchlist:
- AI evaluates aggregate risk across watched projects
- Highlight underperforming vs outperforming projects
- Export watchlist report

> Full portfolio management (wallet connection, holdings tracking) is out of scope.

---

## Module 11 — Admin Module

Monitor:
- Analysis queue status
- API health (RPC, GitHub, Twitter)
- AI usage (Gemini calls)
- Fraud/abuse attempts

Manage:
- Rate limits per user
- Feature access flags

---

## Module 12 — API Layer

Expose:
- `GET /api/projects/:id/scores` — traction, risk, growth scores
- `GET /api/projects/:id/report` — full AI report
- `GET /api/projects/:id/wallet-intelligence` — whale/smart money data
- `GET /api/projects/:id/sentiment` — social sentiment metrics

API authentication: JWT (reused from main app)
Rate limiting enforced per tier.
API documentation at `/api-docs`.

---

## Data Models

### Analysis
```
projectId, runAt, status,
tractionScore, riskScore, growthProbability,
sustainabilityScore, communityHealthScore, confidenceInterval,
aiSummary, riskLevel,
onChainMetrics, githubMetrics, sentimentMetrics,
riskSignals, walletIntelligence,
components[]
```

### Alert
```
projectId, userId, type, message,
severity (low|medium|high|critical),
triggeredAt, read
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| AI | Google Gemini (gemini-2.5-flash) |
| Database | MongoDB (mongoose) |
| Auth | Reuse JWT from main app |
| On-chain | ethers.js (EVM) + @solana/web3.js |
| GitHub | GitHub REST API |
| Social | Twitter API v2 |
| Frontend | Next.js (reuse existing shell) |
| Charts | Recharts (reuse existing) |
| Hosting | Railway / Render + Vercel |

---

## What's Reused from Main App

- JWT auth middleware
- Wallet connection (RainbowKit + wagmi)
- Frontend shell (Next.js + shadcn/ui + Recharts)
- Gemini AgentService agentic loop pattern
- RAGContextBuilder pattern
- WebSocket infrastructure
- Chat UI components
