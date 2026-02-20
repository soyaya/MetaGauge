# Metagauge Application Architecture Analysis

## 📋 Executive Summary

**Metagauge** is a full-stack blockchain analytics platform that provides comprehensive smart contract analysis across multiple chains (Lisk, Starknet, Ethereum). It features a modern React frontend, Express.js REST API backend, and AI-powered insights using Google's Gemini AI.

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                          │
│  Next.js 16 + React 19 + TypeScript + Tailwind CSS            │
│  - Landing Page, Auth, Dashboard, Analyzer, Profile            │
│  - Real-time WebSocket updates                                  │
│  - Web3 Integration (RainbowKit + Wagmi)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WS
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND LAYER                           │
│  Express.js 5 + Node.js (ES Modules)                          │
│  - REST API with JWT Authentication                            │
│  - WebSocket Server for real-time updates                      │
│  - Rate Limiting & CORS                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                       │
│  Analytics Engine + AI Services + RPC Clients                  │
│  - Multi-chain blockchain data fetching                        │
│  - DeFi metrics calculation                                     │
│  - User behavior analysis                                       │
│  - GeminiAI integration                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
│  File-based JSON Storage (PostgreSQL migration in progress)    │
│  - users.json, contracts.json, analyses.json                   │
│  - Backup system with versioning                               │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER                             │
│  Multi-Provider RPC Clients with Failover                      │
│  - Lisk: DRPC, Tenderly, Moralis, Lisk API                    │
│  - Starknet: Lava, PublicNode, Infura                         │
│  - Ethereum: PublicNode, NowNodes                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

### Backend Structure (`/src`)

```
src/
├── api/
│   ├── server.js                    # Main Express server with WebSocket
│   ├── routes/
│   │   ├── auth.js                  # User registration, login, JWT
│   │   ├── contracts.js             # Contract configuration CRUD
│   │   ├── analysis.js              # Analysis start, status, results
│   │   ├── quick-scan.js            # Fast 1-week analysis
│   │   ├── onboarding.js            # User onboarding flow
│   │   ├── users.js                 # User profile & usage stats
│   │   ├── chat.js                  # AI chat interface
│   │   ├── subscription.js          # Subscription management
│   │   └── faucet.js                # Testnet faucet integration
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication
│   │   ├── errorHandler.js          # Global error handling
│   │   └── logger.js                # Request logging
│   ├── database/
│   │   ├── index.js                 # Database abstraction layer
│   │   ├── fileStorage.js           # JSON file-based storage
│   │   ├── postgresStorage.js       # PostgreSQL storage (migration)
│   │   └── chatStorage.js           # Chat session storage
│   └── models/
│       ├── User.js                  # User data model
│       ├── ContractConfig.js        # Contract configuration model
│       ├── AnalysisResult.js        # Analysis result model
│       └── ChatSession.js           # Chat session model
│
├── services/
│   ├── SmartContractFetcher.js      # Multi-provider RPC manager
│   ├── SmartRpcManager.js           # RPC failover & health checks
│   ├── LiskRpcClient.js             # Lisk-specific RPC client
│   ├── StarknetRpcClient.js         # Starknet-specific RPC client
│   ├── EthereumRpcClient.js         # Ethereum-specific RPC client
│   ├── ChainNormalizer.js           # Cross-chain data normalization
│   ├── OptimizedQuickScan.js        # Fast 1-week analysis
│   ├── SmartBlockRangeSelector.js   # Intelligent block range selection
│   ├── ProgressiveDataFetcher.js    # Progressive data loading
│   ├── DeFiMetricsCalculator.js     # DeFi metrics (TVL, APY, etc.)
│   ├── UserBehaviorAnalyzer.js      # User engagement analysis
│   ├── GeminiAIService.js           # AI insights & chat
│   ├── ChatAIService.js             # AI chat service
│   ├── ReportGenerator.js           # JSON/CSV/Markdown reports
│   ├── SubscriptionService.js       # Subscription tier management
│   └── FaucetService.js             # Testnet faucet integration
│
├── index.js                         # Analytics Engine main class
└── main.js                          # CLI entry point
```

