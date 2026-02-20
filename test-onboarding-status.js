#!/usr/bin/env node

/**
 * Test onboarding status endpoint response
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';

async function testOnboardingStatus() {
  console.log('\n🧪 Testing Onboarding Status Endpoint');
  console.log('='.repeat(60));
  
  // You need to replace this with a valid token
  const token = process.env.TEST_TOKEN || 'YOUR_TOKEN_HERE';
  
  if (token === 'YOUR_TOKEN_HERE') {
    console.log('❌ Please set TEST_TOKEN environment variable');
    console.log('   Example: TEST_TOKEN=your_jwt_token node test-onboarding-status.js');
    process.exit(1);
  }
  
  try {
    console.log('\n📡 Calling GET /api/onboarding/status...');
    
    const response = await fetch(`${API_URL}/api/onboarding/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📊 Content-Type: ${response.headers.get('content-type')}`);
    
    // Get raw text first
    const rawText = await response.text();
    console.log(`\n📝 Raw Response Length: ${rawText.length} characters`);
    console.log(`📝 First 200 chars: ${rawText.substring(0, 200)}`);
    
    if (rawText.length > 500) {
      console.log(`📝 Last 200 chars: ${rawText.substring(rawText.length - 200)}`);
    }
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(rawText);
      console.log('\n✅ Valid JSON Response:');
      console.log(JSON.stringify(data, null, 2));
      
      // Check for currentStep
      if (data.currentStep !== undefined) {
        console.log(`\n📍 currentStep type: ${typeof data.currentStep}`);
        console.log(`📍 currentStep value: "${data.currentStep}"`);
        console.log(`📍 currentStep length: ${String(data.currentStep).length}`);
      }
      
    } catch (parseError) {
      console.error('\n❌ JSON Parse Error:', parseError.message);
      console.error('❌ This is the issue causing the frontend error!');
      
      // Try to find where the JSON ends
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonPart = rawText.substring(firstBrace, lastBrace + 1);
        console.log(`\n🔍 Extracted JSON part (${jsonPart.length} chars):`);
        console.log(jsonPart);
        
        const extraPart = rawText.substring(lastBrace + 1);
        if (extraPart.trim()) {
          console.log(`\n⚠️  Extra content after JSON (${extraPart.length} chars):`);
          console.log(extraPart);
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ Request Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
}

testOnboardingStatus();
