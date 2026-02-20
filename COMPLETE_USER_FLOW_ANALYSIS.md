# 🚀 Metagauge - Complete User Flow Analysis

**Status**: ✅ Frontend & Backend Working  
**Date**: February 19, 2026  
**Architecture**: Full-Stack React (Next.js) + Node.js (Express) + File-Based Storage

---

## 📋 Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [User Journey Flow](#user-journey-flow)
3. [File-by-File Breakdown](#file-by-file-breakdown)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Key Integration Points](#key-integration-points)

---

## 🏗️ System Architecture Overview

### **Technology Stack**

#### Frontend (Port 3000)
- **Framework**: Next.js 16 with TypeScript
- **UI Library**: React with shadcn/ui components
- **Styling**: Tailwind CSS
- **State Management**: React Context (Auth) + Local State
- **HTTP Client**: Native Fetch with retry logic
- **Real-time**: WebSocket client for live updates

#### Backend (Port 5000)
- **Framework**: Express.js (Node.js)
- **Authentication**: JWT tokens (7-day expiry)
- **Storage**: File-based JSON (no database required)
- **Real-time**: WebSocket Server for progress updates
- **Blockchain**: Multi-chain RPC clients (Ethereum, Lisk, Starknet)
- **AI**: Google Gemini AI integration

#### Storage Structure
```
data/
├── users.json          # User accounts and profiles
├── contracts.json      # Contract configurations
├── analyses.json       # Analysis results and history
└── chat/              # Chat sessions and messages
```

---

## 👤 User Journey Flow

### **Phase 1: Landing & Authentication**

#### Step 1.1: Landing Page
**File**: `frontend/app/page.tsx`

```typescript
User visits http://localhost:3000
↓
AuthProvider checks authentication status
↓
If authenticated → Redirect to /dashboard
If not authenticated → Show landing page
```

**Components Involved**:
- `Header` - Navigation with Login/Signup buttons
- `HeroSection` - Main value proposition
- `RolesSection` - Feature showcase
- `Footer` - Links and information

**Key Logic**:
```typescript
useEffect(() => {
  if (!isLoading && isAuthenticated) {
    router.push('/dashboard')
  }
}, [isAuthenticated, isLoading, router])
```

---

#### Step 1.2: User Registration
**Frontend**: `frontend/app/signup/page.tsx`  
**Backend**: `src/api/routes/auth.js` → `/api/auth/register`

**Flow**:
```
User fills form (name, email, password)
↓
Frontend validates (password ≥ 6 chars)
↓
POST /api/auth/register
↓
Backend validates & checks existing user
↓
Hash password (bcrypt, 6 rounds)
↓
Create user record in users.json
↓
Generate JWT token
↓
Return token + user data
↓
Frontend stores token in localStorage
↓
Auto-login via AuthProvider
↓
Redirect to /analyzer
```

**User Data Structure**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "password": "hashed_password",
  "name": "User Name",
  "tier": "free",
  "apiKey": "random_hex_32_bytes",
  "isActive": true,
  "emailVerified": false,
  "usage": {
    "analysisCount": 0,
    "monthlyAnalysisCount": 0,
    "lastAnalysis": null,
    "monthlyResetDate": "2026-02-19T10:34:40.832Z"
  },
  "onboarding": {
    "completed": false,
    "socialLinks": {},
    "logo": null,
    "defaultContract": {
      "address": null,
      "chain": null,
      "abi": null,
      "name": null,
      "purpose": null,
      "category": null,
      "startDate": null,
      "isIndexed": false,
      "indexingProgress": 0,
      "lastAnalysisId": null
    }
  },
  "preferences": {
    "notifications": { "email": true, "analysis": true },
    "defaultChain": "ethereum"
  },
  "createdAt": "2026-02-19T10:34:40.832Z",
  "updatedAt": "2026-02-19T10:34:40.832Z"
}
```

---

#### Step 1.3: User Login
**Frontend**: `frontend/app/login/page.tsx`  
**Backend**: `src/api/routes/auth.js` → `/api/auth/login`

**Flow**:
```
User enters email & password
↓
POST /api/auth/login
↓
Backend finds user by email
↓
Compare password with bcrypt
↓
Generate new JWT token
↓
Return token + user data
↓
Frontend stores in localStorage
↓
AuthProvider updates context
↓
Redirect to /dashboard or intended page
```

---

#### Step 1.4: Authentication Middleware
**File**: `src/api/middleware/auth.js`

**JWT Token Structure**:
```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "tier": "free",
  "iat": 1708340080,
  "exp": 1708944880
}
```

**Middleware Flow**:
```
Request arrives with Authorization header
↓
Extract token from "Bearer <token>"
↓
Verify JWT signature & expiry
↓
Decode payload → get userId
↓
Load user from users.json
↓
Check user.isActive === true
↓
Attach user to req.user (without password)
↓
Call next() to continue
```

**Protected Routes**: All routes except:
- `/api/auth/register`
- `/api/auth/login`

---

### **Phase 2: Onboarding**

#### Step 2.1: Onboarding Check
**Frontend**: `frontend/app/dashboard/page.tsx`  
**Backend**: `src/api/routes/onboarding.js` → `/api/onboarding/status`

**Flow**:
```
User lands on /dashboard
↓
GET /api/onboarding/status
↓
Backend checks user.onboarding.completed
↓
If false → Redirect to /onboarding
If true → Load dashboard data
```

---

#### Step 2.2: Onboarding Form (3 Steps)
**Frontend**: `frontend/app/onboarding/page.tsx`  
**Backend**: `src/api/routes/onboarding.js` → `/api/onboarding/complete`

**Step 1: Project Information**
- Website URL (optional)
- Twitter handle (optional)
- Discord server (optional)
- Telegram group (optional)
- Logo upload (optional)

**Step 2: Contract Details**
- Contract Address (required)
- Blockchain Chain (required: ethereum/lisk/starknet)
- Contract Name (required, min 2 chars)
- ABI (optional - auto-fetched if not provided)
- Purpose (required, min 10 chars)
- Category (required: defi/nft/gaming/dao/infrastructure/other)
- Start Date (optional - for user reference)

**Step 3: Review & Submit**
- Display all entered information
- Confirm and submit

**Submission Flow**:
```
User submits onboarding form
↓
POST /api/onboarding/complete
↓
Backend validates all required fields
↓
Update user.onboarding in users.json
↓
Mark old contracts as NOT default
↓
Mark old analyses as NOT default
↓
Create new contract config in contracts.json
↓
Respond immediately to frontend
↓
Frontend redirects to /dashboard
↓
Backend starts background indexing (async)
```

---

#### Step 2.3: Background Indexing Process
**File**: `src/api/routes/trigger-indexing.js` → `triggerDefaultContractIndexing()`

**Indexing Flow**:
```
Background process starts (setImmediate)
↓
Fetch user's subscription tier from blockchain
↓
Determine transaction limits based on tier:
  - free: 100 transactions, 10k blocks
  - starter: 500 transactions, 50k blocks
  - pro: 2000 transactions, 200k blocks
  - enterprise: 10000 transactions, 500k blocks
