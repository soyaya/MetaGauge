# Design Document: Function Signature Analytics

## Overview

The Function Signature Analytics feature extends the MetaGauge analytics platform with comprehensive tracking and visualization of smart contract function signature interactions. This feature enables analysts to understand user behavior patterns through function signature usage, track wallet engagement over time, and measure key cohort metrics including activation, retention, and churn.

The feature introduces a new "Functions" tab in the dashboard that displays function signature-level analytics, user journey visualizations, and cohort analysis. It leverages the existing blockchain indexing infrastructure to capture function signature data from transactions and provides both real-time and historical analytics.

### Key Capabilities

- Function signature identification and interaction tracking
- Wallet-level user journey analysis across function signatures
- Cohort-based metrics (activation, churn, retention)
- Flow visualizations showing user paths through function signatures
- Flexible filtering and data export capabilities
- Graceful handling of incomplete or missing data

### Integration Points

- Extends existing dashboard with new Functions tab
- Utilizes existing blockchain indexer for transaction data
- Integrates with current authentication and subscription systems
- Follows established API patterns and data storage mechanisms

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Functions Tab│  │ Flow Viz     │  │ Cohort Table │      │
│  │ Component    │  │ Component    │  │ Component    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Functions    │  │ Journey      │  │ Cohort       │      │
│  │ Routes       │  │ Routes       │  │ Routes       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Function     │  │ Journey      │  │ Cohort       │      │
│  │ Analytics    │  │ Analyzer     │  │ Calculator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Function     │  │ Wallet       │  │ Cohort       │      │
│  │ Signatures   │  │ Journeys     │  │ Metrics      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Transaction Ingestion**: Blockchain indexer captures transactions and extracts function signatures
2. **Journey Construction**: Service layer builds wallet journey sequences from transaction data
3. **Metrics Calculation**: Analytics services compute interaction counts, cohort metrics, and aggregations
4. **API Delivery**: REST endpoints serve processed data to frontend components
5. **Visualization**: Frontend renders interactive charts, tables, and flow diagrams

### Technology Stack

- **Frontend**: Next.js 16 (App Router), React, TypeScript, Recharts/D3.js for visualizations
- **Backend**: Express.js, Node.js
- **Data Storage**: File-based JSON storage (PostgreSQL-ready schema)
- **Caching**: In-memory cache with TTL for computed metrics
- **Testing**: Jest for unit tests, fast-check for property-based tests

## Components and Interfaces

### Frontend Components

#### FunctionsTab Component
```typescript
interface FunctionsTabProps {
  contractAddress: string;
  chain: string;
  dateRange?: { start: Date; end: Date };
}

interface FunctionSignatureData {
  signature: string;
  name: string;
  walletCount: number;
  transactionCount: number;
  avgTransactionsPerWallet: number;
  activationRate: number;
  churnRate: number;
  retentionRates: {
    day1: number;
    day7: number;
    day30: number;
    day90: number;
  };
}
```

#### UserJourneyFlow Component
```typescript
interface FlowVisualizationProps {
  contractAddress: string;
  chain: string;
  selectedSignature?: string;
  dateRange?: { start: Date; end: Date };
}

interface FlowNode {
  id: string;
  signature: string;
  name: string;
  walletCount: number;
  isEntryPoint: boolean;
  isDropOff: boolean;
}

interface FlowEdge {
  source: string;
  target: string;
  walletCount: number;
  transitionRate: number;
}
```

#### CohortAnalysisTable Component
```typescript
interface CohortTableProps {
  contractAddress: string;
  chain: string;
  signature?: string;
  metricType: 'activation' | 'retention' | 'churn';
  cohortPeriod: 'daily' | 'weekly' | 'monthly';
}

interface CohortData {
  cohortId: string;
  cohortDate: Date;
  walletCount: number;
  metrics: {
    [period: string]: number; // e.g., "day0": 100, "day1": 85
  };
}
```

### Backend API Endpoints

#### Function Signature Analytics
```
GET /api/functions/signatures
  Query: contractAddress, chain, dateRange
  Response: Array<FunctionSignatureData>

GET /api/functions/signatures/:signature
  Query: contractAddress, chain, dateRange
  Response: FunctionSignatureData

GET /api/functions/signatures/:signature/wallets
  Query: contractAddress, chain, dateRange, limit, offset
  Response: { wallets: Array<WalletInteraction>, total: number }
```

