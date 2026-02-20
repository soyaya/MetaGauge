/**
 * Test complete streaming indexer integration
 */

import WebSocket from 'ws';

const API_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

// Test user credentials
const testUser = {
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'Test123!@#'
};

let authToken = null;
let userId = null;

async function register() {
  console.log('📝 Registering user...');
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Registration failed: ${error}`);
  }
  
  const data = await response.json();
  authToken = data.token;
  userId = data.user?.id || data.userId;
  console.log(`✅ Registered: ${userId}\n`);
}

async function startIndexing() {
  console.log('🚀 Starting indexing...');
  const response = await fetch(`${API_URL}/api/indexer/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      contractAddress: '0x05D032ac25d322df992303dCa074EE7392C117b9',
      chainId: 'lisk'
    })
  });
  
  const data = await response.json();
  console.log('✅ Indexing started:', data, '\n');
  return data;
}

async function checkStatus() {
  const response = await fetch(`${API_URL}/api/indexer/status`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  const data = await response.json();
  console.log('📊 Status:', data);
  return data;
}

async function connectWebSocket() {
  return new Promise((resolve) => {
    console.log('\n🔌 Connecting to WebSocket...');
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Register user
      ws.send(JSON.stringify({
        type: 'register',
        userId: userId
      }));
      
      resolve(ws);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`📨 [${message.type}]`, JSON.stringify(message.data, null, 2));
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
  });
}

async function stopIndexing() {
  console.log('\n🛑 Stopping indexing...');
  const response = await fetch(`${API_URL}/api/indexer/stop`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  const data = await response.json();
  console.log('✅ Stopped:', data);
}

async function runTest() {
  try {
    await register();
    
    // Connect WebSocket first
    const ws = await connectWebSocket();
    
    // Wait a bit for registration
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start indexing
    await startIndexing();
    
    // Check status a few times
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await checkStatus();
    }
    
    // Stop indexing
    await stopIndexing();
    
    // Final status
    await new Promise(resolve => setTimeout(resolve, 1000));
    await checkStatus();
    
    ws.close();
    console.log('\n✅ Test complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();
