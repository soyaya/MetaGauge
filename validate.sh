#!/bin/bash
cd /mnt/c/pr0/meta/mvp-workspace

# Start server
node -e "import('./src/api/server.js')" > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for ready
for i in $(seq 1 20); do
  sleep 1
  curl -s http://localhost:5000/health > /dev/null 2>&1 && break
done
sleep 2

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYjFjZDY2Yy1hOTA5LTQ3NGQtODQ1My03NmNmOGQyYjE5ZDQiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJ0aWVyIjoiZnJlZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3NTY2MTk2NywiZXhwIjoxNzc2MjY2NzY3fQ.TBazHI1332_Mq9Tk4S3CMeaJxEwZS0HvzfwTLT6GtLM"
H="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"
B="http://localhost:5000"

chk() {
  local label=$1 res=$2
  echo "$label → $(echo $res | python3 -c "import sys,json; d=json.load(sys.stdin); print('❌ '+str(d.get('error',''))[:55] if 'error' in d else '✅')" 2>/dev/null || echo '❌ no response')"
}

chk "GET  /health"                     "$(curl -s $B/health)"
chk "GET  /api/auth/me"                "$(curl -s -H "$H" $B/api/auth/me)"
chk "GET  /api/subscription/status"    "$(curl -s -H "$H" $B/api/subscription/status)"
chk "GET  /api/subscription/usage"     "$(curl -s -H "$H" $B/api/subscription/usage)"
chk "GET  /api/agent/digest"           "$(curl -s -H "$H" $B/api/agent/digest?type=daily)"
chk "POST /api/agent/feedback"         "$(curl -s -X POST -H "$CT" -H "$H" -d '{"messageId":"m1","rating":1,"componentType":"chart"}' $B/api/agent/feedback)"
chk "POST /api/agent/analyze"          "$(curl -s -X POST -H "$CT" -H "$H" -d '{"contractAddress":"0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE","chain":"ethereum"}' $B/api/agent/analyze)"
chk "POST /api/agent/generate-content" "$(curl -s -X POST -H "$CT" -H "$H" -d '{"type":"investor_summary","contractAddress":"0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE","chain":"ethereum"}' $B/api/agent/generate-content)"
chk "POST /api/agent/chat"             "$(curl -s -X POST -H "$CT" -H "$H" -d '{"message":"hello","contractAddress":"0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE","chain":"ethereum"}' $B/api/agent/chat)"
chk "GET  /api/contracts"              "$(curl -s -H "$H" $B/api/contracts)"
chk "GET  /api/auth/refresh-api-key"   "$(curl -s -X POST -H "$H" $B/api/auth/refresh-api-key)"

kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
