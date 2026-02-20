#!/usr/bin/env node

/**
 * Quick Backend Status Check
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

console.log('🔍 Checking backend status...\n');

async function checkBackend() {
  try {
    console.log(`Attempting to connect to: ${API_BASE_URL}/health`);
    console.log('Waiting for response (timeout: 10 seconds)...\n');
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 10000
    });
    
    console.log('✅ Backend is responding!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\n✅ Backend is ready for testing!\n');
    process.exit(0);
    
  } catch (error) {
    console.log('❌ Backend is NOT responding');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ Connection refused - backend is not running');
      console.log('\n💡 Please start the backend:');
      console.log('   cd mvp-workspace');
      console.log('   npm run dev');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.log('\n❌ Connection timeout - backend may be starting or hung');
      console.log('\n💡 Check if backend process is running');
    } else {
      console.log('\nError:', error.message);
      console.log('Code:', error.code);
    }
    
    console.log('\n');
    process.exit(1);
  }
}

checkBackend();
