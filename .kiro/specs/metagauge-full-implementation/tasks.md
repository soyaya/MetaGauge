# Implementation Plan: MetaGauge Full Implementation

## Overview

Implement the complete MetaGauge platform across 8 phases: foundation fixes, wallet intelligence, alerts engine, competitive intelligence, export/sharing, AI growth advisor, public API + SDK, and category benchmarking. All tasks build incrementally on prior steps and wire into the existing Express.js + Next.js codebase.

## Tasks

- [ ] 1. Phase 1 — Foundation Fixes

  - [ ] 1.1 Fix real-time indexing progress accuracy
    - In `src/services/EthereumRpcClient.js`, add a `progressCallback` parameter to `getTransactionsByAddress()` and invoke it after every batch of 15 transactions
    - In `src/api/routes/trigger-indexing.js`, wire the callback so it maps batch progress to the 50–80% range of the overall progress scale and calls `updateProgress()`
    - Ensure `indexingProgress` in the user record and `progress` in the analysis record are updated atomically before the WebSocket event is emitted
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.2 Write property test for progress value range invariant
    - Create `tests/pbt/progress.test.js`
    - Use `fc.float({ min: 0, max: 1 })` to generate batch progress fractions
    - Assert the mapped percentage is in [0, 100] and within 5 points of actual completion
    - Tag: `// Feature: metagauge-full-implementation, Property 1: Progress Value Range Invariant`
    - _Requirements: 1.2_

  - [ ] 1.3 Fix blockRange persistence and dashboard display
    - In `src/api/routes/trigger-indexing.js` after indexing completes, write `blockRange` to both `results.summary.blockRange` and `metadata.blockRange` in the analysis record
    - Update the default contract data API response to return `metadata.blockRange`
    - Return `null` for `blockRange` when no completed analysis exists; the frontend shall display "Not yet indexed"
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 1.4 Implement WebSocket polling fallback
    - In the frontend WebSocket client, detect connection loss and fall back to polling `GET /api/onboarding/status` at 5-second intervals
    - Resume WebSocket updates when the connection is restored
    - _Requirements: 1.5_

  - [ ] 1.5 Migrate to PostgreSQL and create all 16 database tables
    - Set `DATABASE_TYPE=postgres` and verify the PostgreSQL connection on server startup; exit with non-zero code if connection fails
    - Run `scripts/create-schema.js` to create all required tables including the 6 new ones: `alerts`, `cohort_retention`, `competitor_analyses`, `ai_advice`, `share_tokens`, `category_benchmarks`
    - Add `UNIQUE(contract_id, cohort_week)` constraint on `cohort_retention` and `UNIQUE(category, metric_name)` on `category_benchmarks`
    - Ensure all existing queries use parameterized statements
    - Write a migration script that preserves all existing user, contract, and analysis records
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 1.6 Implement role-based access control
    - Add `role` column (default `'admin'`) to the `users` table; support values: `admin`, `analyst`, `viewer`
    - Create `src/middleware/requireRole.js` that reads the authenticated user's role and returns HTTP 403 for unauthorized access
    - Protect all write endpoints (POST/PUT/DELETE) from Viewer role; protect user management endpoints from Analyst role
    - In the frontend, conditionally render edit/delete controls based on the authenticated user's role
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 1.7 Verify and complete FR-02: Project/Contract Management
    - Confirm existing contract CRUD routes cover: create, list, get, update, soft-delete (archive); implement any missing operations
    - Confirm contract address is validated against the target chain RPC before saving (`eth_getCode` or equivalent); add validation if missing
    - Confirm function signatures are extracted from ABI and stored with the contract record; add extraction if missing
    - _Requirements: FR-02 AC-02.1 through AC-02.6_

  - [ ] 1.8 Verify and complete FR-05: Wallet Activity Tracking
    - Confirm indexed activity records include: wallet address, function signature, decoded params, block number, timestamp, and success/fail status; add any missing fields
    - Confirm `GET /api/analysis/:contractId/activities` supports filtering by wallet, date range, and function signature; implement if missing
    - _Requirements: FR-05 AC-05.1 through AC-05.6_

