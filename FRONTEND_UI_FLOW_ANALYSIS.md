# Frontend UI & Backend Flow Analysis

## 📱 Frontend UI Structure

### **Tech Stack**
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (Radix UI primitives)
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **Web3**: RainbowKit + Wagmi + Viem
- **State**: React Context API

---

## 🎨 UI Components Inventory

### **Core Pages** (8 main routes)

| Page | Route | Purpose | Auth Required |
|------|-------|---------|---------------|
| Landing | `/` | Marketing homepage | ❌ |
| Login | `/login` | User authentication | ❌ |
| Signup | `/signup` | User registration | ❌ |
| Onboarding | `/onboarding` | Contract setup wizard | ✅ |
| Dashboard | `/dashboard` | Analytics overview | ✅ |
| Analyzer | `/analyzer` | Start new analysis | ✅ |
| Profile | `/profile` | User settings | ✅ |
| Chat | `/chat` | AI assistant | ✅ |
| History | `/history` | Past analyses | ✅ |
| Subscription | `/subscription` | Plan management | ✅ |

### **Component Categories** (118+ components)

```
components/
├── analyzer/          # Analysis UI (13 components)
├── auth/             # Authentication (4 components)
├── chat/             # AI chat interface (7 components)
├── landing/          # Marketing pages (4 components)
├── startup/          # Startup analytics (20+ components)
├── subscription/     # Subscription UI (3 components)
├── theme/            # Theme switching (2 components)
├── ui/               # shadcn/ui base (60+ components)
└── web3/             # Web3 wallet (1 component)
```

---

## 🔄 Complete User Flows

### **1. Registration & Onboarding Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: USER REGISTRATION                                        │
│ Page: /signup                                                    │
│ Component: frontend/app/signup/page.tsx                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    User fills form:
    - Email (validated)
    - Password (min 6 chars)
    - Name
                              ↓
    Frontend: POST /api/auth/register
    Body: { email, password, name }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: src/api/routes/auth.js                                  │
│ - Validate input                                                 │
│ - Check if user exists                                           │
│ - Hash password (bcrypt, 6 rounds)                              │
│ - Create user in users.json                                     │
│ - Generate JWT token                                             │
│ - Return: { token, user }                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    Frontend stores:
    - localStorage.setItem('token', token)
    - localStorage.setItem('user', JSON.stringify(user))
                              ↓
    AuthProvider updates state:
    - setToken(token)
    - setUser(user)
                              ↓
    Redirect to: /onboarding
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: ONBOARDING WIZARD                                        │
│ Page: /onboarding                                                │
│ Component: frontend/app/onboarding/page.tsx                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    Check onboarding status:
    GET /api/onboarding/status
                              ↓
    If completed → redirect to /dashboard
    If not → show wizard
                              ↓
    WIZARD STEPS:
    
    Step 1: Social Links
    - Website URL
    - Twitter handle
    - Discord invite
    - Telegram link
    
    Step 2: Logo Upload
    - Project logo (optional)
    
    Step 3: Contract Details
    - Contract address (required)
    - Chain selection (Lisk/Starknet/Ethereum)
    - Contract name (required)
    - ABI (optional)
    
    Step 4: Purpose & Category
    - Project purpose (min 10 chars)
    - Category (DeFi/NFT/Gaming/DAO/etc.)
    - Start date
                              ↓
    User submits form:
    POST /api/onboarding/complete
    Body: { socialLinks, logo, contractAddress, chain, ... }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: src/api/routes/onboarding.js                           │
│ - Validate all fields                                            │
│ - Create contract configuration                                  │
│ - Update user onboarding status                                  │
│ - Start Quick Scan (1-week analysis)                            │
│ - Return: { success, contractId, analysisId }                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    Quick Scan Progress:
    - Shows animated progress bar
    - Real-time updates via polling
    - Steps: Fetching data → Analyzing → Complete
                              ↓
    On completion:
    - Update onboarding.completed = true
    - Redirect to: /dashboard
```

---

### **2. Login Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ USER LOGIN                                                       │
│ Page: /login                                                     │
│ Component: frontend/app/login/page.tsx                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    User enters:
    - Email
    - Password
                              ↓
    Frontend: POST /api/auth/login
    Body: { email, password }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: src/api/routes/auth.js                                  │
│ - Find user by email                                             │
│ - Compare password with bcrypt                                   │
│ - Generate JWT token                                             │
│ - Return: { token, user }                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    Frontend stores token & user
    AuthProvider updates state
                              ↓
    Check onboarding status:
    - If completed → /dashboard
    - If not → /onboarding
```

---