↓
Initialize RPC client for target chain
↓
Get current block number
↓
Calculate start block (current - blockRange)
↓
Create analysis record in analyses.json
↓
Update progress: 10% - "Initializing..."
↓
Fetch transactions from blockchain
↓
Update progress: 50% - "Processing data..."
↓
Calculate metrics (TVL, volume, users, etc.)
↓
Update progress: 80% - "Calculating metrics..."
↓
Store results in analysis record
↓
Update progress: 100% - "Complete"
↓
Update user.onboarding.defaultContract.isIndexed = true
↓
Update user.onboarding.defaultContract.lastAnalysisId
```

**Progress Updates via WebSocket**:
```javascript
// Backend sends
wsManager.sendToUser(userId, {
  type: 'indexing-progress',
  progress: 50,
  message: 'Processing transaction data...'
})

// Frontend receives
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'indexing-progress') {
    updateProgressBar(data.progress)
  }
}
```

---

### **Phase 3: Dashboard**

#### Step 3.1: Dashboard Data Loading
**Frontend**: `frontend/app/dashboard/page.tsx`  
**Backend**: `src/api/routes/onboarding.js` → `/api/onboarding/default-contract`

**Flow**:
```
User lands on /dashboard
↓
Check onboarding status
↓
If not completed → Redirect to /onboarding
↓
Load default contract data
↓
GET /api/onboarding/default-contract
↓
Backend finds user's default contract
↓
Find all analyses for this contract
↓
Get most recent completed analysis
↓
Extract metrics from analysis results
↓
Return contract info + metrics + full results
↓
Frontend displays in dashboard tabs
```

**Dashboard Tabs**:
1. **Overview** - Summary metrics, AI insights, quick stats
2. **Metrics** - DeFi ratios, TVL, volume, liquidity
3. **Users** - User behavior, engagement, retention
4. **Transactions** - Transaction list with pagination
5. **UX** - User experience analysis, bottlenecks

---

#### Step 3.2: Real-time Progress Monitoring
**Frontend**: `frontend/app/dashboard/page.tsx`

**Polling Logic**:
```typescript
useEffect(() => {
  if (!defaultContract || defaultContract.indexingStatus.isIndexed) {
    return // Don't poll if already indexed
  }

  const pollInterval = setInterval(async () => {
    await loadDefaultContractData()
  }, 5000) // Poll every 5 seconds

  return () => clearInterval(pollInterval)
}, [defaultContract?.indexingStatus.isIndexed])
```

**Progress Display**:
```tsx
{!defaultContract.indexingStatus.isIndexed && (
  <Card>
    <CardHeader>
      <CardTitle>Indexing in Progress</CardTitle>
    </CardHeader>
    <CardContent>
      <Progress value={defaultContract.indexingStatus.progress} />
      <p>{defaultContract.indexingStatus.progress}% complete</p>
    </CardContent>
  </Card>
)}
```

---

#### Step 3.3: Subscription Management
**Frontend**: `frontend/app/subscription/page.tsx`  
**Backend**: `src/api/routes/subscription.js`

**Subscription Tiers**:
```javascript
const TIERS = {
  free: {
    name: 'Free',
    price: 0,
    analyses: 10,
    historicalDays: 7,
    continuousSync: false
  },
  starter: {
    name: 'Starter',
    price: 29,
    analyses: 100,
    historicalDays: 30,
    continuousSync: false
  },
  pro: {
    name: 'Pro',
    price: 99,
    analyses: 1000,
    historicalDays: 90,
    continuousSync: true
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    analyses: 'unlimited',
    historicalDays: 365,
    continuousSync: true
  }
}
```

**Subscription Flow**:
```
User connects wallet (Web3)
↓
Frontend calls SubscriptionService.getSubscriptionInfo(walletAddress)
↓
Backend queries blockchain subscription contract
↓
Return tier info + expiry date
↓
Update user.tier in users.json
↓
Display subscription status in UI
```

---

### **Phase 4: Analysis & Insights**

#### Step 4.1: Manual Analysis Trigger
**Frontend**: `frontend/app/analyzer/page.tsx`  
**Backend**: `src/api/routes/analysis.js` → `/api/analysis/start`

**Flow**:
```
User clicks "New Analysis" button
↓
Navigate to /analyzer
↓
User configures analysis:
  - Contract address
  - Chain selection
  - Block range (optional)
  - Competitors (optional)