### Frontend Structure (`/frontend`)

```
frontend/
├── app/
│   ├── layout.tsx                   # Root layout with providers
│   ├── page.tsx                     # Landing page
│   ├── login/page.tsx               # Login page
│   ├── signup/page.tsx              # Registration page
│   ├── onboarding/page.tsx          # User onboarding wizard
│   ├── dashboard/page.tsx           # Main analytics dashboard
│   ├── analyzer/page.tsx            # Contract analysis interface
│   ├── profile/page.tsx             # User profile & settings
│   ├── chat/page.tsx                # AI chat interface
│   ├── history/page.tsx             # Analysis history
│   ├── subscription/page.tsx        # Subscription management
│   └── globals.css                  # Global styles
│
├── components/
│   ├── auth/
│   │   └── auth-provider.tsx        # Authentication context
│   ├── ui/                          # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── header.tsx
│   │   └── ... (40+ UI components)
│   ├── landing/
│   │   ├── hero-section.tsx         # Landing hero
│   │   ├── roles-section.tsx        # Feature showcase
│   │   └── footer.tsx               # Footer
│   ├── analyzer/
│   │   └── ... (analyzer components)
│   ├── dashboard/
│   │   └── ... (dashboard tabs)
│   ├── web3/
│   │   └── web3-provider.tsx        # Web3 wallet integration
│   └── theme/
│       └── theme-provider.tsx       # Dark/light theme
│
├── lib/
│   ├── api.ts                       # API client with retry logic
│   ├── api-config.ts                # API configuration
│   ├── api-diagnostics.ts           # API health checks
│   ├── web3-config.ts               # Web3 configuration
│   └── utils.ts                     # Utility functions
│
├── hooks/
│   └── use-marathon-sync.ts         # Real-time sync hook
│
└── public/                          # Static assets
```

---

## 🔑 Core Components

### 1. **Backend API Server** (`src/api/server.js`)

**Purpose**: Main Express.js server with REST API and WebSocket support

**Key Features**:
- **Port**: 5000 (configurable via `PORT` env var)
- **CORS**: Configured for localhost:3000 and local network IPs
- **WebSocket**: Real-time updates at `/ws` endpoint
- **Rate Limiting**: 100 requests per 15 minutes
- **Authentication**: JWT-based with Bearer tokens
- **Storage**: File-based JSON (PostgreSQL migration in progress)

**Main Routes**:
```javascript
/health                          # Health check
/api/auth/*                      # Authentication
/api/contracts/*                 # Contract configuration
/api/analysis/*                  # Analysis operations
/api/users/*                     # User management
/api/chat/*                      # AI chat
/api/onboarding/*                # Onboarding flow
/api/subscription/*              # Subscriptions
/api/faucet/*                    # Faucet integration
/api-docs                        # OpenAPI documentation
```

---

### 2. **Analytics Engine** (`src/index.js`)

**Purpose**: Core blockchain analysis engine

**Key Components**:
- `SmartContractFetcher`: Multi-provider RPC data fetching
- `ChainNormalizer`: Cross-chain data normalization
- `DeFiMetricsCalculator`: Financial metrics calculation
- `UserBehaviorAnalyzer`: User engagement analysis
- `SmartBlockRangeSelector`: Intelligent block range selection
- `ReportGenerator`: Multi-format report generation

**Analysis Flow**:
```
1. Determine search strategy (legacy/smart/orbiter)
2. Fetch transactions from blockchain
3. Normalize data across chains
4. Calculate DeFi metrics (TVL, APY, etc.)
5. Analyze user behavior
6. Generate AI insights
7. Create reports (JSON/CSV/Markdown)
```

---

### 3. **Multi-Chain RPC System** (`src/services/SmartContractFetcher.js`)

**Purpose**: Fetch blockchain data with automatic failover

**Supported Chains**:

