# Remaining Issues - Implementation Notes

## Issues Requiring Major Refactoring (Not Implemented)

### #7 - Streaming Indexer Blocks Server Startup
**Status**: Documented, requires worker threads implementation
**Estimated**: 4-6 hours
**Note**: Current indexer disabled to prevent blocking. Needs background worker.

### #29 - Complete Metrics Fetching and Display System
**Status**: Partial - metrics calculated, display needs frontend work
**Estimated**: 8-10 hours
**Note**: Backend metrics exist, frontend components need enhancement.

### #32 - Analyzer Page Inefficient Data Fetching
**Status**: Documented, needs OptimizedQuickScan integration
**Estimated**: 6-8 hours
**Note**: Create dedicated /api/analyzer/analyze endpoint.

### #35 - PostgreSQL Database Migration
**Status**: Schema ready, migration scripts needed
**Estimated**: 12-16 hours
**Note**: Major infrastructure change, requires careful planning.

## Feature Additions (Placeholders Created)

### #26 - Multi-Language Support (i18n)
**Status**: Placeholder
**Estimated**: 8-10 hours
**Note**: Requires next-intl setup and translation files.

### #28 - Subscription-Based Alert Management
**Status**: Basic alerts exist, needs tier limits
**Estimated**: 6-8 hours
**Note**: Alert routes exist, need subscription integration.

### #30 - Add Stellar Blockchain Support
**Status**: Placeholder
**Estimated**: 8-12 hours
**Note**: Requires StellarRpcClient and Soroban integration.

### #31 - Stellar-Based Subscription Payments
**Status**: Placeholder (depends on #30)
**Estimated**: 10-14 hours
**Note**: Requires Stellar smart contract deployment.

### #33 - AI Chat External Data Integration
**Status**: Placeholder
**Estimated**: 10-14 hours
**Note**: Integrate block explorers and price APIs.

### #34 - AI Metrics Clarity System
**Status**: Placeholder
**Estimated**: 4-6 hours
**Note**: Create metrics glossary for AI context.

### #41 - Property-Based Tests
**Status**: fast-check installed, tests needed
**Estimated**: 6-8 hours
**Note**: Implement property tests for critical functions.

### #42 - E2E Tests for Frontend
**Status**: Placeholder
**Estimated**: 4-6 hours
**Note**: Setup Playwright or Cypress.

### #43 - Dashboard and Widget Use Different Data Sources
**Status**: Documented
**Estimated**: 2 hours
**Note**: Frontend needs to use useReadContract consistently.

### #44 - Subscription Page May Not Exist
**Status**: Page exists, needs completion
**Estimated**: 1-2 hours
**Note**: Frontend subscription page needs enhancement.

## Summary

**Fully Implemented**: 30 issues
**Documented/Placeholder**: 14 issues
**Total**: 44 issues

**Completion**: 68% (30/44 fully implemented)
