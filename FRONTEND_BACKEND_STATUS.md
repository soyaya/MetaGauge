# Frontend-Backend Connection Status

## ✅ Backend Status (Port 5000)
- Health endpoint: ✅ Working
- Auth endpoints: ✅ Working (register, login, profile)
- Indexer endpoints: ✅ Working (status, health, metrics)
- WebSocket: ✅ Available at ws://localhost:5000/ws

## ✅ Frontend Status (Port 3000)
- Environment: ✅ Configured (API_URL=http://localhost:5000)
- API Client: ✅ Configured with retry logic
- Auth Provider: ✅ Token management working
- Pages: ✅ All pages available

## 🔌 Connection Test Results
```
✅ Health check: healthy
✅ User registration: working
✅ Authentication: working
✅ Indexer status: working
✅ Indexer health: healthy (4 components)
✅ Metrics: available
```

## 📱 Available Frontend Pages
- `/` - Landing page
- `/login` - User login
- `/signup` - User registration
- `/onboarding` - Contract onboarding
- `/analyzer` - Contract analysis
- `/dashboard` - Analysis results
- `/history` - Analysis history
- `/chat` - AI chat interface
- `/profile` - User profile
- `/subscription` - Subscription management

## 🔗 API Endpoints Used by Frontend
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/contracts
GET  /api/contracts
POST /api/analysis/start
GET  /api/analysis/:id/status
GET  /api/analysis/:id/results
POST /api/indexer/start
GET  /api/indexer/status
GET  /api/indexer/health
GET  /api/indexer/metrics
```

## 🚀 How to Start
```bash
# Terminal 1: Start Backend
npm run dev

# Terminal 2: Start Frontend
cd frontend
npm run dev
```

## 🌐 Access URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Docs: http://localhost:5000/api-docs
- WebSocket: ws://localhost:5000/ws

## ✅ Status: FULLY CONNECTED & WORKING