#### User Journey Analytics
```
GET /api/functions/journeys
  Query: contractAddress, chain, dateRange, walletAddress?
  Response: Array<UserJourney>

GET /api/functions/journeys/flow
  Query: contractAddress, chain, dateRange, signature?
  Response: { nodes: Array<FlowNode>, edges: Array<FlowEdge> }

GET /api/functions/journeys/:walletAddress
  Query: contractAddress, chain, dateRange
  Response: UserJourney
```

#### Cohort Analytics
```
GET /api/functions/cohorts
  Query: contractAddress, chain, signature?, metricType, cohortPeriod, dateRange
  Response: Array<CohortData>

GET /api/functions/cohorts/activation
  Query: contractAddress, chain, signature?, cohortPeriod, dateRange
  Response: Array<CohortData>

GET /api/functions/cohorts/retention
  Query: contractAddress, chain, signature?, cohortPeriod, dateRange
  Response: Array<CohortData>

GET /api/functions/cohorts/churn
  Query: contractAddress, chain, signature?, cohortPeriod, dateRange
  Response: Array<CohortData>
```

#### Export
```
POST /api/functions/export
  Body: { format: 'csv' | 'json', data: any, filters: any }
  Response: File download
```

### Service Layer Interfaces

#### FunctionAnalyticsService
```typescript
class FunctionAnalyticsService {
  // Get all function signatures for a contract
  async getFunctionSignatures(
    contractAddress: string,
    chain: string,
    dateRange?: DateRange
  ): Promise<FunctionSignatureData[]>

  // Get detailed metrics for a specific signature
  async getSignatureMetrics(
    contractAddress: string,
    chain: string,
    signature: string,
    dateRange?: DateRange
  ): Promise<FunctionSignatureData>

  // Get wallets that interacted with a signature
  async getSignatureWallets(
    contractAddress: string,
    chain: string,
    signature: string,
    dateRange?: DateRange,
    pagination?: { limit: number; offset: number }
  ): Promise<{ wallets: WalletInteraction[]; total: number }>
}
```

#### JourneyAnalyzerService
```typescript
class JourneyAnalyzerService {
  // Build user journey for a wallet
  async buildWalletJourney(
    walletAddress: string,
    contractAddress: string,
    chain: string,
    dateRange?: DateRange
  ): Promise<UserJourney>

  // Get all journeys for a contract
  async getContractJourneys(
    contractAddress: string,
    chain: string,
    dateRange?: DateRange
  ): Promise<UserJourney[]>

  // Generate flow visualization data
  async generateFlowVisualization(
    contractAddress: string,
    chain: string,
    dateRange?: DateRange,
    focusSignature?: string
  ): Promise<{ nodes: FlowNode[]; edges: FlowEdge[] }>

  // Identify entry points and drop-offs
  async identifyJourneyPatterns(
    contractAddress: string,
    chain: string,
    dateRange?: DateRange
  ): Promise<{ entryPoints: string[]; dropOffs: string[]; commonPaths: string[][] }>
}
```

#### CohortCalculatorService
```typescript
class CohortCalculatorService {
  // Calculate activation metrics
  async calculateActivation(
    contractAddress: string,
    chain: string,
    signature?: string,
    cohortPeriod?: 'daily' | 'weekly' | 'monthly',
    dateRange?: DateRange,
    activationConfig?: { interactions: number; days: number }
  ): Promise<CohortData[]>

  // Calculate retention metrics
  async calculateRetention(
    contractAddress: string,
    chain: string,
    signature?: string,
    cohortPeriod?: 'daily' | 'weekly' | 'monthly',
    dateRange?: DateRange
  ): Promise<CohortData[]>

  // Calculate churn metrics
  async calculateChurn(
    contractAddress: string,
    chain: string,
    signature?: string,
    cohortPeriod?: 'daily' | 'weekly' | 'monthly',
    dateRange?: DateRange,
    churnConfig?: { inactiveDays: number }
  ): Promise<CohortData[]>

  // Group wallets into cohorts
  async groupIntoCohorts(
    wallets: WalletInteraction[],
    cohortPeriod: 'daily' | 'weekly' | 'monthly'
  ): Promise<Map<string, WalletInteraction[]>>
}
```

