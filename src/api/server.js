#!/usr/bin/env node

/**
 * Multi-Chain Smart Contract Analytics API Server
 * RESTful API with file-based storage and dynamic configuration
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocketServer } from 'ws';
import http from 'http';
import config from '../config/env.js';

// Import routes
import authRoutes from './routes/auth.js';
import contractRoutes from './routes/contracts.js';
import analysisRoutes from './routes/analysis.js';
import quickScanRoutes from './routes/quick-scan.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chat.js';
import onboardingRoutes from './routes/onboarding.js';
import { setStreamingIndexer } from './routes/onboarding.js';
import subscriptionRoutes from './routes/subscription.js';
import faucetRoutes from './routes/faucet.js';
import { initializeIndexerRoutes } from './routes/indexer.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

// Import database
import { initializeDatabase, AnalysisStorage } from './database/index.js';

// Import streaming indexer
import { initializeStreamingIndexer } from '../indexer/index.js';
import { WebSocketManager } from '../indexer/services/WebSocketManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = config.port;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize streaming indexer
let streamingIndexer = null;
let wsManager = null;

// DISABLED: Streaming indexer initialization blocks the event loop
// TODO: Fix streaming indexer to not block during initialization
console.log('⚠️  Streaming indexer is DISABLED to prevent server hang');
console.log('⚠️  Server will run without streaming indexer features');

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket client connected');
  
  let userId = null;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Register user
      if (data.type === 'register' && data.userId) {
        userId = data.userId;
        wsManager?.registerClient(userId, ws);
        console.log(`✅ WebSocket client registered: ${userId}`);
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    if (userId && wsManager) {
      wsManager.unregisterClient(userId);
    }
    console.log('🔌 WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  }); 
});

// Make WebSocket server available to routes
app.set('wss', wss);

// CORS Configuration
const getAllowedOrigins = () => {
  // Production: Use CORS_ORIGINS from env
  if (config.nodeEnv === 'production' && config.corsOrigins) {
    return config.corsOrigins;
  }
  
  // Development: Allow localhost and configured frontend
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    config.frontendUrl
  ].filter(Boolean);
};

// Middleware
app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// const analysisLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 100, // limit each IP to 100 analysis requests per hour (increased for testing)
//   message: {
//     error: 'Analysis rate limit exceeded. Please try again later.'
//   }
// });

// app.use(limiter); // Temporarily disabled for testing

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    storage: config.databaseType,
    environment: config.nodeEnv
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  console.log('[TEST] Test endpoint hit');
  res.json({ message: 'Server is responding', timestamp: new Date().toISOString() });
});

// Test POST endpoint
app.post('/test-post', (req, res) => {
  console.log('[TEST] POST endpoint hit with body:', req.body);
  res.json({ 
    message: 'POST received', 
    body: req.body,
    timestamp: new Date().toISOString() 
  });
});

// API Documentation
app.get('/', (req, res) => {
  res.json({
    name: 'Multi-Chain Smart Contract Analytics API',
    version: '1.0.0',
    description: 'Comprehensive blockchain analytics platform with multi-chain support',
    documentation: '/api-docs',
    storage: 'file-based',
    endpoints: {
      auth: '/api/auth',
      contracts: '/api/contracts',
      analysis: '/api/analysis',
      users: '/api/users',
      chat: '/api/chat',
      onboarding: '/api/onboarding',
      subscription: '/api/subscription',
      faucet: '/api/faucet'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);

// TEMPORARY: Simple test registration endpoint
app.post('/api/test-register', async (req, res) => {
  console.log('[TEST-REGISTER] Request received:', req.body);
  try {
    res.json({ 
      success: true, 
      message: 'Test registration endpoint working',
      body: req.body 
    });
  } catch (error) {
    console.error('[TEST-REGISTER] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public chat routes (no authentication required)
app.get('/api/chat/suggested-questions', async (req, res) => {
  try {
    console.log('Public suggested questions endpoint hit:', req.query);
    
    const { contractAddress, contractChain } = req.query;

    if (!contractAddress || !contractChain) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'contractAddress and contractChain are required'
      });
    }

    // Import ChatAIService
    const { default: ChatAIService } = await import('../services/ChatAIService.js');

    // Get contract context (using anonymous user)
    const contractContext = await ChatAIService.getContractContext(
      'anonymous', 
      contractAddress, 
      contractChain
    );

    // Generate suggested questions
    const questions = await ChatAIService.generateSuggestedQuestions(contractContext);

    res.json({
      questions: questions,
      contractAddress,
      contractChain,
      total: questions.length,
      aiEnabled: ChatAIService.isEnabled()
    });

  } catch (error) {
    console.error('Suggested questions error:', error);
    res.status(500).json({
      error: 'Failed to generate suggested questions',
      message: error.message
    });
  }
});

app.use('/api/contracts', authenticateToken, contractRoutes);
app.use('/api/analysis', authenticateToken, analysisRoutes); // analysisLimiter temporarily disabled for testing
app.use('/api/analysis', authenticateToken, quickScanRoutes); // Quick scan route
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/onboarding', authenticateToken, onboardingRoutes);
app.use('/api/subscription', subscriptionRoutes); // Some routes require auth, some don't
app.use('/api/faucet', faucetRoutes); // Public faucet endpoints

// Alert configuration routes
import alertRoutes from './routes/alerts.js';
app.use('/api/alerts', authenticateToken, alertRoutes);

// Monitoring routes
import monitoringRoutes from './routes/monitoring.js';
app.use('/api/monitoring', authenticateToken, monitoringRoutes);

// Streaming indexer routes
if (streamingIndexer) {
  const indexerRoutes = initializeIndexerRoutes(streamingIndexer);
  app.use('/api/indexer', authenticateToken, indexerRoutes);
}

// Serve OpenAPI documentation
app.use('/api-docs', express.static(join(__dirname, 'docs')));

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`
  });
});

// Start server with WebSocket support
async function startServer() {
  try {
    // Initialize file-based storage
    await initializeDatabase();

    // Auto-fix stuck analyses on startup
    console.log('🔍 Checking for stuck analyses...');
    try {
      const allAnalyses = await AnalysisStorage.findAll();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const stuckAnalyses = allAnalyses.filter(analysis => {
        if (analysis.status !== 'running' && analysis.status !== 'pending') {
          return false;
        }
        const createdAt = new Date(analysis.createdAt);
        const refreshStarted = analysis.metadata?.refreshStarted ? 
          new Date(analysis.metadata.refreshStarted) : createdAt;
        return refreshStarted < fiveMinutesAgo;
      });
      
      if (stuckAnalyses.length > 0) {
        console.log(`⚠️  Found ${stuckAnalyses.length} stuck analyses, resetting...`);
        for (const analysis of stuckAnalyses) {
          await AnalysisStorage.update(analysis.id, {
            status: 'failed',
            errorMessage: 'Analysis was stuck from previous session',
            completedAt: new Date().toISOString(),
            metadata: {
              ...analysis.metadata,
              wasStuck: true,
              resetAt: new Date().toISOString()
            }
          });
        }
        console.log(`✅ Reset ${stuckAnalyses.length} stuck analyses`);
      } else {
        console.log('✅ No stuck analyses found');
      }
    } catch (error) {
      console.error('⚠️  Failed to check stuck analyses:', error.message);
    }

    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Multi-Chain Analytics API Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`💾 Using file-based storage in ./data directory`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, starting graceful shutdown...');
  
  // Stop all monitoring services
  try {
    const { default: ContinuousMonitoringService } = await import('../services/ContinuousMonitoringService.js');
    await ContinuousMonitoringService.stopAllMonitors();
    console.log('✅ Stopped all monitoring services');
  } catch (error) {
    console.error('⚠️  Error stopping monitoring services:', error.message);
  }
  
  if (streamingIndexer) {
    await streamingIndexer.shutdown();
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, starting graceful shutdown...');
  
  // Stop all monitoring services
  try {
    const { default: ContinuousMonitoringService } = await import('../services/ContinuousMonitoringService.js');
    await ContinuousMonitoringService.stopAllMonitors();
    console.log('✅ Stopped all monitoring services');
  } catch (error) {
    console.error('⚠️  Error stopping monitoring services:', error.message);
  }
  
  if (streamingIndexer) {
    await streamingIndexer.shutdown();
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;