| Chain | Providers | Priority |
|-------|-----------|----------|
| **Lisk** | Lisk API, DRPC, Tenderly, Moralis | 1-4 |
| **Starknet** | Lava, PublicNode, Infura | 1-3 |
| **Ethereum** | PublicNode, NowNodes | 1-2 |

**Features**:
- Automatic failover between providers
- Health monitoring (60s intervals)
- Rate limiting (10 req/sec default)
- Retry logic (3 attempts)
- WebSocket support (Lisk Tenderly)
- Chain isolation (only initialize target chain)

**Performance**:
- 70% faster startup with chain isolation
- 60% lower memory usage
- 30-second analysis for 1000 blocks

---

### 4. **Data Storage System** (`src/api/database/`)

**Current**: File-based JSON storage
**Future**: PostgreSQL (migration in progress)

**Storage Files**:
```
data/
├── users.json              # User accounts & auth
├── contracts.json          # Contract configurations
├── analyses.json           # Analysis results
└── backup/                 # Automatic backups
```

**Storage Classes**:
- `UserStorage`: User CRUD operations
- `ContractStorage`: Contract configuration management
- `AnalysisStorage`: Analysis result storage

**Features**:
- Atomic writes with JSON.stringify
- Automatic backup on write
- UUID-based IDs
- Timestamp tracking (createdAt, updatedAt)

---

### 5. **AI Integration** (`src/services/GeminiAIService.js`)

**Purpose**: AI-powered insights using Google Gemini

**Features**:
- **Model**: gemini-2.5-flash-lite
- **Rate Limiting**: 50 requests per 15 minutes
- **Capabilities**:
  - SWOT analysis
  - Risk assessment
  - Performance scoring
  - Market sentiment analysis
  - Optimization suggestions
  - Real-time alerts
  - Competitive positioning

**AI Endpoints**:
```
POST /api/analysis/:id/interpret          # Full AI interpretation
GET  /api/analysis/:id/quick-insights     # Quick performance score
POST /api/analysis/:id/alerts             # Real-time alerts
POST /api/analysis/:id/sentiment          # Market sentiment
POST /api/analysis/:id/optimizations      # Optimization tips
```

---

### 6. **Frontend Application** (`frontend/`)

**Tech Stack**:
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (Radix UI)
- **Charts**: Recharts
- **Web3**: RainbowKit + Wagmi + Viem
- **Forms**: React Hook Form + Zod
- **State**: React Context API

**Key Pages**:

| Page | Route | Purpose |
|------|-------|---------|
| Landing | `/` | Marketing & features |
| Login | `/login` | User authentication |
| Signup | `/signup` | User registration |
| Onboarding | `/onboarding` | Contract setup wizard |
| Dashboard | `/dashboard` | Analytics overview |
| Analyzer | `/analyzer` | Start new analysis |
| Profile | `/profile` | User settings |
| Chat | `/chat` | AI assistant |
| History | `/history` | Past analyses |

**Dashboard Tabs**:
1. **Overview**: Summary metrics & AI insights
2. **Metrics**: DeFi ratios, TVL, user activity
3. **Users**: Behavior analysis & engagement
4. **Transactions**: Detailed transaction data
5. **Competitive**: Market positioning

---

### 7. **Authentication System** (`src/api/routes/auth.js`)

**Features**:
- JWT-based authentication
- bcrypt password hashing (6 rounds for WSL performance)
- API key generation
- Email verification (placeholder)
- User tiers (free, pro, enterprise)

**User Tiers**:

| Tier | Monthly Analyses | Rate Limit | Features |
|------|-----------------|------------|----------|
| **Free** | 10 | 100 req/15min | Basic analytics |
| **Pro** | 100 | 200 req/15min | AI insights |
| **Enterprise** | Unlimited | Custom | Priority support |

**Auth Flow**:
```
1. User registers → POST /api/auth/register
2. Password hashed with bcrypt
3. User created in users.json
4. JWT token generated
5. Token stored in localStorage
6. Token sent in Authorization header
```

---

### 8. **Analysis System** (`src/api/routes/analysis.js`)

**Analysis Types**:
1. **Single**: Analyze one contract
2. **Competitive**: Compare with competitors
3. **Comparative**: Historical comparison

