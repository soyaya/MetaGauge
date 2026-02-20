#!/usr/bin/env node

/**
 * PostgreSQL Storage Testing Suite
 * Tests all storage classes and methods
 */

import { closePool } from '../src/api/database/postgres.js';
import {
  UserStorage,
  ContractStorage,
  AnalysisStorage,
  ChatSessionStorage,
  ChatMessageStorage
} from '../src/api/database/index.js';

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  return async () => {
    try {
      await fn();
      testResults.passed++;
      testResults.tests.push({ name, status: '✅ PASS' });
      console.log(`✅ ${name}`);
    } catch (error) {
      testResults.failed++;
      testResults.tests.push({ name, status: '❌ FAIL', error: error.message });
      console.error(`❌ ${name}`);
      console.error(`   Error: ${error.message}`);
    }
  };
}

// Test data
let testUser, testContract, testAnalysis, testSession, testMessage;

async function runTests() {
  console.log('🧪 PostgreSQL Storage Testing Suite\n');
  console.log('═'.repeat(60));
  console.log(`Database Type: ${process.env.DATABASE_TYPE || 'file'}\n`);

  // UserStorage Tests
  console.log('\n👥 Testing UserStorage...\n');

  await test('UserStorage.create() - Create user with relations', async () => {
    testUser = await UserStorage.create({
      email: `test-${Date.now()}@example.com`,
      password: 'hashed_password_123',
      name: 'Test User',
      apiKey: `test-key-${Date.now()}`,
      tier: 'free',
      onboarding: { completed: false },
      preferences: { defaultChain: 'ethereum' }
    });
    
    if (!testUser.id) throw new Error('User ID not returned');
    if (!testUser.email) throw new Error('User email not returned');
  })();

  await test('UserStorage.findById() - Find user by ID', async () => {
    const user = await UserStorage.findById(testUser.id);
    if (!user) throw new Error('User not found');
    if (user.email !== testUser.email) throw new Error('Email mismatch');
  })();

  await test('UserStorage.findByEmail() - Find user by email', async () => {
    const user = await UserStorage.findByEmail(testUser.email);
    if (!user) throw new Error('User not found');
    if (user.id !== testUser.id) throw new Error('ID mismatch');
  })();

  await test('UserStorage.findByApiKey() - Find user by API key', async () => {
    const user = await UserStorage.findByApiKey(testUser.apiKey);
    if (!user) throw new Error('User not found');
    if (user.id !== testUser.id) throw new Error('ID mismatch');
  })();

  await test('UserStorage.update() - Update user', async () => {
    const updated = await UserStorage.update(testUser.id, {
      name: 'Updated Test User'
    });
    if (!updated) throw new Error('Update failed');
    if (updated.name !== 'Updated Test User') throw new Error('Name not updated');
  })();

  await test('UserStorage.getOnboarding() - Get user onboarding', async () => {
    const onboarding = await UserStorage.getOnboarding(testUser.id);
    if (!onboarding) throw new Error('Onboarding not found');
    if (onboarding.userId !== testUser.id) throw new Error('User ID mismatch');
  })();

  await test('UserStorage.updateOnboarding() - Update onboarding', async () => {
    const updated = await UserStorage.updateOnboarding(testUser.id, {
      completed: true,
      website: 'https://example.com'
    });
    if (!updated) throw new Error('Update failed');
    if (!updated.completed) throw new Error('Completed not updated');
  })();

  await test('UserStorage.getPreferences() - Get user preferences', async () => {
    const prefs = await UserStorage.getPreferences(testUser.id);
    if (!prefs) throw new Error('Preferences not found');
    if (prefs.userId !== testUser.id) throw new Error('User ID mismatch');
  })();

  await test('UserStorage.updatePreferences() - Update preferences', async () => {
    const updated = await UserStorage.updatePreferences(testUser.id, {
      defaultChain: 'lisk'
    });
    if (!updated) throw new Error('Update failed');
    if (updated.defaultChain !== 'lisk') throw new Error('Chain not updated');
  })();

  await test('UserStorage.findAll() - List all users', async () => {
    const users = await UserStorage.findAll();
    if (!Array.isArray(users)) throw new Error('Not an array');
    if (users.length === 0) throw new Error('No users found');
  })();

  // ContractStorage Tests
  console.log('\n📄 Testing ContractStorage...\n');

  await test('ContractStorage.create() - Create contract', async () => {
    testContract = await ContractStorage.create({
      userId: testUser.id,
      name: 'Test Contract',
      description: 'Test contract description',
      targetContract: {
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
        name: 'Test Token',
        abi: '[]'
      },
      tags: ['test', 'token']
    });
    
    if (!testContract.id) throw new Error('Contract ID not returned');
    if (testContract.userId !== testUser.id) throw new Error('User ID mismatch');
  })();

  await test('ContractStorage.findById() - Find contract by ID', async () => {
    const contract = await ContractStorage.findById(testContract.id);
    if (!contract) throw new Error('Contract not found');
    if (contract.name !== testContract.name) throw new Error('Name mismatch');
  })();

  await test('ContractStorage.findByUserId() - Find contracts by user', async () => {
    const contracts = await ContractStorage.findByUserId(testUser.id);
    if (!Array.isArray(contracts)) throw new Error('Not an array');
    if (contracts.length === 0) throw new Error('No contracts found');
  })();

  await test('ContractStorage.findByUserId() with filters - Search filter', async () => {
    const contracts = await ContractStorage.findByUserId(testUser.id, {
      search: 'Test'
    });
    if (!Array.isArray(contracts)) throw new Error('Not an array');
  })();

  await test('ContractStorage.update() - Update contract', async () => {
    const updated = await ContractStorage.update(testContract.id, {
      name: 'Updated Test Contract'
    });
    if (!updated) throw new Error('Update failed');
    if (updated.name !== 'Updated Test Contract') throw new Error('Name not updated');
  })();

  await test('ContractStorage.countByUserId() - Count user contracts', async () => {
    const count = await ContractStorage.countByUserId(testUser.id);
    if (typeof count !== 'number') throw new Error('Count not a number');
    if (count === 0) throw new Error('Count is zero');
  })();

  await test('ContractStorage.findAll() - List all contracts', async () => {
    const contracts = await ContractStorage.findAll();
    if (!Array.isArray(contracts)) throw new Error('Not an array');
  })();

  // AnalysisStorage Tests
  console.log('\n📊 Testing AnalysisStorage...\n');

  await test('AnalysisStorage.create() - Create analysis', async () => {
    testAnalysis = await AnalysisStorage.create({
      userId: testUser.id,
      configId: testContract.id,
      analysisType: 'quick_scan',
      status: 'pending',
      progress: 0,
      results: null,
      metadata: { test: true },
      logs: ['Analysis started']
    });
    
    if (!testAnalysis.id) throw new Error('Analysis ID not returned');
    if (testAnalysis.userId !== testUser.id) throw new Error('User ID mismatch');
  })();

  await test('AnalysisStorage.findById() - Find analysis by ID', async () => {
    const analysis = await AnalysisStorage.findById(testAnalysis.id);
    if (!analysis) throw new Error('Analysis not found');
    if (analysis.status !== 'pending') throw new Error('Status mismatch');
  })();

  await test('AnalysisStorage.findByUserId() - Find analyses by user', async () => {
    const analyses = await AnalysisStorage.findByUserId(testUser.id);
    if (!Array.isArray(analyses)) throw new Error('Not an array');
    if (analyses.length === 0) throw new Error('No analyses found');
  })();

  await test('AnalysisStorage.findByUserId() with filters - Status filter', async () => {
    const analyses = await AnalysisStorage.findByUserId(testUser.id, {
      status: 'pending'
    });
    if (!Array.isArray(analyses)) throw new Error('Not an array');
  })();

  await test('AnalysisStorage.update() - Update analysis', async () => {
    const updated = await AnalysisStorage.update(testAnalysis.id, {
      status: 'completed',
      progress: 100,
      results: { transactions: 100, users: 50 }
    });
    if (!updated) throw new Error('Update failed');
    if (updated.status !== 'completed') throw new Error('Status not updated');
    if (updated.progress !== 100) throw new Error('Progress not updated');
  })();

  await test('AnalysisStorage.getStats() - Get user stats', async () => {
    const stats = await AnalysisStorage.getStats(testUser.id);
    if (!stats) throw new Error('Stats not returned');
    if (typeof stats.total !== 'number') throw new Error('Total not a number');
    if (typeof stats.completed !== 'number') throw new Error('Completed not a number');
  })();

  await test('AnalysisStorage.getMonthlyCount() - Get monthly count', async () => {
    const count = await AnalysisStorage.getMonthlyCount(
      testUser.id,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    if (typeof count !== 'number') throw new Error('Count not a number');
  })();

  await test('AnalysisStorage.findAll() - List all analyses', async () => {
    const analyses = await AnalysisStorage.findAll();
    if (!Array.isArray(analyses)) throw new Error('Not an array');
  })();

  // ChatSessionStorage Tests
  console.log('\n💬 Testing ChatSessionStorage...\n');

  await test('ChatSessionStorage.create() - Create chat session', async () => {
    testSession = await ChatSessionStorage.create({
      userId: testUser.id,
      title: 'Test Chat',
      contractAddress: testContract.targetAddress,
      contractChain: testContract.targetChain,
      contractName: testContract.name
    });
    
    if (!testSession.id) throw new Error('Session ID not returned');
    if (testSession.userId !== testUser.id) throw new Error('User ID mismatch');
  })();

  await test('ChatSessionStorage.findById() - Find session by ID', async () => {
    const session = await ChatSessionStorage.findById(testSession.id);
    if (!session) throw new Error('Session not found');
    if (session.title !== 'Test Chat') throw new Error('Title mismatch');
  })();

  await test('ChatSessionStorage.findByUserId() - Find sessions by user', async () => {
    const sessions = await ChatSessionStorage.findByUserId(testUser.id);
    if (!Array.isArray(sessions)) throw new Error('Not an array');
    if (sessions.length === 0) throw new Error('No sessions found');
  })();

  await test('ChatSessionStorage.update() - Update session', async () => {
    const updated = await ChatSessionStorage.update(testSession.id, {
      title: 'Updated Test Chat'
    });
    if (!updated) throw new Error('Update failed');
    if (updated.title !== 'Updated Test Chat') throw new Error('Title not updated');
  })();

  await test('ChatSessionStorage.findAll() - List all sessions', async () => {
    const sessions = await ChatSessionStorage.findAll();
    if (!Array.isArray(sessions)) throw new Error('Not an array');
  })();

  // ChatMessageStorage Tests
  console.log('\n💬 Testing ChatMessageStorage...\n');

  await test('ChatMessageStorage.create() - Create message', async () => {
    testMessage = await ChatMessageStorage.create({
      sessionId: testSession.id,
      role: 'user',
      content: 'Test message',
      components: { type: 'text' },
      tokensUsed: 10,
      model: 'gemini-2.5-flash-lite'
    });
    
    if (!testMessage.id) throw new Error('Message ID not returned');
    if (testMessage.sessionId !== testSession.id) throw new Error('Session ID mismatch');
  })();

  await test('ChatMessageStorage.findById() - Find message by ID', async () => {
    const message = await ChatMessageStorage.findById(testMessage.id);
    if (!message) throw new Error('Message not found');
    if (message.content !== 'Test message') throw new Error('Content mismatch');
  })();

  await test('ChatMessageStorage.findBySessionId() - Find messages by session', async () => {
    const messages = await ChatMessageStorage.findBySessionId(testSession.id);
    if (!Array.isArray(messages)) throw new Error('Not an array');
    if (messages.length === 0) throw new Error('No messages found');
  })();

  await test('ChatMessageStorage.findAll() - List all messages', async () => {
    const messages = await ChatMessageStorage.findAll();
    if (!Array.isArray(messages)) throw new Error('Not an array');
  })();

  // Cleanup Tests
  console.log('\n🧹 Testing Cleanup...\n');

  await test('ChatMessageStorage.delete() - Delete message', async () => {
    const result = await ChatMessageStorage.delete(testMessage.id);
    if (!result) throw new Error('Delete failed');
  })();

  await test('ChatSessionStorage.delete() - Delete session', async () => {
    const result = await ChatSessionStorage.delete(testSession.id);
    if (!result) throw new Error('Delete failed');
  })();

  await test('ContractStorage.delete() - Soft delete contract', async () => {
    const result = await ContractStorage.delete(testContract.id);
    if (!result) throw new Error('Delete failed');
  })();

  await test('UserStorage.delete() - Delete user (cascades)', async () => {
    const result = await UserStorage.delete(testUser.id);
    if (!result) throw new Error('Delete failed');
  })();

  // Print Results
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Results\n');
  console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => t.status.includes('FAIL'))
      .forEach(t => {
        console.log(`   - ${t.name}`);
        console.log(`     ${t.error}`);
      });
  }

  console.log('\n' + '═'.repeat(60));
  
  if (testResults.failed === 0) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed!\n');
    process.exit(1);
  }
}

// Run tests
runTests()
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
