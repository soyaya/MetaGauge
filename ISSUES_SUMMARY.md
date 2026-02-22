# MetaGauge - Open Issues Summary
**Generated:** 2026-02-22  
**Total Open Issues:** 44

## 🔴 Critical Priority (8 issues)

### #36 - Missing Database Schema for Wallet Address
- **Labels:** bug, critical, backend, database
- **Difficulty:** Beginner | **Time:** 30 minutes
- User schema missing walletAddress field causing undefined errors
- Need to add field and migrate existing users

### #35 - PostgreSQL Database Migration
- **Labels:** critical, infrastructure, database, migration
- **Difficulty:** Advanced | **Time:** 12-16 hours
- Migrate from file-based JSON to PostgreSQL for scalability
- Includes schema creation, data migration, connection pooling

### #32 - Analyzer Page Inefficient Data Fetching
- **Labels:** bug, critical, backend, frontend, performance
- **Difficulty:** Advanced | **Time:** 6-8 hours
- Analyzer uses different, less efficient data fetching than optimized indexer
- Create /api/analyzer/analyze endpoint using OptimizedQuickScan

### #29 - Complete Metrics Fetching and Display System
- **Labels:** bug, critical, backend, frontend, data-integrity
- **Difficulty:** Advanced | **Time:** 8-10 hours
- Dashboard shows null/undefined even after successful analysis
- Structure mismatch and silent failures

