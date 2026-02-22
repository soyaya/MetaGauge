# Architecture Documentation

## System Overview

MetaGauge is a multi-chain blockchain analytics platform built with a modern microservices-inspired architecture.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                     │
│  Landing → Auth → Onboarding → Dashboard → Analytics → Chat │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API + WebSocket
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                       │
│  Auth │ Contracts │ Analysis │ Subscription │ Chat │ Export │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   Services Layer                             │
│  RPC Clients │ Analytics │ AI │ Backup │ Cache │ Monitoring │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              External Services                               │
│  Ethereum │ Lisk │ Starknet │ Google Gemini │ Price APIs   │
└─────────────────────────────────────────────────────────────┘
```

## Backend Architecture

### API Layer (`src/api/`)
- **Routes**: RESTful endpoints organized by domain
- **Middleware**: Authentication, validation, rate limiting, caching, error handling
- **Database**: File-based storage (PostgreSQL-ready)

### Services Layer (`src/services/`)
- **RPC Clients**: Chain-specific blockchain interaction
- **Analytics Engine**: Data processing and metrics calculation
- **AI Services**: Google Gemini integration for insights
- **Backup Service**: Automated database backups
- **Cache Manager**: In-memory caching with TTL

### Key Design Decisions

**Why File-Based Storage?**
- Fast MVP development
- No database setup required
- Easy migration path to PostgreSQL
- Suitable for moderate data volumes

**Why Express.js?**
- Mature ecosystem
- Flexible middleware system
- Easy to understand and maintain
- Great for RESTful APIs

## Frontend Architecture

### Next.js App Router
- Server and client components
- File-based routing
- API routes for backend communication

### State Management
- React Query for server state
- React hooks for local state
- Context for global state (auth, theme)

### Web3 Integration
- RainbowKit for wallet connection
- wagmi for Ethereum interactions
- ethers.js for contract calls

## Data Flow

### Onboarding Flow
1. User enters contract address
2. Backend validates and fetches ABI
3. Indexer starts processing blocks
4. Progress updates via WebSocket
5. Results stored and displayed

### Analysis Flow
1. User requests analysis
2. Backend fetches blockchain data
3. Analytics engine processes data
4. AI generates insights
5. Results cached and returned

### Subscription Flow
1. User purchases subscription on-chain
2. Smart contract emits event
3. Backend syncs subscription status
4. User tier updated
5. Features unlocked

## Security Architecture

### Authentication
- JWT tokens with 32+ character secret
- Bcrypt password hashing
- Token expiration and refresh

### Authorization
- Tier-based access control
- Rate limiting per tier
- API usage tracking

### Input Validation
- Joi schemas for all inputs
- Ethereum address validation
- SQL injection prevention

## Scalability Considerations

### Current Limitations
- File-based storage (single server)
- In-memory cache (not distributed)
- Single process (no clustering)

### Future Improvements
- PostgreSQL for data persistence
- Redis for distributed caching
- Horizontal scaling with load balancer
- Message queue for async processing

## Monitoring & Observability

- Error tracking with ErrorTracker
- Request logging middleware
- WebSocket for real-time updates
- Health check endpoints

## Deployment Architecture

### Development
- Backend: localhost:5000
- Frontend: localhost:3000
- File storage: ./data/

### Production
- Backend: Railway/Render
- Frontend: Vercel
- Database: PostgreSQL
- CDN: Vercel Edge Network

## Technology Choices

| Component | Technology | Reason |
|-----------|-----------|---------|
| Backend | Express.js | Mature, flexible |
| Frontend | Next.js 16 | SSR, App Router |
| Database | File/PostgreSQL | MVP → Production |
| AI | Google Gemini | Advanced capabilities |
| Web3 | ethers.js | Industry standard |
| Validation | Joi | Comprehensive |
| Testing | Jest | Popular, well-supported |

## Performance Optimizations

- Caching with TTL
- Parallel block fetching
- Lazy loading components
- Bundle optimization
- Code splitting

## Future Architecture

### Phase 2
- PostgreSQL migration
- Redis caching
- Message queue (Bull/RabbitMQ)
- Microservices separation

### Phase 3
- Kubernetes deployment
- Service mesh
- Distributed tracing
- Advanced monitoring