- [ ] 2. Checkpoint — Phase 1 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Phase 2 — Wallet Intelligence

  - [ ] 3.1 Implement WalletClassificationEngine
    - Create `src/services/WalletClassificationEngine.js` with `classifyWallet(walletHistory)` and `classifyAll(contractId)` methods
    - Apply segment rules in strict priority order: Bot → High-risk → Whale → New → Active → Churned
    - Bot: >100 txs in any 24h window OR same function + identical input >5 times within 60s
    - High-risk: failed tx rate > 40%; Whale: top 10 by total volume; New: first interaction within 7 days; Active: interacted within 30 days; Churned: last interaction > 30 days ago
    - Implement `runClassificationCycle(contractId)` that persists segment assignments to `wallet_segments` JSONB in `analyses.results`
    - Schedule the full classification pass via cron every 24 hours
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ] 3.2 Write property test for wallet classification determinism and priority
    - Create `tests/pbt/wallet-classification.test.js`
    - Build a `walletHistoryArb` arbitrary covering all segment boundary conditions
    - Assert: result is in `{Bot, High-risk, Whale, New, Active, Churned}`, same input always returns same output, and priority order is respected when multiple rules match
    - Tag: `// Feature: metagauge-full-implementation, Property 2: Wallet Classification Determinism and Priority`
    - _Requirements: 5.1, 5.2, 5.9_

  - [ ] 3.3 Expose wallet segment API endpoint
    - Add `GET /api/analysis/:contractId/wallet-segments` route in `src/api/routes/analysis.js`
    - Return segment counts and per-wallet segment assignments from the classification results
    - Protect with Viewer+ role middleware
    - _Requirements: 5.11_

  - [ ] 3.4 Implement MetricsCalculator (LTV, RPAW, Revenue Concentration)
    - Create `src/services/MetricsCalculator.js` with methods: `calculateLTV(walletHistory)`, `calculateRPAW(contractId, period)`, `calculateRevenueConcentration(contractId)`
    - LTV = sum of gas fees paid + total ETH/token value transferred to contract by that wallet
    - RPAW = total contract revenue in period / count of Active wallets in that period
    - Revenue Concentration = percentage of total revenue from top 10 wallets by volume
    - Flag Reactivated wallets (previously Churned, now interacting again) and record reactivation timestamp
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.5 Expose wallet metrics API endpoint
    - Add `GET /api/analysis/:contractId/wallet-metrics` route returning LTV, RPAW, Revenue Concentration, and reactivation events
    - Protect with Viewer+ role middleware
    - _Requirements: 6.5_

  - [ ] 3.6 Implement BotDetectionService
    - Create `src/services/BotDetectionService.js` with `isBot(walletHistory)`, `getBotHeuristics(walletHistory)`, and `evaluateContract(contractId)` methods
    - Evaluate every wallet against bot heuristics after each indexing cycle
    - Exclude bot-flagged wallets from retention, LTV, and RPAW calculations by default
    - Support manual bot review mode: present flagged wallets for user confirmation before permanent classification
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 3.7 Expose bot wallets API endpoint
    - Add `GET /api/analysis/:contractId/bot-wallets` route returning bot-flagged wallets and their triggering heuristics
    - Protect with Analyst+ role middleware
    - _Requirements: 8.5_

  - [ ] 3.8 Implement CohortCalculator
    - Create `src/services/CohortCalculator.js` that groups wallets into weekly cohorts by first interaction calendar week
    - Calculate D1 (day 1), D7 (days 6–8), D30 (days 28–32), D90 (days 87–93) retention rates as `retained_count / cohort_size`
    - Persist results to `cohort_retention` table using `INSERT ... ON CONFLICT (contract_id, cohort_week) DO UPDATE` to prevent duplicates
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 3.9 Write property test for cohort retention rate correctness
    - Create `tests/pbt/cohort-retention.test.js`
    - Use `fc.array(fc.date())` to generate wallet interaction timestamps
    - Assert retention rate equals `retained_count / cohort_size` and each Dx window includes exactly the wallets whose return falls within the defined day boundaries
    - Tag: `// Feature: metagauge-full-implementation, Property 3: Cohort Retention Rate Correctness`
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ] 3.10 Write property test for cohort recalculation idempotence
    - Create `tests/pbt/cohort-idempotence.test.js`
    - Use `fc.uuid()` and `fc.date()` to generate contract IDs and cohort weeks
    - Run the cohort calculation N times and assert exactly one row exists in `cohort_retention` for each `(contract_id, cohort_week)` pair with values from the most recent run
    - Tag: `// Feature: metagauge-full-implementation, Property 4: Cohort Recalculation Idempotence`
    - _Requirements: 7.7_

  - [ ] 3.11 Expose cohort retention API endpoint
    - Add `GET /api/analysis/:contractId/cohort-retention` route returning all cohorts sorted by `cohort_week` descending
    - Protect with Viewer+ role middleware
    - _Requirements: 7.8_

  - [ ] 3.12 Implement FR-07/08: Feature Analytics and Funnel Mapping
    - Create `src/services/FunnelService.js` with `defineFunnel(projectId, name, steps)`, `calculateConversion(funnelId)`, and `getResults(funnelId)` methods
    - Steps are ordered function signatures; a wallet completes a step if it called that function at any point (non-linear order counts)
    - Store funnel definitions in a `funnels` JSON record per contract; store per-wallet step completion in `funnel_conversions`
    - Add routes: `POST /api/analysis/:contractId/funnels`, `GET /api/analysis/:contractId/funnels`, `GET /api/analysis/:contractId/funnels/:funnelId`
    - Add `POST /api/analysis/:contractId/function-mappings` and `GET /api/analysis/:contractId/function-mappings` to store human-readable names for function signatures
    - Expose feature adoption rate (% of active wallets that called each function) via `GET /api/analysis/:contractId/feature-adoption`
    - Protect all routes with Viewer+ role middleware
    - _Requirements: FR-07 AC-07.1 through AC-07.8, FR-08 AC-08.1 through AC-08.4_

