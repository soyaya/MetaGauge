/**
 * Analysis routes
 * Handles contract analysis operations and results with file storage
 */

import express from 'express';
import { ContractStorage, AnalysisStorage, UserStorage } from '../database/index.js';
import { AnalyticsEngine } from '../../index.js';
import { requireTier } from '../middleware/auth.js';
import GeminiAIService from '../../services/GeminiAIService.js';

const router = express.Router();

/**
 * @swagger
 * /api/analysis/start:
 *   post:
 *     summary: Start contract analysis
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - configId
 *             properties:
 *               configId:
 *                 type: string
 *               analysisType:
 *                 type: string
 *                 enum: [single, competitive, comparative]
 *                 default: single
 *     responses:
 *       202:
 *         description: Analysis started successfully
 *       400:
 *         description: Invalid request or rate limit exceeded
 *       404:
 *         description: Configuration not found
 */
router.post('/start', async (req, res) => {
  try {
    const { configId, analysisType = 'single' } = req.body;
    const userId = req.user.id;

    if (!configId) {
      return res.status(400).json({
        error: 'Missing configuration ID',
        message: 'Configuration ID is required'
      });
    }

    // Get user and check analysis limits
    const user = await UserStorage.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Check refresh rate limit
    if (user.usage.lastAnalysis) {
      const refreshRate = user.subscription?.limits?.dataRefreshRate || 24; // hours
      const hoursSinceLastAnalysis = (Date.now() - new Date(user.usage.lastAnalysis)) / (1000 * 60 * 60);
      
      if (hoursSinceLastAnalysis < refreshRate) {
        const hoursRemaining = Math.ceil(refreshRate - hoursSinceLastAnalysis);
        return res.status(429).json({
          error: 'Refresh rate limit',
          message: `Please wait ${hoursRemaining} hour(s) before running another analysis`,
          hoursRemaining,
          nextAllowedTime: new Date(new Date(user.usage.lastAnalysis).getTime() + refreshRate * 60 * 60 * 1000)
        });
      }
    }

    // Simple rate limiting check
    const monthlyLimit = user.tier === 'free' ? 10 : user.tier === 'pro' ? 100 : -1;
    if (monthlyLimit !== -1 && user.usage.monthlyAnalysisCount >= monthlyLimit) {
      return res.status(400).json({
        error: 'Analysis limit exceeded',
        message: `You have reached your monthly analysis limit for ${user.tier} tier`,
        usage: user.usage
      });
    }

    // Get configuration
    const config = await ContractStorage.findById(configId);
    if (!config || config.userId !== userId || !config.isActive) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'Contract configuration not found or access denied'
      });
    }

    // Create analysis result record
    const analysisData = {
      userId,
      configId: config.id,
      analysisType,
      status: 'pending',
      progress: 0,
      results: null,
      metadata: null,
      errorMessage: null,
      logs: [],
      completedAt: null
    };

    const analysisResult = await AnalysisStorage.create(analysisData);

    // Start analysis asynchronously
    performAnalysis(analysisResult.id, config, user, analysisType)
      .catch(error => {
        console.error('Analysis error:', error);
        AnalysisStorage.update(analysisResult.id, {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date().toISOString()
        });
      });

    res.status(202).json({
      message: 'Analysis started successfully',
      analysisId: analysisResult.id,
      status: 'pending',
      estimatedTime: getEstimatedTime(analysisType, config)
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to start analysis',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/status:
 *   get:
 *     summary: Get analysis status
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis status retrieved successfully
 *       404:
 *         description: Analysis not found
 */
router.get('/:id/status', async (req, res) => {
  try {
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    const config = await ContractStorage.findById(analysis.configId);

    res.json({
      id: analysis.id,
      status: analysis.status,
      progress: analysis.progress,
      analysisType: analysis.analysisType,
      config: config ? {
        id: config.id,
        name: config.name,
        targetContract: config.targetContract
      } : null,
      createdAt: analysis.createdAt,
      completedAt: analysis.completedAt,
      errorMessage: analysis.errorMessage,
      logs: analysis.logs ? analysis.logs.slice(-5) : [] // Last 5 log entries
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get analysis status',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/results:
 *   get:
 *     summary: Get analysis results
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis results retrieved successfully
 *       404:
 *         description: Analysis not found
 */
router.get('/:id/results', async (req, res) => {
  try {
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (analysis.status !== 'completed') {
      return res.status(400).json({
        error: 'Analysis not completed',
        message: `Analysis is ${analysis.status}. Results not available yet.`,
        status: analysis.status,
        progress: analysis.progress
      });
    }

    const config = await ContractStorage.findById(analysis.configId);

    res.json({
      id: analysis.id,
      status: analysis.status,
      analysisType: analysis.analysisType,
      config: config ? {
        id: config.id,
        name: config.name,
        targetContract: config.targetContract,
        competitors: config.competitors
      } : null,
      results: analysis.results,
      metadata: analysis.metadata,
      createdAt: analysis.createdAt,
      completedAt: analysis.completedAt
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get analysis results',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/history:
 *   get:
 *     summary: Get user's analysis history
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: analysisType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis history retrieved successfully
 */
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, analysisType } = req.query;
    const userId = req.user.id;

    // Build filters
    const filters = {};
    if (status) filters.status = status;
    if (analysisType) filters.analysisType = analysisType;

    // Get user's analyses
    const allAnalyses = await AnalysisStorage.findByUserId(userId, filters);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const analyses = allAnalyses.slice(startIndex, endIndex);

    // Add config info and remove detailed results
    const analysesWithConfig = await Promise.all(analyses.map(async analysis => {
      const config = await ContractStorage.findById(analysis.configId);
      return {
        id: analysis.id,
        status: analysis.status,
        progress: analysis.progress,
        analysisType: analysis.analysisType,
        config: config ? {
          id: config.id,
          name: config.name,
          targetContract: config.targetContract
        } : null,
        createdAt: analysis.createdAt,
        completedAt: analysis.completedAt,
        errorMessage: analysis.errorMessage
      };
    }));

    res.json({
      analyses: analysesWithConfig,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allAnalyses.length,
        pages: Math.ceil(allAnalyses.length / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve analysis history',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/interpret:
 *   post:
 *     summary: Generate AI interpretation of analysis results
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AI interpretation generated successfully
 *       404:
 *         description: Analysis not found
 *       400:
 *         description: Analysis not completed
 */
router.post('/:id/interpret', async (req, res) => {
  try {
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (analysis.status !== 'completed') {
      return res.status(400).json({
        error: 'Analysis not completed',
        message: `Analysis is ${analysis.status}. AI interpretation requires completed analysis.`,
        status: analysis.status
      });
    }

    // Generate AI interpretation
    const interpretation = await GeminiAIService.interpretAnalysis(analysis, analysis.analysisType, req.user.id);

    // Store interpretation in analysis record
    await AnalysisStorage.update(analysis.id, {
      aiInterpretation: interpretation,
      lastInterpretedAt: new Date().toISOString()
    });

    res.json({
      analysisId: analysis.id,
      interpretation: interpretation.interpretation || interpretation.fallback,
      aiEnabled: GeminiAIService.isEnabled(),
      generatedAt: interpretation.generatedAt || new Date().toISOString(),
      success: interpretation.success !== false
    });

  } catch (error) {
    console.error('AI interpretation error:', error);
    res.status(500).json({
      error: 'Failed to generate AI interpretation',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/quick-insights:
 *   get:
 *     summary: Get quick AI insights for analysis
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quick insights retrieved successfully
 *       404:
 *         description: Analysis not found
 */
router.get('/:id/quick-insights', async (req, res) => {
  try {
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (analysis.status !== 'completed') {
      return res.status(400).json({
        error: 'Analysis not completed',
        message: `Analysis is ${analysis.status}. Insights require completed analysis.`
      });
    }

    const insights = await GeminiAIService.generateQuickInsights(analysis, req.user.id);

    res.json({
      analysisId: analysis.id,
      insights,
      aiEnabled: GeminiAIService.isEnabled(),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Quick insights error:', error);
    res.status(500).json({
      error: 'Failed to generate insights',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/recommendations:
 *   post:
 *     summary: Generate AI recommendations based on analysis
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractType:
 *                 type: string
 *                 default: defi
 *     responses:
 *       200:
 *         description: Recommendations generated successfully
 *       404:
 *         description: Analysis not found
 */
router.post('/:id/recommendations', async (req, res) => {
  try {
    const { contractType = 'defi' } = req.body;
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (analysis.status !== 'completed') {
      return res.status(400).json({
        error: 'Analysis not completed',
        message: `Analysis is ${analysis.status}. Recommendations require completed analysis.`
      });
    }

    const metrics = analysis.results?.target?.metrics || analysis.results?.target?.fullReport || {};
    const recommendations = await GeminiAIService.generateRecommendations(metrics, contractType, req.user.id);

    res.json({
      analysisId: analysis.id,
      recommendations: recommendations.recommendations || [],
      contractType,
      aiEnabled: GeminiAIService.isEnabled(),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/alerts:
 *   post:
 *     summary: Generate real-time alerts for analysis
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               previousResultsId:
 *                 type: string
 *                 description: ID of previous analysis for comparison
 *     responses:
 *       200:
 *         description: Alerts generated successfully
 *       404:
 *         description: Analysis not found
 */
router.post('/:id/alerts', async (req, res) => {
  try {
    const { previousResultsId } = req.body;
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (analysis.status !== 'completed') {
      return res.status(400).json({
        error: 'Analysis not completed',
        message: `Analysis is ${analysis.status}. Alerts require completed analysis.`
      });
    }

    // Get previous results if provided
    let previousResults = null;
    if (previousResultsId) {
      const prevAnalysis = await AnalysisStorage.findById(previousResultsId);
      if (prevAnalysis && prevAnalysis.userId === req.user.id) {
        previousResults = prevAnalysis;
      }
    }

    // Load user's alert configuration
    const AlertConfigurationStorage = (await import('../database/AlertConfigurationStorage.js')).default;
    const configs = await AlertConfigurationStorage.findByUserId(req.user.id);
    const userConfig = configs.find(c => !c.contractId || c.contractId === analysis.configId);

    const alerts = await GeminiAIService.generateRealTimeAlerts(
      analysis, 
      previousResults, 
      req.user.id,
      userConfig
    );

    res.json({
      analysisId: analysis.id,
      alerts,
      aiEnabled: GeminiAIService.isEnabled(),
      configApplied: !!userConfig,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Alerts generation error:', error);
    res.status(500).json({
      error: 'Failed to generate alerts',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/sentiment:
 *   post:
 *     summary: Generate market sentiment analysis
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               marketData:
 *                 type: object
 *                 description: Additional market data for analysis
 *     responses:
 *       200:
 *         description: Sentiment analysis generated successfully
 *       404:
 *         description: Analysis not found
 */
router.post('/:id/sentiment', async (req, res) => {
  try {
    const { marketData } = req.body;
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (analysis.status !== 'completed') {
      return res.status(400).json({
        error: 'Analysis not completed',
        message: `Analysis is ${analysis.status}. Sentiment analysis requires completed analysis.`
      });
    }

    const sentiment = await GeminiAIService.generateMarketSentiment(
      analysis, 
      marketData, 
      req.user.id
    );

    res.json({
      analysisId: analysis.id,
      sentiment,
      aiEnabled: GeminiAIService.isEnabled(),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate sentiment analysis',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/optimizations:
 *   post:
 *     summary: Generate optimization suggestions
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractType:
 *                 type: string
 *                 default: defi
 *     responses:
 *       200:
 *         description: Optimization suggestions generated successfully
 *       404:
 *         description: Analysis not found
 */
router.post('/:id/optimizations', async (req, res) => {
  try {
    const { contractType = 'defi' } = req.body;
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (analysis.status !== 'completed') {
      return res.status(400).json({
        error: 'Analysis not completed',
        message: `Analysis is ${analysis.status}. Optimization suggestions require completed analysis.`
      });
    }

    const optimizations = await GeminiAIService.generateOptimizationSuggestions(
      analysis, 
      contractType, 
      req.user.id
    );

    res.json({
      analysisId: analysis.id,
      optimizations,
      contractType,
      aiEnabled: GeminiAIService.isEnabled(),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Optimization suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate optimization suggestions',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/stats:
 *   get:
 *     summary: Get user's analysis statistics
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analysis statistics retrieved successfully
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await AnalysisStorage.getStats(userId);
    const user = await UserStorage.findById(userId);

    res.json({
      stats,
      usage: user ? user.usage : { analysisCount: 0, monthlyAnalysisCount: 0 },
      limits: {
        free: 10,
        pro: 100,
        enterprise: -1
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get analysis statistics',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/analysis/{id}/cancel:
 *   post:
 *     summary: Cancel running analysis
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis cancelled successfully
 *       400:
 *         description: Analysis cannot be cancelled
 *       404:
 *         description: Analysis not found
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const analysis = await AnalysisStorage.findById(req.params.id);

    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'Analysis not found or access denied'
      });
    }

    if (!['pending', 'running'].includes(analysis.status)) {
      return res.status(400).json({
        error: 'Cannot cancel analysis',
        message: `Analysis is ${analysis.status} and cannot be cancelled`
      });
    }

    await AnalysisStorage.update(analysis.id, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
      logs: [{
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Analysis cancelled by user'
      }]
    });

    res.json({
      message: 'Analysis cancelled successfully',
      id: analysis.id,
      status: 'cancelled'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to cancel analysis',
      message: error.message
    });
  }
});

/**
 * Perform the actual analysis
 */
async function performAnalysis(analysisId, config, user, analysisType) {
  const startTime = Date.now();

  try {
    // Update status to running
    await AnalysisStorage.update(analysisId, {
      status: 'running',
      logs: [{
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Analysis started'
      }]
    });

    // Initialize analytics engine with config
    const engine = new AnalyticsEngine({
      maxRequestsPerSecond: config.analysisParams?.maxConcurrentRequests || 5,
      failoverTimeout: config.analysisParams?.failoverTimeout || 30000,
      maxRetries: config.analysisParams?.maxRetries || 2
    });

    // Update progress
    await AnalysisStorage.update(analysisId, {
      progress: 10,
      logs: [{
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Initializing analytics engine'
      }]
    });

    let results = {};

    if (analysisType === 'single') {
      // Analyze target contract only
      await AnalysisStorage.update(analysisId, {
        progress: 30,
        logs: [{
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Analyzing target contract'
        }]
      });
      
      const targetResult = await engine.analyzeContract(
        config.targetContract.address,
        config.targetContract.chain,
        config.targetContract.name,
        null // Smart search enabled
      );

      // Use the comprehensive fullReport structure
      results.target = {
        contract: config.targetContract,
        transactions: targetResult.transactions,
        metrics: targetResult.metrics,
        behavior: targetResult.behavior,
        reportPaths: targetResult.reportPaths,
        fullReport: targetResult.fullReport // Include the complete report structure
      };

    } else if (analysisType === 'competitive' || analysisType === 'comparative') {
      // Analyze target + competitors
      await AnalysisStorage.update(analysisId, {
        progress: 20,
        logs: [{
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Analyzing target contract'
        }]
      });
      
      const targetResult = await engine.analyzeContract(
        config.targetContract.address,
        config.targetContract.chain,
        config.targetContract.name,
        null // Smart search enabled
      );

      // Use the comprehensive fullReport structure
      results.target = {
        contract: config.targetContract,
        transactions: targetResult.transactions,
        metrics: targetResult.metrics,
        behavior: targetResult.behavior,
        reportPaths: targetResult.reportPaths,
        fullReport: targetResult.fullReport // Include the complete report structure
      };

      // Analyze competitors
      results.competitors = [];
      const progressStep = 60 / Math.max(config.competitors.length, 1);

      for (let i = 0; i < config.competitors.length; i++) {
        const competitor = config.competitors[i];
        const progress = 30 + (i + 1) * progressStep;
        
        await AnalysisStorage.update(analysisId, {
          progress: Math.min(90, progress),
          logs: [{
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Analyzing competitor: ${competitor.name}`
          }]
        });

        try {
          const competitorResult = await engine.analyzeContract(
            competitor.address,
            competitor.chain,
            competitor.name,
            null // Smart search enabled
          );

          results.competitors.push({
            contract: competitor,
            transactions: competitorResult.transactions,
            metrics: competitorResult.metrics,
            behavior: competitorResult.behavior,
            fullReport: competitorResult.fullReport // Include competitor's full report
          });

        } catch (error) {
          results.competitors.push({
            contract: competitor,
            error: error.message
          });
        }
      }

      // Generate comparative analysis if requested
      if (analysisType === 'comparative') {
        await AnalysisStorage.update(analysisId, {
          progress: 95,
          logs: [{
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Generating comparative analysis'
          }]
        });
        results.comparative = generateComparativeAnalysis(results);
      }
    }

    // Calculate metadata
    const executionTime = Date.now() - startTime;
    const metadata = {
      blockRange: config.analysisParams.blockRange || 1000,
      chainsAnalyzed: [
        config.targetContract.chain,
        ...config.competitors.map(c => c.chain)
      ].filter((chain, index, arr) => arr.indexOf(chain) === index),
      totalTransactions: (results.target?.transactions || 0) + 
        (results.competitors?.reduce((sum, c) => sum + (c.transactions || 0), 0) || 0),
      executionTimeMs: executionTime,
      rpcCallsCount: 0, // TODO: Track RPC calls
      errorCount: results.competitors?.filter(c => c.error).length || 0
    };

    // Mark as completed
    await AnalysisStorage.update(analysisId, {
      status: 'completed',
      progress: 100,
      results,
      metadata,
      completedAt: new Date().toISOString(),
      logs: [{
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Analysis completed successfully'
      }]
    });

    // Update user usage
    await UserStorage.update(user.id, {
      'usage.analysisCount': (user.usage.analysisCount || 0) + 1,
      'usage.monthlyAnalysisCount': (user.usage.monthlyAnalysisCount || 0) + 1,
      'usage.lastAnalysis': new Date().toISOString()
    });

    // Update config stats
    await ContractStorage.update(config.id, {
      lastAnalyzed: new Date().toISOString(),
      analysisCount: (config.analysisCount || 0) + 1
    });

  } catch (error) {
    console.error('Analysis failed:', error);
    await AnalysisStorage.update(analysisId, {
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date().toISOString(),
      logs: [{
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Analysis failed',
        data: { error: error.message }
      }]
    });
    throw error;
  }
}

/**
 * Generate comparative analysis insights
 */
function generateComparativeAnalysis(results) {
  const { target, competitors } = results;
  
  // Filter out failed competitors
  const successfulCompetitors = competitors.filter(c => !c.error);
  
  if (successfulCompetitors.length === 0) {
    return {
      summary: 'No successful competitor analyses to compare',
      rankings: {},
      insights: ['All competitor analyses failed']
    };
  }

  // Create rankings
  const allContracts = [target, ...successfulCompetitors];
  
  const rankings = {
    byTransactions: allContracts
      .sort((a, b) => (b.transactions || 0) - (a.transactions || 0))
      .map((c, index) => ({ rank: index + 1, contract: c.contract, value: c.transactions })),
    
    byUsers: allContracts
      .sort((a, b) => (b.behavior?.userCount || 0) - (a.behavior?.userCount || 0))
      .map((c, index) => ({ rank: index + 1, contract: c.contract, value: c.behavior?.userCount })),
    
    byValue: allContracts
      .sort((a, b) => (b.metrics?.totalValue || 0) - (a.metrics?.totalValue || 0))
      .map((c, index) => ({ rank: index + 1, contract: c.contract, value: c.metrics?.totalValue }))
  };

  // Generate insights
  const insights = [];
  const targetRankTx = rankings.byTransactions.find(r => r.contract.address === target.contract.address)?.rank;
  const targetRankUsers = rankings.byUsers.find(r => r.contract.address === target.contract.address)?.rank;
  const targetRankValue = rankings.byValue.find(r => r.contract.address === target.contract.address)?.rank;

  insights.push(`Target contract ranks #${targetRankTx} in transaction volume`);
  insights.push(`Target contract ranks #${targetRankUsers} in user count`);
  insights.push(`Target contract ranks #${targetRankValue} in total value`);

  return {
    summary: `Comparative analysis of ${target.contract.name} against ${successfulCompetitors.length} competitors`,
    rankings,
    insights
  };
}

/**
 * Estimate analysis time based on type and configuration
 */
function getEstimatedTime(analysisType, config) {
  const baseTime = 30; // 30 seconds for single contract
  const competitorTime = 25; // 25 seconds per competitor
  
  switch (analysisType) {
    case 'single':
      return `${baseTime} seconds`;
    case 'competitive':
    case 'comparative':
      const totalTime = baseTime + (config.competitors.length * competitorTime);
      return `${Math.ceil(totalTime / 60)} minutes`;
    default:
      return '1-2 minutes';
  }
}

export default router;