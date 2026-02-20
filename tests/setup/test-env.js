/**
 * Test Environment Setup
 * 
 * This file runs before each test file to set up the test environment.
 * It configures environment variables, database connections, and global test utilities.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '5001'; // Use different port for tests

// Disable logging during tests
process.env.LOG_LEVEL = 'error';

// Use test database
process.env.DATABASE_TYPE = 'file';
process.env.DATA_DIR = path.join(__dirname, '../../data/test');

// Mock external services
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.ETHERSCAN_API_KEY = 'test-etherscan-key';

// Set shorter timeouts for tests
process.env.REQUEST_TIMEOUT = '5000';
process.env.ANALYSIS_TIMEOUT = '10000';

// Global test utilities
global.testUtils = {
  // Wait helper
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Random string generator
  randomString: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  
  // Random email generator
  randomEmail: () => {
    return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  },
  
  // Random wallet address generator
  randomAddress: (chain = 'ethereum') => {
    if (chain === 'starknet') {
      return '0x' + Array.from({ length: 63 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
    }
    return '0x' + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  },
};

// Increase test timeout for integration tests
jest.setTimeout(30000);

console.log('✅ Test environment initialized');
