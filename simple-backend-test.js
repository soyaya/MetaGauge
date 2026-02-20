/**
 * Simple Backend Test - Minimal dependencies
 * Tests if backend is responding to basic HTTP requests
 */

import http from 'http';

function testEndpoint(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      timeout: 3000
    };

    console.log(`Testing: http://localhost:5000${path}`);
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Response received - Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(`   Data:`, JSON.stringify(json, null, 2).substring(0, 200));
        } catch (e) {
          console.log(`   Data:`, data.substring(0, 200));
        }
        console.log('');
        resolve({ success: true, status: res.statusCode });
      });
    });

    req.on('timeout', () => {
      console.log(`⏱️  TIMEOUT - No response after 3 seconds`);
      console.log('');
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ CONNECTION REFUSED - Backend not listening on port 5000`);
      } else {
        console.log(`❌ ERROR: ${error.message}`);
      }
      console.log('');
      resolve({ success: false, error: error.code });
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 Simple Backend Test\n');
  console.log('Testing basic HTTP connectivity...\n');
  
  const endpoints = ['/health', '/test', '/'];
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }
  
  console.log('\n📋 Test Complete');
  console.log('If all tests timed out, the backend is hung or not responding.');
  console.log('If connection was refused, the backend is not running.');
  console.log('If you see responses, the backend is working!');
}

main().catch(console.error);
