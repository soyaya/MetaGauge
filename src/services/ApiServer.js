/**
 * RESTful API and Data Export System
 * Multi-Chain RPC Integration - Task 13
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import { errorHandler } from './ErrorHandler.js';
import { performanceMonitor } from './PerformanceMonitor.js';

/**
 * API and data export system
 * Provides RESTful endpoints, WebSocket streaming, and multiple export formats
 */
export class ApiServer {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3000,
      wsPort: config.wsPort || 3001,
      jwtSecret: config.jwtSecret || 'your-secret-key',
      rateLimit: {
        windowMs: config.rateLimitWindow || 15 * 60 * 1000, // 15 minutes
        max: config.rateLimitMax || 100, // requests per window
        ...config.rateLimit
      },
      cors: {
        origin: config.corsOrigin || '*',
        credentials: true,
        ...config.cors
      },
      ...config
    };
    
    // Express app
    this.app = express();
    this.server = null;
    
    // WebSocket server
    this.wsServer = null;
    this.wsClients = new Set();
    
    // Data services (injected)
    this.dataServices = new Map();
    
    this._initializeApp();
  }

  /**
   * Initialize Express application
   * @private
   */
  _initializeApp() {
    // Middleware
    this.app.use(cors(this.config.cors));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting
    const limiter = rateLimit(this.config.rateLimit);
    this.app.use('/api/', limiter);
    
    // Request logging
    this.app.use((req, res, next) => {
      const requestId = `req_${Date.now()}_${Math.random()}`;
      req.requestId = requestId;
      
      performanceMonitor.startRequest(requestId, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      res.on('finish', () => {
        performanceMonitor.endRequest(requestId, {
          statusCode: res.statusCode,
          success: res.statusCode < 400
        });
      });
      
      next();
    });
    
    // Routes
    this._setupRoutes();
    
    // Error handling
    this.app.use(this._errorHandler.bind(this));
  }

  /**
   * Setup API routes
   * @private
   */
  _setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });
    
    // Authentication
    this.app.post('/api/auth/login', this._handleLogin.bind(this));
    this.app.post('/api/auth/refresh', this._handleRefresh.bind(this));
    
    // Analytics endpoints
    this.app.get('/api/analytics/metrics', this._authenticate.bind(this), this._getMetrics.bind(this));
    this.app.get('/api/analytics/defi', this._authenticate.bind(this), this._getDeFiMetrics.bind(this));
    this.app.get('/api/analytics/behavior', this._authenticate.bind(this), this._getUserBehavior.bind(this));
    this.app.get('/api/analytics/patterns', this._authenticate.bind(this), this._getPatterns.bind(this));
    this.app.get('/api/analytics/transactions', this._authenticate.bind(this), this._getTransactions.bind(this));
    this.app.get('/api/analytics/contracts', this._authenticate.bind(this), this._getContracts.bind(this));
    
    // Export endpoints
    this.app.get('/api/export/json', this._authenticate.bind(this), this._exportJson.bind(this));
    this.app.get('/api/export/csv', this._authenticate.bind(this), this._exportCsv.bind(this));
    this.app.get('/api/export/parquet', this._authenticate.bind(this), this._exportParquet.bind(this));
    
    // Performance endpoints
    this.app.get('/api/performance/metrics', this._authenticate.bind(this), this._getPerformanceMetrics.bind(this));
    this.app.get('/api/performance/recommendations', this._authenticate.bind(this), this._getRecommendations.bind(this));
  }

  /**
   * Register data service
   * @param {string} name - Service name
   * @param {Object} service - Service instance
   */
  registerDataService(name, service) {
    this.dataServices.set(name, service);
    errorHandler.info(`Data service registered: ${name}`);
  }

  /**
   * Start API server
   * @returns {Promise} Server start promise
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Start HTTP server
        this.server = createServer(this.app);
        
        this.server.listen(this.config.port, () => {
          errorHandler.info(`API server started on port ${this.config.port}`);
          
          // Start WebSocket server
          this._startWebSocketServer();
          
          resolve();
        });
        
        this.server.on('error', reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop API server
   * @returns {Promise} Server stop promise
   */
  async stop() {
    return new Promise((resolve) => {
      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
        this.wsClients.clear();
      }
      
      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          errorHandler.info('API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Start WebSocket server for real-time streaming
   * @private
   */
  _startWebSocketServer() {
    this.wsServer = new WebSocketServer({ port: this.config.wsPort });
    
    this.wsServer.on('connection', (ws, req) => {
      const clientId = `ws_${Date.now()}_${Math.random()}`;
      ws.clientId = clientId;
      
      this.wsClients.add(ws);
      
      errorHandler.info(`WebSocket client connected: ${clientId}`, {
        clientCount: this.wsClients.size,
        userAgent: req.headers['user-agent']
      });
      
      // Handle authentication
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          
          if (data.type === 'auth') {
            this._authenticateWebSocket(ws, data.token);
          } else if (data.type === 'subscribe') {
            this._handleWebSocketSubscription(ws, data);
          }
          
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });
      
      ws.on('close', () => {
        this.wsClients.delete(ws);
        errorHandler.info(`WebSocket client disconnected: ${clientId}`, {
          clientCount: this.wsClients.size
        });
      });
      
      ws.on('error', (error) => {
        errorHandler.error(`WebSocket error for client ${clientId}`, {
          error: error.message
        });
      });
    });
    
    errorHandler.info(`WebSocket server started on port ${this.config.wsPort}`);
  }

  /**
   * Broadcast data to WebSocket clients
   * @param {string} type - Message type
   * @param {Object} data - Data to broadcast
   * @param {string} subscription - Subscription filter
   */
  broadcast(type, data, subscription = null) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    this.wsClients.forEach(ws => {
      if (ws.readyState === ws.OPEN && ws.authenticated) {
        // Check subscription filter
        if (!subscription || ws.subscriptions?.includes(subscription)) {
          ws.send(message);
        }
      }
    });
  }

  // Authentication middleware
  _authenticate(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Route handlers
  async _handleLogin(req, res) {
    try {
      const { username, password } = req.body;
      
      // Simple authentication (replace with real auth)
      if (username === 'admin' && password === 'password') {
        const token = jwt.sign(
          { userId: 1, username },
          this.config.jwtSecret,
          { expiresIn: '24h' }
        );
        
        res.json({ token, expiresIn: '24h' });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _handleRefresh(req, res) {
    try {
      const { token } = req.body;
      
      const decoded = jwt.verify(token, this.config.jwtSecret);
      
      const newToken = jwt.sign(
        { userId: decoded.userId, username: decoded.username },
        this.config.jwtSecret,
        { expiresIn: '24h' }
      );
      
      res.json({ token: newToken, expiresIn: '24h' });
      
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  async _getMetrics(req, res) {
    try {
      const { startDate, endDate, chain, contract, limit = 100, offset = 0 } = req.query;
      
      const filters = this._buildFilters(req.query);
      const pagination = { limit: parseInt(limit), offset: parseInt(offset) };
      
      // Get data from registered services
      const metricsService = this.dataServices.get('metrics');
      if (!metricsService) {
        return res.status(503).json({ error: 'Metrics service not available' });
      }
      
      const data = await metricsService.getMetrics(filters, pagination);
      
      res.json({
        data,
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
          total: data.length
        },
        filters
      });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _getDeFiMetrics(req, res) {
    try {
      const filters = this._buildFilters(req.query);
      const defiService = this.dataServices.get('defi');
      
      if (!defiService) {
        return res.status(503).json({ error: 'DeFi service not available' });
      }
      
      const data = await defiService.getDeFiMetrics(filters);
      res.json({ data, filters });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _getUserBehavior(req, res) {
    try {
      const filters = this._buildFilters(req.query);
      const behaviorService = this.dataServices.get('behavior');
      
      if (!behaviorService) {
        return res.status(503).json({ error: 'Behavior service not available' });
      }
      
      const data = await behaviorService.getUserBehavior(filters);
      res.json({ data, filters });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _getPatterns(req, res) {
    try {
      const filters = this._buildFilters(req.query);
      const patternService = this.dataServices.get('patterns');
      
      if (!patternService) {
        return res.status(503).json({ error: 'Pattern service not available' });
      }
      
      const data = await patternService.getPatterns(filters);
      res.json({ data, filters });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _getTransactions(req, res) {
    try {
      const filters = this._buildFilters(req.query);
      const transactionService = this.dataServices.get('transactions');
      
      if (!transactionService) {
        return res.status(503).json({ error: 'Transaction service not available' });
      }
      
      const data = await transactionService.getTransactions(filters);
      res.json({ data, filters });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _getContracts(req, res) {
    try {
      const filters = this._buildFilters(req.query);
      const contractService = this.dataServices.get('contracts');
      
      if (!contractService) {
        return res.status(503).json({ error: 'Contract service not available' });
      }
      
      const data = await contractService.getContracts(filters);
      res.json({ data, filters });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _exportJson(req, res) {
    try {
      const { type, ...filters } = req.query;
      const data = await this._getExportData(type, filters);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_export_${Date.now()}.json"`);
      
      res.json(data);
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _exportCsv(req, res) {
    try {
      const { type, ...filters } = req.query;
      const data = await this._getExportData(type, filters);
      
      const csv = this._convertToCsv(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_export_${Date.now()}.csv"`);
      
      res.send(csv);
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _exportParquet(req, res) {
    try {
      const { type, ...filters } = req.query;
      
      // Placeholder for Parquet export
      // In real implementation, would use a library like parquetjs
      res.status(501).json({ error: 'Parquet export not yet implemented' });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _getPerformanceMetrics(req, res) {
    try {
      const metrics = performanceMonitor.getMetrics();
      res.json({ data: metrics });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _getRecommendations(req, res) {
    try {
      const recommendations = performanceMonitor.getRecommendations();
      res.json({ data: recommendations });
      
    } catch (error) {
      this._handleError(res, error);
    }
  }

  // Helper methods
  _buildFilters(query) {
    const filters = {};
    
    // Date filters
    if (query.startDate) filters.startDate = new Date(query.startDate);
    if (query.endDate) filters.endDate = new Date(query.endDate);
    
    // Chain filters
    if (query.chain) filters.chain = query.chain;
    if (query.contract) filters.contract = query.contract;
    
    // User filters
    if (query.userId) filters.userId = query.userId;
    if (query.address) filters.address = query.address;
    
    // Metric filters
    if (query.metric) filters.metric = query.metric;
    if (query.minValue) filters.minValue = parseFloat(query.minValue);
    if (query.maxValue) filters.maxValue = parseFloat(query.maxValue);
    
    return filters;
  }

  async _getExportData(type, filters) {
    const service = this.dataServices.get(type);
    
    if (!service) {
      throw new Error(`Export service not available: ${type}`);
    }
    
    // Get all data for export (no pagination)
    return await service.getAllData(filters);
  }

  _convertToCsv(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }

  _authenticateWebSocket(ws, token) {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);
      ws.authenticated = true;
      ws.user = decoded;
      ws.subscriptions = [];
      
      ws.send(JSON.stringify({
        type: 'auth_success',
        message: 'Authentication successful'
      }));
      
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'auth_error',
        message: 'Authentication failed'
      }));
    }
  }

  _handleWebSocketSubscription(ws, data) {
    if (!ws.authenticated) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated'
      }));
      return;
    }
    
    const { subscription } = data;
    
    if (!ws.subscriptions.includes(subscription)) {
      ws.subscriptions.push(subscription);
    }
    
    ws.send(JSON.stringify({
      type: 'subscription_success',
      subscription
    }));
  }

  _handleError(res, error) {
    errorHandler.error('API error', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }

  _errorHandler(error, req, res, next) {
    this._handleError(res, error);
  }
}

// Export class