↓
POST /api/analysis/start
↓
Backend creates analysis record
↓
Start async analysis process
↓
Return analysis ID
↓
Frontend polls for progress
↓
GET /api/analysis/:id/status
↓
Display progress bar
↓
When complete, show results
```

---

#### Step 4.2: AI-Powered Insights
**Backend**: `src/services/GeminiAIService.js`

**AI Features**:
1. **Quick Insights** - Performance scoring (0-100)
2. **SWOT Analysis** - Strengths, Weaknesses, Opportunities, Threats
3. **Real-time Alerts** - Security, performance, anomaly detection
4. **Market Sentiment** - Competitive positioning
5. **Optimization Suggestions** - Gas efficiency, performance tips

**AI Request Flow**:
```
User requests AI insights
↓
POST /api/analysis/:id/interpret
↓
Backend loads analysis results
↓
Format data for Gemini AI
↓
Send prompt to Gemini API
↓
Parse AI response
↓
Store insights in analysis record
↓
Return formatted insights
↓
Frontend displays in dashboard
```

**Rate Limiting**:
- Free tier: 10 AI requests per 15 minutes
- Pro tier: 50 AI requests per 15 minutes
- Enterprise: 200 AI requests per 15 minutes

---

#### Step 4.3: Continuous Monitoring
**Backend**: `src/services/ContinuousMonitoringService.js`

**Continuous Sync Flow** (Pro/Enterprise only):
```
User enables continuous monitoring
↓
Backend starts monitoring service
↓
Every 5 minutes:
  - Fetch new blocks
  - Extract new transactions
  - Update metrics
  - Send WebSocket updates
↓
Store incremental data
↓
Update dashboard in real-time
```

---

### **Phase 5: History & Reports**

#### Step 5.1: Analysis History
**Frontend**: `frontend/app/history/page.tsx`  
**Backend**: `src/api/routes/analysis.js` → `/api/analysis/history`

**Flow**:
```
User navigates to /history
↓
GET /api/analysis/history
↓
Backend finds all analyses for user
↓
Sort by createdAt (newest first)
↓
Return paginated list
↓
Frontend displays in table:
  - Contract name
  - Chain
  - Status
  - Created date
  - Actions (View, Delete)
