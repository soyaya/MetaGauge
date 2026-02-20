import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function verifyBackend() {
  console.log('🔍 Verifying backend is running...\n');
  
  const endpoints = [
    '/health',
    '/api/auth/health',
    '/api/health',
    '/'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${BASE_URL}${endpoint}`);
      const response = await axios.get(`${BASE_URL}${endpoint}`, { timeout: 5000 });
      console.log(`✅ SUCCESS - Status: ${response.status}`);
      console.log(`   Response:`, response.data);
      console.log('');
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Connection refused - backend not listening on port 5000`);
      } else if (error.code === 'ETIMEDOUT') {
        console.log(`⏱️  Timeout - backend not responding`);
      } else if (error.response) {
        console.log(`⚠️  Got response but status ${error.response.status}`);
        console.log(`   Response:`, error.response.data);
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
      console.log('');
    }
  }
  
  console.log('\n📋 Summary:');
  console.log('If all endpoints failed with "Connection refused", the backend is not running.');
  console.log('If you see timeouts, the backend might be starting up or hung.');
  console.log('If you see 404s, the backend is running but routes might be different.');
}

verifyBackend().catch(console.error);
