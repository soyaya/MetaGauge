/**
 * Jest Configuration for User Flow Testing
 * 
 * This configuration sets up Jest for testing the mvp-workspace application
 * with support for ES modules, isolated test environments, and comprehensive coverage.
 */

export default {
  // Use node environment for API testing
  testEnvironment: 'node',

  // Support ES modules
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Test file patterns
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/property/**/*.test.js',
    '**/tests/performance/**/*.test.js',
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
    '!**/node_modules/**',
    '!**/tests/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/api/routes/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup/test-env.js'],
  globalTeardown: '<rootDir>/tests/setup/teardown.js',

  // Test timeout (30 seconds for property tests)
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Detect open handles
  detectOpenHandles: true,
  forceExit: true,

  // Max workers for parallel execution
  maxWorkers: '50%',
};