```

---

#### Step 5.2: Report Generation
**Backend**: `src/services/ReportGenerator.js`

**Report Formats**:
1. **JSON** - Structured data for API consumption
2. **CSV** - Spreadsheet format for Excel
3. **Markdown** - Executive summary report

**Report Structure**:
```
reports/
├── {contract-name}/
│   └── {chain}/
│       ├── analysis_{timestamp}.json
│       ├── analysis_{timestamp}.csv
│       ├── analysis_{timestamp}.md
│       └── README.md
```

---

### **Phase 6: Chat & Support**

#### Step 6.1: AI Chat Assistant
**Frontend**: `frontend/app/chat/page.tsx`  
**Backend**: `src/api/routes/chat.js`

**Chat Flow**:
```
User opens chat interface
↓
Create or load chat session
↓
User sends message
↓
POST /api/chat/message
↓
Backend processes with ChatAIService
↓
Query analysis data for context
↓
Send to Gemini AI with context
↓
Stream response back to frontend
↓
Store message in chat history
```

**Chat Features**:
- Context-aware responses
- Analysis data integration
- Code examples
- Best practices recommendations

---

## 📁 File-by-File Breakdown

### **Frontend Files**

#### Core Application Files

**`frontend/app/layout.tsx`**
- Root layout component
- Wraps entire app with AuthProvider
- Provides theme and global styles
- Manages metadata and fonts

**`frontend/app/page.tsx`**
- Landing page component
- Checks authentication status
- Redirects authenticated users to dashboard
- Shows hero section for non-authenticated users

**`frontend/app/globals.css`**
- Global CSS styles
- Tailwind CSS imports
- Custom CSS variables for theming
- Responsive design utilities

---

#### Authentication Pages

**`frontend/app/signup/page.tsx`**
- User registration form
- Fields: name, email, password
- Client-side validation
- Calls `api.auth.register()`
- Auto-login after successful registration
- Redirects to /analyzer

**`frontend/app/login/page.tsx`**
- User login form
- Fields: email, password
- Calls `api.auth.login()`
- Stores token in localStorage
- Redirects to dashboard or intended page

**`frontend/components/auth/auth-provider.tsx`**
- React Context for authentication
- Manages user state and token
- Provides login/logout functions
- Handles protected route logic
- Persists auth state in localStorage

---

#### Onboarding Flow

**`frontend/app/onboarding/page.tsx`**
- 3-step onboarding wizard
- Step 1: Project information (social links, logo)
- Step 2: Contract details (address, chain, name, etc.)
- Step 3: Review and submit
- Form validation with Zod schema
- Calls `api.onboarding.complete()`
- Redirects to dashboard after submission

---

#### Dashboard & Analytics

**`frontend/app/dashboard/page.tsx`**
- Main dashboard view
- Checks onboarding status
- Loads default contract data
- Displays 5 tabs: Overview, Metrics, Users, Transactions, UX
- Real-time progress polling during indexing
- Subscription status display
- Quick actions (New Analysis)

**`frontend/components/analyzer/overview-tab.tsx`**
- Summary metrics display
- AI insights section
- Quick stats cards
- Performance indicators

**`frontend/components/analyzer/metrics-tab.tsx`**
- DeFi metrics (TVL, volume, liquidity)
- Financial ratios
- Gas efficiency metrics
- Charts and visualizations

**`frontend/components/analyzer/users-tab.tsx`**
- User behavior analysis
- Engagement metrics
- Retention rates
- User lifecycle stages
- Top users list

**`frontend/components/analyzer/transactions-tab.tsx`**
- Transaction list with pagination
- Transaction details
- Filtering and sorting
- Export functionality

**`frontend/components/analyzer/ux-tab.tsx`**
- User experience analysis
- Bottleneck detection
- Journey mapping
- Optimization suggestions

---

#### Analysis & History

**`frontend/app/analyzer/page.tsx`**
- Manual analysis configuration
- Contract address input
- Chain selection
- Block range configuration
- Competitor analysis setup
- Triggers new analysis

**`frontend/app/history/page.tsx`**
- Analysis history list
- Paginated table view
- Status indicators
- View/Delete actions
- Filter by status/chain

---

#### Subscription & Profile

**`frontend/app/subscription/page.tsx`**
- Subscription tier display
- Wallet connection
- Tier comparison table
- Upgrade/downgrade options
- Usage statistics

**`frontend/app/profile/page.tsx`**
- User profile information
- Account settings
- API key management
- Notification preferences
- Usage statistics

---

#### Chat Interface

**`frontend/app/chat/page.tsx`**
- AI chat assistant interface
- Message history
- Context-aware responses
- Code examples
- Analysis data integration

---

#### API Client & Utilities

**`frontend/lib/api.ts`**
- Centralized API client
- HTTP request wrapper with retry logic
- Token management
- Error handling
- Timeout configuration
- All API endpoints organized by feature:
  - `api.auth.*` - Authentication
  - `api.onboarding.*` - Onboarding
  - `api.analysis.*` - Analysis
  - `api.contracts.*` - Contracts
  - `api.chat.*` - Chat
  - `api.subscription.*` - Subscription

**Key Features**:
```typescript
// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelay: 1000,
  maxDelay: 5000,
  timeout: 60000
}

// Automatic token injection
const apiRequest = async (endpoint, options) => {
  const token = getAuthToken()
  headers.Authorization = `Bearer ${token}`
  // ... retry logic
}
```

**`frontend/lib/web3-config.ts`**
- Web3 wallet configuration
- Chain configurations
- Contract ABIs
- RPC endpoints

**`frontend/lib/validation.ts`**
- Form validation utilities
- Zod schemas
- Custom validators

---

### **Backend Files**

#### Server & Configuration

**`src/api/server.js`**
- Express.js server setup
- CORS configuration
- Rate limiting
- WebSocket server initialization
- Route mounting
- Middleware setup
- Error handling
- Health checks

**Server Initialization**:
```javascript
const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Middleware
app.use(cors())
app.use(express.json())
app.use(requestLogger)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/contracts', authenticateToken, contractRoutes)
app.use('/api/analysis', authenticateToken, analysisRoutes)
// ... more routes