**Analysis Flow**:
```
1. User starts analysis → POST /api/analysis/start
2. Create analysis record (status: pending)
3. Fetch blockchain data (transactions, events)
4. Normalize data across chains
5. Calculate metrics (DeFi, user behavior)
6. Generate AI insights
7. Update status to completed
8. Store results in analyses.json
9. Generate reports (JSON/CSV/Markdown)
```

**Progress Tracking**:
- Real-time WebSocket updates
- Progress percentage (0-100%)
- Current step description
- Estimated time remaining

---

### 9. **Quick Scan Feature** (`src/services/OptimizedQuickScan.js`)

**Purpose**: Fast 1-week analysis for quick insights

**Features**:
- Scans last 50,000 blocks (~7 days)
- Detects contract deployment date
- Fetches only contract-related data
- Execution time: 30-60 seconds
- Progress updates every 10%

**Data Collected**:
- Transactions (to/from contract)
- Events (contract logs)
- Unique accounts
- Block timestamps

---

### 10. **Onboarding System** (`src/api/routes/onboarding.js`)

**Purpose**: Guide new users through contract setup

**Onboarding Steps**:
1. **Social Links**: Website, Twitter, Discord, Telegram
2. **Logo Upload**: Project branding
3. **Contract Details**: Address, chain, name, ABI
4. **Purpose & Category**: Project description
5. **Start Date**: Project launch date
6. **Quick Scan**: Initial 1-week analysis

**Onboarding Status**:
```javascript
{
  completed: false,
  currentStep: 1,
  steps: {
    socialLinks: false,
    logo: false,
    contractDetails: false,
    purpose: false,
    quickScan: false
  }
}
```

---

## 🔄 Data Flow

### Complete Analysis Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER INITIATES ANALYSIS                                      │
│    Frontend: POST /api/analysis/start                           │
│    Body: { configId, analysisType }                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. BACKEND VALIDATES REQUEST                                     │
│    - Check user authentication (JWT)                             │
│    - Verify contract configuration exists                        │
│    - Check analysis limits (tier-based)                          │
│    - Create analysis record (status: pending)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. BLOCKCHAIN DATA FETCHING                                      │
│    SmartContractFetcher:                                         │
│    - Initialize RPC clients for target chain                     │
│    - Determine block range (smart/legacy)                        │
│    - Fetch transactions with failover                            │
│    - Fetch events/logs                                           │
│    - Handle rate limiting & retries                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DATA NORMALIZATION                                            │
│    ChainNormalizer:                                              │
│    - Convert chain-specific formats to unified schema            │
│    - Decode function calls (if ABI provided)                     │
│    - Extract user addresses                                      │
│    - Calculate gas costs                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. METRICS CALCULATION                                           │
│    DeFiMetricsCalculator:                                        │
│    - Total Value Locked (TVL)                                    │
│    - Transaction volume                                          │
│    - Unique users                                                │
│    - Gas efficiency                                              │
│    - Activity trends                                             │
│                                                                  │
│    UserBehaviorAnalyzer:                                         │
│    - User engagement scores                                      │
│    - Retention rates                                             │
│    - Whale detection                                             │
│    - User lifecycle stages                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. AI INSIGHTS GENERATION                                        │
│    GeminiAIService:                                              │
│    - SWOT analysis                                               │
│    - Risk assessment                                             │
│    - Performance scoring                                         │
│    - Optimization suggestions                                    │
│    - Market sentiment                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. RESULTS STORAGE                                               │
│    AnalysisStorage:                                              │
│    - Update analysis record (status: completed)                  │
│    - Store results in analyses.json                             │
│    - Generate reports (JSON/CSV/Markdown)                        │
│    - Update user usage statistics                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. FRONTEND DISPLAY                                              │
│    Dashboard:                                                    │
│    - Fetch results: GET /api/analysis/:id/results               │
│    - Display 5 dashboard tabs                                    │
│    - Show AI insights                                            │
│    - Enable report downloads                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Features