- [ ] 4. Checkpoint — Phase 2 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 3 — Alerts Engine

  - [ ] 5.1 Implement AlertEngine core
    - Create `src/services/AlertEngine.js` with `checkAllAlerts(userId)` as the cron entry point
    - Implement individual check methods: `checkRetentionDrop`, `checkWhaleExit`, `checkRevenueChange`, `checkBotSurge`, `checkChurnSpike`
    - Fetch current and previous metric snapshots from the DB; compare against configured thresholds (fall back to defaults if not configured)
    - Insert into `alerts` table only when threshold is crossed; suppress duplicate alerts of the same type for the same contract within the last 1 hour
    - Deliver triggered alerts via WebSocket within 10 seconds using `wsManager.sendToUser()`
    - Schedule the alert check cron every hour
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [ ] 5.2 Write property test for alert threshold firing
    - Create `tests/pbt/alert-threshold.test.js`
    - Use `fc.float()` for current value, previous value, and threshold
    - Assert the alert fires if and only if the threshold crossing condition is true, for all five alert types
    - Tag: `// Feature: metagauge-full-implementation, Property 5: Alert Fires If and Only If Threshold Is Crossed`
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ] 5.3 Implement alert acknowledgement and CRUD API
    - Add `GET /api/alerts` (list alerts for user), `PATCH /api/alerts/:id/acknowledge` (set `acknowledged_at` and `is_read=true`), `GET /api/alerts/config`, and `PUT /api/alerts/config` routes
    - Protect with Analyst+ role middleware
    - _Requirements: 9.11, 9.12_

  - [ ] 5.4 Implement alert threshold configuration
    - Persist per-user per-contract threshold configurations in the database
    - Validate that threshold values are positive numbers within the allowed range for each alert type
    - Fall back to default thresholds when no custom configuration exists
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 5.5 Build alerts frontend page
    - Create `frontend/app/alerts/page.tsx` with a list of active alerts using severity badges
    - Create `frontend/components/alerts/alert-list.tsx` for severity-badged alert items
    - Create `frontend/components/alerts/alert-config.tsx` for the threshold configuration form
    - Wire acknowledge action and real-time WebSocket updates
    - _Requirements: 9.11, 9.12, 10.1_

