#!/usr/bin/env node

/**
 * Minimal server test - just Express with routes
 */

import express from 'express';
import cors from 'cors';
import http from 'http';

const app = express();
const PORT = 5003;

// Create HTTP server
const server = http.createServer(app);

console.log('🔧 Setting up middleware...');

// Middleware
app.use(cors());
app.use(express.json());

console.log('🔧 Setting up routes...');

// Health check
app.get('/health', (req, res) => {
  console.log('[HEALTH] Request received');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('[TEST] Request received');
  res.json({ message: 'Server is responding' });
});

// Test POST
app.post('/api/auth/register', async (req, res) => {
  console.log('[REGISTER] Request received:', req.body);
  res.json({ success: true, message: 'Test registration' });
});

console.log('🚀 Starting server...');

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔍 Test: http://localhost:${PORT}/health`);
});

// Error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

console.log('📝 Server setup complete, waiting for listen callback...');
