# API Connectivity Troubleshooting Guide

## Problem: "Failed to fetch" Error

If you're seeing `Failed to fetch` errors in the browser console, follow this guide to diagnose and fix the issue.

## Quick Diagnostics

### Step 1: Check API Server Status

Open browser console and run:
```javascript
__API_DIAGNOSTICS__.runFullDiagnostics()
```

This will check:
- ✅ API server connectivity
- ✅ HTTP status codes
- ✅ Response time
- ✅ Network connectivity
- ✅ CORS configuration

### Step 2: Verify Environment Variables

In the frontend folder, check `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Common issues:**
- ❌ Port mismatch (e.g., 3001 instead of 5000)
- ❌ Wrong hostname (e.g., 127.0.0.1 instead of localhost)
- ❌ Environment variable not set

### Step 3: Ensure Backend is Running

```bash
cd src
npm run dev
```

OR if using the root package.json:
```bash
npm run dev --workspace=src
```

The backend should start on port 5000:
```
✓ Server running at http://localhost:5000
```

### Step 4: Verify CORS Configuration

Check `src/api/server.js`:
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

**The frontend runs on:** http://localhost:3000 (default Next.js dev port)  
**The backend expects requests from:** http://localhost:3000

This should match automatically.

## Common Errors and Solutions

### Error 1: "Failed to fetch" - Backend Not Running

**Symptoms:**
- Console shows: `Failed to fetch`
- Network tab shows request fails before reaching server
- Diagnostics shows: "API is offline"

**Solution:**
1. Start the backend server:
   ```bash
   cd src
   npm run dev
   ```

2. Verify it's running at http://localhost:5000:
   ```bash
   curl http://localhost:5000/health
   ```

3. Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "version": "1.0.0"
   }
   ```

### Error 2: CORS Policy Block

**Symptoms:**
- Console shows: `Access to XMLHttpRequest at 'http://localhost:5000/api/...' from origin 'http://localhost:3000' has been blocked by CORS policy`
- Network tab shows: No `Access-Control-Allow-Origin` header

**Solution:**
1. Verify backend CORS middleware is configured:
   ```javascript
   app.use(cors({
     origin: 'http://localhost:3000',  // or process.env.FRONTEND_URL
     credentials: true
   }));
   ```

2. Set FRONTEND_URL environment variable in backend `.env`:
   ```env
   FRONTEND_URL=http://localhost:3000
   ```

3. Restart backend server

### Error 3: Port Already in Use

**Symptoms:**
- Backend fails to start: `Error: listen EADDRINUSE :::5000`
- Diagnostics shows: "Connection refused"

**Solution:**
1. Find process using port 5000:
   ```bash
   # On Windows
   netstat -ano | findstr :5000
   
   # On Mac/Linux
   lsof -i :5000
   ```

2. Kill the process:
   ```bash
   # On Windows
   taskkill /PID <PID> /F
   
   # On Mac/Linux
   kill -9 <PID>
   ```

3. Restart backend on different port:
   ```bash
   PORT=5001 npm run dev
   ```

4. Update frontend `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5001
   ```

### Error 4: Network Timeout

**Symptoms:**
- Console shows: `Request timeout after 30000ms`
- Backend is running but very slow
- Diagnostics shows: Response time > 30000ms

**Solution:**
1. Check backend logs for errors:
   ```bash
   # Look for @TODO errors or stack traces
   ```

2. Increase timeout in `frontend/lib/api.ts`:
   ```typescript
   const RETRY_CONFIG = {
     timeout: 60000  // Increased from 30000
   };
   ```

3. Check backend resource usage:
   ```bash
   # Monitor CPU/memory
   ```

4. Check blockchain RPC connectivity (backend logs)

## Manual Testing

### Test 1: Direct API Call

```javascript
// In browser console
fetch('http://localhost:5000/health')
  .then(r => r.json())
  .then(d => console.log('✅ API is working:', d))
  .catch(e => console.error('❌ API failed:', e))
```

### Test 2: Test with Authentication

```javascript
// In browser console
const token = localStorage.getItem('token');
fetch('http://localhost:5000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(d => console.log('✅ Auth working:', d))
  .catch(e => console.error('❌ Auth failed:', e))
```

### Test 3: Test Registration

```javascript
// In browser console
fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'test123',
    name: 'Test User'
  })
})
  .then(r => r.json())
  .then(d => console.log('✅ Registration working:', d))
  .catch(e => console.error('❌ Registration failed:', e))
```

## Advanced Debugging

### Enable API Debug Logging

In browser console:
```javascript
// Enable debug mode
window.__API_DEBUG__ = true

// Now all API calls will log detailed info
```

### Check Network Tab

1. Open DevTools → Network tab
2. Clear logs
3. Try to register/login
4. Look for failed requests
5. Click on failed request and check:
   - **Request Headers** - Should include Content-Type
   - **Response Headers** - Should include Access-Control-Allow-Origin
   - **Response Body** - Error message from backend

### Check Backend Logs

Look for:
- **@TODO errors** - Timeout issues with blockchain
- **CORS errors** - Origin mismatch
- **Connection errors** - Database or RPC issues
- **404 errors** - Incorrect endpoint

## Checklist

Before submitting an issue, verify:

- [ ] Backend is running (`npm run dev` in src folder)
- [ ] Backend started successfully on port 5000
- [ ] Frontend `.env.local` has correct API_URL
- [ ] Port 5000 is not blocked by firewall
- [ ] No other service is using port 5000
- [ ] Browser console has no CORS errors
- [ ] `/health` endpoint returns 200 OK
- [ ] No typos in endpoint URLs

## Getting Help

If still having issues, provide:

1. Output of:
   ```javascript
   __API_DIAGNOSTICS__.runFullDiagnostics()
   ```

2. Backend startup logs (first 20 lines)

3. Full error message from browser console

4. Environment variables:
   ```bash
   echo $NEXT_PUBLIC_API_URL  # or echo %NEXT_PUBLIC_API_URL% on Windows
   echo $PORT  # Backend port
   ```

5. Network request details (from DevTools Network tab)