// Error handler
app.use(errorHandler)

server.listen(PORT)
```

**`src/config/env.js`**
- Environment variable management
- Configuration validation
- Default values
- Chain-specific settings

---

#### Authentication Routes

**`src/api/routes/auth.js`**
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- GET `/api/auth/me` - Get current user
- POST `/api/auth/refresh-api-key` - Generate new API key
- POST `/api/auth/forgot-password` - Password reset
- POST `/api/auth/reset-password` - Reset password

**Registration Flow**:
```javascript
router.post('/register', async (req, res) => {
  // Validate input
  // Check existing user
  // Hash password (bcrypt, 6 rounds)
  // Create user in users.json
  // Generate JWT token
  // Return token + user data
})
```

**`src/api/middleware/auth.js`**
- `generateToken(user)` - Create JWT token
- `verifyToken(token)` - Validate JWT token
- `authenticateToken(req, res, next)` - Middleware for protected routes
- `authenticateApiKey(req, res, next)` - API key authentication

---

#### Onboarding Routes

**`src/api/routes/onboarding.js`**
- GET `/api/onboarding/status` - Get onboarding status
- POST `/api/onboarding/complete` - Complete onboarding
- GET `/api/onboarding/default-contract` - Get default contract data
- GET `/api/onboarding/user-metrics` - Get user metrics

**Onboarding Complete Flow**:
```javascript
router.post('/complete', async (req, res) => {
  // Validate contract details
  // Update user.onboarding in users.json
  // Mark old contracts as NOT default
  // Create new contract config
  // Respond immediately
  // Start background indexing (async)
})
```

---

#### Analysis Routes

**`src/api/routes/analysis.js`**
- POST `/api/analysis/start` - Start new analysis
- GET `/api/analysis/:id/status` - Get analysis status
- GET `/api/analysis/:id/results` - Get analysis results
- GET `/api/analysis/history` - Get analysis history
- DELETE `/api/analysis/:id` - Delete analysis
- POST `/api/analysis/:id/interpret` - AI interpretation
- GET `/api/analysis/:id/quick-insights` - Quick AI insights
- POST `/api/analysis/:id/alerts` - Real-time alerts
- POST `/api/analysis/:id/sentiment` - Market sentiment
- POST `/api/analysis/:id/optimizations` - Optimization suggestions

---

#### Contract Routes

**`src/api/routes/contracts.js`**
- GET `/api/contracts` - List user contracts
- POST `/api/contracts` - Create contract config
- GET `/api/contracts/:id` - Get contract details
- PUT `/api/contracts/:id` - Update contract
- DELETE `/api/contracts/:id` - Delete contract
- POST `/api/contracts/:id/validate` - Validate contract address

---

#### Indexing & Monitoring

**`src/api/routes/trigger-indexing.js`**
- `triggerDefaultContractIndexing(req, res)` - Manual indexing trigger
- Fetches subscription tier
- Determines transaction limits
- Initializes RPC client
- Fetches blockchain data
- Calculates metrics
- Updates progress
- Stores results

**`src/api/routes/monitoring.js`**
- POST `/api/monitoring/start` - Start continuous monitoring
- POST `/api/monitoring/stop` - Stop continuous monitoring
- GET `/api/monitoring/status` - Get monitoring status

**`src/services/ContinuousMonitoringService.js`**
- Continuous blockchain monitoring
- Incremental data fetching
- Real-time metric updates
- WebSocket notifications
- Automatic error recovery

---

#### Blockchain Services

**`src/services/SmartContractFetcher.js`**
- Multi-provider RPC management
- Automatic failover
- Transaction fetching
- Event log parsing
- Block range optimization

**`src/services/LiskRpcClient.js`**
- Lisk-specific RPC client
- Enhanced error handling
- Rate limiting
- Retry logic
- Health monitoring

**`src/services/EthereumRpcClient.js`**
- Ethereum RPC client
- EVM-compatible chains
- Transaction normalization
- Gas estimation

**`src/services/StarknetRpcClient.js`**
- Starknet-specific client
- Transaction handling
- Event parsing
- Cairo contract support

---

#### AI Services

**`src/services/GeminiAIService.js`**
- Google Gemini AI integration
- Prompt engineering
- Response parsing
- Rate limiting
- Error handling
- Context management

**AI Methods**:
```javascript
class GeminiAIService {
  async interpretAnalysis(analysisData)
  async generateQuickInsights(metrics)
  async generateAlerts(analysisData)
  async analyzeSentiment(competitiveData)
  async suggestOptimizations(performanceData)
  async generateRecommendations(fullAnalysis)
}
```

---

#### Analytics Services

**`src/services/EnhancedAnalyticsEngine.js`**
- Core analytics engine
- Metric calculations
- Data aggregation
- Statistical analysis

**`src/services/UserBehaviorAnalyzer.js`**
- User behavior patterns
- Engagement scoring
- Retention analysis
- Cohort analysis

**`src/services/DeFiMetricsCalculator.js`**
- TVL calculation
- Volume metrics
- Liquidity ratios
- APY/APR calculations

**`src/services/GasEfficiencyAnalyzer.js`**
- Gas usage analysis
- Optimization suggestions
- Cost calculations
- Efficiency scoring

---

#### Storage & Database

**`src/api/database/index.js`**
- Database abstraction layer
- Supports file-based and PostgreSQL
- Auto-detection based on DATABASE_TYPE env var

**`src/api/database/fileStorage.js`**
- File-based JSON storage
- CRUD operations for:
  - Users
  - Contracts
  - Analyses
- Atomic writes with backups
- Auto-incrementing IDs

**Storage Methods**:
```javascript
class UserStorage {
  static async create(userData)
  static async findById(id)
  static async findByEmail(email)
  static async update(id, updates)
  static async delete(id)
  static async findAll()
}
```

---

## 🔄 Data Flow Diagrams

### **Complete User Journey - Visual Flow**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY START                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   Landing Page (/)      │
                    │   frontend/app/page.tsx │
                    └─────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │  Not Authenticated│       │   Authenticated   │
        │  Show Landing     │       │   Redirect to     │
        │  Page             │       │   /dashboard      │
        └───────────────────┘       └───────────────────┘
                    │
                    ▼
        ┌───────────────────┐
        │  User Clicks      │
        │  "Sign Up"        │
        └───────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │  Signup Page (/signup)                │
        │  frontend/app/signup/page.tsx         │
        │  ─────────────────────────────────    │
        │  Form Fields:                         │
        │  • Name                               │
        │  • Email                              │
        │  • Password (min 6 chars)             │
        └───────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │  POST /api/auth/register              │
        │  src/api/routes/auth.js               │
        │  ─────────────────────────────────    │
        │  1. Validate input                    │
        │  2. Check existing user               │
        │  3. Hash password (bcrypt)            │
        │  4. Create user in users.json         │
        │  5. Generate JWT token                │
        │  6. Return token + user data          │
        └───────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │  Frontend Receives Response           │
        │  ─────────────────────────────────    │
        │  1. Store token in localStorage       │
        │  2. Update AuthProvider context       │
        │  3. Auto-login user                   │
        │  4. Redirect to /analyzer             │
        └───────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │  Dashboard Check (/dashboard)         │
        │  frontend/app/dashboard/page.tsx      │
        │  ─────────────────────────────────    │
        │  GET /api/onboarding/status           │
        └───────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌─────────────────┐   ┌─────────────────┐
│ Not Completed   │   │   Completed     │
│ Redirect to     │   │   Load          │
│ /onboarding     │   │   Dashboard     │
└─────────────────┘   └─────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│  Onboarding Page (/onboarding)                │
│  frontend/app/onboarding/page.tsx             │
│  ───────────────────────────────────────────  │
│  Step 1: Project Info                         │
│  • Website, Twitter, Discord, Telegram        │
│  • Logo upload                                │
│                                               │
│  Step 2: Contract Details                     │
│  • Contract Address (required)                │
│  • Chain (ethereum/lisk/starknet)             │
│  • Contract Name (required)                   │
│  • ABI (optional)                             │
│  • Purpose (required)                         │
│  • Category (defi/nft/gaming/dao/etc)         │
│  • Start Date (optional)                      │
│                                               │
│  Step 3: Review & Submit                      │
└───────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  POST /api/onboarding/complete               │
│  src/api/routes/onboarding.js                │
│  ───────────────────────────────────────────  │
│  1. Validate all fields                       │
│  2. Update user.onboarding in users.json      │
│  3. Mark old contracts as NOT default         │
│  4. Create new contract config                │
│  5. Respond immediately to frontend           │
│  6. Start background indexing (async)         │
└───────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌─────────────────┐   ┌─────────────────────────┐
│ Frontend        │   │ Background Process      │
│ Redirects to    │   │ (setImmediate)          │
│ /dashboard      │   │                         │
└─────────────────┘   └─────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Indexing Process           │
                    │  trigger-indexing.js        │
                    │  ─────────────────────────  │
                    │  1. Fetch subscription tier │
                    │  2. Determine limits        │
                    │  3. Init RPC client         │
                    │  4. Get current block       │
                    │  5. Calculate block range   │
                    │  6. Create analysis record  │
                    │  7. Fetch transactions      │
                    │  8. Calculate metrics       │
                    │  9. Store results           │
                    │  10. Update user record     │
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Progress Updates           │
                    │  (WebSocket)                │
                    │  ─────────────────────────  │
                    │  10% - Initializing...      │
                    │  20% - Fetching txs...      │
                    │  50% - Processing data...   │
                    │  80% - Calculating metrics..│
                    │  100% - Complete!           │
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Dashboard Displays Data    │
                    │  frontend/app/dashboard/    │
                    │  ─────────────────────────  │
                    │  • Overview Tab             │
                    │  • Metrics Tab              │
                    │  • Users Tab                │
                    │  • Transactions Tab         │
                    │  • UX Tab                   │
                    └─────────────────────────────┘
```