### #15 - No Database Backup Strategy
- **Labels:** critical, infrastructure, database
- **Difficulty:** Intermediate | **Time:** 2-3 hours
- No automated backups for data/*.json files
- Create BackupService with retention policy

### #13 - No Input Validation on API Endpoints
- **Labels:** critical, backend, security
- **Difficulty:** Intermediate | **Time:** 3-4 hours
- Vulnerable to injection attacks
- Install joi and create validation middleware

### #12 - JWT Secret Hardcoded or Weak
- **Labels:** critical, backend, security
- **Difficulty:** Beginner | **Time:** 30 minutes
- Add startup validation requiring 32+ character secret

### #7 - Streaming Indexer Blocks Server Startup
- **Labels:** bug, critical, backend, performance
- **Difficulty:** Advanced | **Time:** 4-6 hours
- Currently disabled - blocks event loop
- Move to background process or worker threads

### #5 - Continuous Sync Hardcoded Cycle Limit
- **Labels:** bug, critical, backend
- **Difficulty:** Intermediate | **Time:** 2 hours
- Stops after 50 cycles regardless of tier
- Replace with subscription-based API limit checking

### #1 - Monitoring Routes Not Registered
- **Labels:** bug, critical, backend, good-first-issue
- **Difficulty:** Beginner | **Time:** 30 minutes
- Routes exist but not registered in Express server

## 🟠 High Priority (1 issue)

### #2 - Missing Graceful Shutdown for Monitoring Service
- **Labels:** bug, high-priority, backend
- **Difficulty:** Intermediate | **Time:** 1 hour
- Monitoring loops create zombie processes on shutdown

## 🟡 Features & Enhancements (15 issues)

### #34 - AI Metrics Clarity System
- **Labels:** documentation, enhancement, feature, ai
- **Difficulty:** Intermediate | **Time:** 4-6 hours
- Create comprehensive metrics glossary for AI chat

### #33 - AI Chat External Data Integration with Report Generation
- **Labels:** enhancement, backend, frontend, feature, ai
- **Difficulty:** Advanced | **Time:** 10-14 hours
- Integrate block explorers, price data, generate PDF/CSV reports

### #31 - Stellar-Based Subscription Payment System
- **Labels:** enhancement, backend, frontend, feature, blockchain, payment
- **Difficulty:** Advanced | **Time:** 10-14 hours
- Add Stellar as payment method (XLM/USDC)

### #30 - Add Stellar Blockchain Support
- **Labels:** enhancement, backend, feature, multi-chain
- **Difficulty:** Advanced | **Time:** 8-12 hours
- Create StellarRpcClient and integrate Soroban contracts

### #28 - Subscription-Based Alert Management System
- **Labels:** backend, frontend, feature, subscription
- **Difficulty:** Advanced | **Time:** 6-8 hours
- Complete alert system with tier limits and notifications

### #27 - Complete Profile CRUD Operations
- **Labels:** backend, frontend, feature, good-first-issue
- **Difficulty:** Intermediate | **Time:** 3-4 hours
- Add change password, resend verification, wallet endpoints

### #26 - Add Multi-Language Support (i18n)
- **Labels:** enhancement, frontend, feature, internationalization
- **Difficulty:** Advanced | **Time:** 8-10 hours
- Install next-intl, create translations for EN, ES, FR, ZH, JA

### #25 - Add Export Functionality for Analysis Data
- **Labels:** enhancement, backend, frontend, feature, good-first-issue
- **Difficulty:** Intermediate | **Time:** 2-3 hours
- Export to CSV, JSON, PDF

### #24 - Add WebSocket Real-Time Updates
- **Labels:** enhancement, backend, frontend, feature
- **Difficulty:** Advanced | **Time:** 6-8 hours
- Real-time updates for analysis, monitoring, alerts

### #18 - No Caching Strategy
- **Labels:** enhancement, backend, performance
- **Difficulty:** Intermediate | **Time:** 3-4 hours
- Implement CacheManager with TTL for blocks, transactions, ABIs

### #11 - Account Action Buttons Not Implemented
- **Labels:** backend, frontend, feature, good-first-issue
- **Difficulty:** Intermediate | **Time:** 3-4 hours
- Resend verification, change password, delete account

### #9 - Dashboard Monitoring Status UI Missing
- **Labels:** frontend, feature, good-first-issue, ui
- **Difficulty:** Intermediate | **Time:** 2-3 hours
- Add monitoring status and API usage cards

### #8 - No Subscription Sync Mechanism
- **Labels:** backend, feature, blockchain
- **Difficulty:** Advanced | **Time:** 4-6 hours
- Create SubscriptionSyncService with cron job

### #3 - Wallet Address Sync Not Implemented
- **Labels:** critical, backend, frontend, feature
- **Difficulty:** Intermediate | **Time:** 2-3 hours
- Create endpoints to sync wallet address from frontend

### #37 - No Error Tracking or Monitoring
- **Labels:** feature, infrastructure, monitoring
- **Difficulty:** Intermediate | **Time:** 3-4 hours
- Integrate Sentry or custom error tracking

## 🐛 Bugs (8 issues)

### #44 - Subscription Page May Not Exist
- **Labels:** bug, frontend, good-first-issue, routing
- **Difficulty:** Beginner | **Time:** 1-2 hours
- Profile links to /subscription but page incomplete

### #43 - Dashboard and Widget Use Different Data Sources
- **Labels:** bug, frontend, data-integrity
- **Difficulty:** Intermediate | **Time:** 2 hours
- Dashboard reads from backend (stale), widget from contract

### #10 - Profile Page Uses Stale Subscription Data
- **Labels:** bug, frontend, data-integrity
- **Difficulty:** Intermediate | **Time:** 1-2 hours
- Use useReadContract from wagmi instead of backend

### #6 - Profile API Response Structure Mismatch
- **Labels:** bug, backend, frontend, good-first-issue
- **Difficulty:** Beginner | **Time:** 15 minutes
- Backend returns { user: userProfile }, frontend expects user directly

### #4 - API Limits Hardcoded and Inconsistent
- **Labels:** bug, backend, data-integrity
- **Difficulty:** Beginner | **Time:** 1 hour
- Import SUBSCRIPTION_TIERS and use consistently

### #38 - CORS Configuration Too Permissive
- **Labels:** backend, security, configuration
- **Difficulty:** Beginner | **Time:** 30 minutes
- Implement environment-based CORS with specific origins

### #14 - No Rate Limiting on Critical Endpoints
- **Labels:** backend, security, infrastructure
- **Difficulty:** Intermediate | **Time:** 2 hours
- Implement subscription-based tiered rate limiting

## 🔧 Code Quality & Refactoring (4 issues)

### #22 - Inconsistent Error Handling
- **Labels:** backend, refactoring, code-quality
- **Difficulty:** Intermediate | **Time:** 3-4 hours
- Create custom error classes and standardize middleware

### #21 - Duplicate RPC Client Implementations
- **Labels:** backend, refactoring, code-quality
- **Difficulty:** Intermediate | **Time:** 2-3 hours
- 5 versions of LiskRpcClient exist - merge best features

### #23 - No Code Linting Configuration
- **Labels:** good-first-issue, code-quality, tooling
- **Difficulty:** Beginner | **Time:** 1 hour
- Install ESLint and Prettier

## 🚀 Performance & Optimization (3 issues)

### #20 - Frontend Bundle Size Too Large
- **Labels:** frontend, performance, optimization
- **Difficulty:** Intermediate | **Time:** 2-3 hours
- Setup bundle analyzer, code splitting, remove unused deps

### #19 - Inefficient Block Range Queries
- **Labels:** backend, performance, optimization
- **Difficulty:** Advanced | **Time:** 4-6 hours
- Implement parallel fetching with binary search

## 📚 Documentation (5 issues)

### #40 - No Architecture Documentation
- **Labels:** documentation, architecture
- **Difficulty:** Intermediate | **Time:** 3-4 hours
- Create ARCHITECTURE.md with diagrams and design decisions

### #39 - No Developer Setup Guide
- **Labels:** documentation, good-first-issue
- **Difficulty:** Beginner | **Time:** 2 hours
- Create CONTRIBUTING.md and DEVELOPMENT.md

### #17 - API Documentation Incomplete
- **Labels:** documentation, good-first-issue
- **Difficulty:** Beginner | **Time:** 3-4 hours
- Create complete OpenAPI 3.0 spec with Swagger UI

## 🧪 Testing (3 issues)

### #42 - No E2E Tests for Frontend
- **Labels:** frontend, testing, quality
- **Difficulty:** Intermediate | **Time:** 4-6 hours
- Implement Playwright or Cypress for critical flows

### #41 - No Property-Based Tests
- **Labels:** testing, quality, advanced
- **Difficulty:** Advanced | **Time:** 6-8 hours
- Implement fast-check property tests

### #16 - No Integration Tests for Critical Flows
- **Labels:** good-first-issue, testing, quality
- **Difficulty:** Intermediate | **Time:** 4-6 hours
- Test signup, onboarding, analysis flows

---

## 📊 Issue Statistics

**By Difficulty:**
- Beginner: 9 issues
- Intermediate: 19 issues
- Advanced: 16 issues

**By Category:**
- Backend: 25 issues
- Frontend: 18 issues
- Security: 5 issues
- Testing: 3 issues
- Documentation: 5 issues
- Performance: 5 issues
- Infrastructure: 5 issues

**Good First Issues:** 11 issues

**Estimated Total Time:** 180-240 hours

---

## 🎯 Recommended Priority Order

### Phase 1: Critical Fixes (Week 1)
1. #1 - Monitoring Routes Not Registered (30 min)
2. #12 - JWT Secret Validation (30 min)
3. #6 - Profile API Response Fix (15 min)
4. #4 - API Limits Consistency (1 hour)
5. #36 - Wallet Address Schema (30 min)
6. #13 - Input Validation (3-4 hours)

### Phase 2: Core Functionality (Week 2-3)
7. #7 - Streaming Indexer Fix (4-6 hours)
8. #29 - Metrics Display System (8-10 hours)
9. #32 - Analyzer Optimization (6-8 hours)
10. #5 - Continuous Sync Fix (2 hours)
11. #3 - Wallet Address Sync (2-3 hours)

### Phase 3: Infrastructure (Week 4)
12. #35 - PostgreSQL Migration (12-16 hours)
13. #15 - Database Backups (2-3 hours)
14. #14 - Rate Limiting (2 hours)
15. #37 - Error Tracking (3-4 hours)

### Phase 4: Features & Polish (Week 5-8)
16. Documentation issues (#39, #40, #17)
17. Testing issues (#16, #42, #41)
18. Feature enhancements (#24, #25, #27, #28)
19. Code quality (#21, #22, #23)
20. Advanced features (#30, #31, #33, #34)
