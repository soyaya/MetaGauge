# How to Start the Backend Server

## The Problem
The streaming indexer was blocking the Node.js event loop during initialization, preventing the server from responding to HTTP requests.

## The Fix
I've disabled the streaming indexer initialization in `src/api/server.js`. The server will now start immediately and respond to requests.

## Steps to Start

### 1. Kill All Existing Node Processes

**Option A: Using Task Manager**
1. Press `Ctrl+Shift+Esc`
2. Go to "Details" tab
3. Find ALL "node.exe" processes
4. Right-click each and select "End task"

**Option B: Using Command Prompt (as Administrator)**
```cmd
taskkill /F /IM node.exe
```

### 2. Start the Backend

Open a terminal in the `mvp-workspace` directory and run:

```bash
node src/api/server.js
```

You should see:
```
✅ Using file-based storage
⚠️  Streaming indexer is DISABLED to prevent server hang
⚠️  Server will run without streaming indexer features
🔍 Checking for stuck analyses...
✅ No stuck analyses found
🚀 Multi-Chain Analytics API Server running on port 5000
📚 API Documentation: http://localhost:5000/api-docs
🔍 Health Check: http://localhost:5000/health
🔌 WebSocket: ws://localhost:5000/ws
💾 Using file-based storage in ./data directory
```

### 3. Test the Server

In another terminal, run:

```bash
node test-signup-flow.js
```

This will test:
- Health endpoint
- Registration
- Login
- Protected routes

All tests should pass in < 10 seconds.

### 4. Test in Frontend

Open `http://localhost:3000/signup` and try to register a new user.
It should work immediately without any timeout.

## What's Disabled

The following features are temporarily disabled:
- Streaming indexer
- Real-time blockchain indexing
- WebSocket updates for indexing progress

## What Still Works

Everything else works normally:
- User registration and login
- Contract management
- Analysis (without real-time indexing)
- Chat
- Onboarding
- Faucet
- All API endpoints

## Re-enabling the Streaming Indexer

To re-enable the streaming indexer, we need to fix it to not block during initialization. This requires:

1. Making RPC health checks truly async
2. Deferring heavy initialization until after server starts
3. Using proper lazy loading for all components

For now, the server works without it.

## Troubleshooting

### Server still not responding?
- Make sure ALL Node processes are killed
- Check if another process is using port 5000: `netstat -ano | findstr :5000`
- Try restarting your computer if processes won't die

### Port 5000 in use?
- Kill the process using it
- Or change the port in `.env`: `PORT=5001`

### Frontend still timing out?
- Make sure backend is actually running
- Check the backend terminal for errors
- Try `curl http://localhost:5000/health` to test directly
