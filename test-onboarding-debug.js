#!/usr/bin/env node

/**
 * Debug onboarding endpoint
 */

import fetch from 'node-fetch';

async function testOnboarding() {
  console.log('🧪 Testing onboarding endpoint...');
  
  // First, login to get a token
  const loginData = {
    email: "frontend-test@example.com",
    password: "testpass123"
  };
  
  try {
    console.log('📤 Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    const loginResult = await loginResponse.json();
    console.log('✅ Login successful, token:', loginResult.token ? 'received' : 'missing');
    
    // Now test onboarding status
    console.log('\n📤 Fetching onboarding status...');
    const response = await fetch('http://localhost:5000/api/onboarding/status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginResult.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Get raw response text first
    const rawText = await response.text();
    console.log('📥 Raw response length:', rawText.length);
    console.log('📥 Raw response (first 500 chars):', rawText.substring(0, 500));
    console.log('📥 Raw response (around position 1350):', rawText.substring(1340, 1360));
    
    // Check for issues
    const nullByteCount = (rawText.match(/\u0000/g) || []).length;
    console.log('📥 Null bytes found:', nullByteCount);
    
    // Try to parse as JSON
    try {
      const jsonData = JSON.parse(rawText);
      console.log('✅ Successfully parsed JSON');
    } catch (parseError) {
      console.log('❌ JSON parse error:', parseError.message);
      console.log('Error position:', parseError.message.match(/position (\d+)/)?.[1]);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testOnboarding().catch(console.error);
