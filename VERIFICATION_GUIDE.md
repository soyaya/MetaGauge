# MetaGauge System Verification Guide

This guide provides comprehensive testing and verification of the entire MetaGauge system.

## 🚀 Quick Start

### Prerequisites
1. **Start Backend Server**
   ```bash
   npm run dev
   # Server should be running on http://localhost:5000
   ```

2. **Start Frontend Server** (in separate terminal)
   ```bash
   cd frontend
   npm run dev
   # Frontend should be running on http://localhost:3000
   ```

### Run Complete System Verification
```bash
npm run verify:system
```

This will test:
- ✅ Server health and dependencies
- ✅ All API endpoints and routes
- ✅ Complete user flow (registration → onboarding → analytics)
- ✅ Frontend routes and pages
- ✅ WebSocket connections
- ✅ AI features and chat
- ✅ Subscription system
- ✅ Real-time indexing

## 📋 Individual Test Suites

### 1. API Routes Verification
```bash
npm run verify:routes
```
Tests all backend API endpoints:
- Authentication (register, login, API keys)
- Onboarding flow
- Contract management
- Analytics and metrics
- AI features (chat, advice)
- Subscription and billing
- Monitoring and health checks

### 2. Frontend Routes Verification
```bash
npm run verify:frontend
```
Tests all frontend pages:
- Public routes (landing, login, signup)
- Protected routes (dashboard, analyzer, chat)
- Static assets and 404 handling

### 3. Complete User Flow Test
```bash
npm run verify:flow
```
Tests end-to-end user journey:
- User registration and authentication
- Contract onboarding with indexing
- Real-time analytics updates
- AI chat interactions
- WebSocket real-time features

## 🔍 What Gets Tested

### Backend API (50+ endpoints)
```
✅ Authentication & User Management
   POST /api/auth/register
   POST /api/auth/login
   GET  /api/auth/me
   POST /api/auth/refresh-api-key

✅ Onboarding & Contract Setup
   POST /api/onboarding/complete
   GET  /api/onboarding/default-contract
   POST /api/onboarding/trigger-indexing

✅ Analytics & Metrics
   GET  /api/enhanced-metrics/analysis
   GET  /api/enhanced-metrics/users
   GET  /api/functions/signatures
   GET  /api/contracts

✅ AI Features
   POST /api/chat/sessions
   POST /api/chat/message
   GET  /api/chat/sessions
   POST /api/advice/generate

✅ Advanced Features
   GET  /api/competitive/analysis
   GET  /api/wallet-analytics/enrichment
   POST /api/alerts/configure

✅ Subscription & Billing
   GET  /api/subscription/status
   GET  /api/subscription/usage
   GET  /api/billing/info

✅ Monitoring & Health
   GET  /health
   GET  /api/monitoring/health
   GET  /api/indexer/health
   GET  /api/indexer/status
```

### Frontend Routes (15+ pages)
```
✅ Public Pages
   /                    (Landing page)
   /login              (Authentication)
   /signup             (Registration)
   /forgot-password    (Password reset)
   /verify             (Email verification)

✅ Protected Pages
   /dashboard          (Main dashboard)
   /onboarding         (Contract setup)
   /analyzer           (Analytics interface)
   /chat               (AI chat)
   /profile            (User settings)
   /subscription       (Billing)
   /alerts             (Notifications)
   /history            (Analysis history)

✅ Assets & Error Handling
   /favicon.ico        (Static assets)
   /404                (Error pages)
```

### User Flow Features
```
✅ Complete Registration Flow
   - Email validation
   - Password requirements
   - JWT token generation

✅ Contract Onboarding
   - Contract address validation
   - Chain selection (Ethereum/Starknet)
   - ABI detection
   - Indexing initiation

✅ Real-time Analytics
   - Historical data fetching (50 transactions)
   - Live transaction monitoring
   - WebSocket progress updates
   - Metrics calculation

✅ AI Integration
   - Chat session creation
   - Natural language queries
   - AI-powered insights
   - Contract analysis

✅ Advanced Features
   - Subscription tier management
   - Alert configuration
   - Competitive analysis
   - Function signature detection
```