### Authentication & Authorization
- JWT tokens with expiration
- bcrypt password hashing (6 rounds)
- API key authentication
- Bearer token validation
- Protected routes with middleware

### Rate Limiting
- Global: 100 requests per 15 minutes
- Analysis: 10 per hour (free tier)
- AI requests: 50 per 15 minutes
- User tier-based limits

### Data Protection
- CORS configuration
- Input validation (Zod schemas)
- SQL injection prevention (prepared statements)
- XSS protection (React escaping)
- HTTPS recommended for production

### Error Handling
- Global error handler middleware
- Sanitized error messages
- Detailed logging (server-side only)
- Graceful degradation

---

## 📊 Key Metrics & Analytics

### DeFi Metrics (20+ metrics)
1. Total Value Locked (TVL)
2. Transaction volume
3. Unique users
4. Active users (daily/weekly/monthly)
5. Transaction count
6. Average transaction value
7. Gas costs (total/average)
8. Gas efficiency
9. Success rate
10. Failed transactions
11. Whale transactions (>$10k)
12. User retention rate
13. New user growth
14. Churn rate
15. Engagement score
16. Activity trends
17. Peak usage times
18. User lifecycle stages
19. Revenue metrics
20. Competitive positioning

### User Behavior Analysis
- Engagement scores (0-100)
- Retention rates (7/30/90 day)
- User lifecycle stages (new/active/at-risk/churned)
- Whale detection (>$10k transactions)
- Transaction patterns
- Time-based activity
- User journey mapping

### Competitive Analysis
- Market share calculation
- Feature comparison
- Performance benchmarking
- Growth rate comparison
- User acquisition metrics

---

## 🚀 Performance Optimizations

### Chain Isolation
- Only initialize RPC providers for target chain
- **70% faster startup**
- **60% lower memory usage**
- Configurable via `ANALYZE_CHAIN_ONLY=true`

### Smart Block Range Selection
- Orbiter Finance-inspired strategy
- Priority-based multi-range search
- Stops on low activity detection
- Adaptive block range sizing

### Caching
- Block number caching (30s TTL)
- RPC response caching
- Analysis result caching

### Progressive Data Fetching
- Chunked data loading
- Batch processing
- Parallel RPC requests
- Timeout handling

### Frontend Optimizations
- Next.js App Router (React Server Components)
- Code splitting
- Image optimization
- Lazy loading
- WebSocket for real-time updates

---

## 🔧 Configuration

### Environment Variables

**Backend** (`.env`):
```bash
# Contract Configuration
CONTRACT_ADDRESS=0x...
CONTRACT_CHAIN=lisk
CONTRACT_NAME=MyContract

# Chain Isolation
ANALYZE_CHAIN_ONLY=true

# RPC Endpoints
LISK_RPC_URL1=https://lisk.drpc.org
LISK_RPC_URL2=https://lisk.gateway.tenderly.co/...
ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com
STARKNET_RPC_URL1=https://rpc.starknet.lava.build

# Server
PORT=5000

# AI Integration
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-2.5-flash-lite

# Database
DATABASE_TYPE=file  # or 'postgres'
```

**Frontend** (`frontend/.env`):
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000

# Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS=false
```

---

## 📦 Dependencies

### Backend
- **express**: ^5.2.1 - Web framework
- **ethers**: ^6.16.0 - Ethereum library
- **bcryptjs**: ^2.4.3 - Password hashing
- **jsonwebtoken**: ^9.0.3 - JWT authentication
- **cors**: ^2.8.5 - CORS middleware
- **dotenv**: ^17.2.3 - Environment variables
- **ws**: ^8.19.0 - WebSocket server
- **pg**: ^8.18.0 - PostgreSQL client
- **@google/generative-ai**: ^0.21.0 - Gemini AI

### Frontend
- **next**: ^16.1.6 - React framework
- **react**: 19.2.0 - UI library
- **typescript**: ^5 - Type safety
- **tailwindcss**: ^4.1.9 - Styling
- **@radix-ui/react-***: UI components
- **recharts**: ^3.7.0 - Charts
- **@rainbow-me/rainbowkit**: ^2.2.10 - Web3 wallet
- **wagmi**: ^2.15.2 - Web3 hooks
- **viem**: ^2.21.54 - Ethereum library
- **zod**: ^3.25.76 - Schema validation

---

## 🧪 Testing

### Test Scripts
```bash
# Backend
npm test                              # Run all tests
npm run test:api                      # API tests
npm run test:interaction              # Contract interaction tests

