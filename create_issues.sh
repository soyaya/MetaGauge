#!/bin/bash
# MetaGauge GitHub Issues Creation Script
# Usage: bash create_issues.sh soyaya/MetaGauge

REPO="${1:-soyaya/MetaGauge}"

echo "Creating issues for repo: $REPO"

# Issue #1
gh issue create --repo "$REPO" \
  --title "Monitoring Routes Not Registered" \
  --label "bug,critical,backend,good-first-issue" \
  --body "## Description
The monitoring API routes exist but are NOT registered in the Express server.

## Solution
Add to server.js:
\`\`\`javascript
import monitoringRoutes from './routes/monitoring.js';
app.use('/api/monitoring', authenticateToken, monitoringRoutes);
\`\`\`

**Difficulty**: Beginner | **Time**: 30 min"

echo "✅ Issue #1 created"

# Issue #2
gh issue create --repo "$REPO" \
  --title "Missing Graceful Shutdown for Monitoring Service" \
  --label "bug,high-priority,backend" \
  --body "## Description
Monitoring loops continue running after server shutdown, creating zombie processes.

## Solution
Add to SIGTERM/SIGINT handlers in server.js:
\`\`\`javascript
await ContinuousMonitoringService.stopAllMonitors();
\`\`\`

**Difficulty**: Intermediate | **Time**: 1 hour"

echo "✅ Issue #2 created"

# Issue #3
gh issue create --repo "$REPO" \
  --title "Wallet Address Sync Not Implemented" \
  --label "feature,critical,backend,frontend" \
  --body "## Description
Backend doesn't have user's wallet address, so it can't query smart contract for subscription data.

## Solution
Create POST/GET /api/users/wallet-address endpoints and sync from frontend.

**Difficulty**: Intermediate | **Time**: 2-3 hours"

echo "✅ Issue #3 created"

# Issue #4
gh issue create --repo "$REPO" \
  --title "API Limits Hardcoded and Inconsistent" \
  --label "bug,backend,data-integrity" \
  --body "## Description
API limits are hardcoded with different values that don't match smart contract.

## Solution
Import SUBSCRIPTION_TIERS from SubscriptionBlockRangeCalculator.js and use consistently.

**Difficulty**: Beginner | **Time**: 1 hour"

echo "✅ Issue #4 created"

# Issue #5
gh issue create --repo "$REPO" \
  --title "Continuous Sync Hardcoded Cycle Limit" \
  --label "bug,critical,backend" \
  --body "## Description
Continuous sync stops after 50 cycles regardless of subscription tier.

## Solution
Replace cycle limit with subscription-based API limit checking.

**Difficulty**: Intermediate | **Time**: 2 hours"

echo "✅ Issue #5 created"

# Issue #6
gh issue create --repo "$REPO" \
  --title "Profile API Response Structure Mismatch" \
  --label "bug,backend,frontend,good-first-issue" \
  --body "## Description
Backend returns { user: userProfile } but frontend expects user object directly.

**Difficulty**: Beginner | **Time**: 15 min"

echo "✅ Issue #6 created"

# Issue #7
gh issue create --repo "$REPO" \
  --title "Streaming Indexer Blocks Server Startup" \
  --label "bug,critical,backend,performance" \
  --body "## Description
Indexer initialization blocks event loop during startup. Currently disabled.

## Solution
Move to background process or use worker threads.

**Difficulty**: Advanced | **Time**: 4-6 hours"

echo "✅ Issue #7 created"

# Issue #8
gh issue create --repo "$REPO" \
  --title "No Subscription Sync Mechanism" \
  --label "feature,backend,blockchain" \
  --body "## Description
No mechanism to sync subscription data from smart contract to backend.

## Solution
Create SubscriptionSyncService with daily cron job.

**Difficulty**: Advanced | **Time**: 4-6 hours"

echo "✅ Issue #8 created"

# Issue #9
gh issue create --repo "$REPO" \
  --title "Dashboard Monitoring Status UI Missing" \
  --label "feature,frontend,ui,good-first-issue" \
  --body "## Description
Dashboard doesn't display monitoring status or API usage.

## Solution
Add monitoring status card and API usage card with progress bar.

**Difficulty**: Intermediate | **Time**: 2-3 hours"

echo "✅ Issue #9 created"

# Issue #10
gh issue create --repo "$REPO" \
  --title "Profile Page Uses Stale Subscription Data" \
  --label "bug,frontend,data-integrity" \
  --body "## Description
Profile page shows stale DB data instead of querying smart contract.

## Solution
Use useReadContract from wagmi to query contract directly.

**Difficulty**: Intermediate | **Time**: 1-2 hours"

echo "✅ Issue #10 created"

# Issue #11
gh issue create --repo "$REPO" \
  --title "Account Action Buttons Not Implemented" \
  --label "feature,frontend,backend,good-first-issue" \
  --body "## Description
Resend Verification, Change Password, Delete Account buttons don't work.

**Difficulty**: Intermediate | **Time**: 3-4 hours"

echo "✅ Issue #11 created"

# Issue #12
gh issue create --repo "$REPO" \
  --title "JWT Secret Hardcoded or Weak" \
  --label "security,critical,backend" \
  --body "## Description
JWT secret may be weak or hardcoded.

## Solution
Add startup validation requiring 32+ character secret.

**Difficulty**: Beginner | **Time**: 30 min"

echo "✅ Issue #12 created"

# Issue #13
gh issue create --repo "$REPO" \
  --title "No Input Validation on API Endpoints" \
  --label "security,backend,critical" \
  --body "## Description
API endpoints don't validate input, vulnerable to injection attacks.

## Solution
Install joi and create validation middleware for all endpoints.

**Difficulty**: Intermediate | **Time**: 3-4 hours"

echo "✅ Issue #13 created"

# Issue #14
gh issue create --repo "$REPO" \
  --title "No Rate Limiting on Critical Endpoints" \
  --label "security,backend,infrastructure" \
  --body "## Description
Rate limiting disabled, API vulnerable to abuse.

## Solution
Implement subscription-based tiered rate limiting.

**Difficulty**: Intermediate | **Time**: 2 hours"

echo "✅ Issue #14 created"

# Issue #15
gh issue create --repo "$REPO" \
  --title "No Database Backup Strategy" \
  --label "infrastructure,database,critical" \
  --body "## Description
No automated backups for data/*.json files.

## Solution
Create BackupService with hourly/daily/weekly retention.

**Difficulty**: Intermediate | **Time**: 2-3 hours"

echo "✅ Issue #15 created"

# Issue #16
gh issue create --repo "$REPO" \
  --title "No Integration Tests for Critical Flows" \
  --label "testing,quality,good-first-issue" \
  --body "## Description
Missing integration tests for signup, onboarding, analysis flows.

**Difficulty**: Intermediate | **Time**: 4-6 hours"

echo "✅ Issue #16 created"

# Issue #17
gh issue create --repo "$REPO" \
  --title "API Documentation Incomplete" \
  --label "documentation,good-first-issue" \
  --body "## Description
OpenAPI docs incomplete or missing.

## Solution
Create complete OpenAPI 3.0 spec with Swagger UI.

**Difficulty**: Beginner | **Time**: 3-4 hours"

echo "✅ Issue #17 created"

# Issue #18
gh issue create --repo "$REPO" \
  --title "No Caching Strategy" \
  --label "performance,backend,enhancement" \
  --body "## Description
Repeated RPC calls without caching cause slow responses.

## Solution
Implement CacheManager with TTL for blocks, transactions, ABIs.

**Difficulty**: Intermediate | **Time**: 3-4 hours"

echo "✅ Issue #18 created"

# Issue #19
gh issue create --repo "$REPO" \
  --title "Inefficient Block Range Queries" \
  --label "performance,backend,optimization" \
  --body "## Description
Sequential block fetching is slow for large ranges.

## Solution
Implement parallel fetching in batches with binary search.

**Difficulty**: Advanced | **Time**: 4-6 hours"

echo "✅ Issue #19 created"

# Issue #20
gh issue create --repo "$REPO" \
  --title "Frontend Bundle Size Too Large" \
  --label "performance,frontend,optimization" \
  --body "## Description
Bundle size not optimized, causing slow page loads.

## Solution
Setup bundle analyzer, implement code splitting, remove unused deps.

**Difficulty**: Intermediate | **Time**: 2-3 hours"

echo "✅ Issue #20 created"

# Issue #21
gh issue create --repo "$REPO" \
  --title "Duplicate RPC Client Implementations" \
  --label "refactoring,code-quality,backend" \
  --body "## Description
5 versions of LiskRpcClient exist - unclear which is active.

## Affected Files
- LiskRpcClient.js, LiskRpcClient_backup.js, LiskRpcClient_Enhanced.js, LiskRpcClient_Optimized.js, LiskRpcClient_Original.js

## Solution
Merge best features into single implementation, remove duplicates.

**Stack**: Node.js, ethers.js  
**Difficulty**: Intermediate | **Time**: 2-3 hours"

echo "✅ Issue #21 created"

# Issue #22
gh issue create --repo "$REPO" \
  --title "Inconsistent Error Handling" \
  --label "code-quality,backend,refactoring" \
  --body "## Description
Error handling inconsistent across routes - different formats, missing try-catch.

## Solution
Create custom error classes (AppError, ValidationError, AuthenticationError, NotFoundError) and standardize middleware.

**Stack**: Express.js, Node.js  
**Difficulty**: Intermediate | **Time**: 3-4 hours"

echo "✅ Issue #22 created"

# Issue #23
gh issue create --repo "$REPO" \
  --title "No Code Linting Configuration" \
  --label "code-quality,tooling,good-first-issue" \
  --body "## Description
No ESLint or Prettier config, leading to inconsistent code style.

## Solution
Install eslint, prettier, eslint-config-prettier. Create configs and add lint scripts.

**Stack**: ESLint, Prettier  
**Difficulty**: Beginner | **Time**: 1 hour"

echo "✅ Issue #23 created"

# Issue #24
gh issue create --repo "$REPO" \
  --title "Add WebSocket Real-Time Updates" \
  --label "feature,enhancement,backend,frontend" \
  --body "## Description
WebSocket server underutilized - add real-time updates for analysis, monitoring, alerts.

## Events to Implement
- analysis:progress, analysis:complete
- monitoring:new-transaction, monitoring:status-change
- alert:triggered, subscription:updated

**Stack**: WebSocket (ws), React hooks  
**Difficulty**: Advanced | **Time**: 6-8 hours"

echo "✅ Issue #24 created"

# Issue #25
gh issue create --repo "$REPO" \
  --title "Add Export Functionality for Analysis Data" \
  --label "feature,enhancement,backend,frontend,good-first-issue" \
  --body "## Description
Users cannot export analysis data to CSV, JSON, or PDF.

## Solution
Backend: GET /api/analysis/:id/export?format=csv|json|pdf
Frontend: Export dropdown with format selection

**Stack**: csv-writer, pdfkit, React  
**Difficulty**: Intermediate | **Time**: 2-3 hours"

echo "✅ Issue #25 created"

# Issue #26
gh issue create --repo "$REPO" \
  --title "Add Multi-Language Support (i18n)" \
  --label "feature,enhancement,frontend,internationalization" \
  --body "## Description
Application is English-only. Add internationalization for global users.

## Solution
Install next-intl, create translation files for EN, ES, FR, ZH, JA. Add language switcher.

**Stack**: next-intl, Next.js, React  
**Difficulty**: Advanced | **Time**: 8-10 hours"

echo "✅ Issue #26 created"

# Issue #27
gh issue create --repo "$REPO" \
  --title "Complete Profile CRUD Operations" \
  --label "feature,backend,frontend,good-first-issue" \
  --body "## Description
Profile management incomplete - missing change password, resend verification, wallet endpoints.

## Endpoints Needed
- POST /api/users/change-password
- POST /api/auth/resend-verification
- POST/GET /api/users/wallet-address
- DELETE /api/users/account

**Stack**: Express.js, React, JWT  
**Difficulty**: Intermediate | **Time**: 3-4 hours"

echo "✅ Issue #27 created"

# Issue #28
gh issue create --repo "$REPO" \
  --title "Subscription-Based Alert Management System" \
  --label "feature,backend,frontend,subscription" \
  --body "## Description
Alert system lacks subscription limits, complete UI, and notification delivery.

## Tier Limits
Free: 3 alerts | Starter: 10 | Pro: 50 | Enterprise: Unlimited

## Notification Channels
In-App (all), Email (all), Webhook (Starter+), SMS (Enterprise)

**Stack**: Express.js, React, Node-cron, Nodemailer  
**Difficulty**: Advanced | **Time**: 6-8 hours"

echo "✅ Issue #28 created"

# Issue #29
gh issue create --repo "$REPO" \
  --title "Complete Metrics Fetching and Display System" \
  --label "bug,critical,backend,frontend,data-integrity" \
  --body "## Description
Metrics not fetched/displayed correctly. Dashboard shows null/undefined even after successful analysis.

## Root Causes
- Analysis results structure mismatch
- Silent metric calculation failures
- Missing metrics integration
- Incomplete error handling

**Stack**: Express.js, React, ethers.js, Recharts  
**Difficulty**: Advanced | **Time**: 8-10 hours"

echo "✅ Issue #29 created"

# Issue #30
gh issue create --repo "$REPO" \
  --title "Add Stellar Blockchain Support" \
  --label "feature,enhancement,backend,multi-chain" \
  --body "## Description
Add Stellar blockchain support (Soroban smart contracts via Horizon API + RPC).

## Implementation
- Create StellarRpcClient.js
- Update MultiChainContractIndexer
- Update chain config and frontend selector
- Handle XDR encoding

**Stack**: Stellar SDK, Soroban RPC, Horizon API  
**Difficulty**: Advanced | **Time**: 8-12 hours"

echo "✅ Issue #30 created"

# Issue #31
gh issue create --repo "$REPO" \
  --title "Stellar-Based Subscription Payment System" \
  --label "feature,enhancement,backend,frontend,blockchain,payment" \
  --body "## Description
Implement Stellar as alternative payment method using XLM or USDC.

## Pricing (Stellar)
Starter: 10 XLM or 29 USDC/month | Pro: 33 XLM or 99 USDC/month | Enterprise: 100 XLM or 299 USDC/month

## Implementation
- Soroban subscription smart contract
- StellarPaymentService
- Multi-chain SubscriptionService
- Frontend Stellar payment component (Freighter/Albedo wallet)

**Stack**: Stellar SDK, Soroban, Solidity, React, wagmi  
**Difficulty**: Advanced | **Time**: 10-14 hours  
**Requires**: Issue #30"

echo "✅ Issue #31 created"

# Issue #32
gh issue create --repo "$REPO" \
  --title "Analyzer Page Inefficient Data Fetching" \
  --label "bug,performance,frontend,backend,critical" \
  --body "## Description
Analyzer page uses different, less efficient data fetching than optimized RPC indexer.

## Problems
- Duplicate data fetching logic
- No subscription-aware limits
- Inefficient sequential RPC calls
- Inconsistent metrics vs onboarding

## Solution
Create /api/analyzer/analyze endpoint using OptimizedQuickScan. Update frontend to use new endpoint.

**Stack**: Express.js, React, ethers.js  
**Difficulty**: Advanced | **Time**: 6-8 hours"

echo "✅ Issue #32 created"

# Issue #33
gh issue create --repo "$REPO" \
  --title "AI Chat External Data Integration with Report Generation" \
  --label "feature,enhancement,backend,frontend,ai" \
  --body "## Description
Integrate external data sources into AI chat and add comprehensive report generation.

## Data Sources
- Block Explorers: Etherscan, Lisk Explorer, Starkscan, Stellar Expert
- Price Data: CoinMarketCap, CoinGecko, DexScreener

## Report Formats
CSV, PDF, JSON with 10 sections: Executive Summary, Financial Metrics, Transaction Analysis, User Metrics, SWOT, Competitive Analysis, Investor Metrics, Scaling Recommendations, Technical Analysis, Market Context

**Stack**: Google Gemini API, Node-fetch, pdfkit, csv-writer  
**Difficulty**: Advanced | **Time**: 10-14 hours"

echo "✅ Issue #33 created"

# Issue #34
gh issue create --repo "$REPO" \
  --title "AI Metrics Clarity System" \
  --label "feature,enhancement,ai,documentation" \
  --body "## Description
Create comprehensive metrics glossary so AI chat provides accurate, consistent explanations.

## Metrics to Define (50+)
Financial: TVL, Volume, Fees, APY/APR, Liquidity, Revenue
Transaction: Count, Success/Failure Rate, Gas Efficiency
User: Unique, Active, Retention, Churn
Performance: Response Time, Throughput, Error Rate

## Implementation
- src/config/metrics-glossary.js
- src/services/MetricsContextService.js
- docs/METRICS_GLOSSARY.md
- Add to AI system prompts

**Stack**: Google Gemini API, Node.js  
**Difficulty**: Intermediate | **Time**: 4-6 hours"

echo "✅ Issue #34 created"

# Issue #35
gh issue create --repo "$REPO" \
  --title "PostgreSQL Database Migration" \
  --label "infrastructure,database,migration,critical" \
  --body "## Description
Migrate from file-based JSON storage to PostgreSQL for performance and scalability.

## Schema
- users: id, email, password, wallet_address, tier, subscription, timestamps
- contracts: id, user_id, address, chain, name, abi, created_at
- analyses: id, user_id, contract_id, status, results, timestamps
- chat_sessions: id, user_id, contract_id, messages, timestamps

## Tasks
1. Install and configure PostgreSQL
2. Create schema with migration scripts
3. Export and transform JSON data
4. Update all Storage services
5. Add connection pooling and transactions
6. Verify data integrity and benchmark

**Stack**: PostgreSQL, pg (node-postgres), Node.js  
**Difficulty**: Advanced | **Time**: 12-16 hours"

echo "✅ Issue #35 created"

# Issue #36
gh issue create --repo "$REPO" \
  --title "Missing Database Schema for Wallet Address" \
  --label "bug,critical,database,backend" \
  --body "## Description
User schema missing walletAddress field, causing req.user.walletAddress to be undefined.

## Solution
Add walletAddress field to user schema in UserStorage.js and migrate existing users.

**Stack**: Node.js, JSON file storage  
**Difficulty**: Beginner | **Time**: 30 minutes"

echo "✅ Issue #36 created"

# Issue #37
gh issue create --repo "$REPO" \
  --title "No Error Tracking or Monitoring" \
  --label "feature,infrastructure,monitoring" \
  --body "## Description
No centralized error tracking. Errors only logged to console.

## Options
1. Integrate Sentry (@sentry/node)
2. Custom ErrorTracker with database

## Features
- Error categorization (critical/warning/info)
- Stack trace with user context
- Alerting on critical errors
- Error dashboard

**Stack**: Sentry or custom (Express.js, Node.js)  
**Difficulty**: Intermediate | **Time**: 3-4 hours"

echo "✅ Issue #37 created"

# Issue #38
gh issue create --repo "$REPO" \
  --title "CORS Configuration Too Permissive" \
  --label "security,backend,configuration" \
  --body "## Description
CORS uses regex to allow any local network IP - too permissive for production.

## Solution
Implement environment-based CORS with specific allowed origins from .env.

**Stack**: Express.js, cors middleware  
**Difficulty**: Beginner | **Time**: 30 minutes"

echo "✅ Issue #38 created"

# Issue #39
gh issue create --repo "$REPO" \
  --title "No Developer Setup Guide" \
  --label "documentation,good-first-issue" \
  --body "## Description
No comprehensive developer setup guide for new contributors.

## Files to Create
- CONTRIBUTING.md (fork, branch, PR workflow)
- DEVELOPMENT.md (local setup, env vars, troubleshooting)
- Update README.md with quick start

**Stack**: Documentation  
**Difficulty**: Beginner | **Time**: 2 hours"

echo "✅ Issue #39 created"

# Issue #40
gh issue create --repo "$REPO" \
  --title "No Architecture Documentation" \
  --label "documentation,architecture" \
  --body "## Description
No documentation explaining system architecture, data flow, or design decisions.

## File to Create
ARCHITECTURE.md with sections:
1. System Architecture (diagrams, components)
2. Backend Architecture (API, services, database, auth)
3. Frontend Architecture (Next.js, state, wallet integration)
4. Data Flows (onboarding, analysis, subscription, monitoring)
5. Design Decisions (why file storage, why Next.js, etc.)

**Stack**: Documentation, Mermaid diagrams  
**Difficulty**: Intermediate | **Time**: 3-4 hours"

echo "✅ Issue #40 created"

# Issue #41
gh issue create --repo "$REPO" \
  --title "No Property-Based Tests" \
  --label "testing,quality,advanced" \
  --body "## Description
fast-check installed but no property tests implemented.

## Properties to Test
- Subscription calculations are deterministic
- API limits enforced correctly
- Block ranges contiguous (no overlaps/gaps)
- Wallet addresses validated
- Data transformations reversible

**Stack**: Jest, fast-check  
**Difficulty**: Advanced | **Time**: 6-8 hours"

echo "✅ Issue #41 created"

# Issue #42
gh issue create --repo "$REPO" \
  --title "No E2E Tests for Frontend" \
  --label "testing,frontend,quality" \
  --body "## Description
No end-to-end tests for frontend. Critical user flows not tested from browser perspective.

## Framework
Playwright or Cypress

## Flows to Test
1. Signup and login
2. Contract onboarding
3. Dashboard interaction
4. Wallet connection

**Stack**: Playwright/Cypress, Next.js  
**Difficulty**: Intermediate | **Time**: 4-6 hours"

echo "✅ Issue #42 created"

# Issue #43
gh issue create --repo "$REPO" \
  --title "Dashboard and Widget Use Different Data Sources" \
  --label "bug,frontend,data-integrity" \
  --body "## Description
Subscription widget reads from smart contract (correct), dashboard reads from backend (stale). They show different tiers.

## Solution
Make dashboard use useReadContract from wagmi (same as widget).

**Stack**: wagmi, React, ethers.js  
**Difficulty**: Intermediate | **Time**: 2 hours"

echo "✅ Issue #43 created"

# Issue #44
gh issue create --repo "$REPO" \
  --title "Subscription Page May Not Exist" \
  --label "bug,frontend,routing,good-first-issue" \
  --body "## Description
Profile page links to /subscription but page may not exist or be incomplete.

## Requirements
- Display all subscription tiers with features/pricing
- Connect wallet button
- Purchase subscription button (smart contract interaction)
- Current subscription status

**Stack**: Next.js, React, wagmi, Tailwind CSS  
**Difficulty**: Beginner | **Time**: 1-2 hours"

echo "✅ Issue #44 created"

echo ""
echo "=========================================="
echo "🎉 All 44 issues created successfully! 🎉"
echo "=========================================="
echo ""
echo "View your issues at:"
echo "https://github.com/$REPO/issues"
