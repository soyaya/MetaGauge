 
I'll organize this by priority tiers (MVP, Phase 2, Phase 3) to help with development sequencing.

---

# METAGAUGE - COMPLETE DEVELOPMENT SPECIFICATION

## Priority Tier Definition

| Tier | Description | FR Coverage |
|------|-------------|-------------|
| **MVP** | Core functionality - must work end-to-end | FR-01 through FR-11, FR-17, FR-22 |
| **Phase 2** | Intelligence layer + exports | FR-12 through FR-16, FR-18, FR-19, FR-20 |
| **Phase 3** | Competitive intelligence + AI Growth Advisor | FR-24 through FR-38 |

---

# MVP REQUIREMENTS (Tier 1)

## FR-01: User Authentication

### User Story
```
As a founder or team member,
I want to authenticate using my wallet or email,
So that I can securely access my project dashboards and data.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| AC-01.1 | Users can connect wallet (MetaMask, WalletConnect, Coinbase Wallet) | Manual test with each wallet type |
| AC-01.2 | Users can sign up with email + password | Manual test + automated |
| AC-01.3 | JWT tokens issued on successful authentication | API test |
| AC-01.4 | Role-based access control (Admin, Viewer, Analyst) | Permission matrix test |
| AC-01.5 | Session persists across page reloads | Manual test |

### Definition of Done
- [ ] Authentication service deployed
- [ ] Wallet connection SDK integrated
- [ ] JWT auth middleware implemented
- [ ] Role-based middleware implemented
- [ ] Login/signup UI components built
- [ ] Session storage working
- [ ] Unit tests: 80% coverage
- [ ] Integration tests: all ACs pass
- [ ] Security audit: no exposed private keys

### Edge Cases to Test

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Wallet connection rejected by user | Graceful error message, retry option |
| Expired JWT | Auto-refresh or redirect to login |
| User with no roles assigned | Default "Viewer" role, cannot access admin features |
| Email already registered | "Account exists" with login option |
| Wrong network (e.g., connected to Ethereum but app expects Polygon) | Prompt to switch network |

### Test Scenarios

```javascript
// Test 1: Wallet Authentication Flow
describe('FR-01: Wallet Authentication', () => {
  test('User connects MetaMask and receives JWT', async () => {
    const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7599b0e7a6';
    const signature = await wallet.signMessage('Login to Metagauge');
    
    const response = await api.post('/auth/wallet', {
      address: walletAddress,
      signature: signature,
      chainId: 1
    });
    
    expect(response.status).toBe(200);
    expect(response.data.token).toBeDefined();
    expect(response.data.user.role).toBe('viewer');
  });
  
  test('Invalid signature returns 401', async () => {
    const response = await api.post('/auth/wallet', {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7599b0e7a6',
      signature: 'invalid_signature',
      chainId: 1
    });
    
    expect(response.status).toBe(401);
    expect(response.data.error).toContain('Invalid signature');
  });
});

