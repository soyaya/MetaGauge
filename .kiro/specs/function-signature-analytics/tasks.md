# Implementation Plan: Function Signature Analytics

## Overview

This implementation plan breaks down the Function Signature Analytics feature into discrete coding tasks. The feature adds comprehensive analytics and visualization for smart contract function signature interactions, including wallet tracking, user journey analysis, and cohort-based metrics (activation, churn, retention).

The implementation follows a bottom-up approach: data models → services → API routes → frontend components → integration. Each task builds incrementally to ensure testable progress at every step.

## Tasks

- [-] 1. Set up data models and storage infrastructure
  - [x] 1.1 Create TypeScript interfaces for core data models
    - Define FunctionSignature, WalletInteraction, UserJourney, CohortMetrics, and AnalyticsCache interfaces
    - Create type definitions file at `src/types/function-analytics.ts`
    - _Requirements: 2.1, 3.1, 4.1, 5.1_

  - [x] 1.2 Implement file-based storage layer for function analytics
    - Create storage service at `src/services/storage/FunctionAnalyticsStorage.ts`
    - Implement methods for reading/writing signatures, interactions, journeys, and cohorts
    - Set up directory structure: `data/function-analytics/{contractAddress}_{chain}/`
    - _Requirements: 2.1, 3.1, 4.3_

  - [ ] 1.3 Write unit tests for storage layer
    - Test file creation, reading, writing, and error handling
    - Test directory structure creation
    - _Requirements: 2.1, 3.1, 4.3_

- [ ] 2. Implement FunctionAnalyticsService
  - [ ] 2.1 Create FunctionAnalyticsService class with signature tracking
    - Implement `getFunctionSignatures()` method to aggregate wallet and transaction counts
    - Implement `getSignatureMetrics()` for detailed single-signature metrics
    - Implement `getSignatureWallets()` with pagination support
    - Create service file at `src/services/FunctionAnalyticsService.ts`
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.4_

  - [ ] 2.2 Write property test for unique wallet count accuracy
    - **Property 1: Unique Wallet Count Accuracy**
    - **Validates: Requirements 2.1, 2.2**
    - Generate random wallet interactions and verify unique wallet counts match distinct addresses
    - _Requirements: 2.1, 2.2_

  - [ ] 2.3 Write property test for transaction count accuracy
    - **Property 2: Transaction Count Accuracy**
    - **Validates: Requirements 3.1, 3.2, 3.4**
    - Verify transaction counts and average transactions per wallet calculations
    - _Requirements: 3.1, 3.2, 3.4_

  - [ ] 2.4 Write property test for signature sorting invariant
    - **Property 3: Signature Sorting Invariant**
    - **Validates: Requirements 2.4**
    - Verify signatures are sorted by wallet count in descending order
    - _Requirements: 2.4_

  - [ ] 2.5 Write unit tests for FunctionAnalyticsService
    - Test edge cases: empty datasets, single wallet, missing signatures
    - Test pagination logic
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2_