### **3. Dashboard Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ DASHBOARD PAGE                                                   │
│ Page: /dashboard                                                 │
│ Component: frontend/app/dashboard/page.tsx                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    On page load:
    1. Check authentication (AuthProvider)
    2. Fetch default contract data
    3. Fetch user metrics
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ API CALLS                                                        │
│                                                                  │
│ 1. GET /api/onboarding/default-contract                         │
│    Returns:                                                      │
│    - contract: { address, chain, name, ... }                    │
│    - metrics: { tvl, volume, transactions, users, ... }         │
│    - fullResults: { complete analysis data }                    │
│    - indexingStatus: { isIndexed, progress }                    │
│    - analysisHistory: { total, completed, latest }              │
│                                                                  │
│ 2. GET /api/onboarding/user-metrics                             │
│    Returns:                                                      │
│    - overview: { totalContracts, totalAnalyses, ... }           │
│    - usage: { analysisCount, monthlyAnalysisCount, ... }        │
│    - limits: { monthly, remaining }                             │
│    - recentAnalyses: [...]                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DASHBOARD UI TABS                                                │
│                                                                  │
│ Tab 1: OVERVIEW                                                  │
│ Component: components/analyzer/overview-tab.tsx                  │
│ - Summary metrics cards                                          │
│ - AI insights (SWOT, recommendations)                           │
│ - Quick stats                                                    │
│                                                                  │
│ Tab 2: METRICS                                                   │
│ Component: components/analyzer/metrics-tab.tsx                   │
│ - DeFi ratios                                                    │
│ - TVL trends                                                     │
│ - Transaction volume charts                                     │
│ - Gas efficiency metrics                                         │
│                                                                  │
│ Tab 3: USERS                                                     │
│ Component: components/analyzer/users-tab.tsx                     │
│ - User engagement scores                                         │
│ - Retention rates                                                │
│ - User lifecycle stages                                          │
│ - Whale detection                                                │
│                                                                  │
│ Tab 4: TRANSACTIONS                                              │
│ Component: components/analyzer/transactions-tab.tsx              │
│ - Transaction list (paginated)                                   │
│ - Transaction details                                            │
│ - Gas costs                                                      │
│ - Success/failure rates                                          │
│                                                                  │
│ Tab 5: UX/COMPETITIVE                                            │
│ Component: components/analyzer/ux-tab.tsx                        │
│ - Competitive analysis                                           │
│ - Market positioning                                             │
│ - Feature comparison                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    User Actions:
    - "Quick Sync" button → Refresh data (1-week scan)
    - "Marathon Sync" button → Continuous sync
    - "New Analysis" button → /analyzer
```

---

### **4. Analysis Flow (Analyzer Page)**

```
┌─────────────────────────────────────────────────────────────────┐
│ ANALYZER PAGE                                                    │
│ Page: /analyzer                                                  │
│ Component: frontend/app/analyzer/page.tsx                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    WIZARD FORM:
    
    Step 1: Basic Info
    - Startup name
    - Contract address
    - Chain selection
    
    Step 2: Competitors (optional)
    - Add up to 5 competitors
    - Each: name, chain, address, ABI
    
    Step 3: Duration
    - 7 days (default)
    - 14 days
    - 30 days
                              ↓
    User submits form
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: CREATE CONTRACT CONFIG                                  │
│ POST /api/contracts                                              │
│ Body: { address, chain, name, abi, ... }                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: src/api/routes/contracts.js                            │
│ - Validate contract data                                         │
│ - Create contract config in contracts.json                       │
│ - Return: { id, address, chain, ... }                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: START ANALYSIS                                          │
│ POST /api/analysis/start                                         │
│ Body: { configId, analysisType: 'competitive' }                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: src/api/routes/analysis.js                             │
│ - Check user limits (tier-based)                                │
│ - Create analysis record (status: pending)                       │
│ - Start async analysis process                                  │
│ - Return: { analysisId, status: 'pending' }                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: ANALYSIS EXECUTION (Backend)                            │
│ File: src/index.js (AnalyticsEngine)                            │
│                                                                  │
│ 1. Initialize RPC clients for target chain                      │
│ 2. Determine block range (smart/legacy)                         │
│ 3. Fetch transactions from blockchain                           │
│ 4. Normalize data (ChainNormalizer)                             │
│ 5. Calculate DeFi metrics (DeFiMetricsCalculator)               │
│ 6. Analyze user behavior (UserBehaviorAnalyzer)                 │
│ 7. Generate AI insights (GeminiAIService)                       │
│ 8. Store results in analyses.json                               │
│ 9. Update status to 'completed'                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: PROGRESS MONITORING (Frontend)                          │
│ Component: components/analyzer/loading-screen.tsx                │
│                                                                  │
│ Poll every 2 seconds:                                            │
│ GET /api/analysis/:id/status                                     │
│                                                                  │
│ Returns:                                                         │
│ - status: 'pending' | 'running' | 'completed' | 'failed'        │
│ - progress: 0-100                                                │
│ - currentStep: 'Fetching data' | 'Analyzing' | ...              │
│ - logs: [...]                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    When status === 'completed':
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: FETCH RESULTS                                           │
│ GET /api/analysis/:id/results                                    │
│                                                                  │
│ Returns complete analysis data:                                  │
│ - metrics: { tvl, volume, users, ... }                          │
│ - transactions: [...]                                            │
│ - userBehavior: { engagement, retention, ... }                  │
│ - aiInsights: { swot, recommendations, ... }                    │
│ - competitiveAnalysis: { ... }                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    Display results in dashboard tabs
    (Same 5 tabs as Dashboard page)
