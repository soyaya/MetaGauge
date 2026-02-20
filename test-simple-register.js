#!/usr/bin/env node

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

const TEST_USER = {
  email: `quicktest-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Quick Test User',
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
};

console.log('🔍 Testing user registration...\n');
console.log('API URL:', API_BASE_URL);
console.log('User email:', TEST_USER.email);
console.log('\nSending registration request...\n');

axios.post(`${API_BASE_URL}/api/auth/register`, TEST_USER, {
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})
  .then(response => {
    console.log('✅ Registration successful!');
    console.log('User ID:', response.data.user?.id);
    console.log('Token:', response.data.token?.substring(0, 30) + '...');
    console.log('\n✅ Backend is working correctly!\n');
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ Registration failed');
    console.log('Error:', error.code || error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
    console.log('\n');
    process.exit(1);
  });
