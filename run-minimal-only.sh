#!/bin/bash
# Keep only minimal server running

echo "🔧 Ensuring only minimal server runs..."

# Kill ALL node server processes
pkill -9 -f "node.*server" 2>/dev/null
pkill -9 -f "npm.*start" 2>/dev/null
sleep 2

# Start minimal server
cd /mnt/c/pr0/meta/mvp-workspace
node server-minimal.js &

echo "✅ Minimal server started"
echo "🔗 Test: curl http://localhost:5000/health"
