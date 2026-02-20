/**
 * Diagnose server startup issues
 * This script traces exactly where the server hangs during startup
 */

console.log('🔍 Starting server startup diagnosis...\n');

// Track timing
const startTime = Date.now();
let lastCheckpoint = startTime;

function checkpoint(name) {
  const now = Date.now();
  const elapsed = now - lastCheckpoint;
  const total = now - startTime;
  console.log(`✓ ${name} (${elapsed}ms, total: ${total}ms)`);
  lastCheckpoint = now;
}

console.log('1️⃣  Loading express...');
import('express').then(() => {
  checkpoint('Express loaded');
  
  console.log('\n2️⃣  Loading cors...');
  return import('cors');
}).then(() => {
  checkpoint('CORS loaded');
  
  console.log('\n3️⃣  Loading config...');
  return import('./src/config/env.js');
}).then(() => {
  checkpoint('Config loaded');
  
  console.log('\n4️⃣  Loading auth routes...');
  return import('./src/api/routes/auth.js');
}).then(() => {
  checkpoint('Auth routes loaded');
  
  console.log('\n5️⃣  Loading faucet routes...');
  return import('./src/api/routes/faucet.js');
}).then(() => {
  checkpoint('Faucet routes loaded');
  
  console.log('\n6️⃣  Loading database...');
  return import('./src/api/database/index.js');
}).then(() => {
  checkpoint('Database loaded');
  
  console.log('\n7️⃣  Loading streaming indexer...');
  return import('./src/indexer/index.js');
}).then(() => {
  checkpoint('Streaming indexer loaded');
  
  console.log('\n✅ All modules loaded successfully!');
  console.log(`\nTotal time: ${Date.now() - startTime}ms`);
  
  console.log('\n8️⃣  Now testing actual server startup...');
  return import('./src/api/server.js');
}).then(() => {
  checkpoint('Server module loaded');
  console.log('\n🎉 Server started successfully!');
}).catch(error => {
  const elapsed = Date.now() - startTime;
  console.error(`\n❌ Failed after ${elapsed}ms`);
  console.error('Error:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});

// Timeout warning
setTimeout(() => {
  const elapsed = Date.now() - startTime;
  if (elapsed > 5000) {
    console.warn(`\n⚠️  Startup taking longer than expected (${elapsed}ms)`);
    console.warn('This suggests a blocking operation...');
  }
}, 5000);

setTimeout(() => {
  const elapsed = Date.now() - startTime;
  console.error(`\n❌ TIMEOUT: Server failed to start after ${elapsed}ms`);
  console.error('The server is hanging during startup.');
  console.error('\nLast successful checkpoint:', lastCheckpoint - startTime, 'ms');
  process.exit(1);
}, 30000);