---

### **Authentication Flow - Detailed**

```
┌──────────────┐
│   Browser    │
└──────────────┘
       │
       │ 1. User enters credentials
       ▼
┌──────────────────────────────────┐
│  Frontend (login/page.tsx)       │
│  ──────────────────────────────  │
│  • Validate form                 │
│  • POST /api/auth/login          │
└──────────────────────────────────┘
       │
       │ 2. HTTP Request with credentials
       ▼
┌──────────────────────────────────┐
│  Backend (auth.js)               │
│  ──────────────────────────────  │
│  • Find user by email            │
│  • Compare password (bcrypt)     │
│  • Generate JWT token            │
│  • Return token + user data      │
└──────────────────────────────────┘
       │
       │ 3. Response with token
       ▼
┌──────────────────────────────────┐
│  Frontend (api.ts)               │
│  ──────────────────────────────  │
│  • Store token in localStorage   │
│  • Update AuthProvider context   │
└──────────────────────────────────┘
       │
       │ 4. Subsequent requests
       ▼
┌──────────────────────────────────┐
│  API Request with Auth Header    │
│  ──────────────────────────────  │
│  Authorization: Bearer <token>   │
└──────────────────────────────────┘
       │
       │ 5. Token validation
       ▼
┌──────────────────────────────────┐
│  Middleware (auth.js)            │
│  ──────────────────────────────  │
│  • Extract token from header     │
│  • Verify JWT signature          │
│  • Decode payload                │
│  • Load user from storage        │
│  • Attach user to req.user       │
│  • Call next()                   │
└──────────────────────────────────┘
       │
       │ 6. Protected route access
       ▼
┌──────────────────────────────────┐
│  Route Handler                   │
│  ──────────────────────────────  │
│  • Access req.user               │
│  • Process request               │
│  • Return response               │
└──────────────────────────────────┘
```

