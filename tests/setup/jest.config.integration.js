import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// Integration tests exercise the real Express app (src/api/server.js), which
// uses a top-level `await import(...)` in src/api/database/index.js to pick
// postgres vs. file storage. That syntax can't be transformed to CommonJS, so
// (unlike tests/pbt and tests/unit) these must run under native ESM via
// `node --experimental-vm-modules`, not the Babel-CJS transform.
export default {
  testEnvironment: 'node',
  transform: {},
  roots: [`${ROOT}/tests/integration`],
  testMatch: ['**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
};