- [ ] 6. Checkpoint — Phase 3 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 4 — Competitive Intelligence

  - [ ] 7.1 Implement competitor management backend
    - Add competitor CRUD routes to `src/api/routes/contracts.js`: `GET /api/contracts/:id/competitors`, `POST /api/contracts/:id/competitors`, `DELETE /api/contracts/:id/competitors/:competitorId`
    - Validate contract address format for the specified chain before saving
    - Allow users to organize competitors into named groups
    - Protect with Analyst+ role middleware
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.7_

  - [ ] 7.2 Implement CompetitorIndexer
    - Create `src/services/CompetitorIndexer.js` with `scheduleIndexing(competitor)`, `reindexAll()`, and `indexCompetitor(competitor)` methods
    - Trigger background indexing within 60 seconds of a competitor being added
    - Store results in `competitor_analyses` table
    - After each index cycle, call `OpportunityScorer.recalculate()` and `AlertEngine.checkCompetitorAlerts()`
    - Schedule re-indexing of all competitors every 24 hours via cron
    - Stop indexing when a competitor is removed
    - _Requirements: 11.3, 11.4_

  - [ ] 7.3 Implement CompetitorSuggestionEngine
    - Create `src/services/CompetitorSuggestionEngine.js` with `suggest(contractId)` returning up to 5 suggestions based on category and wallet overlap with other indexed contracts
    - _Requirements: 11.6_

  - [ ] 7.4 Implement competitive alert checks
    - Add to `AlertEngine.js`: `checkCompetitorRetentionSurge`, `checkCompetitorAcquisitionSpike`, `checkWhaleMigration`, `checkTVLOvertake`, `checkMomentumShift`
    - Retention Surge: competitor D7 retention +15pp in 7 days; Acquisition Spike: competitor new wallets +50% in 24h; Whale Migration: competitor whale makes first interaction with user's contract; TVL Overtake: competitor volume surpasses user's for the first time; Momentum Shift: competitor 7d growth rate ≥ 2× user's for 7 consecutive days
    - Only fire when the threshold condition is genuinely crossed
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ] 7.5 Implement OpportunityScorer
    - Create `src/services/OpportunityScorer.js` with `recalculate(contractId)`, `scoreFeatureGap()`, `scoreUserOverlap()`, and `scoreRetentionPlay()` methods
    - Feature Gap (0–100): based on adoption rate of functions used by competitors but absent from user's contract
    - User Overlap (0–100): wallets active on competitors but never on user's contract, weighted by LTV
    - Retention Play (0–100): competitors with high D1 but low D30 retention
    - Recalculate after each competitor indexing cycle
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ] 7.6 Expose opportunities API endpoint
    - Add `GET /api/analysis/:contractId/opportunities` returning ranked opportunity list sorted by score descending
    - Protect with Viewer+ role middleware
    - _Requirements: 14.5_

  - [ ] 7.7 Build competitive intelligence frontend
    - Enhance `frontend/components/analyzer/competitive-tab.tsx` with: side-by-side comparison table (active wallets, D7 retention, daily revenue, 30d growth rate, churn rate), leaderboard with user's position highlighted, 7d/30d/90d historical trend lines per metric, and scatter plot (acquisition rate X-axis, retention rate Y-axis)
    - Create `frontend/components/analyzer/opportunities-panel.tsx` for ranked opportunity cards
    - Display "Indexing..." for competitors whose data is unavailable
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 8. Checkpoint — Phase 4 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Phase 5 — Export and Sharing

  - [ ] 9.1 Implement CSV export endpoints
    - Add `GET /api/analysis/:contractId/export/csv?type=transactions`, `?type=wallet-segments`, and `?type=cohort-retention` routes in `src/api/routes/analysis.js`
    - Use `fast-csv` for generation; set `Content-Type: text/csv` and `Content-Disposition: attachment; filename="[type]-[contractAddress]-[date].csv"`
    - Return header-only CSV for empty datasets (HTTP 200)
    - Protect with Viewer+ role middleware
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.6_

  - [ ] 9.2 Write property test for CSV export data consistency
    - Create `tests/pbt/csv-consistency.test.js`
    - Build a `transactionArb` arbitrary and assert that CSV export values are identical to the corresponding dashboard API values for the same contract and time range
    - Tag: `// Feature: metagauge-full-implementation, Property 6: CSV Export Data Matches Dashboard Data`
    - _Requirements: 15.4_

  - [ ] 9.3 Write property test for CSV transaction round-trip
    - Create `tests/pbt/csv-roundtrip.test.js`
    - Use `transactionArb` to generate transaction objects; serialize to CSV row and parse back; assert all field values are identical to the original
    - Tag: `// Feature: metagauge-full-implementation, Property 11: CSV Transaction Round-Trip`
    - _Requirements: 26.4_

  - [ ] 9.4 Implement PDF report generation
    - Create or enhance `src/services/ReportGenerator.js` using `pdfkit`
    - PDF must contain: contract name, key metrics summary (active wallets, D7 retention, RPAW, revenue concentration), 30-day growth chart, cohort retention table, competitive position summary
    - Add `GET /api/analysis/:contractId/export/pdf` route; return HTTP 504 if generation exceeds 30 seconds
    - Protect with Viewer+ role middleware
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ] 9.5 Implement shareable read-only dashboard links
    - Add `POST /api/analysis/:contractId/share` that generates a `crypto.randomBytes(32).toString('hex')` token, stores it in `share_tokens` with `expires_at = NOW() + 7 days`, and returns the share URL
    - Add `GET /share/:token` (no auth) that validates the token: return HTTP 404 if not found, HTTP 410 if expired or revoked, dashboard data if valid
    - Add token revocation: after revocation, the token must immediately return HTTP 410
    - Protect share creation with Admin role middleware
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7_

  - [ ] 9.6 Write property test for share token uniqueness and minimum length
    - Create `tests/pbt/share-token.test.js`
    - Use `fc.integer({ min: 2, max: 100 })` to generate N tokens; assert all are pairwise distinct and each is at least 64 hex characters long
    - Tag: `// Feature: metagauge-full-implementation, Property 7: Share Token Uniqueness and Minimum Length`
    - _Requirements: 17.1_

  - [ ] 9.7 Write property test for share token expiry enforcement
    - Create `tests/pbt/share-token-expiry.test.js`
    - Use `fc.date()` to generate `expires_at` timestamps; assert HTTP 410 for expired/revoked tokens and dashboard data for valid tokens
    - Tag: `// Feature: metagauge-full-implementation, Property 8: Share Token Expiry Enforcement`
    - _Requirements: 17.3, 17.4, 17.7_

  - [ ] 9.8 Build shared dashboard frontend page
    - Create `frontend/app/share/[token]/page.tsx` that fetches `GET /share/:token` and renders the read-only dashboard
    - Display the same metrics as the owner's dashboard but omit all edit controls, alert configurations, and competitor management options
    - _Requirements: 17.6_

  - [ ] 9.9 Add export button UI component
    - Create `frontend/components/ui/export-button.tsx` that triggers CSV or PDF export for the current contract and data type
    - _Requirements: 15.1, 15.2, 15.3, 16.3_

