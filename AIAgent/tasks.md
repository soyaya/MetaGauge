# MetaGauge AI Agent — Implementation Tasks

## Phase 1: Foundation
- [ ] Create `AIAgent/src/` folder structure
- [ ] Set up Express server (`server.js`) on port 5001
- [ ] Connect MongoDB via mongoose
- [ ] Create Analysis, Alert mongoose schemas (no Project schema — main app owns that)
- [ ] Wire up JWT auth middleware (reuse from main app)
- [ ] Set up environment config (`config/env.js`)

> Modules 1 & 2 (user management + project submission) are skipped — handled by main app.

## Phase 2: Data Collection (Module 3 inputs)
- [ ] `OnChainCollector.js` — EVM (ethers.js): holder count, tx volume, liquidity, whale txs
- [ ] `OnChainCollector.js` — Solana (@solana/web3.js): same metrics
- [ ] `GitHubAnalyzer.js` — commits, contributors, issue resolution, dev health score (Module 6)
- [ ] `SentimentAnalyzer.js` — Twitter API v2: sentiment score, bot ratio, trend direction (Module 5)
- [ ] `WalletIntelligence.js` — whale clusters, smart money wallets, movement timeline (Module 4.2)

## Phase 3: Scoring & Risk (Modules 3 + 4)
- [ ] `RiskDetector.js` — concentration, LP withdrawal, wash trading, dev inactivity, ownership (Module 4.1)
- [ ] `ScoringEngine.js` — traction, risk, sustainability, community health scores 0–100 (Module 3.2)

## Phase 4: AI Layer (Module 7)
- [ ] `AgentService.js` — Gemini agentic loop with tool calling (adapt from main app)
- [ ] Agent tools: `get_onchain_metrics`, `get_github_activity`, `get_social_sentiment`
- [ ] Agent tools: `get_risk_signals`, `get_wallet_intelligence`, `generate_report`, `compare_projects`
- [ ] `ReportGenerator.js` — Gemini call → explainable report + structured components (Module 3.3)

## Phase 5: API Routes (Module 12)
- [ ] `routes/analysis.js` — POST trigger, GET status, GET results
- [ ] `routes/agent.js` — POST chat, POST autonomous research
- [ ] `routes/alerts.js` — GET list, PUT mark read
- [ ] `routes/admin.js` — queue status, API health, usage stats (Module 11)

## Phase 6: Pipeline + Alerts (Modules 8 + 9)
- [ ] Wire full pipeline: collect → score → report → save → WebSocket emit
- [ ] Background job: re-analyze active projects every 6h
- [ ] Alert engine: check thresholds after each analysis run (Module 9)

## Phase 7: Frontend (Module 8 — reuse existing shell)
- [ ] Project intelligence dashboard page (`/agent/project/[id]`) — scores + charts + AI report
- [ ] Agent chat interface (reuse existing chat components)
- [ ] Alerts panel (reuse existing alerts components)
- [ ] Watchlist page for portfolio lite (Module 10)

## Phase 8: Demo Polish
- [ ] Seed 2–3 real projects for demo (e.g. PEPE, UNI, a small cap)
- [ ] Ensure all scores render correctly
- [ ] Test agent chat with "Why is risk high?" type questions
- [ ] Deploy backend to Railway/Render
- [ ] Deploy frontend to Vercel
- [ ] Record demo video
