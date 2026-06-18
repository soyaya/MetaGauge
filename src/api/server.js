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
import analyzerRoutes from './routes/analyzer.js';
import functionsRoutes from './routes/functions.js';
import alertRoutes from './routes/alerts.js';
import billingRoutes, { paystackWebhookHandler, flutterwaveWebhookHandler } from './routes/billing.js';
import supportRoutes from './routes/support.js';
import metricsRoutes from './routes/metrics.js';
import dashboardRoutes from './routes/dashboard.js';
import tractionRoutes from './routes/traction.js';
import { competitiveRouter } from './routes/competitive.js';
import { walletAnalyticsRouter } from './routes/wallet-analytics.js';
import monitoringRoutes from './routes/monitoring.js';
import indexingRoutes from './routes/indexing.js';
import { resumeLivePoll } from './routes/trigger-indexing.js';
import agentRoutes from './routes/agent.js';
import predictionsRoutes from './routes/predictions.js';
import shareRoutes from './routes/share.js';

// Import middleware
import { authenticateToken, verifyToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

// Import database
import { initializeDatabase, AnalysisStorage } from './database/index.js';

// Import streaming indexer
import { initializeStreamingIndexer } from '../indexer/index.js';
import { WebSocketManager } from '../indexer/services/WebSocketManager.js';
import { connectMongo } from './database/mongo.js';

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

// Store indexer state in app.locals for middleware access
app.locals.indexerInitialized = false;

// Initialize indexer asynchronously after server starts
async function initializeIndexerAsync() {
  try {
    console.log('🔄 Initializing streaming indexer in background...');
    
    // Initialize WebSocket manager first
    wsManager = new WebSocketManager(wss);
    
    // Initialize streaming indexer (non-blocking)
    const { indexerManager, components } = await initializeStreamingIndexer('./data');
    streamingIndexer = indexerManager;
    
    // Set indexer for onboarding routes
    setStreamingIndexer(streamingIndexer);
    
    // Initialize indexer routes
    const indexerRouter = initializeIndexerRoutes(streamingIndexer);
    app.use('/api/indexer', authenticateToken, indexerRouter);
    
    app.locals.indexerInitialized = true;
    console.log('✅ Streaming indexer initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize streaming indexer:', error);
    console.log('⚠️  Server will continue without streaming indexer features');
  }
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket client connected');
  
  let userId = null;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register' && data.token) {
        try {
          const decoded = verifyToken(data.token);
          userId = decoded.userId;
          wsManager?.registerClient(userId, ws);
        } catch {
          ws.close(1008, 'Invalid token');
        }
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

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    /^http:\/\/192\.168\.\d+\.\d+:3000$/, // Allow local network IPs
    /^http:\/\/172\.\d+\.\d+\.\d+:3000$/, // Allow WSL2 network IPs
    config.frontendUrl
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Paystack webhook — must be BEFORE express.json() to get raw body
app.post('/api/paystack-webhook', express.raw({ type: 'application/json' }), paystackWebhookHandler);
// Flutterwave webhook — must be BEFORE express.json() to get raw body
app.post('/api/flutterwave-webhook', express.raw({ type: 'application/json' }), flutterwaveWebhookHandler);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 2000,
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
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    storage: config.databaseType,
    environment: config.nodeEnv,
    indexer: {
      initialized: app.locals.indexerInitialized || false,
      status: app.locals.indexerInitialized ? 'ready' : 'initializing'
    }
  });
});

// Simple test endpoint — dev only
if (process.env.NODE_ENV !== 'production') {
app.get('/test', (req, res) => {
  res.json({ message: 'Server is responding', timestamp: new Date().toISOString() });
});

app.post('/test-post', (req, res) => {
  res.json({ message: 'POST received', body: req.body, timestamp: new Date().toISOString() });
});
} // end dev-only

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

app.use('/api/contracts', authenticateToken, contractRoutes);
app.use('/api/analysis', authenticateToken, analysisRoutes);
app.use('/api/analysis', authenticateToken, quickScanRoutes);
app.use('/api/analyzer', authenticateToken, analyzerRoutes);
app.use('/api/functions/wallet-analytics', authenticateToken, walletAnalyticsRouter);
app.use('/api/functions', authenticateToken, functionsRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/onboarding', authenticateToken, onboardingRoutes);
app.use('/api/subscription', authenticateToken, subscriptionRoutes);
app.use('/api/faucet', authenticateToken, faucetRoutes);

// Alert configuration routes
app.use('/api/alerts', authenticateToken, alertRoutes);

app.use('/api/billing', authenticateToken, billingRoutes);
app.use('/api/support', authenticateToken, supportRoutes);

app.use('/api/metrics', authenticateToken, metricsRoutes);

app.use('/api/dashboard', authenticateToken, dashboardRoutes);

app.use('/api/traction', authenticateToken, tractionRoutes);

app.use('/api/agent', authenticateToken, agentRoutes);
app.use('/api/predictions', authenticateToken, predictionsRoutes);
app.use('/api/share', shareRoutes); // mixed auth — POST requires token, GET /:token/data is public

app.use('/api/competitive', authenticateToken, competitiveRouter);

app.use('/api/monitoring', authenticateToken, monitoringRoutes);

app.use('/api/indexing', authenticateToken, indexingRoutes);

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

    // Connect MongoDB (optional — won't block startup if unavailable)
    await connectMongo();

    // Resume live polling for all users who had active polls before restart
    try {
      const { UserStorage: US, LivePollStorage: LPS } = await import('./database/index.js');
      const users = await US.findAll();
      let resumed = 0;
      for (const user of users) {
        const poll = await LPS.get(user.id).catch(() => null);
        if (poll?.active && poll.contractAddress && poll.analysisId) {
          console.log(`📡 Resuming live poll for user ${user.id} contract ${poll.contractAddress}`);
          resumeLivePoll({ userId: user.id, ...poll }).catch(e =>
            console.warn(`⚠️  Failed to resume live poll for ${user.id}: ${e.message}`)
          );
          resumed++;
        }
      }
      if (resumed > 0) console.log(`✅ Resumed ${resumed} live poll(s)`);
    } catch (e) {
      console.warn('⚠️  Live poll resume failed:', e.message);
    }

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
      console.log(`💾 Storage: ${process.env.DATABASE_TYPE === 'postgres' ? 'PostgreSQL' : 'file-based (./data)'}`);
      if (!process.env.PAYSTACK_SECRET_KEY) console.warn('⚠️  PAYSTACK_SECRET_KEY not set — Paystack top-ups will not work');
      if (!process.env.PAYMENT_ADDRESS) console.warn('⚠️  PAYMENT_ADDRESS not set — on-chain payment verification will reject all transactions');
      
      // Initialize indexer asynchronously after server is ready
      initializeIndexerAsync().catch(err => {
        console.error('❌ Indexer initialization failed:', err);
      });

      // Start proactive agent
      import('../services/ProactiveAgent.js').then(({ ProactiveAgent }) => {
        ProactiveAgent.init(wsManager);
      }).catch(err => console.warn('⚠️ ProactiveAgent failed to start:', err.message));

      import('../scripts/monitoring-billing.js').then(({ startMonitoringBillingScheduler }) => {
        startMonitoringBillingScheduler();
      }).catch(err => console.warn('⚠️ Monitoring billing scheduler failed:', err.message));
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
  
  if (streamingIndexer) {
    await streamingIndexer.shutdown();
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;