- [ ] 10. Checkpoint — Phase 5 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Phase 6 — AI Growth Advisor

  - [ ] 11.1 Implement AIGrowthAdvisor proactive advice engine
    - Create `src/services/AIGrowthAdvisor.js` with `generateDailyAdvice(userId)`, `generateAdvice(trigger)`, and `buildPrompt(metrics, competitors, trigger)` methods
    - Trigger advice generation for: D7 retention below category average, competitor acquisition spike, feature gap detected, churn rate increasing week-over-week, RPAW declining, bot activity >20%
    - Each advice message must reference the specific metric name and its current value
    - Store each advice item in `ai_advice` table with all required fields
    - Deliver proactive advice via in-app notification within 60 seconds of generation
    - Schedule daily advice generation via cron
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [ ] 11.2 Expose AI advice API endpoints
    - Add `GET /api/advice` and `GET /api/advice/:id` routes
    - Protect with Viewer+ role middleware
    - _Requirements: 18.5_

  - [ ] 11.3 Implement AI feedback loop
    - Add `PATCH /api/advice/:id/feedback` route accepting thumbs-up or thumbs-down rating
    - Record `implemented` flag and timestamp when a user marks advice as implemented
    - In `AIGrowthAdvisor.adjustFrequency()`, reduce advice frequency for a type if it has received thumbs-down on 3 or more consecutive instances for that user
    - Support explanation requests: `AIGrowthAdvisor` responds with a natural language explanation referencing underlying metrics
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [ ] 11.4 Implement BriefingScheduler
    - Create `src/services/BriefingScheduler.js` with `initialize()`, `generateDailyBrief(userId)`, `generateWeeklyStrategy(userId)`, and `generateMonthlyBoardSummary(userId)` methods
    - Daily Brief at 08:00 UTC: key metric changes from previous day, one actionable insight, new competitor movements
    - Weekly Strategy every Monday 08:00 UTC: deep dive on one strategic area, competitive landscape changes, recommended focus
    - Monthly Board Summary on 1st of month 08:00 UTC: investor-ready metrics summary, progress against goals, risks, opportunities
    - Store briefings and expose via `GET /api/briefings`; still generate and store in-app when user has disabled email delivery
    - _Requirements: 19.1, 19.2, 19.3, 19.5, 19.6_

  - [ ] 11.5 Implement EmailService
    - Create `src/services/EmailService.js` using `nodemailer` with `sendBriefing(to, briefing)` and `sendAlert(to, alert)` methods
    - Deliver briefings to the user's registered email within 5 minutes of generation
    - _Requirements: 19.4_

  - [ ] 11.6 Implement ScenarioModeler
    - Create `src/services/ScenarioModeler.js` with `model(contractId, input)` accepting a target metric and hypothetical value
    - Project estimated impact on active wallet count, monthly revenue, and 90-day growth rate based on patterns from similar contracts in the same category
    - Return results within 15 seconds
    - Add `POST /api/scenarios` route; protect with Analyst+ role middleware
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

