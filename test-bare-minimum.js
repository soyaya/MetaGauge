/**
 * Absolute bare minimum server test
 * No imports, no dependencies, just raw HTTP
 */

import http from 'http';

const PORT = 5001; // Use different port to avoid conflict

console.log('🔍 Creating bare minimum HTTP server...');

const server = http.createServer((req, res) => {
  console.log(`📥 Request received: ${req.method} ${req.url}`);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Bare minimum server works!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  }));
});

server.listen(PORT, () => {
  console.log(`✅ Bare minimum server running on port ${PORT}`);
  console.log(`🔗 Test it: http://localhost:${PORT}`);
  console.log('\nIf this works, the problem is in the Express app or its dependencies.');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Test the server after 1 second
setTimeout(async () => {
  console.log('\n🧪 Testing the server...');
  try {
    const response = await fetch(`http://localhost:${PORT}/test`);
    const data = await response.json();
    console.log('✅ Server responded:', data);
    console.log('\n🎉 SUCCESS: Basic HTTP server works fine!');
    console.log('The problem is in the Express application or its dependencies.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}, 1000);
