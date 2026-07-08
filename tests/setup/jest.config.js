import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: `${ROOT}/babel.config.cjs` }],
  },
  // roots tells jest where to search for tests
  roots: [
    `${ROOT}/tests/pbt`,
    `${ROOT}/tests/integration`,
    `${ROOT}/tests/unit`,
  ],
  testMatch: ['**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  coverageDirectory: `${ROOT}/coverage`,
  collectCoverageFrom: [
    `${ROOT}/src/services/**/*.js`,
    `${ROOT}/src/api/routes/**/*.js`,
    `!**/node_modules/**`,
  ],
  coverageReporters: ['text', 'lcov'],
};
