#!/bin/bash

# Start Minimal Backend Server
# No RPC dependencies, instant startup

echo "🚀 Starting Minimal Backend Server..."

# Kill existing processes
echo "1️⃣ Stopping existing servers..."
pkill -9 -f "node.*server" 2>/dev/null
lsof -ti:5000 | xargs kill -9 2>/dev/null
sleep 1

# Start minimal server
echo "2️⃣ Starting minimal server..."
cd /mnt/c/pr0/meta/mvp-workspace
node server-minimal.js &

# Wait and verify
echo "3️⃣ Waiting for server..."
sleep 2

# Test
echo "4️⃣ Testing server..."
if curl -s -m 2 http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Server is running!"
    echo ""
    curl -s http://localhost:5000/health | jq . 2>/dev/null || curl -s http://localhost:5000/health
    echo ""
    echo "🎯 Frontend can now connect!"
else
    echo "❌ Server failed to start"
    echo "Check: node server-minimal.js"
fi