```

---

## 🔌 API Client Architecture

### **File**: `frontend/lib/api.ts`

**Features**:
- Automatic retry with exponential backoff
- Request timeout (60s)
- JWT token management
- Error handling with user-friendly messages
- Type-safe TypeScript interfaces

**Retry Logic**:
```typescript
maxRetries: 2
baseDelay: 1000ms
maxDelay: 5000ms
timeout: 60000ms

Retryable errors:
- Network timeouts
- Connection refused
- Failed to fetch
- Network errors
```

**Token Management**:
```typescript
// Store token
localStorage.setItem('token', token)

// Send in requests
headers: {
  'Authorization': `Bearer ${token}`
}

// Remove on logout
localStorage.removeItem('token')
```

---

## 🔐 Authentication Flow

### **AuthProvider** (`components/auth/auth-provider.tsx`)

**State Management**:
```typescript
interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token, user) => void
  logout: () => void
  isAuthenticated: boolean
}
```

**Protected Routes**:
```typescript
PUBLIC_ROUTES = ['/', '/login', '/signup', '/verify']

If not authenticated && not public route:
  → Redirect to /login?redirect={currentPath}
```

**Initialization**:
```typescript
useEffect(() => {
  // Load from localStorage
  const token = localStorage.getItem('token')
  const user = localStorage.getItem('user')
  
  if (token && user) {
    setToken(token)
    setUser(JSON.parse(user))
  }
  
  setIsLoading(false)
}, [])
```

---

## 📊 Data Flow Patterns

### **Pattern 1: Simple GET Request**

```typescript
// Frontend
const data = await api.users.getProfile()

// Backend
router.get('/api/users/profile', authenticateToken, async (req, res) => {
  const user = await UserStorage.findById(req.user.id)
  res.json(user)
})
```

### **Pattern 2: POST with Body**

```typescript
// Frontend
const result = await api.contracts.create({
  address: '0x...',
  chain: 'lisk',
  name: 'MyContract'
})

// Backend
router.post('/api/contracts', authenticateToken, async (req, res) => {
  const { address, chain, name } = req.body
  const contract = await ContractStorage.create({
    userId: req.user.id,
    address,
    chain,
    name
  })
  res.json(contract)
})
```

### **Pattern 3: Long-Running Analysis**

```typescript
// Frontend
// 1. Start analysis
const { analysisId } = await api.analysis.start(configId)

// 2. Poll for status
const interval = setInterval(async () => {
  const status = await api.analysis.getStatus(analysisId)
  
  if (status.status === 'completed') {
    clearInterval(interval)
    const results = await api.analysis.getResults(analysisId)
    // Display results
  }
}, 2000)

// Backend
// 1. Create analysis record
const analysis = await AnalysisStorage.create({
  userId,
  configId,
  status: 'pending'
})

// 2. Start async process
startAnalysisAsync(analysis.id, config)

// 3. Update status periodically
await AnalysisStorage.update(analysisId, {
  status: 'running',
  progress: 50
})

// 4. Complete
await AnalysisStorage.update(analysisId, {
  status: 'completed',
  results: analysisData
})
```

---

## 🎯 Key UI Components

### **1. Dashboard Header**
- Contract selector dropdown
- Chain badge
- Quick actions (Sync, New Analysis)
- User menu

### **2. Metrics Cards**
- TVL display with trend
- Transaction count
- Unique users
- Gas efficiency
- Color-coded status indicators

### **3. Charts**
- Area charts (TVL over time)
- Bar charts (Transaction volume)
- Donut charts (User distribution)
- Line charts (Trends)
- Spark lines (Mini trends)

### **4. Data Tables**
- Paginated transaction lists
- Sortable columns
- Filterable data
- Export options (CSV/JSON)

### **5. Progress Indicators**
- Linear progress bars
- Circular loaders
- Step indicators
- Real-time status updates

### **6. AI Insights Cards**
- SWOT analysis display
- Recommendations list
- Risk assessment
- Performance scoring

---

## 🔄 Real-Time Features

### **WebSocket Connection** (Planned)
```typescript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:5000/ws')

