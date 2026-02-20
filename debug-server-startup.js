#!/usr/bin/env node

/**
 * Debug server startup - trace where it hangs
 */

console.log('🔍 [DEBUG] Starting server debug...');
console.log('🔍 [DEBUG] Step 1: Loading express...');

import express from 'express';
console.log('✅ [DEBUG] Express loaded');

console.log('🔍 [DEBUG] Step 2: Loading cors...');
import cors from 'cors';
console.log('✅ [DEBUG] CORS loaded');

console.log('🔍 [DEBUG] Step 3: Loading http...');
import http from 'http';
console.log('✅ [DEBUG] HTTP loaded');

console.log('🔍 [DEBUG] Step 4: Loading config...');
import config from './src/config/env.js';
console.log('✅ [DEBUG] Config loaded:', { port: config.port, nodeEnv: config.nodeEnv });

console.log('🔍 [DEBUG] Step 5: Creating Express app...');
const app = express();
console.log('✅ [DEBUG] Express app created');

console.log('🔍 [DEBUG] Step 6: Setting up middleware...');
app.use(cors());
app.use(express.json());
console.log('✅ [DEBUG] Middleware configured');

console.log('🔍 [DEBUG] Step 7: Adding test route...');
app.get('/health', (req, res) => {
  console.log('🔍 [DEBUG] Health endpoint hit!');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
console.log('✅ [DEBUG] Test route added');

console.log('🔍 [DEBUG] Step 8: Creating HTTP server...');
const server = http.createServer(app);
console.log('✅ [DEBUG] HTTP server created');

console.log('🔍 [DEBUG] Step 9: Starting to listen on port 5000...');
server.listen(5000, () => {
  console.log('✅ [DEBUG] Server is listening on port 5000');
  console.log('✅ [DEBUG] Server should now respond to requests');
  console.log('🔍 [DEBUG] Test with: curl http://localhost:5000/health');
});

server.on('error', (error) => {
  console.error('❌ [DEBUG] Server error:', error);
});

console.log('🔍 [DEBUG] Step 10: Waiting for listen callback...');
console.log('🔍 [DEBUG] If you see this but not "Server is listening", the listen() call is blocked');
