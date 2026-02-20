#!/bin/bash

# Start Full Server with RPC Timeout Protection
# Prevents RPC initialization from blocking server startup

echo "🚀 Starting Full Server with timeout protection..."

# Set environment to skip RPC health checks at startup
export SKIP_RPC_HEALTH_CHECK=true
export RPC_LAZY_INIT=true

# Kill existing servers
pkill -9 -f "node.*server" 2>/dev/null
sleep 2

# Start server
cd /mnt/c/pr0/meta/mvp-workspace
node src/api/server.js &

echo "⏳ Waiting for server to start..."
sleep 5

# Test if server is responding
if curl -s -m 5 http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Full server started successfully!"
    echo "🔗 http://localhost:5000"
    curl -s http://localhost:5000/health | head -5
else
    echo "❌ Server failed to start. Check logs:"
    echo "   tail -f server.log"
fi
