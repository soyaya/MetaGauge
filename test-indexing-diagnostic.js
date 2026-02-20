#!/usr/bin/env node

/**
 * Indexing Diagnostic Test
 * Quick test to see what's happening with indexing
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = 'http://localhost:5000';

async function checkIndexingStatus() {
  console.log('🔍 Checking recent user indexing status...\n');
  
  try {
    // Get the most recent test user
    const email = 'ethtest-1771489023535@example.com';
    const password = 'TestPassword123!';
    
    console.log(`📧 Logging in as: ${email}`);
    
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email,
      password
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully\n');
    
    // Check onboarding status
    console.log('📊 Checking onboarding status...');
    const statusResponse = await axios.get(`${API_BASE_URL}/api/onboarding/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Status:', JSON.stringify(statusResponse.data, null, 2));
    
    // Check default contract
    console.log('\n📊 Checking default contract...');
    const contractResponse = await axios.get(`${API_BASE_URL}/api/onboarding/default-contract`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Contract:', JSON.stringify(contractResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkIndexingStatus();