// Test 2: Role-Based Access Control
describe('FR-01: Role-Based Access', () => {
  test('Viewer cannot access admin endpoints', async () => {
    const viewerToken = getTokenForRole('viewer');
    
    const response = await api.get('/admin/projects', {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    
    expect(response.status).toBe(403);
  });
  
  test('Admin can create new projects', async () => {
    const adminToken = getTokenForRole('admin');
    
    const response = await api.post('/projects', {
      name: 'Test Project'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    expect(response.status).toBe(201);
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement user authentication for Metagauge with wallet connection and email options.

Requirements:
1. Use NextAuth.js or similar for authentication framework
2. Support MetaMask, WalletConnect, and Coinbase Wallet
3. Implement wallet signature verification using ethers.js v6
4. JWT-based session management with refresh tokens
5. Role-based middleware: admin, analyst, viewer
6. PostgreSQL users table with: id, email, wallet_address, role, created_at

Example Flow:
1. User clicks "Connect Wallet" button
2. MetaMask prompts for signature of message: "Login to Metagauge at {timestamp}"
3. Frontend sends {address, signature, chainId} to /api/auth/wallet
4. Backend verifies signature using ethers.verifyMessage()
5. Backend creates/updates user and returns JWT
6. Frontend stores JWT in httpOnly cookie or localStorage
7. Subsequent requests include JWT in Authorization header

API Endpoints:
- POST /api/auth/wallet - wallet authentication
- POST /api/auth/email - email/password authentication
- POST /api/auth/refresh - refresh expired token
- GET /api/auth/me - get current user info
```

---

## FR-02: Project Creation & Management

### User Story
```
As an admin or project manager,
I want to create a project and register its smart contracts,
So that I can start tracking on-chain activity for my protocol.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| AC-02.1 | User can create project with name, category, chain, description | UI form test |
| AC-02.2 | User can add smart contract addresses with ABI upload/paste | Manual test |
| AC-02.3 | System validates contract exists on specified chain | API call to chain RPC |
| AC-02.4 | System validates ABI format and extracts function signatures | JSON validation |
| AC-02.5 | User can edit project settings | UI test |
| AC-02.6 | User can archive/delete projects (soft delete) | Data persistence test |

### Definition of Done
- [ ] Project CRUD API endpoints
- [ ] Contract validation service (RPC calls)
- [ ] ABI parser with function signature extraction
- [ ] Project management UI with forms
- [ ] Projects table with soft delete
- [ ] Contracts table linked to projects
- [ ] Unit tests: 80% coverage
- [ ] Integration tests: all ACs pass

### Edge Cases to Test

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Contract address doesn't exist on chain | Error: "Contract not found on {chain}" |
| Invalid ABI JSON format | Error with specific parsing error |
| Contract has no verified source code | Continue but note "Unverified contract - limited function names" |
| Duplicate contract added to same project | Warning: "Contract already registered" |
| User tries to delete project with dependencies | Confirm dialog, show impact |

### Test Scenarios

```javascript
// Test 1: Project Creation with Contract Validation
describe('FR-02: Project Creation', () => {
  test('Create project with valid contract', async () => {
    const projectData = {
      name: 'Uniswap V3 Tracker',
      category: 'DEX',
      chain: 'ethereum',
      description: 'Tracking Uniswap V3 activity',
      contracts: [{
        address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        abi: uniswapV3Abi  // valid ABI
      }]
    };
    
    const response = await api.post('/projects', projectData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    expect(response.status).toBe(201);
    expect(response.data.project.id).toBeDefined();
    expect(response.data.contracts[0].status).toBe('validated');
    expect(response.data.contracts[0].functions).toContain('swap');
  });
  
  test('Create project with invalid contract address returns 400', async () => {
    const projectData = {
      name: 'Invalid Project',
      category: 'DEX',
      chain: 'ethereum',
      contracts: [{
        address: '0x0000000000000000000000000000000000000000',
        abi: simpleAbi
      }]
    };
    
    const response = await api.post('/projects', projectData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    expect(response.status).toBe(400);
    expect(response.data.error).toContain('Contract not found');
  });
});

// Test 2: ABI Parsing
describe('FR-02: ABI Parsing', () => {
  test('Extracts function signatures from ABI', () => {
    const abi = [
      { type: 'function', name: 'swap', inputs: [{ name: 'amount', type: 'uint256' }] },
      { type: 'function', name: 'addLiquidity', inputs: [{ name: 'token', type: 'address' }] },
      { type: 'event', name: 'Swap' }
    ];
    
    const result = parseAbi(abi);
    
    expect(result.functions).toEqual(['swap', 'addLiquidity']);
    expect(result.signatures).toEqual([
      'swap(uint256)',
      'addLiquidity(address)'
    ]);
  });
  
  test('Handles malformed ABI gracefully', () => {
    const malformedAbi = '{ not: valid json }';
    
    expect(() => parseAbi(malformedAbi)).toThrow('Invalid ABI format');
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement project and contract management for Metagauge.

Requirements:
1. Project model: id, name, category, chain, description, created_by, created_at, archived_at (nullable)
2. Contract model: id, project_id, address, chain, abi_json, status, validated_at
3. Contract validation service:
   - Call chain RPC (Alchemy/Infura) to check if contract exists at address
   - Validate ABI format using JSON.parse
   - Extract function signatures: function name + input types
   - Store mapping of function signatures to human-readable names
4. UI: Form with project details, dynamic contract rows, ABI upload (file or paste)
5. API endpoints:
   - POST /api/projects - create project
   - GET /api/projects - list user's projects
   - GET /api/projects/:id - get project details with contracts
   - PUT /api/projects/:id - update project
   - DELETE /api/projects/:id - soft delete (archive)

Example Validation Flow:
1. User enters "0x1F98431c8aD98523631AE4a59f267346ea31F984" on Ethereum
2. Backend calls eth_getCode at that address via Alchemy
3. If returns non-empty, contract exists
4. Parse ABI, extract: swap(address,uint256), mint(address), etc.
5. Store mapping: {"swap(address,uint256)": "Swap", "mint(address)": "Mint"}
6. Return success with validated contract status
```

---

## FR-03 & FR-04: Blockchain Data Ingestion

### User Story
```
As a system,
I want to continuously index on-chain data for registered contracts,
So that wallet activities are captured in near-real-time without manual intervention.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| AC-03.1 | System indexes transactions for all registered contracts | Check database after new block |
| AC-03.2 | System indexes events emitted by contracts | Event log verification |
| AC-03.3 | System indexes function calls with decoded parameters | Parameter decode test |
| AC-03.4 | System processes new blocks within 30 seconds of finality | Latency measurement |
| AC-03.5 | System handles chain reorganizations | Reorg test with simulated chain fork |
| AC-03.6 | Indexing resumes from last processed block on restart | Restart test |

### Definition of Done
- [ ] Indexer service deployed (Node.js + ethers.js)
- [ ] PostgreSQL with TimescaleDB for time-series data
- [ ] Kafka/RabbitMQ for event streaming (optional for MVP)
- [ ] Checkpoint system for block tracking
- [ ] Reorg handler implemented
- [ ] Monitoring dashboard for indexer health
- [ ] Unit tests: 70% coverage
- [ ] Integration tests with local chain (Anvil/Hardhat)

### Edge Cases to Test

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Chain reorganization (reorg) > 20 blocks | Trigger full re-index of affected blocks |
| RPC provider rate limit exceeded | Exponential backoff, rotate to backup provider |
| Contract with high transaction volume | Batch processing, no memory overflow |
| New contract added mid-block | Indexer catches up from contract deployment block |
| Invalid transaction data (malformed logs) | Skip with error log, continue processing |

### Test Scenarios

```javascript
// Test 1: Basic Transaction Indexing
describe('FR-03/04: Transaction Indexing', () => {
  test('Indexes transaction for registered contract', async () => {
    // Setup: Deploy test contract, register in Metagauge
    const { contract, deployer } = await deployTestContract();
    await registerContract(contract.address);
    
    // Execute transaction
    const tx = await contract.swap('0x742d35...', 100);
    await tx.wait();
    
    // Wait for indexer (polling up to 30s)
    await waitForIndexer(30000);
    
    // Query database
    const activity = await db.query(`
      SELECT * FROM wallet_activities 
      WHERE contract_address = $1 
      AND transaction_hash = $2
    `, [contract.address, tx.hash]);
    
    expect(activity.rows.length).toBe(1);
    expect(activity.rows[0].function_signature).toBe('swap(address,uint256)');
    expect(activity.rows[0].wallet_address).toBe(deployer.address);
  });
  
  test('Handles multiple transactions in same block', async () => {
    const { contract } = await deployTestContract();
    await registerContract(contract.address);
    
    // Send 10 transactions in same block (use batch or increase block gas limit)
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(contract.swap(`0x${i.toString(16)}`, 100));
    }
    const txs = await Promise.all(promises);
    await Promise.all(txs.map(tx => tx.wait()));
    
    await waitForIndexer(30000);
    
    const count = await db.query(`
      SELECT COUNT(*) FROM wallet_activities 
      WHERE contract_address = $1
    `, [contract.address]);
    
    expect(parseInt(count.rows[0].count)).toBe(10);
  });
});

// Test 2: Chain Reorganization Handling
describe('FR-03/04: Chain Reorg Handling', () => {
  test('Corrects data after chain reorganization', async () => {
    // This requires a local testnet with reorg simulation
    // Setup: Index blocks, simulate reorg, verify corrections
    
    const { chain } = await setupLocalChain();
    const { contract } = await deployTestContract(chain);
    
    // Mine block 100 with transaction
    const tx = await contract.swap('0x123', 100);
    await chain.mineBlock();
    
    // Indexer processes block 100
    await waitForIndexer(5000);
    
    // Simulate reorg: mine competing block 100' with different transaction
    await chain.simulateReorg(100);
    const tx2 = await contract.swap('0x456', 200);
    await chain.mineBlock();
    
    await waitForIndexer(10000);
    
    // Verify only correct transaction exists for that block height
    const activities = await db.query(`
      SELECT * FROM wallet_activities 
      WHERE contract_address = $1 
      AND block_number = 100
    `, [contract.address]);
    
    expect(activities.rows.length).toBe(1);
    expect(activities.rows[0].amount).toBe(200); // New transaction, not original
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement blockchain data indexing service for Metagauge.

Architecture:
1. Indexer Service (Node.js + ethers.js v6):
   - Connect to multiple RPC providers (Alchemy, Infura, public RPCs)
   - Track last processed block per chain in PostgreSQL
   - Poll for new blocks every 3 seconds
   - Process blocks in batches of 20

2. Data Models:
   - indexed_blocks: chain, block_number, processed_at, hash
   - wallet_activities: id, chain, contract_address, wallet_address, 
                        transaction_hash, function_signature, block_number, 
                        timestamp, decoded_params (JSONB), status
   - events: id, contract_address, event_name, event_params, block_number, tx_hash

3. Processing Logic per Block:
   For each transaction in block:
     For each contract in registered_contracts:
       If transaction.to == contract.address:
         - Decode transaction input using contract ABI
         - Store wallet_activity record
       For each log in transaction.logs:
         If log.address == contract.address:
           - Decode event using contract ABI
           - Store event record

4. Reorg Handling:
   - On chain reorg, detect by comparing block hash
   - Delete all activities from orphaned blocks
   - Re-index from reorg start point

Example Processing Flow:
Block #15,000,000 mined at timestamp 1700000000
├── Transaction 0xabc...
│   ├── to: 0x1F98431c8aD98523631AE4a59f267346ea31F984 (Uniswap V3)
│   ├── input: 0x... (swap function)
│   ├── Decode: swap(recipient=0x742d..., amount=1000000000000000000)
│   └── Store: wallet=0x742d..., function=swap(address,uint256), amount=1 ETH
└── Logs:
    ├── Swap event from Uniswap V3
    └── Store: event_type=Swap, params={sender:0x..., amount0:100, amount1:200}
```

---

## FR-05: Wallet Activity Tracking

### User Story
```
As a product manager,
I want to see every wallet interaction with my contracts,
So that I can understand user behavior patterns and engagement.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| AC-05.1 | System captures wallet address for every interaction | Database record check |
| AC-05.2 | System captures function signature called | Activity table verification |
| AC-05.3 | System maps function signature to human-readable feature name | Mapping table check |
| AC-05.4 | System timestamps every interaction | Timestamp present in records |
| AC-05.5 | System tracks interaction frequency per wallet | Aggregation query test |
| AC-05.6 | System supports filtering by time range | API test with date parameters |

### Definition of Done
- [ ] Wallet activities table with all required fields
- [ ] Function signature to feature name mapping system
- [ ] Activity API endpoints with filtering
- [ ] Frequency calculation queries
- [ ] Unit tests: 80% coverage
- [ ] Performance: query < 200ms for 1M records

### Edge Cases to Test

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Unknown function signature (not in ABI) | Store raw signature, flag for review |
| Very high frequency wallet (>1000 tx/day) | Track normally, monitor for bot flagging |
| Wallet with 0 balance interacting | Still track, segment as potential bot |
| Contract self-destructs | Continue tracking historical, stop new indexing |

### Test Scenarios

```javascript
// Test 1: Activity Capture
describe('FR-05: Wallet Activity Tracking', () => {
  test('Captures all wallet interactions with correct metadata', async () => {
    // Simulate multiple interactions
    const wallet = '0x742d35Cc6634C0532925a3b844Bc9e7599b0e7a6';
    
    await simulateInteraction(wallet, 'swap', { amount: 100 });
    await simulateInteraction(wallet, 'addLiquidity', { amount: 50 });
    await simulateInteraction(wallet, 'swap', { amount: 200 });
    
    await waitForIndexer(5000);
    
    const activities = await api.get(`/api/wallets/${wallet}/activities`);
    
    expect(activities.data.length).toBe(3);
    expect(activities.data[0].function_signature).toBe('swap');
    expect(activities.data[1].function_signature).toBe('addLiquidity');
  });
  
  test('Maps function signatures to human-readable names', async () => {
    // Setup mapping
    await api.post('/api/projects/1/function-mappings', {
      signature: 'swap(address,uint256)',
      display_name: 'Swap Tokens',
      category: 'Trading'
    });
    
    const activity = await simulateInteraction('0x123', 'swap(address,uint256)', {});
    await waitForIndexer(5000);
    
    const result = await api.get(`/api/activities/${activity.id}`);
    
    expect(result.data.feature_name).toBe('Swap Tokens');
    expect(result.data.feature_category).toBe('Trading');
  });
  
  test('Tracks interaction frequency per wallet', async () => {
    const wallet = '0xFrequencyWallet';
    
    // Send 50 interactions
    for (let i = 0; i < 50; i++) {
      await simulateInteraction(wallet, 'swap', {});
    }
    await waitForIndexer(10000);
    
    const stats = await api.get(`/api/wallets/${wallet}/stats`);
    
    expect(stats.data.total_interactions).toBe(50);
    expect(stats.data.interactions_per_day).toBeGreaterThan(0);
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement wallet activity tracking system.

Requirements:
1. Database Schema:
   CREATE TABLE wallet_activities (
     id UUID PRIMARY KEY,
     chain VARCHAR(50) NOT NULL,
     contract_address VARCHAR(42) NOT NULL,
     wallet_address VARCHAR(42) NOT NULL,
     transaction_hash VARCHAR(66) NOT NULL,
     function_signature VARCHAR(255) NOT NULL,
     function_name VARCHAR(255),
     decoded_params JSONB,
     block_number BIGINT NOT NULL,
     timestamp TIMESTAMPTZ NOT NULL,
     status VARCHAR(20) DEFAULT 'confirmed',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   CREATE INDEX idx_wallet_activities_wallet ON wallet_activities(wallet_address);
   CREATE INDEX idx_wallet_activities_timestamp ON wallet_activities(timestamp);
   CREATE INDEX idx_wallet_activities_contract ON wallet_activities(contract_address);

2. Function Signature Mapping:
   CREATE TABLE function_mappings (
     id UUID PRIMARY KEY,
     project_id UUID REFERENCES projects(id),
     signature VARCHAR(255) NOT NULL,
     display_name VARCHAR(255) NOT NULL,
     category VARCHAR(100),
     is_activation_event BOOLEAN DEFAULT false,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

3. API Endpoints:
   GET /api/projects/:projectId/activities
     Query: ?wallet=0x..., &from=date&to=date&function=swap
   GET /api/wallets/:address/activities
   GET /api/wallets/:address/stats
   POST /api/projects/:projectId/function-mappings

Example Queries:
-- Get top 10 most active wallets in last 7 days
SELECT wallet_address, COUNT(*) as activity_count
FROM wallet_activities
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY wallet_address
ORDER BY activity_count DESC
LIMIT 10;

-- Get feature usage breakdown
SELECT fm.display_name, COUNT(*) as usage_count
FROM wallet_activities wa
JOIN function_mappings fm ON wa.function_signature = fm.signature
WHERE wa.timestamp > NOW() - INTERVAL '30 days'
GROUP BY fm.display_name
ORDER BY usage_count DESC;
```

---

## FR-06: Wallet Classification

### User Story
```
As a growth lead,
I want wallets automatically classified into segments,
So that I can target different user groups with appropriate strategies.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| AC-06.1 | New wallets auto-assigned based on first interaction date | Cohort assignment test |
| AC-06.2 | Active wallets recalculated daily (interaction within lookback) | Scheduled job verification |
| AC-06.3 | Cohort retention (D1, D7, D30, D90) auto-calculated daily | Retention query test |
| AC-06.4 | LTV auto-calculated as sum of fees generated | Fee tracking verification |
| AC-06.5 | Top 10 wallets by volume auto-updated daily | Ranking query test |
| AC-06.6 | Churned wallets auto-flagged after inactivity threshold | Scheduled job test |
| AC-06.7 | Whales auto-flagged based on volume/balance thresholds | Threshold test |
| AC-06.8 | Bot/suspicious flagged with heuristics, awaiting user confirmation | Flagging logic test |

### Definition of Done
- [ ] Classification engine (scheduled jobs)
- [ ] Cohort calculation queries
- [ ] LTV calculation with fee tracking
- [ ] Bot detection heuristics
- [ ] Classification API endpoints
- [ ] Scheduled jobs with monitoring
- [ ] Unit tests: 70% coverage
- [ ] Performance: cohort calc < 5 min for 1M wallets

### Edge Cases to Test

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Wallet with first and only interaction on day 1 | Churned after inactivity threshold |
| Whale with decreasing volume over time | Gradually moves down rankings |
| Bot with high volume but no fee generation | Flagged as bot, user can confirm |
| Wallet that churns then reactivates | Removed from churned, retention recalculated |

### Test Scenarios

```javascript
// Test 1: Cohort Assignment
describe('FR-06: Wallet Classification - Cohorts', () => {
  test('Assigns wallets to correct weekly cohort', async () => {
    const today = new Date('2024-01-15');
    const wallet1 = await createWalletWithFirstInteraction('2024-01-01');
    const wallet2 = await createWalletWithFirstInteraction('2024-01-10');
    
    await runClassificationJob(today);
    
    const cohort1 = await getCohort(wallet1.address);
    const cohort2 = await getCohort(wallet2.address);
    
    expect(cohort1.week).toBe('2024-01-01');
    expect(cohort2.week).toBe('2024-01-08');
  });
  
  test('Calculates retention correctly', async () => {
    // Create cohort of 100 wallets with first interaction Jan 1
    const cohort = await createCohort('2024-01-01', 100);
    
    // 80 wallets active on Jan 2 (D1)
    await createActivitiesForWallets(cohort.slice(0, 80), '2024-01-02');
    // 50 wallets active on Jan 8 (D7)
    await createActivitiesForWallets(cohort.slice(0, 50), '2024-01-08');
    // 30 wallets active on Jan 31 (D30)
    await createActivitiesForWallets(cohort.slice(0, 30), '2024-01-31');
    
    await runRetentionCalculation('2024-01-31');
    
    const retention = await getRetention('2024-01-01');
    
    expect(retention.D1).toBe(80);
    expect(retention.D7).toBe(50);
    expect(retention.D30).toBe(30);
  });
});

// Test 2: Bot Detection
describe('FR-06: Wallet Classification - Bot Detection', () => {
  test('Flags suspicious wallets based on heuristics', async () => {
    const botWallet = '0xBotWallet';
    
    // Simulate bot-like behavior: 1000 transactions in 1 hour
    for (let i = 0; i < 1000; i++) {
      await simulateInteraction(botWallet, 'swap', {});
    }
    
    await runBotDetectionJob();
    
    const classification = await getWalletClassification(botWallet);
    
    expect(classification.is_suspicious).toBe(true);
    expect(classification.suspicious_reasons).toContain('high_frequency');
    expect(classification.status).toBe('pending_review'); // Semi-automated
  });
  
  test('Allows user to confirm/reclassify flagged wallets', async () => {
    const flaggedWallet = '0xFlaggedWallet';
    
    // Mark as confirmed bot
    await api.post(`/api/wallets/${flaggedWallet}/classification`, {
      is_bot: true,
      confirmed: true
    });
    
    const classification = await getWalletClassification(flaggedWallet);
    
    expect(classification.is_bot).toBe(true);
    expect(classification.status).toBe('confirmed');
    expect(classification.auto_flagged).toBe(true);
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement wallet classification system with scheduled jobs.

Classification Jobs (run daily at 00:00 UTC):
1. Cohort Assignment:
   - Get all wallets with first_interaction_date in last 7 days
   - Assign to weekly/monthly cohort

2. Activity Status:
   - Active: interacted within last 7 days
   - Churned: no interaction for 30+ days (threshold configurable)
   - Dormant reactivation: churned wallet that interacts again

3. Whale Detection:
   - Calculate total volume per wallet in last 30 days
   - Top 10% by volume = whale

4. Bot Detection Heuristics:
   - High frequency: >100 tx/day average
   - Gas patterns: always using exact gas limits
   - Activity clustering: repetitive patterns
   - Zero balance but high activity
   - Score each wallet (0-100), flag if >70

5. Retention Calculation:
   For each cohort:
     D1: % active on day 1
     D7: % active on day 7
     D30: % active on day 30
     D90: % active on day 90

Database Schema:
CREATE TABLE wallet_classifications (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  project_id UUID REFERENCES projects(id),
  cohort_week DATE,
  cohort_month DATE,
  is_active BOOLEAN DEFAULT true,
  is_churned BOOLEAN DEFAULT false,
  is_whale BOOLEAN DEFAULT false,
  is_bot BOOLEAN DEFAULT false,
  is_high_risk BOOLEAN DEFAULT false,
  bot_score INT,
  ltv DECIMAL,
  total_volume_30d DECIMAL,
  last_interaction TIMESTAMPTZ,
  classification_updated_at TIMESTAMPTZ,
  UNIQUE(wallet_address, project_id)
);

Scheduled Job Code Example:
async function runDailyClassification(projectId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Update active/churned status
  await db.query(`
    UPDATE wallet_classifications wc
    SET 
      is_active = EXISTS (
        SELECT 1 FROM wallet_activities wa
        WHERE wa.wallet_address = wc.wallet_address
        AND wa.timestamp > NOW() - INTERVAL '7 days'
      ),
      is_churned = NOT EXISTS (
        SELECT 1 FROM wallet_activities wa
        WHERE wa.wallet_address = wc.wallet_address
        AND wa.timestamp > NOW() - INTERVAL '30 days'
      ),
      last_interaction = (
        SELECT MAX(timestamp) FROM wallet_activities wa
        WHERE wa.wallet_address = wc.wallet_address
      )
    WHERE wc.project_id = $1
  `, [projectId]);
  
  // Update whale status
  await db.query(`
    WITH volume_ranking AS (
      SELECT 
        wallet_address,
        SUM(volume) as total_volume,
        PERCENT_RANK() OVER (ORDER BY SUM(volume) DESC) as percentile
      FROM wallet_activities
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY wallet_address
    )
    UPDATE wallet_classifications wc
    SET is_whale = (vr.percentile <= 0.1)
    FROM volume_ranking vr
    WHERE wc.wallet_address = vr.wallet_address
    AND wc.project_id = $1
  `, [projectId]);
}
```

---

## FR-07 & FR-08: Feature Analytics & Funnel Mapping

### User Story
```
As a product manager,
I want to track feature adoption and user journeys,
So that I can optimize the product experience and conversion rates.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| AC-07.1 | Feature adoption rate auto-calculated | % of wallets that used feature |
| AC-07.2 | Feature retention rate auto-calculated | % who used feature again after X days |
| AC-07.3 | Feature activation rate auto-calculated | % who completed activation event |
| AC-07.4 | Feature churn rate auto-calculated | % who stopped using feature |
| AC-07.5 | Usage frequency metrics available | Average, median, percentiles |
| AC-07.6 | Success vs failed calls tracked | Status in activity records |
| AC-07.7 | User can define funnels with steps | Funnel definition UI |
| AC-07.8 | Funnel conversion rates auto-calculated | Step-by-step conversion |

### Definition of Done
- [ ] Feature analytics engine
- [ ] Funnel definition and tracking system
- [ ] Conversion rate calculations
- [ ] Feature adoption/retention/churn queries
- [ ] API endpoints for feature metrics
- [ ] Unit tests: 80% coverage

### Edge Cases to Test

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Feature used in non-linear order | Funnel handles out-of-order steps |
| User completes funnel step multiple times | Count first completion only for conversion |
| Feature with very low usage (<10 wallets) | Show with confidence warning |
| Failed transaction counted as usage? | Separate metrics: attempts vs successes |

### Test Scenarios

```javascript
// Test 1: Feature Adoption Metrics
describe('FR-07: Feature Usage Analytics', () => {
  test('Calculates feature adoption rate correctly', async () => {
    // 100 total active wallets
    // 60 used swap feature
    // 40 used addLiquidity
    
    await calculateFeatureAdoption('swap');
    await calculateFeatureAdoption('addLiquidity');
    
    const swapAdoption = await getFeatureAdoption('swap');
    const liquidityAdoption = await getFeatureAdoption('addLiquidity');
    
    expect(swapAdoption).toBe(60);
    expect(liquidityAdoption).toBe(40);
  });
  
  test('Tracks success vs failed calls', async () => {
    // Simulate 80 successful swaps, 20 failed swaps
    for (let i = 0; i < 80; i++) {
      await simulateInteraction('0xwallet', 'swap', {}, { success: true });
    }
    for (let i = 0; i < 20; i++) {
      await simulateInteraction('0xwallet', 'swap', {}, { success: false });
    }
    
    await waitForIndexer(5000);
    
    const stats = await getFeatureStats('swap');
    
    expect(stats.total_calls).toBe(100);
    expect(stats.success_rate).toBe(80);
    expect(stats.failed_calls).toBe(20);
  });
});

// Test 2: Funnel Tracking
describe('FR-08: Funnel Mapping', () => {
  test('Tracks conversion through defined funnel', async () => {
    // Define funnel: Connect → Swap → Add Liquidity → Stake
    await defineFunnel('test_funnel', [
      'connect', 'swap', 'addLiquidity', 'stake'
    ]);
    
    // Simulate user journeys
    // User A: Connect → Swap → Add Liquidity → Stake
    await simulateJourney('userA', ['connect', 'swap', 'addLiquidity', 'stake']);
    // User B: Connect → Swap (stop)
    await simulateJourney('userB', ['connect', 'swap']);
    // User C: Connect → Swap → Add Liquidity (stop)
    await simulateJourney('userC', ['connect', 'swap', 'addLiquidity']);
    
    await calculateFunnelConversion('test_funnel');
    
    const funnel = await getFunnel('test_funnel');
    
    expect(funnel.steps[0].name).toBe('connect');
    expect(funnel.steps[0].entered).toBe(3);
    expect(funnel.steps[0].converted).toBe(3); // all entered
    
    expect(funnel.steps[1].name).toBe('swap');
    expect(funnel.steps[1].entered).toBe(3);
    expect(funnel.steps[1].converted).toBe(3);
    
    expect(funnel.steps[2].name).toBe('addLiquidity');
    expect(funnel.steps[2].entered).toBe(2);
    expect(funnel.steps[2].converted).toBe(2);
    
    expect(funnel.steps[3].name).toBe('stake');
    expect(funnel.steps[3].entered).toBe(1);
    expect(funnel.steps[3].converted).toBe(1);
    
    expect(funnel.conversion_rate).toBe(33.3); // 1 of 3 completed
  });
  
  test('Handles out-of-order funnel steps', async () => {
    await defineFunnel('linear_funnel', ['A', 'B', 'C']);
    
    // User does C first, then B, then A (reverse order)
    await simulateJourney('userReverse', ['C', 'B', 'A']);
    
    await calculateFunnelConversion('linear_funnel');
    
    const funnel = await getFunnel('linear_funnel');
    
    // Should still count as completing all steps
    expect(funnel.steps[2].entered).toBe(1); // C
    expect(funnel.steps[1].entered).toBe(1); // B
    expect(funnel.steps[0].entered).toBe(1); // A
    expect(funnel.completed).toBe(1);
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement feature analytics and funnel tracking.

Feature Analytics Queries:
-- Feature Adoption (30-day)
SELECT 
  fm.display_name,
  COUNT(DISTINCT wa.wallet_address) as adopting_wallets,
  (SELECT COUNT(DISTINCT wallet_address) FROM wallet_activities 
   WHERE timestamp > NOW() - INTERVAL '30 days') as total_active_wallets
FROM wallet_activities wa
JOIN function_mappings fm ON wa.function_signature = fm.signature
WHERE wa.timestamp > NOW() - INTERVAL '30 days'
GROUP BY fm.display_name;

-- Feature Retention (users who used feature in week 1 and week 2)
WITH week1_users AS (
  SELECT DISTINCT wallet_address
  FROM wallet_activities
  WHERE function_signature = 'swap'
  AND timestamp BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
),
week2_users AS (
  SELECT DISTINCT wallet_address
  FROM wallet_activities
  WHERE function_signature = 'swap'
  AND timestamp > NOW() - INTERVAL '7 days'
)
SELECT 
  COUNT(DISTINCT w1.wallet_address) as week1_users,
  COUNT(DISTINCT w2.wallet_address) as week2_users,
  ROUND(COUNT(DISTINCT w2.wallet_address)::float / COUNT(DISTINCT w1.wallet_address) * 100, 2) as retention_rate
FROM week1_users w1
LEFT JOIN week2_users w2 ON w1.wallet_address = w2.wallet_address;

Funnel Schema:
CREATE TABLE funnels (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  steps JSONB NOT NULL, -- [{order:1, signature:"swap", name:"Swap Tokens"}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE funnel_conversions (
  id UUID PRIMARY KEY,
  funnel_id UUID REFERENCES funnels(id),
  wallet_address VARCHAR(42),
  step_reached INT,
  completed_at TIMESTAMPTZ,
  UNIQUE(funnel_id, wallet_address)
);

Funnel Calculation Logic:
async function calculateFunnel(funnelId) {
  const funnel = await getFunnel(funnelId);
  const steps = funnel.steps;
  
  for (const wallet in wallets) {
    let maxStep = 0;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const completed = await hasWalletCompletedStep(wallet, step.signature, funnel.timeframe);
      
      if (completed) {
        maxStep = i + 1;
      } else {
        break;
      }
    }
    
    await recordFunnelConversion(funnelId, wallet, maxStep);
  }
}
```

---

## FR-09, FR-10, FR-11: Growth, Retention & Churn Analytics

### User Story
```
As a growth lead,
I want to understand cohort retention and churn patterns,
So that I can identify which user segments need intervention.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| FR-09.1 | Activation event configurable per project | UI configuration test |
| FR-09.2 | Activation rate auto-calculated per cohort | % who complete activation |
| FR-10.1 | D1, D7, D30 retention auto-calculated daily | Query verification |
| FR-10.2 | Cohort retention data available via API | API test |
| FR-11.1 | Wallets exceeding inactivity threshold auto-flagged | Scheduled job test |
| FR-11.2 | Churn rate auto-calculated weekly | Metric calculation test |

### Definition of Done
- [ ] Activation event configuration
- [ ] Cohort retention calculation engine
- [ ] Churn detection job
- [ ] Retention/Churn API endpoints
- [ ] Scheduled jobs with monitoring
- [ ] Unit tests: 75% coverage

### Test Scenarios

```javascript
// Test 1: Activation Metrics
describe('FR-09: Activation Metrics', () => {
  test('Calculates activation rate per cohort', async () => {
    // Define activation event as "swap" with amount > 100
    await setActivationEvent('swap_gt_100', {
      signature: 'swap',
      condition: 'amount > 100'
    });
    
    // Cohort of 100 wallets from Jan 1
    const cohort = await createCohort('2024-01-01', 100);
    
    // 40 wallets swap with amount > 100
    for (const wallet of cohort.slice(0, 40)) {
      await simulateInteraction(wallet, 'swap', { amount: 150 });
    }
    
    // 20 wallets swap with amount <= 100 (not activated)
    for (const wallet of cohort.slice(40, 60)) {
      await simulateInteraction(wallet, 'swap', { amount: 50 });
    }
    
    // 40 wallets never swap
    
    await calculateActivationRate('2024-01-01');
    
    const activation = await getCohortActivation('2024-01-01');
    
    expect(activation.activated_count).toBe(40);
    expect(activation.activation_rate).toBe(40);
  });
});

// Test 2: Churn Detection
describe('FR-11: Churn Detection', () => {
  test('Flags wallets as churned after inactivity', async () => {
    const churnedWallet = '0xChurnedWallet';
    const activeWallet = '0xActiveWallet';
    
    // Last interaction 35 days ago
    await createInteraction(churnedWallet, '2024-01-01');
    // Last interaction yesterday
    await createInteraction(activeWallet, '2024-02-04');
    
    await runChurnDetection({ inactivityDays: 30 });
    
    const churnedStatus = await getWalletStatus(churnedWallet);
    const activeStatus = await getWalletStatus(activeWallet);
    
    expect(churnedStatus.is_churned).toBe(true);
    expect(activeStatus.is_churned).toBe(false);
  });
  
  test('Calculates churn rate weekly', async () => {
    // Total active wallets start of week: 1000
    // Wallets that churned during week: 150
    
    await calculateWeeklyChurnRate('2024-02-04');
    
    const churnRate = await getChurnRate('2024-02-04');
    
    expect(churnRate.weekly_churn_rate).toBe(15);
  });
});
```

---

# PHASE 2 REQUIREMENTS (Tier 2)

## FR-14, FR-15, FR-16: AI-Driven Insights & Alerts

### User Story
```
As a founder,
I want the system to automatically detect anomalies and generate insights,
So that I don't have to manually analyze dashboards to find opportunities.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| FR-14.1 | System detects retention drops below threshold | Alert generation test |
| FR-14.2 | System detects whale exits (top 10 inactive for 7 days) | Alert test |
| FR-14.3 | System detects revenue spikes/dips (>30% change) | Alert test |
| FR-14.4 | System detects bot surges (>20% of activity) | Alert test |
| FR-14.5 | System detects churn spikes (>20% increase) | Alert test |
| FR-15.1 | Each insight links to underlying metrics | Drill-down test |
| FR-15.2 | Users can drill down to raw transaction data | Navigation test |
| FR-16.1 | Users can configure alert thresholds | UI configuration test |
| FR-16.2 | Alerts delivered via configured channels | Notification test |

### Test Scenarios

```javascript
// Test 1: Retention Drop Detection
describe('FR-14: Automated Insights - Retention Drop', () => {
  test('Detects D7 retention drop below threshold', async () => {
    // Set threshold: D7 retention < 15% triggers alert
    await setAlertThreshold('retention_drop', { d7: 15 });
    
    // Cohort from Jan 1
    await createCohort('2024-01-01', 1000);
    
    // Only 10 wallets active on day 7 (1%)
    await createActivitiesForWallets(10, '2024-01-08');
    
    await runInsightEngine();
    
    const alerts = await getAlerts();
    const retentionAlert = alerts.find(a => a.type === 'retention_drop');
    
    expect(retentionAlert).toBeDefined();
    expect(retentionAlert.severity).toBe('high');
    expect(retentionAlert.message).toContain('D7 retention dropped to 1%');
    expect(retentionAlert.drill_down_url).toBeDefined();
  });
  
  test('Insight includes explainability data', async () => {
    await runInsightEngine();
    
    const alert = await getAlert('retention_drop');
    
    // Drill down to underlying metrics
    const metrics = await api.get(alert.drill_down_url);
    
    expect(metrics.cohort_data).toBeDefined();
    expect(metrics.comparison_with_previous_cohort).toBeDefined();
    expect(metrics.feature_usage_during_drop).toBeDefined();
  });
});

// Test 2: Whale Exit Detection
describe('FR-14: Automated Insights - Whale Exit', () => {
  test('Detects when top 10 wallet becomes inactive for 7 days', async () => {
    // Create top 10 wallets by volume
    const topWallets = await createTopWallets(10);
    
    // Top wallet #3 becomes inactive for 7 days
    const whaleWallet = topWallets[2];
    await createInteraction(whaleWallet, '2024-01-01'); // last interaction 8 days ago
    
    await runInsightEngine();
    
    const alerts = await getAlerts();
    const whaleAlert = alerts.find(a => a.type === 'whale_exit');
    
    expect(whaleAlert).toBeDefined();
    expect(whaleAlert.message).toContain(whaleWallet.address);
    expect(whaleAlert.suggested_action).toBeDefined();
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement AI insights and alerting system.

Alert Configuration Schema:
CREATE TABLE alert_configs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  alert_type VARCHAR(50) NOT NULL, -- retention_drop, whale_exit, etc.
  threshold JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  channels TEXT[], -- email, telegram, slack, webhook
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  drill_down_query JSONB, -- parameters to reconstruct view
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

Insight Generation Jobs:

1. Retention Drop Detection (daily):
   - Compare each cohort's D7, D30 retention to configurable baseline
   - If below threshold, generate alert with:
     - Current retention vs previous cohort
     - Feature usage patterns of retained vs churned users
     - Drill-down: cohort analysis view

2. Whale Exit Detection (daily):
   - Identify top 10 wallets by 30-day volume
   - Check if any have no activity in last 7 days
   - Alert with: wallet address, historical volume, last interaction date

3. Revenue Spike/ Dip Detection (daily):
   - Calculate daily revenue (fees) for last 7 days
   - Compare to 7-day moving average
   - If change >30%, generate alert with:
     - Current revenue vs average
     - Potential causes (new feature launch, market event, competitor action)

4. Bot Surge Detection (hourly):
   - Calculate % of total activity from flagged bot wallets
   - If >20% (configurable), generate alert with:
     - Bot activity breakdown by address
     - Suggested actions (rate limiting, captcha)

5. Churn Spike Detection (weekly):
   - Calculate weekly churn rate
   - Compare to 4-week rolling average
   - If increase >20%, generate alert with:
     - Churned wallet segments
     - Last features used before churn
```

---

# PHASE 3 REQUIREMENTS (Tier 3)

## FR-24 through FR-29: Competitive Intelligence

### User Story
```
As a founder,
I want to track competitors and get alerts about their moves,
So that I can respond quickly to market opportunities and threats.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| FR-24.1 | User can add competitors by contract address | UI test |
| FR-24.2 | System auto-validates competitor contracts | RPC call test |
| FR-24.3 | System auto-suggests competitors based on category/user overlap | ML model test |
| FR-25.1 | Side-by-side competitor comparison dashboard | UI test |
| FR-25.2 | Leaderboard ranking by key metrics | Ranking query test |
| FR-26.1 | Retention surge alerts for competitors | Alert test |
| FR-26.2 | User acquisition spike alerts | Alert test |
| FR-26.3 | Feature adoption surge alerts | Alert test |
| FR-26.4 | Whale migration detection | Alert test |
| FR-27.1 | Feature gap identification | Gap analysis test |
| FR-27.2 | User overlap opportunity scoring | Scoring test |
| FR-27.3 | Market entry opportunity detection | Opportunity test |

### Test Scenarios

```javascript
// Test 1: Competitor Addition
describe('FR-24: Competitor Management', () => {
  test('User can add competitor by contract address', async () => {
    const competitor = {
      name: 'Uniswap',
      contract_address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      chain: 'ethereum',
      category: 'DEX'
    };
    
    const response = await api.post('/api/projects/1/competitors', competitor);
    
    expect(response.status).toBe(201);
    expect(response.data.validation_status).toBe('validated');
  });
  
  test('System auto-suggests competitors', async () => {
    // User's project is a DEX on Ethereum
    await createProject({ category: 'DEX', chain: 'ethereum' });
    
    // Other DEX projects exist in database
    await createCompetitor('Uniswap', 'DEX', 'ethereum');
    await createCompetitor('SushiSwap', 'DEX', 'ethereum');
    await createCompetitor('PancakeSwap', 'DEX', 'bsc'); // different chain
    
    const suggestions = await api.get('/api/projects/1/competitor-suggestions');
    
    expect(suggestions.data).toHaveLength(2);
    expect(suggestions.data[0].name).toBe('Uniswap');
    expect(suggestions.data[1].name).toBe('SushiSwap');
  });
});

// Test 2: Competitive Alerts
describe('FR-26: Competitive Alerts', () => {
  test('Detects competitor retention surge', async () => {
    // Track competitor Uniswap
    await addCompetitor('Uniswap');
    
    // Simulate retention increase from 30% to 50% in 7 days
    await setCompetitorRetention('Uniswap', '2024-01-01', 30);
    await setCompetitorRetention('Uniswap', '2024-01-08', 50);
    
    await runCompetitiveInsightEngine();
    
    const alerts = await getCompetitiveAlerts();
    const retentionAlert = alerts.find(a => a.type === 'competitor_retention_surge');
    
    expect(retentionAlert).toBeDefined();
    expect(retentionAlert.competitor).toBe('Uniswap');
    expect(retentionAlert.message).toContain('retention jumped 20%');
    expect(retentionAlert.suggested_action).toBeDefined();
  });
  
  test('Detects feature adoption surge in competitor', async () => {
    await addCompetitor('SushiSwap');
    
    // Simulate 3x increase in 'stake' function usage
    await setFunctionUsage('SushiSwap', 'stake', 100); // baseline
    await setFunctionUsage('SushiSwap', 'stake', 300); // surge
    
    await runCompetitiveInsightEngine();
    
    const alerts = await getCompetitiveAlerts();
    const featureAlert = alerts.find(a => a.type === 'feature_adoption_surge');
    
    expect(featureAlert).toBeDefined();
    expect(featureAlert.message).toContain('stake');
    expect(featureAlert.message).toContain('3x increase');
  });
});

// Test 3: Opportunity Scoring
describe('FR-27: Opportunity Scoring', () => {
  test('Identifies feature gaps vs competitors', async () => {
    // User's features: swap, addLiquidity
    await addUserFeatures(['swap', 'addLiquidity']);
    
    // Competitors have: swap, addLiquidity, stake, farm
    await addCompetitorFeatures('Uniswap', ['swap', 'addLiquidity', 'stake', 'farm']);
    await addCompetitorFeatures('SushiSwap', ['swap', 'addLiquidity', 'stake']);
    
    const gaps = await getFeatureGaps();
    
    expect(gaps).toContainEqual(expect.objectContaining({
      feature: 'stake',
      competitors_count: 2,
      adoption_rate: 45,
      opportunity_score: 85
    }));
    expect(gaps).toContainEqual(expect.objectContaining({
      feature: 'farm',
      competitors_count: 1,
      adoption_rate: 30,
      opportunity_score: 70
    }));
  });
  
  test('Calculates user overlap opportunity', async () => {
    // User's project has 1000 wallets
    // Competitor has 5000 wallets
    // Overlap: 200 wallets active on both
    
    await calculateUserOverlap('competitor_dex');
    
    const opportunity = await getUserOverlapOpportunity('competitor_dex');
    
    expect(opportunity.total_wallets).toBe(5000);
    expect(opportunity.overlap_count).toBe(200);
    expect(opportunity.available_wallets).toBe(4800);
    expect(opportunity.score).toBeGreaterThan(80); // high quality if overlap wallets have high LTV
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement competitive intelligence system.

Database Schema:
CREATE TABLE competitors (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id), -- user's project
  competitor_id UUID REFERENCES projects(id), -- competitor project
  added_by UUID REFERENCES users(id),
  custom_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE competitor_metrics (
  id UUID PRIMARY KEY,
  competitor_id UUID REFERENCES projects(id),
  metric_type VARCHAR(50) NOT NULL, -- active_wallets, retention, volume, etc.
  value DECIMAL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_id, metric_type, date)
);

CREATE TABLE competitive_alerts (
  id UUID PRIMARY KEY,
  user_project_id UUID REFERENCES projects(id),
  competitor_id UUID REFERENCES projects(id),
  alert_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  suggested_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

Opportunity Scoring Logic:
async function calculateOpportunityScores(userProjectId) {
  // Feature Gap Score
  const userFeatures = await getUserFeatures(userProjectId);
  const competitorFeatures = await getAllCompetitorFeatures(userProjectId);
  
  const missingFeatures = competitorFeatures.filter(f => !userFeatures.includes(f));
  
  for (const feature of missingFeatures) {
    const competitorsWithFeature = competitorFeatures.filter(cf => cf.feature === feature).length;
    const avgAdoption = await getAvgAdoptionAcrossCompetitors(feature);
    
    const opportunityScore = (
      (competitorsWithFeature / totalCompetitors) * 40 + // prevalence (40%)
      (avgAdoption / 100) * 60 // market demand (60%)
    );
    
    await saveOpportunity('feature_gap', {
      feature,
      competitors_with_feature: competitorsWithFeature,
      adoption_rate: avgAdoption,
      score: opportunityScore
    });
  }
  
  // User Overlap Opportunity
  const userWallets = await getUserWallets(userProjectId);
  const competitorWallets = await getCompetitorWallets(userProjectId);
  
  const overlap = userWallets.filter(w => competitorWallets.includes(w));
  const available = competitorWallets.filter(w => !userWallets.includes(w));
  
  const avgLTVOfOverlap = await getAvgLTV(overlap);
  const opportunityScore = (available.length / competitorWallets.length) * 50 + // market size
                           (avgLTVOfOverlap / 100) * 50; // wallet quality
  
  await saveOpportunity('user_overlap', {
    available_wallets: available.length,
    overlap_wallets: overlap.length,
    score: opportunityScore
  });
}
```

---

## FR-30 through FR-38: AI Growth Advisor

### User Story
```
As a founder,
I want to ask strategic questions and receive actionable advice via chat,
So that I can get expert-level guidance without hiring expensive consultants.
```

### Acceptance Criteria

| AC# | Criteria | Validation Method |
|-----|----------|-------------------|
| FR-30.1 | AI has real-time access to user's metrics | Query test |
| FR-30.2 | AI has real-time access to competitor metrics | Query test |
| FR-30.3 | AI remembers conversation context | Session test |
| FR-31.1 | Web chat interface available in dashboard | UI test |
| FR-31.2 | Email integration for daily/weekly advice | Notification test |
| FR-31.3 | Telegram/WhatsApp integration | Bot test |
| FR-33.1 | AI provides proactive growth advice | Scheduled advice test |
| FR-33.2 | AI answers user questions about performance | Q&A test |
| FR-33.3 | AI generates automated strategic briefings | Report generation test |
| FR-35.1 | AI converts advice to actionable tasks | Task creation test |
| FR-36.1 | User can configure AI communication style | Settings test |
| FR-37.1 | User can provide feedback on AI advice | Feedback tracking test |
| FR-38.1 | Data isolation between organizations | Security test |

### Test Scenarios

```javascript
// Test 1: Proactive Growth Advice
describe('FR-33: Proactive Growth Advice', () => {
  test('AI detects retention issue and suggests fix', async () => {
    // User's D7 retention is 12% (below category avg of 20%)
    await setUserRetention(12);
    await setCategoryAvgRetention('DEX', 20);
    
    // Run AI advisor daily check
    await runAIAdvisorDaily();
    
    const advice = await getLatestAdvice('retention_optimization');
    
    expect(advice.type).toBe('retention_optimization');
    expect(advice.message).toContain('12%');
    expect(advice.message).toContain('below category average');
    expect(advice.suggested_action).toContain('analyze which features correlate with retention');
    expect(advice.action_items).toBeDefined();
  });
  
  test('AI identifies feature gap opportunity', async () => {
    // User lacks staking feature
    // 3 competitors have staking with 25% adoption
    
    await AIAdvisor.analyzeFeatureGaps();
    
    const advice = await getLatestAdvice('feature_opportunity');
    
    expect(advice.message).toContain('3 competitors');
    expect(advice.message).toContain('staking');
    expect(advice.message).toContain('25% adoption');
    expect(advice.roadmap_suggestion).toBeDefined();
    expect(advice.estimated_impact).toBeDefined();
  });
});

// Test 2: Reactive Q&A
describe('FR-33: Reactive Q&A', () => {
  test('Answers performance questions', async () => {
    const question = "How are we doing on retention this month?";
    
    const response = await aiChat.sendMessage(question);
    
    expect(response).toContain('retention');
    expect(response).toContain('D7');
    expect(response).toContain('D30');
    expect(response).toContain('vs last month');
    expect(response).toContain('competitor benchmark');
  });
  
  test('Answers competitive questions', async () => {
    const question = "What are our top 3 competitors doing differently?";
    
    const response = await aiChat.sendMessage(question);
    
    expect(response).toContain('feature gaps');
    expect(response).toContain('growth rates');
    expect(response).toContain('retention differences');
    expect(response).toHaveLength(3); // top 3 insights
  });
  
  test('Handles strategic "what if" scenarios', async () => {
    const question = "What happens to our metrics if we add a 0.5% fee?";
    
    const response = await aiChat.sendMessage(question);
    
    expect(response).toContain('projected retention impact');
    expect(response).toContain('projected user acquisition impact');
    expect(response).toContain('revenue projection');
    expect(response).toContain('similar protocols');
  });
});

// Test 3: Actionable Output
describe('FR-35: Workflow Integration', () => {
  test('Creates tasks from AI advice', async () => {
    // AI generates advice about adding referral program
    await AIAdvisor.generateReferralRecommendation();
    
    const task = await getPendingTask();
    
    expect(task.title).toContain('Referral program');
    expect(task.priority).toBe('high');
    expect(task.description).toContain('competitor analysis');
    expect(task.estimated_impact).toBeDefined();
    
    // User approves
    await approveTask(task.id);
    
    // Verify task created in connected tool (Notion/Linear)
    const externalTask = await getExternalTask(task.id);
    expect(externalTask).toBeDefined();
  });
  
  test('Tracks implemented advice impact', async () => {
    // User implements referral program based on AI advice
    await markAdviceImplemented('referral_program_advice');
    
    // Wait 30 days, measure impact
    await wait(30 * 24 * 60 * 60 * 1000);
    await runImpactAnalysis();
    
    const impact = await getAdviceImpact('referral_program_advice');
    
    expect(impact.user_acquisition_increase).toBeGreaterThan(0);
    expect(impact.retention_impact).toBeDefined();
    expect(impact.roi).toBeDefined();
  });
});

// Test 4: Privacy & Security
describe('FR-38: Data Privacy', () => {
  test('Ensures data isolation between organizations', async () => {
    // User A's project
    // User B's project
    
    const userAToken = getTokenForUser('userA');
    const userBToken = getTokenForUser('userB');
    
    // AI for user A cannot access user B's data
    const userAData = await aiChat.sendMessage('What is my retention?', userAToken);
    const userBData = await aiChat.sendMessage('What is user A retention?', userBToken);
    
    expect(userAData).toContain('userA');
    expect(userBData).toContain('not have access');
  });
});
```

### Implementation Prompt for AI/Developer

```
Implement AI Growth Advisor - conversational AI agent with business advisory capabilities.

Architecture Overview:

1. AI Model Layer:
   - Use GPT-4 or Claude with function calling
   - Fine-tuned on Web3 business data (case studies, protocols, tokenomics)
   - Embeddings for semantic search of user's data and competitor data

2. Tool/Function Definitions (for AI to call):

tools = [
  {
    name: "get_user_metrics",
    description: "Get current metrics for user's project",
    parameters: {
      metric_type: ["retention", "acquisition", "revenue", "active_wallets", "churn"],
      timeframe: ["7d", "30d", "90d", "ytd"]
    }
  },
  {
    name: "get_competitor_metrics", 
    description: "Get metrics for tracked competitors",
    parameters: {
      competitor_name: "string",
      metric_type: ["retention", "acquisition", "feature_adoption", "volume"]
    }
  },
  {
    name: "analyze_feature_gaps",
    description: "Identify features competitors have that user lacks",
    parameters: {}
  },
  {
    name: "get_retention_analysis",
    description: "Deep dive into retention patterns and churn reasons",
    parameters: { cohort: "string" }
  },
  {
    name: "create_task",
    description: "Create actionable task from advice",
    parameters: {
      title: "string",
      description: "string",
      priority: "high|medium|low",
      estimated_impact: "string"
    }
  },
  {
    name: "generate_strategic_briefing",
    description: "Generate weekly/monthly strategic summary",
    parameters: { briefing_type: "weekly|monthly|board" }
  }
]

3. Proactive Advice Schedule:
   - Daily: Key metric changes, competitor movements, one actionable insight
   - Weekly: Deep dive on one strategic area, competitive landscape
   - Monthly: Board-ready summary, next quarter focus

4. Prompt Template for Proactive Advice:

You are MetaGauge AI, a Web3 growth advisor for {project_name}, a {category} protocol on {chain}.

Current Metrics:
- Active wallets (7d): {active_wallets} ({trend})
- D7 Retention: {d7_retention}% (category avg: {cat_d7}%)
- Revenue (30d): ${revenue} ({revenue_trend})
- Churn rate: {churn_rate}% ({churn_trend})

Competitor Intelligence:
{competitor_summary}

Recent Alerts:
{recent_alerts}

Based on this data, identify:
1. The most critical opportunity or risk
2. Specific, actionable recommendation
3. Expected impact if implemented
4. Any competitor moves worth responding to

Format as a concise business briefing with clear action items.

5. Q&A Context Builder:

When user asks a question, build context:
- User's project data (last 30 days)
- Relevant competitor data
- Historical conversation context (last 5 messages)
- Any ongoing alert conditions

Example Q&A Flow:
User: "Should we launch on Base or Arbitrum next?"

AI calls:
1. get_user_metrics(chain_distribution) - where users currently come from
2. get_competitor_metrics(chain_presence) - where competitors are active
3. get_chain_analytics(chain_growth) - growth rates of each L2
4. get_user_overlap(chain) - existing user overlap with each chain

Response synthesizes:
- "Based on your user base, 40% already use Arbitrum via bridges vs 15% on Base"
- "3 competitors launched on Base in last month with avg 20k new users"
- "Base gas costs are 30% lower, which aligns with your user demographic"
- "Recommendation: Launch on Arbitrum first (3 weeks), then Base (6 weeks) to capture both"

6. Memory/Persistence:
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  session_id VARCHAR(255),
  user_message TEXT,
  ai_response TEXT,
  context_used JSONB,
  feedback_score INT, -- 1-5
  feedback_text TEXT,
  implemented BOOLEAN DEFAULT false,
  impact_measured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_advice (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  advice_type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  suggested_action TEXT,
  priority VARCHAR(20),
  estimated_impact TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, implemented
  implemented_at TIMESTAMPTZ,
  impact_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# CROSS-CUTTING REQUIREMENTS

## Testing Strategy Summary

| Test Type | Coverage Target | Tools |
|-----------|-----------------|-------|
| Unit Tests | 80% | Jest, Mocha |
| Integration Tests | All ACs | Supertest, Postman |
| E2E Tests | Critical paths | Cypress, Playwright |
| Performance Tests | API < 200ms | K6, Artillery |
| Security Tests | OWASP Top 10 | OWASP ZAP, Snyk |

## Development Process Prompt Template

For each FR, provide to developers:

```
## FR-XX: [Requirement Name]

### Business Context
[Why this matters to users]

### User Story
As a [persona], I want to [action] so that [value].

### Acceptance Criteria
[List with AC-XX.X format]

### Technical Spec
- Database: [tables, indexes, relationships]
- API: [endpoints, request/response format]
- UI: [components, interactions]
- Scheduled Jobs: [if applicable, cron schedule]

### Edge Cases
[List with expected behavior]

### Test Cases
[Gherkin format or code examples]

### Example Flow
[Concrete example with data]

### Definition of Done Checklist
- [ ] Code complete with comments
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] API documentation updated
- [ ] UI reviewed
- [ ] Performance verified
- [ ] Security reviewed
- [ ] Deployed to staging
```

---

This comprehensive specification should give you everything needed to build Metagauge with clear expectations, testable criteria, and implementation guidance for each feature. Would you like me to elaborate on any specific section or create additional detail for a particular FR?