// Listen for updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  if (data.type === 'analysis_progress') {
    updateProgress(data.progress)
  }
}
```

### **Polling (Current Implementation)**
```typescript
// Poll every 2 seconds
const pollInterval = setInterval(async () => {
  const status = await api.analysis.getStatus(analysisId)
  updateUI(status)
  
  if (status.status === 'completed') {
    clearInterval(pollInterval)
  }
}, 2000)
```

---

## 🎨 UI/UX Features

### **Responsive Design**
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Collapsible sidebars
- Adaptive layouts

### **Dark Mode**
- System preference detection
- Manual toggle
- Persistent preference
- Smooth transitions

### **Loading States**
- Skeleton loaders
- Animated spinners
- Progress bars
- Shimmer effects

### **Error Handling**
- Toast notifications
- Inline error messages
- Retry buttons
- Fallback UI

### **Accessibility**
- ARIA labels
- Keyboard navigation
- Focus indicators
- Screen reader support

---

## 📱 Mobile Optimization

### **Touch Interactions**
- Swipe gestures
- Pull-to-refresh
- Touch-friendly buttons (min 44px)
- Bottom navigation

### **Performance**
- Code splitting
- Lazy loading
- Image optimization
- Minimal bundle size

---

## 🔍 Search & Filters

### **Contract Search**
- Search by address
- Filter by chain
- Sort by metrics
- Recent contracts

### **Transaction Filters**
- Date range
- Transaction type
- Value range
- Status (success/failed)

### **User Filters**
- Activity level
- Lifecycle stage
- Transaction count
- Value range

---

## 📈 Analytics Visualization

### **Chart Types Used**
1. **Area Charts**: TVL trends, volume over time
2. **Bar Charts**: Transaction counts, user distribution
3. **Line Charts**: Price trends, gas costs
4. **Donut Charts**: User segments, transaction types
5. **Funnel Charts**: User journey, conversion rates
6. **Spark Lines**: Mini trend indicators

### **Data Aggregation**
- Daily/Weekly/Monthly views
- Moving averages
- Percentage changes
- Comparative analysis

---

## 🚀 Performance Optimizations

### **Frontend**
- React Server Components (Next.js 16)
- Automatic code splitting
- Image optimization (next/image)
- Font optimization (next/font)
- Static generation where possible

### **API Calls**
- Request deduplication
- Response caching
- Parallel requests
- Retry with backoff

### **State Management**
- Context API for global state
- Local state for component-specific
- Memoization (useMemo, useCallback)
- Lazy initialization

---

## 🐛 Error Scenarios & Handling

### **Network Errors**
```typescript
try {
  const data = await api.contracts.list()
} catch (error) {
  if (error.name === 'NetworkError') {
    showToast('Cannot connect to server')
  } else if (error.name === 'BackendTimeout') {
    showToast('Server not responding')
  } else {
    showToast('An error occurred')
  }
}
```

### **Authentication Errors**
```typescript
if (response.status === 401) {
  // Token expired
  logout()
  router.push('/login')
}
```

### **Validation Errors**
```typescript
if (response.status === 400) {
  // Show field-specific errors
  setFieldError('email', 'Invalid email format')
}
```

---

## 📝 Form Validation

### **Zod Schemas**
```typescript
const OnboardingSchema = z.object({
  contractAddress: z.string().min(1, 'Required'),
  chain: z.string().min(1, 'Required'),
  contractName: z.string().min(2, 'Min 2 chars'),
  purpose: z.string().min(10, 'Min 10 chars'),
  category: z.string().min(1, 'Required'),
  startDate: z.string().min(1, 'Required'),
})
```

### **React Hook Form Integration**
```typescript
const form = useForm({
  resolver: zodResolver(OnboardingSchema),
  mode: 'onSubmit',
  defaultValues: { ... }
})

const onSubmit = async (data) => {
  // Data is validated
  await api.onboarding.complete(data)
}
```

---

## 🎯 Key Takeaways

### **Strengths**
✅ Type-safe API client with TypeScript
✅ Comprehensive error handling
✅ Retry logic for network resilience
✅ Protected routes with auth checks
✅ Real-time progress monitoring
✅ Responsive design (mobile-friendly)
✅ Dark mode support
✅ Form validation with Zod
✅ Modular component architecture

### **Areas for Improvement**
⚠️ Implement WebSocket for real-time updates (currently polling)
⚠️ Add request caching layer
⚠️ Implement optimistic UI updates
⚠️ Add offline support (Service Worker)
⚠️ Improve loading states consistency
⚠️ Add comprehensive error boundaries
⚠️ Implement analytics tracking
⚠️ Add A/B testing framework

---

**Last Updated**: February 11, 2026
**Status**: Production Ready
