#!/usr/bin/env node

/**
 * Simplified server WITHOUT streaming indexer
 * For debugging the hanging issue
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import config from './src/config/env.js';

// Import routes
import authRoutes from './src/api/routes/auth.js';
import faucetRoutes from './src/api/routes/faucet.js';

// Import middleware
import { authenticateToken } from './src/api/middleware/auth.js';
import { errorHandler } from './src/api/middleware/errorHandler.js';

// Import database
import { initializeDatabase } from './src/api/database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5002; // Different port to avoid conflict

console.log('🚀 Starting simplified server (no indexer)...');

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    config.frontendUrl
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('✅ Health check hit');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-simplified'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  console.log('✅ Test endpoint hit');
  res.json({ message: 'Server is responding', timestamp: new Date().toISOString() });
});

// API Documentation
app.get('/', (req, res) => {
  console.log('✅ Root endpoint hit');
  res.json({
    name: 'Simplified Analytics API',
    version: '1.0.0-simplified',
    message: 'Server is working without indexer'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/faucet', faucetRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`
  });
});

// Start server
async function startServer() {
  try {
    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized');

    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Simplified Server running on port ${PORT}`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
      console.log(`🧪 Test: http://localhost:${PORT}/test`);
      console.log(`📝 Auth: http://localhost:${PORT}/api/auth/register`);
      console.log(`${'='.repeat(60)}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