## Data Models

### FunctionSignature
```typescript
interface FunctionSignature {
  signature: string;           // e.g., "0xa9059cbb"
  name: string;                 // e.g., "transfer"
  contractAddress: string;
  chain: string;
  firstSeen: Date;
  lastSeen: Date;
  totalTransactions: number;
  uniqueWallets: number;
}
```

### WalletInteraction
```typescript
interface WalletInteraction {
  walletAddress: string;
  contractAddress: string;
  chain: string;
  signature: string;
  timestamp: Date;
  transactionHash: string;
  blockNumber: number;
  gasUsed?: number;
  success: boolean;
}
```

### UserJourney
```typescript
interface UserJourney {
  walletAddress: string;
  contractAddress: string;
  chain: string;
  interactions: Array<{
    signature: string;
    name: string;
    timestamp: Date;
    transactionHash: string;
    sequenceNumber: number;
  }>;
  entryPoint: string;           // First signature
  lastInteraction: Date;
  totalInteractions: number;
  uniqueSignatures: number;
  hasGaps: boolean;             // Indicates incomplete data
}
```

### CohortMetrics
```typescript
interface CohortMetrics {
  cohortId: string;             // e.g., "2024-01-15" or "2024-W03"
  cohortDate: Date;
  contractAddress: string;
  chain: string;
  signature?: string;           // Optional: specific signature
  metricType: 'activation' | 'retention' | 'churn';
  walletCount: number;
  periodMetrics: {
    [period: string]: {
      value: number;            // Percentage or count
      walletCount: number;
    };
  };
  calculatedAt: Date;
}
```

### AnalyticsCache
```typescript
interface AnalyticsCache {
  key: string;                  // Cache key
  data: any;                    // Cached data
  createdAt: Date;
  expiresAt: Date;
  contractAddress: string;
  chain: string;
}
```

### Storage Schema

#### File Structure
```
data/
  function-analytics/
    {contractAddress}_{chain}/
      signatures.json           # All function signatures
      interactions.json         # All wallet interactions
      journeys.json            # Computed user journeys
      cohorts/
        activation.json        # Activation cohort data
        retention.json         # Retention cohort data
        churn.json            # Churn cohort data
      cache/
        {cacheKey}.json        # Cached computed metrics
```

