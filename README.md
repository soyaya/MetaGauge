# 🚀 MetaGauge

[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)](https://github.com/soyaya/MetaGauge)
[![Chains](https://img.shields.io/badge/Chains-Ethereum%20%7C%20Lisk%20%7C%20Starknet-blue)](https://github.com/soyaya/MetaGauge)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

> **Enterprise-grade blockchain analytics platform** with AI-powered insights, real-time indexing, and multi-chain support. Built for startups, investors, and developers who need deep contract intelligence.

---

## ✨ What is MetaGauge?

MetaGauge is a comprehensive blockchain analytics platform that transforms raw smart contract data into actionable business intelligence. Whether you're a startup tracking user engagement, an investor analyzing DeFi protocols, or a developer optimizing gas costs, MetaGauge provides the insights you need.

### 🎯 Key Highlights

- **🤖 AI-Powered Analytics** - Google Gemini integration for intelligent insights and recommendations
- **⚡ Real-Time Indexing** - Streaming blockchain data with WebSocket updates
- **🌐 Multi-Chain Support** - Ethereum, Lisk, and Starknet with automatic chain detection
- **💬 AI Chat Assistant** - Natural language queries about your contracts
- **📊 Comprehensive Dashboards** - User behavior, transactions, metrics, and competitive analysis
- **🔐 Subscription-Based** - Flexible tiers from Free to Enterprise
- **💳 Multi-Chain Payments** - Pay with Lisk (LSK/ETH) or Stellar (XLM/USDC)

---

## 🎬 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Google Gemini API Key** (optional, for AI features)
- **RPC Endpoints** for your target blockchain

### Installation

```bash
# Clone the repository
git clone https://github.com/soyaya/MetaGauge.git
cd MetaGauge

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Setup environment files
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### Configuration

#### Backend (`.env`)

```env
# Target Contract
CONTRACT_ADDRESS=0xYourContractAddress
CONTRACT_CHAIN=ethereum
CONTRACT_NAME=YourProject

# RPC Endpoints (with failover)
ETHEREUM_RPC_URL1=https://ethereum-rpc.publicnode.com
ETHEREUM_RPC_URL2=https://eth.llamarpc.com
ETHEREUM_RPC_URL3=https://eth.nownodes.io/YOUR_API_KEY

LISK_RPC_URL1=https://lisk.drpc.org
LISK_RPC_URL2=https://lisk.gateway.tenderly.co/YOUR_KEY

STARKNET_RPC_URL1=https://rpc.starknet.lava.build
STARKNET_RPC_URL2=https://starknet-rpc.publicnode.com

# AI Integration (optional)
GEMINI_API_KEY=your-gemini-api-key

# Server
PORT=5000
DATABASE_TYPE=file
```

#### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Running the Application

#### Development Mode

```bash
# Terminal 1: Start Backend
npm run dev
# Backend runs on http://localhost:5000

# Terminal 2: Start Frontend
cd frontend
npm run dev
# Frontend runs on http://localhost:3000
```

#### Production Mode

```bash
# Backend
npm start

# Frontend
cd frontend
npm run build
npm start
```

### First Steps

1. **Access the app** at `http://localhost:3000`
2. **Sign up** for a free account
3. **Onboard a contract** - Enter contract address and chain
4. **View analytics** - Real-time dashboard with AI insights
5. **Chat with AI** - Ask questions about your contract data

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                     │
│  Landing → Auth → Onboarding → Dashboard → Analytics → Chat │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API + WebSocket
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                       │
│  Auth │ Contracts │ Analysis │ Subscription │ Chat │ Faucet │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   Streaming Indexer                          │
│  IndexerManager → ChunkManager → SmartContractFetcher       │
│       ↓                ↓                    ↓                │
│  FileStorage    HorizontalValidator   RPCClientPool         │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Blockchain Networks + AI Services               │
│  Ethereum │ Lisk │ Starknet │ Google Gemini │ Price Oracles │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

#### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: React 19 + Tailwind CSS
- **Components**: shadcn/ui + Radix UI
- **Charts**: Recharts
- **Web3**: wagmi + RainbowKit + ethers.js
- **State**: React Query

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Language**: JavaScript (ES Modules)
- **Storage**: File-based JSON (PostgreSQL ready)
- **Auth**: JWT + bcrypt
- **AI**: Google Gemini API
- **WebSocket**: ws library

#### Blockchain
- **Chains**: Ethereum, Lisk, Starknet
- **RPC**: Multi-provider failover system
- **Indexing**: Real-time streaming with chunk processing
- **Normalization**: Cross-chain data standardization

---

## 🎯 Core Features

### 1. 🤖 AI-Powered Analytics

**Google Gemini Integration** provides:
- **SWOT Analysis** - Strengths, weaknesses, opportunities, threats
- **Risk Assessment** - Security, performance, and market risks
- **Optimization Suggestions** - Gas efficiency and performance improvements
- **Market Sentiment** - Competitive positioning and growth predictions
- **Real-time Alerts** - Anomaly detection and security warnings

### 2. 💬 AI Chat Assistant

**Natural Language Interface** for:
- Querying contract data ("How many users joined last week?")
- Understanding metrics ("Explain my retention rate")
- Getting recommendations ("How can I improve user engagement?")
- Comparing competitors ("How do I stack up against competitors?")
- Exploring trends ("What's my growth trajectory?")

### 3. 📊 Comprehensive Dashboards

#### Overview Tab
- Key metrics summary
- AI-generated insights
- Performance scoring
- Quick actions

#### Metrics Tab
- DeFi ratios (TVL, liquidity, utilization)
- Financial metrics (volume, fees, revenue)
- User engagement scores
- Growth indicators

#### Users Tab
- User behavior analysis
- Cohort retention
- Lifecycle stages
- Whale detection
- Engagement patterns

#### Transactions Tab
- Complete transaction history
- Gas analysis
- Value transfers
- Success/failure rates
- Pagination and filtering

#### Competitive Tab
- Multi-contract comparison
- Market positioning
- Benchmark analysis
- Growth comparisons
- Feature gaps

### 4. ⚡ Real-Time Indexing

**Streaming Indexer** features:
- **Automatic Processing** - Starts on contract onboarding
- **Chunk-Based** - Efficient memory usage
- **Progress Tracking** - Real-time WebSocket updates
- **Horizontal Validation** - Data integrity checks
- **Failover Support** - Multiple RPC providers
- **Resume Capability** - Continues from last checkpoint

### 5. 🌐 Multi-Chain Support

| Chain | Status | Features |
|-------|--------|----------|
| **Ethereum** | ✅ Production | Full event + transaction analysis |
| **Lisk** | ✅ Production | DRPC + Tenderly failover |
| **Starknet** | ✅ Production | Specialized transaction handling |

**Chain Isolation**: Only initializes RPC providers for target chain
- 70% faster startup
- 60% lower memory usage

### 6. 💳 Subscription System

#### Tiers & Pricing

| Tier | Monthly | Yearly | API Calls | Historical Data | Features |
|------|---------|--------|-----------|-----------------|----------|
| **Free** | $0 | $0 | 1,000 | 30 days | Basic analytics |
| **Starter** | $29 | $290 | 10,000 | 90 days | AI insights |
| **Pro** | $99 | $990 | 50,000 | 365 days | Advanced analytics |
| **Enterprise** | $299 | $2,990 | 250,000 | 730 days | Full features |

#### Payment Options
- **Lisk**: LSK tokens or ETH
- **Stellar**: XLM (Lumens) or USDC
- **Smart Contract Verification**: Automatic subscription validation

### 7. 🔐 Security & Authentication

- **JWT-based auth** with secure token management
- **Password hashing** with bcrypt
- **Rate limiting** per user tier
- **API key generation** for programmatic access
- **Session management** with refresh tokens

---

## 📡 API Reference

### Authentication

```bash
POST /api/auth/register     # Register new user
POST /api/auth/login        # Login user
GET  /api/auth/me          # Get current user
POST /api/auth/refresh-api-key # Generate new API key
```

### Contracts

```bash
GET    /api/contracts       # List user contracts
POST   /api/contracts       # Add new contract
GET    /api/contracts/:id   # Get contract details
PUT    /api/contracts/:id   # Update contract
DELETE /api/contracts/:id   # Delete contract
```

### Analysis

```bash
POST /api/analysis/start           # Start analysis
GET  /api/analysis/:id/status      # Get progress
GET  /api/analysis/:id/results     # Get results
GET  /api/analysis/history         # Analysis history
POST /api/analysis/:id/interpret   # AI interpretation
GET  /api/analysis/:id/quick-insights # Quick AI insights
```

### Onboarding

```bash
POST /api/onboarding/start         # Start onboarding
GET  /api/onboarding/:id/status    # Get progress
GET  /api/onboarding/:id/results   # Get results
```

### Chat

```bash
POST /api/chat/sessions            # Create chat session
GET  /api/chat/sessions            # List sessions
POST /api/chat/message             # Send message
GET  /api/chat/sessions/:id/messages # Get messages
```

### Subscription

```bash
GET  /api/subscription/status      # Get subscription status
POST /api/subscription/verify      # Verify payment
GET  /api/subscription/usage       # Get usage stats
```

### Documentation

```bash
GET /api-docs                      # OpenAPI/Swagger docs
GET /health                        # Health check
```

---

## 📊 Data Analytics

### Metrics Calculated

#### User Metrics
- **Unique Users** - Total and active users
- **New Users** - Daily, weekly, monthly
- **Retention Rate** - Cohort-based retention
- **Churn Rate** - User attrition
- **Engagement Score** - Activity-based scoring
- **Lifecycle Stages** - New, active, at-risk, churned

#### Transaction Metrics
- **Total Transactions** - Success and failure counts
- **Transaction Volume** - Value transferred
- **Gas Costs** - Total and average gas
- **Success Rate** - Transaction success percentage
- **Average Value** - Per transaction value

#### Financial Metrics
- **Total Value Locked (TVL)** - For DeFi protocols
- **Trading Volume** - For DEXs
- **Fee Revenue** - Protocol fees collected
- **Liquidity Depth** - Available liquidity

#### Competitive Metrics
- **Market Share** - Relative to competitors
- **Growth Rate** - Compared to market
- **Feature Parity** - Feature comparison
- **User Acquisition** - Compared to competitors

---

## 🚀 Deployment

### Environment Setup

#### Production Backend

```bash
# Set production environment
NODE_ENV=production

# Configure production RPC endpoints
ETHEREUM_RPC_URL1=https://your-production-rpc.com
LISK_RPC_URL1=https://your-production-rpc.com

# Set secure JWT secret
JWT_SECRET=your-secure-random-secret

# Configure CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

#### Production Frontend

```bash
# Build frontend
cd frontend
npm run build

# Start production server
npm start
```

### Deployment Platforms

#### Recommended Platforms

**Backend**:
- Railway
- Render
- Heroku
- AWS EC2
- DigitalOcean

**Frontend**:
- Vercel (recommended for Next.js)
- Netlify
- AWS Amplify
- Cloudflare Pages

### Docker Support (Coming Soon)

```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

---

## 🧪 Testing

### Run Tests

```bash
# Backend tests
npm test
npm run test:unit
npm run test:integration
npm run test:coverage

# Frontend tests
cd frontend
npm test
npm run test:coverage
```

### Manual Testing

```bash
# Test authentication flow
node test-auth-flow.js

# Test RPC connections
node test-rpc-connections.js

# Test complete user journey
node test-complete-user-journey.js

# Test AI integration
node test-enhanced-ai.js
```

### Health Checks

```bash
# Backend health
curl http://localhost:5000/health

# Frontend health
curl http://localhost:3000/api/health
```

---

## 📁 Project Structure

```
MetaGauge/
├── frontend/                    # Next.js frontend
│   ├── app/                    # App router pages
│   │   ├── page.tsx           # Landing page
│   │   ├── login/             # Authentication
│   │   ├── signup/
│   │   ├── onboarding/        # Contract onboarding
│   │   ├── dashboard/         # Main dashboard
│   │   ├── chat/              # AI chat interface
│   │   └── subscription/      # Subscription management
│   ├── components/            # React components
│   │   ├── analyzer/          # Dashboard tabs
│   │   ├── auth/              # Auth components
│   │   ├── chat/              # Chat components
│   │   ├── subscription/      # Subscription components
│   │   └── ui/                # shadcn/ui components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities and API client
│   └── public/                # Static assets
│
├── src/                        # Backend source
│   ├── api/                   # Express API
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth, logging, errors
│   │   ├── models/           # Data models
│   │   └── database/         # Storage layer
│   ├── indexer/              # Streaming indexer
│   │   ├── services/         # Indexer services
│   │   ├── config/           # Chain configs
│   │   └── models/           # Type definitions
│   ├── services/             # Business logic
│   │   ├── *RpcClient.js    # Chain-specific RPC clients
│   │   ├── GeminiAIService.js # AI integration
│   │   ├── SubscriptionService.js # Subscription logic
│   │   └── ChatAIService.js  # Chat AI service
│   └── config/               # Configuration
│
├── data/                      # File-based storage
│   ├── users.json            # User data
│   ├── contracts.json        # Contract configs
│   ├── analyses.json         # Analysis results
│   ├── chat_sessions.json    # Chat sessions
│   └── chat_messages.json    # Chat messages
│
├── reports/                   # Generated reports
│   └── [contract]/[chain]/   # Contract-specific reports
│
├── tests/                     # Test suites
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── helpers/              # Test utilities
│
├── .env.example              # Environment template
├── package.json              # Backend dependencies
└── README.md                 # This file
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MetaGauge.git
   cd MetaGauge
   ```
3. **Create a branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make your changes**
5. **Test your changes**
   ```bash
   npm test
   ```
6. **Commit and push**
   ```bash
   git commit -m 'Add amazing feature'
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Contribution Guidelines

- Follow existing code style
- Write tests for new features
- Update documentation
- Keep commits atomic and descriptive
- Ensure all tests pass

### Areas for Contribution

- 🌐 Additional blockchain support (Polygon, Arbitrum, etc.)
- 📊 New analytics metrics
- 🎨 UI/UX improvements
- 🐛 Bug fixes
- 📝 Documentation improvements
- 🧪 Test coverage
- 🔧 Performance optimizations

---

## 🗺️ Roadmap

### ✅ Completed (v1.0)

- ✅ Multi-chain support (Ethereum, Lisk, Starknet)
- ✅ Full-stack web application
- ✅ AI-powered analytics with Google Gemini
- ✅ Real-time streaming indexer
- ✅ Subscription system with multi-chain payments
- ✅ AI chat assistant
- ✅ Comprehensive dashboards
- ✅ User authentication and authorization

### 🚧 In Progress (v1.1)

- [ ] PostgreSQL migration (file-based storage ready)
- [ ] Mobile-responsive improvements
- [ ] Advanced filtering and search
- [ ] Export functionality (PDF, Excel)
- [ ] Email notifications

### 🔮 Future (v2.0+)

- [ ] Additional chains (Polygon, Arbitrum, Optimism, Base)
- [ ] Mobile app (React Native)
- [ ] Advanced ML predictions
- [ ] Team collaboration features
- [ ] Custom alert thresholds
- [ ] API marketplace
- [ ] White-label solutions
- [ ] On-chain governance analytics

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

### Technologies

- [Next.js](https://nextjs.org/) - React framework
- [Express.js](https://expressjs.com/) - Backend framework
- [Google Gemini](https://ai.google.dev/) - AI integration
- [ethers.js](https://docs.ethers.org/) - Ethereum library
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Recharts](https://recharts.org/) - Charts

### Blockchain Networks

- [Ethereum](https://ethereum.org/)
- [Lisk](https://lisk.com/)
- [Starknet](https://starknet.io/)
- [Stellar](https://stellar.org/)

---

## 📞 Support & Contact

### 📖 Documentation

- **API Docs**: http://localhost:5000/api-docs (when running)
- **GitHub Wiki**: [Project Wiki](https://github.com/soyaya/MetaGauge/wiki)

### 🐛 Issues & Bugs

Found a bug? [Open an issue](https://github.com/soyaya/MetaGauge/issues)

### 💬 Community

- **GitHub Discussions**: [Join the conversation](https://github.com/soyaya/MetaGauge/discussions)
- **Discord**: Coming soon
- **Twitter**: Coming soon

### 📧 Contact

- **Email**: support@metagauge.io
- **Website**: https://metagauge.io (coming soon)

---

## 🌟 Star History

If you find MetaGauge useful, please consider giving it a star ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=soyaya/MetaGauge&type=Date)](https://star-history.com/#soyaya/MetaGauge&Date)

---

## 📊 Project Stats

- **Lines of Code**: 133,964+
- **Files**: 636
- **Backend Services**: 88
- **Frontend Components**: 115+
- **API Endpoints**: 50+
- **Supported Chains**: 3
- **Test Coverage**: Growing

---

<div align="center">

**Built with ❤️ for the blockchain community**

[Website](https://metagauge.io) • [Documentation](https://github.com/soyaya/MetaGauge/wiki) • [Issues](https://github.com/soyaya/MetaGauge/issues) • [Discussions](https://github.com/soyaya/MetaGauge/discussions)

</div>