---

### **Indexing Flow - Detailed**

```
┌─────────────────────────────────────────────────────────┐
│  Trigger: User completes onboarding                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Background Process Starts          │
        │  (setImmediate in onboarding.js)    │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Fetch Subscription Tier            │
        │  ─────────────────────────────────  │
        │  • Query blockchain contract        │
        │  • Get tier (free/starter/pro/ent)  │
        │  • Update user.tier in storage      │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Determine Limits                   │
        │  ─────────────────────────────────  │
        │  Free: 100 txs, 10k blocks          │
        │  Starter: 500 txs, 50k blocks       │
        │  Pro: 2000 txs, 200k blocks         │
        │  Enterprise: 10k txs, 500k blocks   │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Initialize RPC Client              │
        │  ─────────────────────────────────  │
        │  • Select chain (eth/lisk/starknet) │
        │  • Load RPC URLs from env           │
        │  • Create client with failover      │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Get Current Block Number           │
        │  ─────────────────────────────────  │
        │  • Query blockchain                 │
        │  • Handle RPC errors                │
        │  • Retry with failover              │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Calculate Block Range              │
        │  ─────────────────────────────────  │
        │  startBlock = current - blockRange  │
        │  endBlock = current                 │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Create Analysis Record             │
        │  ─────────────────────────────────  │
        │  • Store in analyses.json           │
        │  • Status: 'running'                │
        │  • Progress: 0                      │
        │  • metadata.isDefaultContract: true │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Update Progress: 10%               │
        │  "Initializing connection..."       │
        │  ─────────────────────────────────  │
        │  • Update analysis record           │
        │  • Send WebSocket notification      │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Fetch Transactions                 │
        │  ─────────────────────────────────  │
        │  • Query blockchain in chunks       │
        │  • Filter by contract address       │
        │  • Parse transaction data           │
        │  • Handle pagination                │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Update Progress: 50%               │
        │  "Processing transaction data..."   │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Calculate Metrics                  │
        │  ─────────────────────────────────  │
        │  • Total transactions               │
        │  • Unique users                     │
        │  • Total volume                     │
        │  • TVL (if applicable)              │
        │  • Gas metrics                      │
        │  • User behavior patterns           │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Update Progress: 80%               │
        │  "Calculating analytics metrics..." │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Store Results                      │
        │  ─────────────────────────────────  │
        │  • Update analysis record           │
        │  • Store full results               │
        │  • Store transaction list           │
        │  • Store calculated metrics         │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Update Progress: 100%              │
        │  "Complete!"                        │
        │  ─────────────────────────────────  │
        │  • Status: 'completed'              │
        │  • completedAt: timestamp           │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Update User Record                 │
        │  ─────────────────────────────────  │
        │  • isIndexed: true                  │
        │  • indexingProgress: 100            │
        │  • lastAnalysisId: analysis.id      │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Dashboard Displays Results         │
        │  ─────────────────────────────────  │
        │  • Frontend polls for updates       │
        │  • Detects completion               │
        │  • Loads full results               │
        │  • Displays in tabs                 │
        └─────────────────────────────────────┘
```