#### PostgreSQL Schema (Future)
```sql
CREATE TABLE function_signatures (
  id SERIAL PRIMARY KEY,
  signature VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  contract_address VARCHAR(42) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  first_seen TIMESTAMP NOT NULL,
  last_seen TIMESTAMP NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  unique_wallets INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(signature, contract_address, chain)
);

CREATE TABLE wallet_interactions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  signature VARCHAR(10) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  gas_used BIGINT,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_wallet_contract (wallet_address, contract_address, chain),
  INDEX idx_signature (signature, contract_address, chain),
  INDEX idx_timestamp (timestamp),
  UNIQUE(transaction_hash, wallet_address, signature)
);

CREATE TABLE user_journeys (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  entry_point VARCHAR(10) NOT NULL,
  last_interaction TIMESTAMP NOT NULL,
  total_interactions INTEGER DEFAULT 0,
  unique_signatures INTEGER DEFAULT 0,
  has_gaps BOOLEAN DEFAULT false,
  journey_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, contract_address, chain)
);

CREATE TABLE cohort_metrics (
  id SERIAL PRIMARY KEY,
  cohort_id VARCHAR(50) NOT NULL,
  cohort_date DATE NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  signature VARCHAR(10),
  metric_type VARCHAR(20) NOT NULL,
  wallet_count INTEGER DEFAULT 0,
  period_metrics JSONB NOT NULL,
  calculated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_cohort (cohort_id, contract_address, chain),
  INDEX idx_metric_type (metric_type, contract_address, chain)
);
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated to eliminate redundancy:

**Consolidations Made:**
- Properties 2.1 and 2.2 (calculate and display wallet counts) → Combined into Property 1 (wallet count accuracy)
- Properties 3.1 and 3.2 (calculate and display transaction counts) → Combined into Property 2 (transaction count accuracy)
- Properties 5.2, 5.3, 5.4 (calculate activation, churn, retention) → Combined into Property 8 (cohort metric calculation)
- Properties 7.2 and 7.3 (calculate and display activation) → Covered by Property 8
- Properties 8.2 and 8.3 (calculate and display churn) → Covered by Property 8
- Properties 9.1 and 9.3 (calculate retention for cohorts) → Covered by Property 8
- Properties 6.1 and 6.2 (generate flow and display counts) → Combined into Property 11 (flow visualization accuracy)

**Redundancies Eliminated:**
- Display properties are subsumed by calculation properties (if calculated correctly, display follows)
- Multiple cohort calculation properties unified into single comprehensive property
- Update properties (2.3, 3.3) are covered by the base calculation properties when tested with different datasets

### Property 1: Unique Wallet Count Accuracy

*For any* set of wallet interactions grouped by function signature, the unique wallet count for each signature should equal the number of distinct wallet addresses that interacted with that signature.

**Validates: Requirements 2.1, 2.2**

### Property 2: Transaction Count Accuracy

*For any* set of transactions grouped by function signature, the transaction count for each signature should equal the total number of transactions with that signature, and the average transactions per wallet should equal the transaction count divided by the unique wallet count.

**Validates: Requirements 3.1, 3.2, 3.4**

### Property 3: Signature Sorting Invariant

*For any* list of function signatures with wallet interaction counts, the output list should be sorted in descending order by wallet count, meaning each signature's count should be greater than or equal to the next signature's count.

**Validates: Requirements 2.4**

### Property 4: Journey Sequence Preservation

*For any* wallet's interactions, the recorded user journey sequence should preserve the chronological order of interactions based on timestamps, meaning for any two interactions i and j where i occurs before j, i's timestamp should be less than or equal to j's timestamp.

**Validates: Requirements 4.1, 4.2**

### Property 5: Journey Completeness

*For any* wallet address, the user journey should include all interactions for that wallet across all function signatures, meaning the set of interactions in the journey should equal the set of all recorded interactions for that wallet.

**Validates: Requirements 4.3**

### Property 6: Entry Point Identification

*For any* wallet's user journey with at least one interaction, the identified entry point should be the function signature with the earliest timestamp in that wallet's interaction history.

**Validates: Requirements 4.4**

### Property 7: Cohort Grouping Consistency

*For any* set of wallets, wallets grouped into the same cohort should have first interaction dates that fall within the same cohort period (daily, weekly, or monthly), and wallets with first interaction dates in different cohort periods should be in different cohorts.

**Validates: Requirements 5.1**

### Property 8: Cohort Metric Calculation

*For any* cohort of wallets and function signature:
- Activation rate should equal (wallets with 2+ interactions within 7 days of first / total cohort wallets) × 100
- Churn rate should equal (wallets with no interactions for 30+ consecutive days / previously active wallets) × 100
- Retention rate for period N should equal (wallets active in period N / initial cohort size) × 100

**Validates: Requirements 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3**

### Property 9: Custom Metric Configuration

*For any* custom activation threshold (interactions count and days) or churn period (inactive days), the metric calculations should use the custom values instead of defaults, meaning a wallet's activation status with threshold (N, D) should be true if it has N+ interactions within D days of first interaction.

**Validates: Requirements 7.4, 8.4**

### Property 10: Date Range Filtering

*For any* date range filter applied to metrics, all returned data should only include interactions with timestamps within the specified range (inclusive), meaning no interaction outside the date range should appear in filtered results.

**Validates: Requirements 10.2**

### Property 11: Flow Visualization Accuracy

*For any* set of user journeys, the generated flow visualization should include:
- All observed transitions between function signatures
- Transition counts that equal the number of distinct wallets that made each transition
- The most common paths highlighted, where "most common" means paths with the highest wallet counts

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 12: Flow Signature Filtering

*For any* selected function signature, the filtered flow visualization should only include journeys where that signature appears at least once, meaning every displayed journey path should contain the selected signature.

**Validates: Requirements 6.4**

### Property 13: Drop-off Point Identification

*For any* user journey, if a wallet's last interaction is with signature S and there are no subsequent interactions, then S should be marked as a drop-off point in the flow visualization.

**Validates: Requirements 6.5**

### Property 14: Multi-Signature Selection

*For any* set of selected function signatures, the displayed metrics should include data for all selected signatures, meaning each selected signature should appear in the results.

**Validates: Requirements 10.3**

### Property 15: Cohort Period Filtering

*For any* cohort time period filter, only cohorts with cohort dates falling within the specified period should be displayed, meaning no cohort outside the filter period should appear in results.

**Validates: Requirements 10.4**

### Property 16: CSV Export Validity

*For any* data export in CSV format, the output should be valid CSV that can be parsed back into structured data, and the parsed data should contain the same information as the original dataset.

**Validates: Requirements 11.2**

### Property 17: JSON Export Round-Trip

*For any* data export in JSON format, parsing the JSON output should produce an equivalent data structure to the original, meaning JSON.parse(exported) should equal the original data.

**Validates: Requirements 11.3**

### Property 18: Export Data Consistency

*For any* export request, the exported data should exactly match the currently filtered and displayed dataset, meaning every row in the export should correspond to a row in the filtered view and vice versa.

**Validates: Requirements 11.4**

### Property 19: Missing Signature Exclusion

*For any* set of transactions, those without a function signature field should not appear in any signature-specific metrics, meaning the count of transactions in signature metrics should equal the count of transactions with valid signatures.

**Validates: Requirements 12.1**

### Property 20: Journey Gap Marking

*For any* wallet with incomplete user journey data (detected by timestamp gaps or missing expected interactions), the journey object should have a flag indicating incompleteness (hasGaps = true).

**Validates: Requirements 12.2**

### Property 21: Missing Data Notification

*For any* scenario where data is missing or incomplete, the system should include a notification in the response indicating which metrics are affected, meaning the presence of missing data should always result in a notification.

**Validates: Requirements 12.3**

### Property 22: Timestamp Validation

*For any* timestamp in the system, it should pass validation checks ensuring it is not in the future (relative to current time) and not before a reasonable blockchain genesis date, meaning invalid timestamps should be rejected before processing.

**Validates: Requirements 12.4**

## Error Handling

### Input Validation Errors

**Invalid Contract Address**
- Validate Ethereum address format (0x + 40 hex characters)
- Return 400 Bad Request with descriptive error message
- Example: "Invalid contract address format"

**Invalid Date Range**
- Validate start date is before end date
- Validate dates are not in the future
- Return 400 Bad Request with descriptive error message
- Example: "Start date must be before end date"

**Invalid Signature Format**
- Validate function signature format (0x + 8 hex characters)
- Return 400 Bad Request with descriptive error message
- Example: "Invalid function signature format"

**Invalid Pagination Parameters**
- Validate limit and offset are positive integers
- Validate limit does not exceed maximum (e.g., 1000)
- Return 400 Bad Request with descriptive error message

### Data Processing Errors

**Missing Transaction Data**
- Log warning for transactions without function signatures
- Exclude from signature-specific metrics
- Include count of excluded transactions in response metadata
- Continue processing valid transactions

**Incomplete Journey Data**
- Mark journey with hasGaps flag
- Include available data in response
- Add warning to response metadata
- Example: "Journey data incomplete due to indexing gaps"

**Timestamp Anomalies**
- Validate timestamps are within reasonable bounds
- Log warning for out-of-bounds timestamps
- Exclude invalid data points
- Include count of excluded data in response metadata

**Cohort Calculation Errors**
- Handle edge cases (empty cohorts, single-wallet cohorts)
- Return 0% for rates when denominator is zero
- Include warning in response for edge cases
- Example: "Cohort has insufficient data for reliable metrics"

### External Service Errors

**Blockchain RPC Failures**
- Retry with exponential backoff (3 attempts)
- Fall back to cached data if available
- Return 503 Service Unavailable if all retries fail
- Include retry information in error response

**Database Connection Errors**
- Retry connection with exponential backoff
- Return 503 Service Unavailable if connection cannot be established
- Log error details for debugging
- Example: "Database temporarily unavailable"

**Cache Service Errors**
- Log warning but continue without cache
- Fetch data from primary source
- Attempt to rebuild cache in background
- Do not fail request due to cache errors

### Performance and Resource Errors

**Query Timeout**
- Set reasonable timeout limits (30 seconds for complex queries)
- Return 504 Gateway Timeout if exceeded
- Suggest narrower date range or filters
- Example: "Query timeout - please narrow your date range"

**Memory Limits**
- Monitor memory usage during large data processing
- Implement pagination for large result sets
- Return 413 Payload Too Large if limits exceeded
- Suggest using export functionality for large datasets

**Rate Limiting**
- Implement per-user rate limits based on subscription tier
- Return 429 Too Many Requests when limit exceeded
- Include Retry-After header with wait time
- Example: "Rate limit exceeded - retry after 60 seconds"

### User Experience Errors

**No Data Available**
- Return 200 OK with empty result set
- Include helpful message in response
- Suggest checking filters or date range
- Example: "No data found for the selected criteria"

**Partial Data Available**
- Return 200 OK with available data
- Include warning about missing data
- Specify which metrics are affected
- Example: "Some metrics unavailable due to incomplete indexing"

### Error Response Format

All error responses follow a consistent format:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: any;          // Additional error details
    affectedMetrics?: string[]; // Metrics affected by error
    suggestions?: string[]; // Suggested actions to resolve
  };
  metadata?: {
    excludedCount?: number; // Count of excluded data points
    warnings?: string[];    // Non-fatal warnings
  };
}
```