- [ ] 3. Implement JourneyAnalyzerService
  - [ ] 3.1 Create JourneyAnalyzerService class with journey building logic
    - Implement `buildWalletJourney()` to construct sequential interaction paths
    - Implement `getContractJourneys()` to retrieve all journeys for a contract
    - Implement entry point identification logic
    - Create service file at `src/services/JourneyAnalyzerService.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 3.2 Write property test for journey sequence preservation
    - **Property 4: Journey Sequence Preservation**
    - **Validates: Requirements 4.1, 4.2**
    - Verify interactions are ordered chronologically by timestamp
    - _Requirements: 4.1, 4.2_

  - [ ] 3.3 Write property test for journey completeness
    - **Property 5: Journey Completeness**
    - **Validates: Requirements 4.3**
    - Verify all wallet interactions are included in journey
    - _Requirements: 4.3_

  - [ ] 3.4 Write property test for entry point identification
    - **Property 6: Entry Point Identification**
    - **Validates: Requirements 4.4**
    - Verify entry point is the earliest interaction
    - _Requirements: 4.4_

  - [ ] 3.5 Implement flow visualization generation
    - Implement `generateFlowVisualization()` to create nodes and edges
    - Implement `identifyJourneyPatterns()` for entry points and drop-offs
    - Calculate transition counts between signatures
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ] 3.6 Write property test for flow visualization accuracy
    - **Property 11: Flow Visualization Accuracy**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Verify all transitions are captured with correct counts
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 3.7 Write property test for flow signature filtering
    - **Property 12: Flow Signature Filtering**
    - **Validates: Requirements 6.4**
    - Verify filtered flows only include selected signature
    - _Requirements: 6.4_

  - [ ] 3.8 Write property test for drop-off point identification
    - **Property 13: Drop-off Point Identification**
    - **Validates: Requirements 6.5**
    - Verify last interactions are marked as drop-offs
    - _Requirements: 6.5_

  - [ ] 3.9 Write unit tests for JourneyAnalyzerService
    - Test gap detection for incomplete data
    - Test edge cases: single interaction, circular paths
    - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.5_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement CohortCalculatorService
  - [ ] 5.1 Create CohortCalculatorService class with cohort grouping
    - Implement `groupIntoCohorts()` to group wallets by first interaction date
    - Support daily, weekly, and monthly cohort periods
    - Create service file at `src/services/CohortCalculatorService.ts`
    - _Requirements: 5.1_

  - [ ] 5.2 Write property test for cohort grouping consistency
    - **Property 7: Cohort Grouping Consistency**
    - **Validates: Requirements 5.1**
    - Verify wallets in same cohort have first interactions in same period
    - _Requirements: 5.1_

  - [ ] 5.3 Implement activation metrics calculation
    - Implement `calculateActivation()` with configurable thresholds
    - Default: 2+ interactions within 7 days of first interaction
    - Support custom activation definitions
    - _Requirements: 5.2, 7.1, 7.2, 7.3, 7.4_

  - [ ] 5.4 Implement retention metrics calculation
    - Implement `calculateRetention()` for 1, 7, 30, and 90-day intervals
    - Calculate retention rates per cohort over time
    - _Requirements: 5.4, 9.1, 9.2, 9.3_

  - [ ] 5.5 Implement churn metrics calculation
    - Implement `calculateChurn()` with configurable inactive period
    - Default: 30 consecutive days of inactivity
    - Support custom churn definitions
    - _Requirements: 5.3, 8.1, 8.2, 8.3, 8.4_

  - [ ] 5.6 Write property test for cohort metric calculation
    - **Property 8: Cohort Metric Calculation**
    - **Validates: Requirements 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3**
    - Verify activation, churn, and retention rate formulas
    - _Requirements: 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

  - [ ] 5.7 Write property test for custom metric configuration
    - **Property 9: Custom Metric Configuration**
    - **Validates: Requirements 7.4, 8.4**
    - Verify custom thresholds are applied correctly
    - _Requirements: 7.4, 8.4_

  - [ ] 5.8 Write unit tests for CohortCalculatorService
    - Test edge cases: empty cohorts, single-wallet cohorts, zero denominators
    - Test different cohort periods (daily, weekly, monthly)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Implement caching layer
  - [ ] 6.1 Create AnalyticsCacheService for computed metrics
    - Implement in-memory cache with TTL (time-to-live)
    - Implement cache key generation based on query parameters
    - Implement cache invalidation on new data
    - Create service file at `src/services/AnalyticsCacheService.ts`
    - _Requirements: 2.3, 3.3_

  - [ ] 6.2 Write unit tests for caching layer
    - Test cache hit/miss scenarios
    - Test TTL expiration
    - Test cache invalidation
    - _Requirements: 2.3, 3.3_

- [ ] 7. Implement backend API routes
  - [ ] 7.1 Create function signature analytics routes
    - Implement `GET /api/functions/signatures` endpoint
    - Implement `GET /api/functions/signatures/:signature` endpoint
    - Implement `GET /api/functions/signatures/:signature/wallets` endpoint
    - Add input validation for contract address, chain, date range
    - Create routes file at `src/api/routes/functions.ts`
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2_

  - [ ] 7.2 Create user journey analytics routes
    - Implement `GET /api/functions/journeys` endpoint
    - Implement `GET /api/functions/journeys/flow` endpoint
    - Implement `GET /api/functions/journeys/:walletAddress` endpoint
    - Add signature filtering for flow visualization
    - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.2, 6.4_

  - [ ] 7.3 Create cohort analytics routes
    - Implement `GET /api/functions/cohorts` endpoint
    - Implement `GET /api/functions/cohorts/activation` endpoint
    - Implement `GET /api/functions/cohorts/retention` endpoint
    - Implement `GET /api/functions/cohorts/churn` endpoint
    - Support cohort period and date range filtering
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.4_

  - [ ] 7.4 Implement date range filtering across all endpoints
    - Add date range query parameter validation
    - Apply filtering to all metrics and visualizations
    - Ensure filter updates complete within 3 seconds
    - _Requirements: 10.1, 10.2, 10.5_

  - [ ] 7.5 Write property test for date range filtering
    - **Property 10: Date Range Filtering**
    - **Validates: Requirements 10.2**
    - Verify all returned data falls within specified date range
    - _Requirements: 10.2_

  - [ ] 7.6 Implement multi-signature selection support
    - Add signature array parameter to relevant endpoints
    - Return data for all selected signatures
    - _Requirements: 10.3_

  - [ ] 7.7 Write property test for multi-signature selection
    - **Property 14: Multi-Signature Selection**
    - **Validates: Requirements 10.3**
    - Verify all selected signatures appear in results
    - _Requirements: 10.3_

  - [ ] 7.8 Write property test for cohort period filtering
    - **Property 15: Cohort Period Filtering**
    - **Validates: Requirements 10.4**
    - Verify only cohorts within filter period are returned
    - _Requirements: 10.4_

  - [ ] 7.9 Write integration tests for API routes
    - Test complete request/response cycles
    - Test authentication and authorization
    - Test error responses (400, 404, 500)
    - _Requirements: 2.1, 3.1, 4.1, 5.1_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement data export functionality
  - [ ] 9.1 Create export service for CSV and JSON formats
    - Implement `POST /api/functions/export` endpoint
    - Implement CSV export with proper formatting
    - Implement JSON export
    - Support export of filtered datasets
    - Create service file at `src/services/ExportService.ts`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 9.2 Write property test for CSV export validity
    - **Property 16: CSV Export Validity**
    - **Validates: Requirements 11.2**
    - Verify exported CSV can be parsed back to structured data
    - _Requirements: 11.2_

  - [ ] 9.3 Write property test for JSON export round-trip
    - **Property 17: JSON Export Round-Trip**
    - **Validates: Requirements 11.3**
    - Verify JSON.parse(exported) equals original data
    - _Requirements: 11.3_

  - [ ] 9.4 Write property test for export data consistency
    - **Property 18: Export Data Consistency**
    - **Validates: Requirements 11.4**
    - Verify exported data matches filtered view
    - _Requirements: 11.4_

  - [ ] 9.5 Write unit tests for export service
    - Test large dataset exports (performance)
    - Test export timeout handling
    - Test file download headers
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

- [ ] 10. Implement error handling and data validation
  - [ ] 10.1 Add input validation middleware
    - Validate contract address format (0x + 40 hex chars)
    - Validate function signature format (0x + 8 hex chars)
    - Validate date ranges (start < end, not in future)
    - Validate pagination parameters
    - _Requirements: 12.4_

  - [ ] 10.2 Write property test for timestamp validation
    - **Property 22: Timestamp Validation**
    - **Validates: Requirements 12.4**
    - Verify timestamps are within reasonable bounds
    - _Requirements: 12.4_

  - [ ] 10.3 Implement missing data handling
    - Exclude transactions without function signatures from metrics
    - Mark incomplete journeys with hasGaps flag
    - Add notifications for missing data
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 10.4 Write property test for missing signature exclusion
    - **Property 19: Missing Signature Exclusion**
    - **Validates: Requirements 12.1**
    - Verify transactions without signatures are excluded
    - _Requirements: 12.1_

  - [ ] 10.5 Write property test for journey gap marking
    - **Property 20: Journey Gap Marking**
    - **Validates: Requirements 12.2**
    - Verify incomplete journeys are flagged
    - _Requirements: 12.2_

  - [ ] 10.6 Write property test for missing data notification
    - **Property 21: Missing Data Notification**
    - **Validates: Requirements 12.3**
    - Verify notifications are included when data is missing
    - _Requirements: 12.3_

  - [ ] 10.7 Implement error response formatting
    - Create consistent error response structure
    - Add error codes, messages, and suggestions
    - Include affected metrics in error responses
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 10.8 Write unit tests for error handling
    - Test all error scenarios (invalid inputs, missing data, timeouts)
    - Test error response format consistency
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 11. Implement frontend FunctionsTab component
  - [ ] 11.1 Create FunctionsTab component with navigation
    - Create component at `frontend/components/analytics/FunctionsTab.tsx`
    - Add tab to main dashboard navigation
    - Implement loading and error states
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 11.2 Create FunctionSignatureTable component
    - Display signature, name, wallet count, transaction count, avg transactions per wallet
    - Display activation, churn, and retention rates
    - Implement sorting by wallet count (descending)
    - Create component at `frontend/components/analytics/FunctionSignatureTable.tsx`
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.4, 7.2, 7.3, 8.2, 8.3, 9.2_

  - [ ] 11.3 Write unit tests for FunctionSignatureTable
    - Test rendering with data
    - Test sorting behavior
    - Test loading and error states
    - _Requirements: 2.1, 2.2, 2.4_

- [ ] 12. Implement frontend UserJourneyFlow component
  - [ ] 12.1 Create UserJourneyFlow component with D3.js visualization
    - Render flow diagram with nodes (signatures) and edges (transitions)
    - Display wallet counts on nodes and edges
    - Highlight most common paths
    - Indicate drop-off points
    - Create component at `frontend/components/analytics/UserJourneyFlow.tsx`
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ] 12.2 Add signature filtering to flow visualization
    - Implement signature selection dropdown
    - Filter flow to show only journeys with selected signature
    - _Requirements: 6.4_

  - [ ] 12.3 Write unit tests for UserJourneyFlow
    - Test rendering with flow data
    - Test signature filtering
    - Test drop-off highlighting
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ] 13. Implement frontend CohortAnalysisTable component
  - [ ] 13.1 Create CohortAnalysisTable component
    - Display cohorts in rows with time periods as columns
    - Support activation, retention, and churn metric types
    - Support daily, weekly, and monthly cohort periods
    - Create component at `frontend/components/analytics/CohortAnalysisTable.tsx`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 13.2 Add retention trend line chart
    - Display retention rates over time using Recharts
    - Show multiple cohorts on same chart
    - _Requirements: 9.3_

  - [ ] 13.3 Write unit tests for CohortAnalysisTable
    - Test rendering with cohort data
    - Test metric type switching
    - Test cohort period switching
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 14. Implement frontend filtering and controls
  - [ ] 14.1 Create DateRangeFilter component
    - Implement date picker for start and end dates
    - Apply filter to all metrics and visualizations
    - Create component at `frontend/components/analytics/DateRangeFilter.tsx`
    - _Requirements: 10.1, 10.2, 10.5_

  - [ ] 14.2 Create SignatureSelector component
    - Implement multi-select dropdown for signatures
    - Support comparison of multiple signatures
    - Create component at `frontend/components/analytics/SignatureSelector.tsx`
    - _Requirements: 10.3_

  - [ ] 14.3 Create CohortPeriodSelector component
    - Implement radio buttons or dropdown for daily/weekly/monthly
    - Apply to cohort analysis table
    - Create component at `frontend/components/analytics/CohortPeriodSelector.tsx`
    - _Requirements: 10.4_

  - [ ] 14.4 Create ExportButton component
    - Implement CSV and JSON export buttons
    - Trigger file download with current filtered data
    - Create component at `frontend/components/analytics/ExportButton.tsx`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 14.5 Write unit tests for filter components
    - Test date range selection and application
    - Test signature multi-select
    - Test export button functionality
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Implement custom metric configuration UI
  - [ ] 16.1 Create ActivationConfigModal component
    - Allow users to customize activation threshold (interactions count and days)
    - Save configuration and recalculate metrics
    - Create component at `frontend/components/analytics/ActivationConfigModal.tsx`
    - _Requirements: 7.4_

  - [ ] 16.2 Create ChurnConfigModal component
    - Allow users to customize churn period (inactive days)
    - Save configuration and recalculate metrics
    - Create component at `frontend/components/analytics/ChurnConfigModal.tsx`
    - _Requirements: 8.4_

  - [ ] 16.3 Write unit tests for configuration modals
    - Test modal open/close
    - Test configuration save
    - Test metric recalculation trigger
    - _Requirements: 7.4, 8.4_

- [ ] 17. Integrate frontend with backend API
  - [ ] 17.1 Create API client methods for function analytics
    - Add methods to `frontend/lib/api.ts` for all function analytics endpoints
    - Implement error handling and loading states
    - _Requirements: 2.1, 3.1, 4.1, 5.1_

  - [ ] 17.2 Connect FunctionsTab to API
    - Fetch function signature data on component mount
    - Handle loading, error, and empty states
    - _Requirements: 1.2, 2.1, 2.2_

  - [ ] 17.3 Connect UserJourneyFlow to API
    - Fetch flow visualization data
    - Update on signature filter changes
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ] 17.4 Connect CohortAnalysisTable to API
    - Fetch cohort data based on metric type and period
    - Update on filter changes
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 17.5 Implement filter synchronization
    - Ensure all components update when filters change
    - Debounce API calls to avoid excessive requests
    - Ensure updates complete within 3 seconds
    - _Requirements: 10.2, 10.5_

  - [ ] 17.6 Write integration tests for frontend-backend communication
    - Test complete data flow from API to UI
    - Test error handling and retry logic
    - Test filter application across components
    - _Requirements: 1.2, 2.1, 4.1, 5.1, 10.2_

- [ ] 18. Implement data ingestion from blockchain indexer
  - [ ] 18.1 Create transaction processor for function signatures
    - Extract function signatures from transaction input data
    - Create WalletInteraction records from transactions
    - Update FunctionSignature aggregates
    - Create processor at `src/indexer/FunctionSignatureProcessor.ts`
    - _Requirements: 2.1, 2.3, 3.1, 3.3, 4.1, 4.2_

  - [ ] 18.2 Integrate processor with existing blockchain indexer
    - Hook into transaction processing pipeline
    - Trigger journey and cohort recalculation on new data
    - Invalidate cache on data updates
    - _Requirements: 2.3, 3.3_

  - [ ] 18.3 Write unit tests for transaction processor
    - Test signature extraction from various transaction formats
    - Test handling of transactions without signatures
    - Test aggregate updates
    - _Requirements: 2.1, 3.1, 4.1, 12.1_

- [ ] 19. Final integration and end-to-end testing
  - [ ] 19.1 Wire all components together in FunctionsTab
    - Ensure all components communicate correctly
    - Verify state management across components
    - Test navigation and tab switching
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 19.2 Write end-to-end tests for complete user flows
    - Test: Navigate to Functions tab → View metrics → Apply filters → Export data
    - Test: Select signature → View flow → Analyze cohorts
    - Test: Customize activation/churn config → View updated metrics
    - _Requirements: 1.1, 1.2, 2.1, 6.1, 10.2, 11.1_

  - [ ] 19.3 Performance testing and optimization
    - Test with 100,000+ interactions
    - Verify query response times under load
    - Optimize slow queries and cache effectiveness
    - _Requirements: 10.5, 11.5_

  - [ ] 19.4 Write performance regression tests
    - Measure and assert on query response times
    - Test pagination performance
    - Test export performance with large datasets
    - _Requirements: 10.5, 11.5_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties from the design document
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end flows and component interactions
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- All property tests must include the feature name and property number in comments
- The implementation uses TypeScript for type safety across frontend and backend
- Fast-check library is used for property-based testing with minimum 100 iterations per test