# Frontend
cd frontend
npm test                              # Jest tests
npm run test:coverage                 # Coverage report
```

### Test Files
- `test-backend-complete.sh` - Full backend test suite
- `test-frontend-integration.js` - Frontend integration tests
- `test-enhanced-ai.js` - AI service tests
- `test-complete-auth-flow.js` - Authentication tests
- `test-api-enhanced.js` - API endpoint tests

---

## 🚀 Deployment

### Development
```bash
# Start backend
npm run dev                           # Port 5000

# Start frontend
cd frontend
npm run dev                           # Port 3000
```

### Production
```bash
# Backend
npm start

# Frontend
cd frontend
npm run build
npm start
```

### Docker (Future)
```bash
docker-compose up -d
```

---

## 📈 Roadmap

### ✅ Completed
- Multi-chain support (Lisk, Starknet, Ethereum)
- Full-stack web application
- AI integration (GeminiAI)
- User authentication & authorization
- Real-time dashboard
- Quick scan feature
- Onboarding wizard
- File-based storage

### 🚧 In Progress
- PostgreSQL migration
- WebSocket real-time updates
- Advanced visualizations

### 🔮 Future
- Additional chains (Polygon, Arbitrum, Optimism)
- Mobile app (React Native)
- ML-powered predictions
- Team collaboration features
- Custom alerts
- API marketplace

---

## 🐛 Known Issues

### Current Issues
1. **PostgreSQL Migration**: Incomplete, still using file-based storage
2. **WebSocket**: Basic implementation, needs enhancement
3. **Chat Storage**: Temporarily disabled
4. **Rate Limiting**: Temporarily disabled for testing

### Workarounds
- Use file-based storage for now
- Manual analysis refresh instead of WebSocket
- Direct API calls for chat

---

## 📚 Documentation

### API Documentation
- **Swagger UI**: http://localhost:5000/api-docs
- **OpenAPI Spec**: `src/api/docs/swagger.yaml`

### Code Documentation
- Inline JSDoc comments
- README.md files in key directories
- Architecture diagrams in markdown

---

## 🤝 Contributing

### Development Workflow
1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request

### Code Style
- ES Modules (import/export)
- Async/await for promises
- Descriptive variable names
- JSDoc comments for functions
- TypeScript for frontend

---

## 📞 Support

### Resources
- **GitHub Issues**: Bug reports & feature requests
- **Documentation**: README.md & inline comments
- **API Docs**: http://localhost:5000/api-docs

### Troubleshooting
```bash
# Check backend health
curl http://localhost:5000/health

# Check frontend
curl http://localhost:3000/api/health

# View logs
tail -f backend.log
tail -f server.log
```

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🎯 Key Takeaways

### Strengths
✅ Modern tech stack (Next.js 16, React 19, Express 5)
✅ Multi-chain support with automatic failover
✅ AI-powered insights with GeminiAI
✅ Comprehensive analytics (20+ metrics)
✅ Real-time updates via WebSocket
✅ User-friendly onboarding
✅ Responsive design (mobile-friendly)
✅ Modular architecture (easy to extend)

### Areas for Improvement
⚠️ Complete PostgreSQL migration
⚠️ Enhance WebSocket implementation
⚠️ Add comprehensive test coverage
⚠️ Implement caching layer (Redis)
⚠️ Add monitoring & alerting (Sentry)
⚠️ Improve error handling
⚠️ Add API versioning
⚠️ Implement CI/CD pipeline

---

**Last Updated**: February 11, 2026
**Version**: 1.0.0
**Status**: Production Ready (with file-based storage)
