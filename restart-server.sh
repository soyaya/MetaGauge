#!/bin/bash

# Quick Server Restart Script
# Fixes RPC timeout issues by cleanly restarting the server

echo "🔧 Restarting Backend Server..."

# Kill all node server processes
echo "1️⃣ Stopping existing processes..."
pkill -9 -f "node.*server.js" 2>/dev/null
pkill -9 -f "npm.*start" 2>/dev/null
sleep 2

# Clear any stuck processes on port 5000
echo "2️⃣ Clearing port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null
sleep 1

# Start server
echo "3️⃣ Starting server..."
cd /mnt/c/pr0/meta/mvp-workspace
npm start > server.log 2>&1 &

# Wait for server to start
echo "4️⃣ Waiting for server to start..."
sleep 5

# Check if server is responding
echo "5️⃣ Testing server..."
if curl -s -m 5 http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Server is running and responding!"
    echo "🔗 Health: http://localhost:5000/health"
    echo "📚 Docs: http://localhost:5000/api-docs"
    curl -s http://localhost:5000/health | jq . 2>/dev/null || curl -s http://localhost:5000/health
else
    echo "❌ Server not responding yet. Check logs:"
    echo "   tail -f server.log"
fi

echo ""
echo "Done! Frontend should now connect successfully."