## 📊 Expected Results

### Healthy System Output
```
🎯 METAGAUGE SYSTEM VERIFICATION REPORT
================================================================================

🖥️  SERVER STATUS:
   Backend:  ✅ Running (Healthy)
   Frontend: ✅ Running (Healthy)

🔌 API ROUTES:
   Tested: 45 endpoints
   Passed: 42 (93.3%)
   Failed: 3

🔄 USER FLOW:
   Steps: 8
   Passed: 8 (100.0%)
   Failed: 0

🎯 OVERALL ASSESSMENT:
   Score: 91.2%
   Status: 🎉 EXCELLENT - System is production ready!
```

### Common Issues & Solutions

#### Backend Not Running
```
❌ Backend: Not running - connect ECONNREFUSED
```
**Solution**: Start backend server
```bash
npm run dev
```

#### Frontend Not Running
```
❌ Frontend: Not running - connect ECONNREFUSED
```
**Solution**: Start frontend server
```bash
cd frontend && npm run dev
```

#### Database Connection Issues
```
❌ Failed endpoints related to user/contract storage
```
**Solution**: Check file permissions and storage directory
```bash
ls -la data/
mkdir -p data
chmod 755 data
```

#### Missing Environment Variables
```
⚠️ GEMINI_API_KEY: Not set
```
**Solution**: Set up environment variables
```bash
cp .env.example .env
# Edit .env with your API keys
```

#### RPC Connection Issues
```
❌ Contract indexing failed - RPC timeout
```
**Solution**: Check RPC endpoints in .env
```bash
# Verify RPC URLs are accessible
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $ETHEREUM_RPC_URL1
```

## 🐛 Debugging Failed Tests

### Enable Debug Mode
```bash
DEBUG=1 npm run verify:system
```

### Check Specific Components
```bash
# Test only authentication
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'

# Test health endpoint
curl http://localhost:5000/health

# Test frontend
curl http://localhost:3000
```

### View Server Logs
```bash
# Backend logs
tail -f server.log

# Analysis logs  
tail -f analysis-debug.log
```

## 🔧 Performance Benchmarks

### Expected Response Times
- Health check: < 50ms
- Authentication: < 200ms
- Contract onboarding: < 2s
- Historical indexing: 30s - 2min (depending on contract activity)
- AI chat response: 2-5s
- Real-time updates: < 100ms

### Resource Usage
- Memory: 200-500MB (backend)
- CPU: 10-30% during indexing
- Disk: 10-100MB (transaction data)
- Network: 1-10 RPC calls/second

## 📈 Continuous Monitoring

### Automated Testing
Add to CI/CD pipeline:
```yaml
# .github/workflows/test.yml
- name: System Verification
  run: |
    npm run dev &
    cd frontend && npm run dev &
    sleep 30
    npm run verify:system
```

### Health Monitoring
```bash
# Periodic health checks
watch -n 30 'curl -s http://localhost:5000/health | jq'

# Monitor indexing progress
watch -n 10 'curl -s http://localhost:5000/api/indexer/status | jq'
```

## 🎯 Success Criteria

### Production Ready Checklist
- [ ] All servers running and healthy
- [ ] 90%+ API endpoints working
- [ ] Complete user flow functional
- [ ] Real-time features operational
- [ ] AI integration working
- [ ] No memory leaks or resource issues
- [ ] Response times within benchmarks
- [ ] Error handling graceful

### Deployment Readiness
- [ ] Environment variables configured
- [ ] Database connections stable
- [ ] RPC endpoints reliable
- [ ] WebSocket connections stable
- [ ] Security measures in place
- [ ] Monitoring and logging active

---

**Need Help?** 
- Check the main README.md for setup instructions
- Review server logs for detailed error messages
- Ensure all dependencies are installed
- Verify environment configuration
