#!/usr/bin/env node

/**
 * Test Authentication Error Handling
 * Verifies improved signup and login error messages
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

class AuthErrorTest {
  constructor() {
    this.results = [];
  }

  async test(description, testFn) {
    try {
      console.log(`🧪 Testing: ${description}`);
      const result = await testFn();
      this.results.push({ description, success: true, result });
      console.log(`✅ PASSED: ${description}`);
      return result;
    } catch (error) {
      this.results.push({ description, success: false, error: error.message });
      console.log(`❌ FAILED: ${description} - ${error.message}`);
      throw error;
    }
  }

  async apiCall(endpoint, data) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const responseData = await response.json();
    return { status: response.status, data: responseData };
  }

  async testSignupErrors() {
    console.log('\n📝 Testing Signup Error Messages\n');

    // Test missing fields
    await this.test('Missing all fields', async () => {
      const { status, data } = await this.apiCall('/api/auth/register', {});
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
      if (!data.message.includes('fill in all fields')) throw new Error('Missing fields error not clear');
      return data.message;
    });

    // Test missing individual fields
    await this.test('Missing email only', async () => {
      const { status, data } = await this.apiCall('/api/auth/register', {
        name: 'Test User',
        password: 'password123'
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
      if (!data.details?.email) throw new Error('Missing email detail not provided');
      return data.message;
    });

    // Test invalid email format
    await this.test('Invalid email format', async () => {
      const { status, data } = await this.apiCall('/api/auth/register', {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
      if (!data.message.includes('valid email')) throw new Error('Invalid email error not clear');
      return data.message;
    });

    // Test weak password
    await this.test('Password too short', async () => {
      const { status, data } = await this.apiCall('/api/auth/register', {
        name: 'Test User',
        email: 'test@example.com',
        password: '123'
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
      if (!data.message.includes('6 characters')) throw new Error('Password length error not clear');
      return data.message;
    });

    // Test name too short
    await this.test('Name too short', async () => {
      const { status, data } = await this.apiCall('/api/auth/register', {
        name: 'A',
        email: 'test@example.com',
        password: 'password123'
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
      if (!data.message.includes('2 characters')) throw new Error('Name length error not clear');
      return data.message;
    });

    // Test successful registration first
    const testEmail = `test-${Date.now()}@example.com`;
    await this.test('Successful registration', async () => {
      const { status, data } = await this.apiCall('/api/auth/register', {
        name: 'Test User',
        email: testEmail,
        password: 'password123'
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
      if (!data.token) throw new Error('No token returned');
      return 'User registered successfully';
    });

    // Test duplicate email
    await this.test('Duplicate email registration', async () => {
      const { status, data } = await this.apiCall('/api/auth/register', {
        name: 'Another User',
        email: testEmail,
        password: 'password123'
      });
      if (status !== 409) throw new Error(`Expected 409, got ${status}`);
      if (!data.message.includes('already exists')) throw new Error('Duplicate email error not clear');
      if (!data.suggestion) throw new Error('No helpful suggestion provided');
      return data.message;
    });
  }

  async testLoginErrors() {
    console.log('\n🔐 Testing Login Error Messages\n');

    // Test missing fields
    await this.test('Missing login credentials', async () => {
      const { status, data } = await this.apiCall('/api/auth/login', {});
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
      if (!data.message.includes('email and password')) throw new Error('Missing credentials error not clear');
      return data.message;
    });

    // Test invalid email format
    await this.test('Invalid email format in login', async () => {
      const { status, data } = await this.apiCall('/api/auth/login', {
        email: 'invalid-email',
        password: 'password123'
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
      if (!data.message.includes('valid email')) throw new Error('Invalid email error not clear');
      return data.message;
    });

    // Test non-existent user
    await this.test('Non-existent user login', async () => {
      const { status, data } = await this.apiCall('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'password123'
      });
      if (status !== 401) throw new Error(`Expected 401, got ${status}`);
      if (!data.message.includes('No account found')) throw new Error('Non-existent user error not clear');
      if (!data.suggestion) throw new Error('No helpful suggestion provided');
      return data.message;
    });

    // Test wrong password (using the user we created earlier)
    const testEmail = `test-${Date.now() - 1000}@example.com`;
    
    // First create a user
    await this.apiCall('/api/auth/register', {
      name: 'Test User',
      email: testEmail,
      password: 'correctpassword'
    });

    await this.test('Wrong password login', async () => {
      const { status, data } = await this.apiCall('/api/auth/login', {
        email: testEmail,
        password: 'wrongpassword'
      });
      if (status !== 401) throw new Error(`Expected 401, got ${status}`);
      if (!data.message.includes('Incorrect password')) throw new Error('Wrong password error not clear');
      if (!data.suggestion) throw new Error('No helpful suggestion provided');
      return data.message;
    });

    // Test successful login
    await this.test('Successful login', async () => {
      const { status, data } = await this.apiCall('/api/auth/login', {
        email: testEmail,
        password: 'correctpassword'
      });
      if (status !== 200) throw new Error(`Expected 200, got ${status}`);
      if (!data.token) throw new Error('No token returned');
      return 'Login successful';
    });
  }

  async run() {
    console.log('🚀 Testing Authentication Error Handling\n');

    try {
      // Check if server is running
      const healthCheck = await fetch(`${BASE_URL}/health`);
      if (!healthCheck.ok) throw new Error('Server not healthy');
      console.log('✅ Server is running\n');

      await this.testSignupErrors();
      await this.testLoginErrors();

      this.printSummary();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 AUTH ERROR HANDLING TEST SUMMARY');
    console.log('='.repeat(60));

    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📊 Success Rate: ${((passed/total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   • ${r.description}: ${r.error}`);
        });
    }

    console.log('\n✅ VERIFIED ERROR MESSAGES:');
    this.results
      .filter(r => r.success && r.result)
      .forEach(r => {
        console.log(`   • ${r.description}: "${r.result}"`);
      });

    console.log('='.repeat(60));

    if (passed === total) {
      console.log('🎉 All authentication error messages are working correctly!');
    } else {
      console.log('⚠️  Some error messages need improvement.');
    }
  }
}

// Run the test
async function main() {
  const tester = new AuthErrorTest();
  await tester.run();
}

if (process.argv[1].endsWith('test-auth-errors.js')) {
  main();
}

export { AuthErrorTest };