- [ ] 12. Checkpoint — Phase 6 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Phase 7 — Public API and JavaScript SDK

  - [ ] 13.1 Implement OpenAPI documentation and Swagger UI
    - Create `src/api/docs/openapi.yaml` with an OpenAPI 3.0 specification covering all public endpoints
    - Serve the spec at `GET /api-docs/openapi.yaml` and interactive Swagger UI at `GET /api-docs`
    - _Requirements: 22.1, 22.2_

  - [ ] 13.2 Implement API key authentication and rate limiting
    - Add API key authentication middleware that reads the `X-API-Key` request header and validates against stored keys
    - Enforce rate limits per API key based on the user's subscription tier
    - _Requirements: 22.3, 22.4_

  - [ ] 13.3 Expose public API endpoints for SDK consumption
    - Ensure the following are accessible via API key auth: analytics retrieval, wallet segment data, cohort retention data, and feature metrics
    - _Requirements: 22.5_

  - [ ] 13.4 Implement JavaScript SDK package
    - Create `sdk/package.json` with package name `@metagauge/sdk`
    - Create `sdk/index.js` exposing: `getMetrics(contractAddress, chain)`, `getWalletSegments(contractAddress, chain)`, `getCohortRetention(contractAddress, chain)`, and `getAlerts()`
    - Throw a typed error with a descriptive message when called with an invalid contract address
    - Create `sdk/README.md` with a quickstart example demonstrating authentication and a metrics retrieval call
    - _Requirements: 23.1, 23.2, 23.3, 23.4_