---

### **WebSocket Communication Flow**

```
┌──────────────┐                    ┌──────────────┐
│   Frontend   │                    │   Backend    │
│   (Browser)  │                    │   (Server)   │
└──────────────┘                    └──────────────┘
       │                                    │
       │ 1. Connect to ws://localhost:5000/ws
       │────────────────────────────────────>│
       │                                    │
       │ 2. Connection established          │
       │<────────────────────────────────────│
       │                                    │
       │ 3. Register user                   │
       │ { type: 'register', userId: '...' }│
       │────────────────────────────────────>│
       │                                    │
       │                                    │ 4. Store connection
       │                                    │    wsManager.registerClient()
       │                                    │
       │                                    │ 5. Indexing starts
       │                                    │    (background process)
       │                                    │
       │ 6. Progress update                 │
       │ { type: 'indexing-progress',       │
       │   progress: 10,                    │
       │   message: 'Initializing...' }     │
       │<────────────────────────────────────│
       │                                    │
       │ 7. Update UI                       │
       │    (progress bar)                  │
       │                                    │
       │ 8. Progress update                 │
       │ { type: 'indexing-progress',       │
       │   progress: 50,                    │
       │   message: 'Processing...' }       │
       │<────────────────────────────────────│
       │                                    │
       │ 9. Progress update                 │
       │ { type: 'indexing-progress',       │
       │   progress: 100,                   │
       │   message: 'Complete!' }           │
       │<────────────────────────────────────│
       │                                    │
       │ 10. Reload dashboard data          │
       │     GET /api/onboarding/default-contract
       │────────────────────────────────────>│
       │                                    │
       │ 11. Return full results            │
       │<────────────────────────────────────│
       │                                    │
       │ 12. Display in dashboard           │
       │                                    │
```

---

## 🔗 Key Integration Points

### **1. Frontend ↔ Backend Communication**

**API Client**: `frontend/lib/api.ts`
- Base URL: `http://localhost:5000`
- Authentication: JWT Bearer tokens
- Retry logic: 2 retries with exponential backoff
- Timeout: 60 seconds

### **2. Authentication Flow**

**Token Storage**: `localStorage.token`
**Token Format**: JWT with 7-day expiry
**Protected Routes**: All except `/`, `/login`, `/signup`, `/verify`

### **3. Real-time Updates**

**WebSocket**: `ws://localhost:5000/ws`
**Events**: 
- `indexing-progress` - Progress updates during indexing
- `analysis-complete` - Analysis completion notification
- `error` - Error notifications

### **4. Data Storage**

**Location**: `data/` directory
**Files**:
- `users.json` - User accounts
- `contracts.json` - Contract configurations
- `analyses.json` - Analysis results

**Backup Strategy**: `.backup` files created on each write

### **5. Blockchain Integration**

**RPC Clients**:
- Ethereum: `EthereumRpcClient.js`
- Lisk: `LiskRpcClient.js`
- Starknet: `StarknetRpcClient.js`

**Failover**: Automatic switching between multiple RPC endpoints

### **6. AI Integration**

**Service**: Google Gemini AI
**API Key**: `process.env.GEMINI_API_KEY`
**Rate Limits**: Tier-based (10-200 requests per 15 min)

---

## 📊 Summary

### **Working Features**
✅ User registration and authentication
✅ JWT-based session management
✅ 3-step onboarding wizard
✅ Automatic background indexing
✅ Real-time progress updates via WebSocket
✅ Multi-chain support (Ethereum, Lisk, Starknet)
✅ Subscription tier management
✅ Dashboard with 5 analytics tabs
✅ AI-powered insights
✅ Analysis history
✅ File-based storage (no database required)

### **User Flow Summary**
1. **Landing** → User visits homepage
2. **Signup** → Create account with email/password
3. **Onboarding** → Configure default contract (3 steps)
4. **Indexing** → Automatic background blockchain data fetch
5. **Dashboard** → View analytics in 5 tabs
6. **Analysis** → Run additional analyses as needed
7. **History** → View past analyses

### **Key Files to Remember**
- **Frontend Entry**: `frontend/app/page.tsx`
- **Backend Entry**: `src/api/server.js`
- **Auth Provider**: `frontend/components/auth/auth-provider.tsx`
- **API Client**: `frontend/lib/api.ts`
- **Onboarding**: `frontend/app/onboarding/page.tsx` + `src/api/routes/onboarding.js`
- **Dashboard**: `frontend/app/dashboard/page.tsx`
- **Indexing**: `src/api/routes/trigger-indexing.js`

---

**Documentation Complete** ✅