### Graceful Degradation Strategy

1. **Prioritize Core Functionality**: Always return basic metrics even if advanced features fail
2. **Partial Results**: Return available data with warnings rather than failing completely
3. **Cache Fallback**: Use cached data when real-time data is unavailable
4. **Progressive Enhancement**: Load basic data first, then enhance with additional metrics
5. **User Notification**: Always inform users when data is incomplete or degraded

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of function signature parsing
- Edge cases (empty datasets, single-wallet cohorts, boundary dates)
- Error conditions (invalid inputs, missing data, malformed responses)
- Integration points between components
- UI component rendering with specific data

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Mathematical invariants (sorting, percentages, counts)
- Data transformation correctness (filtering, grouping, aggregation)
- Round-trip properties (export/import, serialization)

### Property-Based Testing Configuration

**Library**: fast-check (JavaScript/TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Seed-based reproducibility for failed tests
- Shrinking enabled to find minimal failing cases
- Timeout: 30 seconds per property test

**Test Tagging**: Each property test must reference its design document property using the format:
```typescript
// Feature: function-signature-analytics, Property 1: Unique Wallet Count Accuracy
```

### Unit Test Coverage

**Frontend Components** (Jest + React Testing Library):
- FunctionsTab renders correctly with data
- FunctionsTab handles loading and error states
- UserJourneyFlow renders flow diagram correctly
- CohortAnalysisTable renders cohort data in table format
- Date range filters update displayed data
- Export buttons trigger download with correct format
- Navigation between tabs maintains state

**Backend API Routes** (Jest + Supertest):
- GET /api/functions/signatures returns correct data structure
- GET /api/functions/journeys handles pagination correctly
- POST /api/functions/export generates valid CSV/JSON
- Error responses follow consistent format
- Authentication middleware protects endpoints
- Rate limiting enforces tier-based limits

**Service Layer** (Jest):
- FunctionAnalyticsService calculates metrics correctly for known datasets
- JourneyAnalyzerService builds journeys from interaction sequences
- CohortCalculatorService handles empty cohorts gracefully
- Cache service stores and retrieves data correctly
- Data validation rejects invalid inputs

### Property-Based Test Coverage

Each correctness property from the design document must be implemented as a property-based test:

**Property 1: Unique Wallet Count Accuracy**
```typescript
// Feature: function-signature-analytics, Property 1: Unique Wallet Count Accuracy
fc.assert(
  fc.property(
    fc.array(walletInteractionArbitrary),
    (interactions) => {
      const grouped = groupBySignature(interactions);
      for (const [signature, group] of grouped) {
        const calculatedCount = calculateUniqueWallets(group);
        const actualUniqueWallets = new Set(group.map(i => i.walletAddress)).size;
        expect(calculatedCount).toBe(actualUniqueWallets);
      }
    }
  ),
  { numRuns: 100 }
);
```

**Property 3: Signature Sorting Invariant**
```typescript
// Feature: function-signature-analytics, Property 3: Signature Sorting Invariant
fc.assert(
  fc.property(
    fc.array(functionSignatureDataArbitrary),
    (signatures) => {
      const sorted = sortSignaturesByWalletCount(signatures);
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].walletCount).toBeGreaterThanOrEqual(sorted[i + 1].walletCount);
      }
    }
  ),
  { numRuns: 100 }
);
```

**Property 4: Journey Sequence Preservation**
```typescript
// Feature: function-signature-analytics, Property 4: Journey Sequence Preservation
fc.assert(
  fc.property(
    fc.array(walletInteractionArbitrary).filter(arr => arr.length > 0),
    (interactions) => {
      const journey = buildUserJourney(interactions);
      for (let i = 0; i < journey.interactions.length - 1; i++) {
        const current = journey.interactions[i].timestamp;
        const next = journey.interactions[i + 1].timestamp;
        expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
      }
    }
  ),
  { numRuns: 100 }
);
```

**Property 10: Date Range Filtering**
```typescript
// Feature: function-signature-analytics, Property 10: Date Range Filtering
fc.assert(
  fc.property(
    fc.array(walletInteractionArbitrary),
    fc.date(),
    fc.date(),
    (interactions, start, end) => {
      const [startDate, endDate] = start < end ? [start, end] : [end, start];
      const filtered = filterByDateRange(interactions, startDate, endDate);
      for (const interaction of filtered) {
        expect(interaction.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(interaction.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    }
  ),
  { numRuns: 100 }
);
```

**Property 17: JSON Export Round-Trip**
```typescript
// Feature: function-signature-analytics, Property 17: JSON Export Round-Trip
fc.assert(
  fc.property(
    fc.array(functionSignatureDataArbitrary),
    (data) => {
      const exported = exportToJSON(data);
      const parsed = JSON.parse(exported);
      expect(parsed).toEqual(data);
    }
  ),
  { numRuns: 100 }
);
```

### Test Data Generators (Arbitraries)

Property-based tests require generators for random test data:

```typescript
// Generate random wallet addresses
const walletAddressArbitrary = fc.hexaString({ minLength: 40, maxLength: 40 })
  .map(hex => `0x${hex}`);

// Generate random function signatures
const functionSignatureArbitrary = fc.hexaString({ minLength: 8, maxLength: 8 })
  .map(hex => `0x${hex}`);

// Generate random wallet interactions
const walletInteractionArbitrary = fc.record({
  walletAddress: walletAddressArbitrary,
  contractAddress: walletAddressArbitrary,
  chain: fc.constantFrom('ethereum', 'lisk', 'starknet'),
  signature: functionSignatureArbitrary,
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  transactionHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(h => `0x${h}`),
  blockNumber: fc.integer({ min: 1, max: 20000000 }),
  gasUsed: fc.option(fc.integer({ min: 21000, max: 10000000 })),
  success: fc.boolean()
});

// Generate random function signature data
const functionSignatureDataArbitrary = fc.record({
  signature: functionSignatureArbitrary,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  walletCount: fc.integer({ min: 0, max: 100000 }),
  transactionCount: fc.integer({ min: 0, max: 1000000 }),
  avgTransactionsPerWallet: fc.float({ min: 0, max: 100 })
});
```

### Integration Testing

**End-to-End Flows**:
1. User navigates to Functions tab → Data loads → Metrics display correctly
2. User applies date filter → All visualizations update → Export reflects filtered data
3. User selects signature → Flow visualization filters → Cohort table updates
4. User exports data → File downloads → Imported data matches display

**Performance Testing**:
- Load test with 100,000 interactions
- Measure query response times under load
- Verify cache effectiveness
- Test pagination with large datasets

### Test Execution

**Local Development**:
```bash
npm test                          # Run all tests
npm test -- --coverage            # Run with coverage report
npm test -- --watch               # Run in watch mode
npm test property                 # Run only property-based tests
```

**CI/CD Pipeline**:
- Run all tests on every pull request
- Require 80% code coverage minimum
- Run property-based tests with 1000 iterations in CI
- Performance regression tests on main branch

### Test Maintenance

- Update property tests when requirements change
- Add new unit tests for bug fixes
- Review and update test data generators quarterly
- Monitor test execution time and optimize slow tests
- Document any test-specific configuration or setup