- [ ] 14. Checkpoint — Phase 7 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Phase 8 — Category Benchmarking and Data Accuracy

  - [ ] 15.1 Implement BenchmarkingService
    - Create `src/services/BenchmarkingService.js` with `recalculateAll()`, `calculateCategory(category)`, and `getPercentileRank(value, benchmarks)` methods
    - Group all indexed contracts by category (DeFi, NFT, DAO, Gaming, Infrastructure) and calculate avg, p25, p50, p75, p90 for each metric
    - Skip benchmark calculation for categories with fewer than 3 contracts
    - Persist results using `INSERT ... ON CONFLICT (category, metric_name) DO UPDATE`
    - Schedule recalculation every 24 hours via cron
    - _Requirements: 24.1, 24.2, 24.3, 24.6_

  - [ ] 15.2 Write property test for benchmark percentile ordering invariant
    - Create `tests/pbt/benchmarks.test.js`
    - Use `fc.array(fc.float(), { minLength: 3 })` to generate metric value arrays
    - Assert `p25 ≤ p50 ≤ p75 ≤ p90` and `avg` is within `[min, max]` of the input data
    - Tag: `// Feature: metagauge-full-implementation, Property 9: Benchmark Percentile Ordering Invariant`
    - _Requirements: 24.1_

  - [ ] 15.3 Expose benchmarks API endpoint and dashboard integration
    - Add `GET /api/benchmarks/:category` route returning benchmark statistics
    - In `frontend/components/analyzer/metrics-tab.tsx`, display the user's metric value alongside the category average and the user's percentile rank for each key metric
    - Protect with Viewer+ role middleware
    - _Requirements: 24.4, 24.5_

  - [ ] 15.4 Implement ABI parser with round-trip integrity
    - In the contract registration flow, parse ABI JSON strings into structured ABI objects
    - Return a descriptive error message identifying the parse failure location for malformed ABI JSON
    - _Requirements: 26.1, 26.5_

  - [ ] 15.5 Write property test for ABI JSON round-trip
    - Create `tests/pbt/abi-roundtrip.test.js`
    - Build an `abiArb` arbitrary generating valid ABI objects with function names, input/output types, and state mutability
    - Assert that `JSON.parse(JSON.stringify(abi))` produces a structurally equivalent object
    - Tag: `// Feature: metagauge-full-implementation, Property 10: ABI JSON Round-Trip`
    - _Requirements: 26.2_

  - [ ] 15.6 Implement data accuracy monitoring
    - Track the time elapsed since the last successful indexing cycle for each registered contract
    - Generate an internal data accuracy alert and log it when a contract has not been indexed for more than 2 hours
    - Add `GET /api/admin/indexing-health` route (Admin only) exposing indexing health status for all contracts
    - _Requirements: 25.1, 25.2, 25.3_

  - [ ] 15.7 Implement audit log
    - Record all configuration changes and user actions in an audit log stored in the database
    - Add `GET /api/admin/audit-log` route (Admin only) returning entries sorted by timestamp descending
    - _Requirements: 25.4, 25.5_

- [ ] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All property tests use `fast-check` with a minimum of 100 iterations per run
- Each property test file includes the tag comment: `// Feature: metagauge-full-implementation, Property N: {title}`
- All DB queries use parameterized statements — no string interpolation
- Competitor indexing failures are isolated and do not block other competitors
- Duplicate alert suppression: check for same alert type + contract within the last 1 hour before inserting
