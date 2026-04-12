#!/usr/bin/env node

/**
 * Quick Indexing Check and Fix
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function checkAndFixIndexing() {
  try {
    // Get token from user (you'll need to replace this with actual token)
    const token = process.argv[2];
    if (!token) {
      console.log('❌ Please provide auth token as argument');
      console.log('Usage: node check-indexing.js YOUR_JWT_TOKEN');
      process.exit(1);
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Check indexing status
    console.log('🔍 Checking indexing status...');
    const statusRes = await fetch(`${BASE_URL}/api/indexing/status`, { headers });
    const status = await statusRes.json();
    
    console.log('📊 Status:', JSON.stringify(status, null, 2));

    if (status.needsIndexing) {
      console.log('\n🚀 Triggering indexing...');
      const triggerRes = await fetch(`${BASE_URL}/api/indexing/trigger`, {
        method: 'POST',
        headers
      });
      const result = await triggerRes.json();
      console.log('✅ Trigger result:', JSON.stringify(result, null, 2));
    } else if (status.running) {
      console.log('\n⏳ Indexing is already running...');
    } else if (status.completed) {
      console.log('\n✅ Indexing completed with', status.completed.transactionCount, 'transactions');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAndFixIndexing();
