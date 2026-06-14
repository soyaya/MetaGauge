# MetaGauge — Growth & Competitive Advantage Roadmap

## Goal
Give users the tools to grow their protocol, retain users, and win against competitors — not just observe data.

---

## Phase 1 — Surface What's Already Built (Low effort, high impact)

These features exist in the backend but have no UI or are hidden. Ship them first.

### 1.1 Investor Export (TractionNarrator)
**What:** One-click generation of investor-ready content from real on-chain data.
**Already built:** `TractionNarrator.js` with 3 content types.
**What to add:** UI panel on dashboard with 3 buttons:

- **Investor Summary** — 1-page traction overview with benchmarks
- **Twitter Thread** — 5-7 tweet thread about milestones with real numbers
- **Pitch Slide Data** — headline + bullets + chart data for deck

**Endpoint:** `POST /api/agent/generate-content` (already exists)
**Where:** New "Export" button on dashboard header or dedicated tab.

---

### 1.2 Public Growth Score Page
**What:** A shareable URL showing a protocol's MetaGauge score — acts as a trust signal for investors and community.
**Already built:** `ShareTokenService.js` exists.
**What to add:** 
- `GET /share/:token` public page showing traction/risk/growth scores
- "Share my score" button on dashboard

---

### 1.3 Competitor Movement Weekly Email
**What:** Every Monday, email users a digest of competitor activity.
**Already built:** `BriefingScheduler.generateWeeklyStrategy()` uses `get_competitors` tool.
**What to add:** Add competitor movement section to weekly brief — who gained users, who lost, who's growing fastest.

---

## Phase 2 — Actionability (Medium effort, very high impact)

Turn data into actions users can actually take.

### 2.1 Growth Playbooks
**What:** When a metric is underperforming, show a specific playbook — not just a task, but a step-by-step guide.
**Examples:**
- D7 Retention < 20% → "Re-engagement Playbook": segment wallets by LTV, identify inactive high-value users, design on-chain incentive
- Churn spike → "Whale Retention Playbook": identify top 10 at-risk wallets, analyse their recent activity, suggest targeted outreach
- Competitor growing 2x → "Competitive Response Playbook": feature gap analysis, acquisition channel suggestions

**How:** Agent generates playbook when `create_task` is called — adds `playbook` field with numbered steps.

---

### 2.2 Wallet Outreach Intelligence
**What:** Export a list of churned high-value wallets for targeted re-engagement campaigns.
**Already built:** `BusinessIntelligenceEngine.computeChurnRisk()` + `computeLTV()` identify exactly these wallets.
**What to add:**
- "At-risk wallets" panel showing top churned wallets by LTV
- Export as CSV with wallet address, LTV, days inactive, last action
- `GET /api/agent/at-risk-wallets` endpoint

---

### 2.3 Cohort Benchmarking
**What:** Show users how their metrics compare to category averages and top performers.
**Examples:**
- "Your D7 retention (28%) is above DeFi average (22%) but below top quartile (45%)"
- "Your churn rate (18%) is 2x higher than similar protocols"
**How:** Add benchmark labels to `ScoringEngine` output using `data/ai-knowledge/market-context.json` category data.

---

## Phase 3 — Competitive Intelligence (Medium effort, high impact)

### 3.1 Competitor Intelligence Feed
**What:** A dedicated feed showing competitor movements in real-time.
**What to add:**
- `/dashboard` Competitive tab upgraded with a feed view
- Weekly auto-scan: which competitors gained >10% users, which lost liquidity
- "Competitor alert" when a direct competitor spikes — already partially in `ProactiveAgent.checkCompetitorSpikes()`

---

### 3.2 Market Position Score
**What:** Tell users where they rank in their category — not just their own scores but relative position.
**Examples:**
- "You are #3 in DeFi by retention among protocols with similar TVL"
- "You are in the top 25% for community health in your category"
**How:** `AdvancedMarketShareCalculator.js` already exists — surface its output.

---

## Phase 4 — Retention & Lifecycle (Higher effort, long-term value)

### 4.1 User Lifecycle Campaigns
**What:** Automated suggestions for on-chain campaigns based on lifecycle stage.
- New users (< 7 days) → suggest welcome incentive design
- At-risk users (no tx in 14 days) → suggest re-engagement mechanism
- Power users → suggest referral or governance participation

### 4.2 Predictive Alerts (Pre-emptive)
**What:** Alert users *before* a metric goes bad, not after.
- "Your D7 retention trend suggests it will drop below 20% in ~8 days"
- "Whale wallet concentration has increased 12% this week — monitor closely"
**How:** `PredictionEngine.js` already exists — wire its output into ProactiveAgent alerts.

---

## Implementation Order

| Phase | Feature | Effort | Who Benefits |
|-------|---------|--------|-------------|
| 1 | Investor export UI | 1 day | Founders raising money |
| 1 | Public share page | 1 day | All users — distribution |
| 1 | Competitor weekly email | 0.5 days | All users |
| 2 | Growth playbooks | 2 days | All users — actionability |
| 2 | Wallet outreach export | 1 day | Founders with active users |
| 2 | Cohort benchmarking | 1 day | All users — context |
| 3 | Competitor feed | 2 days | Competitive protocols |
| 3 | Market position score | 1 day | All users |
| 4 | Lifecycle campaigns | 3 days | Protocols with user base |
| 4 | Predictive alerts | 2 days | All users |

**Total estimated:** ~15 days of focused work.

---

## What Users Get

After this roadmap:
- **Founders** can generate pitch materials directly from their on-chain data
- **Investors** can see a protocol's verified on-chain trust score
- **Growth teams** get specific playbooks, not just dashboards
- **Protocol teams** know competitor movements before they show up in the market
- **Everyone** gets told what to do next, not just what happened
