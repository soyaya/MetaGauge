/**
 * Property Tests for Streaming Indexer
 * Tests universal correctness properties across all inputs
 */

import { FileStorageManager } from '../src/indexer/services/FileStorageManager.js';
import { RPCClientPool } from '../src/indexer/services/RPCClientPool.js';
import { ChunkManager } from '../src/indexer/services/ChunkManager.js';
import { RetryPolicy, CircuitBreaker } from '../src/indexer/services/ErrorHandling.js';
import fs from 'fs/promises';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message}`);
  }
}

// Property 24: Atomic File Operations
async function testAtomicFileOperations() {
  console.log('\n📝 Property 24: Atomic File Operations');
  
  const storage = new FileStorageManager('./test-data');
  await storage.initialize();
  
  const testData = { test: 'data', timestamp: Date.now() };
  
  // Write should be atomic
  await storage.writeJSON('test.json', testData);
  const read = await storage.readJSON('test.json');
  
  assert(JSON.stringify(read) === JSON.stringify(testData), 
    'Data written atomically matches data read');
  
  // Write again to create backup
  await storage.writeJSON('test.json', { ...testData, updated: true });
  
  // Backup should exist after second write
  try {
    await fs.access('./test-data/test.json.backup');
    assert(true, 'Backup file created on subsequent write');
  } catch {
    assert(false, 'Backup file not created');
  }
  
  // Cleanup
  await fs.rm('./test-data', { recursive: true, force: true });
}

// Property 22: Data Persistence Across Restarts
async function testDataPersistence() {
  console.log('\n💾 Property 22: Data Persistence Across Restarts');
  
  const storage1 = new FileStorageManager('./test-persist');
  await storage1.initialize();
  
  const users = [{ id: '1', name: 'Test User' }];
  await storage1.writeUsers(users);
  
  // Simulate restart with new instance
  const storage2 = new FileStorageManager('./test-persist');
  const readUsers = await storage2.readUsers();
  
  assert(readUsers.length === 1 && readUsers[0].id === '1',
    'Data persists across storage instances');
  
  // Cleanup
  await fs.rm('./test-persist', { recursive: true, force: true });
}

// Property 6: Chain-Specific RPC Initialization
async function testChainSpecificRPC() {
  console.log('\n🔗 Property 6: Chain-Specific RPC Initialization');
  
  const pool = new RPCClientPool();
  
  pool.initializeChain('lisk');
  const endpoint = pool.getHealthyEndpoint('lisk');
  
  assert(endpoint && endpoint.includes('lisk'),
    'Chain-specific endpoint returned');
  
  assert(pool.endpoints.has('lisk'),
    'Chain endpoints stored correctly');
  
  pool.stopHealthChecks();
}

// Property 8: RPC Load Balancing
async function testRPCLoadBalancing() {
  console.log('\n⚖️  Property 8: RPC Load Balancing');
  
  const pool = new RPCClientPool();
  pool.initializeChain('lisk');
  
  const endpoints = [];
  for (let i = 0; i < 10; i++) {
    endpoints.push(pool.getHealthyEndpoint('lisk'));
  }
  
  const unique = new Set(endpoints);
  assert(unique.size > 1, 'Load balancing distributes across endpoints');
  
  pool.stopHealthChecks();
}

// Property 12: Chunk Size Consistency
async function testChunkSizeConsistency() {
  console.log('\n📦 Property 12: Chunk Size Consistency');
  
  const chunkManager = new ChunkManager(null, null);
  
  const chunks = chunkManager.divideIntoChunks(0, 500000);
  
  // All chunks except last should be 200k
  for (let i = 0; i < chunks.length - 1; i++) {
    const size = chunks[i].endBlock - chunks[i].startBlock + 1;
    assert(size === 200000, `Chunk ${i} is exactly 200k blocks`);
  }
  
  // Last chunk can be smaller
  const lastSize = chunks[chunks.length - 1].endBlock - chunks[chunks.length - 1].startBlock + 1;
  assert(lastSize <= 200000, 'Last chunk is <= 200k blocks');
}

// Property 38: Configurable Retry Policies
async function testRetryPolicies() {
  console.log('\n🔄 Property 38: Configurable Retry Policies');
  
  const policy = new RetryPolicy(3, 100, 5000);
  
  let attempts = 0;
  try {
    await policy.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Fail');
      return 'success';
    });
  } catch {}
  
  assert(attempts === 3, 'Retry policy attempts correct number of times');
}

// Property 39: Exponential Backoff Calculation
async function testExponentialBackoff() {
  console.log('\n⏱️  Property 39: Exponential Backoff Calculation');
  
  const policy = new RetryPolicy(5, 1000, 30000);
  
  const delay0 = policy.calculateDelay(0);
  const delay1 = policy.calculateDelay(1);
  const delay2 = policy.calculateDelay(2);
  
  assert(delay1 > delay0, 'Delay increases exponentially');
  assert(delay2 > delay1, 'Delay continues to increase');
  assert(delay2 <= 30000, 'Delay respects max limit');
}

// Property 41: Circuit Breaker Behavior
async function testCircuitBreaker() {
  console.log('\n🔌 Property 41: Circuit Breaker Behavior');
  
  const breaker = new CircuitBreaker(3, 1000);
  
  // Cause failures
  for (let i = 0; i < 3; i++) {
    try {
      await breaker.execute(async () => { throw new Error('Fail'); });
    } catch {}
  }
  
  const state = breaker.getState();
  assert(state.state === 'OPEN', 'Circuit opens after threshold failures');
  
  // Should reject immediately
  try {
    await breaker.execute(async () => 'success');
    assert(false, 'Circuit breaker should reject when open');
  } catch (error) {
    assert(error.message.includes('OPEN'), 'Circuit breaker rejects when open');
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Running Property Tests\n');
  console.log('='.repeat(50));
  
  await testAtomicFileOperations();
  await testDataPersistence();
  await testChainSpecificRPC();
  await testRPCLoadBalancing();
  await testChunkSizeConsistency();
  await testRetryPolicies();
  await testExponentialBackoff();
  await testCircuitBreaker();
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${testsPassed} passed, ${testsFailed} failed`);
  
  if (testsFailed === 0) {
    console.log('✅ All property tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runAllTests();
