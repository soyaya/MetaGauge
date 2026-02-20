/**
 * Direct HTTP test using Node.js http module
 */

import http from 'http';

console.log('🔍 Testing direct HTTP connection to port 5000...\n');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/health',
  method: 'GET',
  timeout: 3000
};

console.log(`Connecting to: http://${options.hostname}:${options.port}${options.path}`);
console.log('Waiting for response...\n');

const req = http.request(options, (res) => {
  console.log(`✅ Got response! Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`\n📦 Response body:`, data);
    console.log('\n✅ SUCCESS - Backend is responding!');
    process.exit(0);
  });
});

req.on('timeout', () => {
  console.log('⏱️  TIMEOUT - No response after 3 seconds');
  console.log('❌ Backend is NOT responding to HTTP requests');
  req.destroy();
  process.exit(1);
});

req.on('error', (error) => {
  console.log(`❌ ERROR: ${error.message}`);
  console.log(`   Code: ${error.code}`);
  
  if (error.code === 'ECONNREFUSED') {
    console.log('   → Backend is not running or not listening on port 5000');
  } else if (error.code === 'ETIMEDOUT') {
    console.log('   → Connection timed out - backend might be hung');
  }
  
  process.exit(1);
});

req.end();

// Force exit after 5 seconds
setTimeout(() => {
  console.log('\n⏱️  Force exit after 5 seconds');
  process.exit(1);
}, 5000);
