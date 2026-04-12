/**
 * Function Analytics API Routes
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.4, 10.1, 10.2, 10.3, 10.4
 */

import express from 'express';
import { FunctionAnalyticsService } from '../../services/FunctionAnalyticsService.js';
import { JourneyAnalyzerService } from '../../services/JourneyAnalyzerService.js';
import { CohortCalculatorService } from '../../services/CohortCalculatorService.js';
import { AnalyticsCacheService } from '../../services/AnalyticsCacheService.js';
import { abiLoader } from '../../services/ABILoaderService.js';

const router = express.Router();

// Initialize services
const analyticsService = new FunctionAnalyticsService();
const journeyService = new JourneyAnalyzerService();
const cohortService = new CohortCalculatorService();
const cacheService = new AnalyticsCacheService();

// Load all ABIs on startup
abiLoader.loadAllABIs().catch(err => console.error('Failed to load ABIs:', err));

/**
 * Middleware to ensure ABI is loaded for contract
 */
async function ensureABILoaded(req, res, next) {
  const { contractAddress, chain } = req.query;
  
  if (contractAddress && chain && !abiLoader.isABILoaded(contractAddress)) {
    await abiLoader.loadContractABI(contractAddress, chain);
  }
  
  next();
}

// Apply middleware to all routes
router.use(ensureABILoaded);

/**
 * Parse date range from query parameters
 */
function parseDateRange(req) {
  if (!req.query.startDate || !req.query.endDate) {
    return null;
  }
  
  const start = new Date(req.query.startDate);
  const end = new Date(req.query.endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format');
  }
  
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
  
  if (end > new Date()) {
    throw new Error('End date cannot be in the future');
  }
  
  return { start, end };
}

/**
 * GET /api/functions/signatures
 * Get all function signatures with metrics
 * Requirements: 2.1, 2.2, 2.4
 */
router.get('/signatures', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    
    // Check cache
    const cacheKey = cacheService.generateKey('signatures', { contractAddress, chain, dateRange });
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const signatures = await analyticsService.getFunctionSignatures(contractAddress, chain, dateRange, req.user?.id);
    
    // Cache result
    cacheService.set(cacheKey, signatures);
    
    res.json(signatures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/signatures/:signature
 * Get detailed metrics for specific signature
 * Requirements: 2.1, 2.2, 3.1, 3.2
 */
router.get('/signatures/:signature', async (req, res) => {
  try {
    const { signature } = req.params;
    const { contractAddress, chain } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    
    const metrics = await analyticsService.getSignatureMetrics(contractAddress, chain, signature, dateRange);
    
    if (!metrics) {
      return res.status(404).json({ error: 'Signature not found' });
    }
    
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/signatures/:signature/wallets
 * Get wallets that interacted with signature
 * Requirements: 3.1, 3.2
 */
router.get('/signatures/:signature/wallets', async (req, res) => {
  try {
    const { signature } = req.params;
    const { contractAddress, chain, limit = 50, offset = 0 } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    const pagination = { limit: parseInt(limit), offset: parseInt(offset) };
    
    const result = await analyticsService.getSignatureWallets(
      contractAddress, 
      chain, 
      signature, 
      dateRange, 
      pagination
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/journeys
 * Get all user journeys
 * Requirements: 4.1, 4.2, 4.3
 */
router.get('/journeys', async (req, res) => {
  try {
    const { contractAddress, chain, walletAddress } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    
    if (walletAddress) {
      const journey = await journeyService.buildWalletJourney(walletAddress, contractAddress, chain, dateRange);
      return res.json(journey ? [journey] : []);
    }
    
    const journeys = await journeyService.getContractJourneys(contractAddress, chain, dateRange);
    res.json(journeys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/journeys/flow
 * Get flow visualization data
 * Requirements: 6.1, 6.2, 6.4
 */
router.get('/journeys/flow', async (req, res) => {
  try {
    const { contractAddress, chain, signature } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    
    // Check cache
    const cacheKey = cacheService.generateKey('flow', { contractAddress, chain, signature, dateRange });
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const flow = await journeyService.generateFlowVisualization(contractAddress, chain, dateRange, signature);
    
    // Cache result
    cacheService.set(cacheKey, flow);
    
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/journeys/:walletAddress
 * Get journey for specific wallet
 * Requirements: 4.1, 4.2, 4.3
 */
router.get('/journeys/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { contractAddress, chain } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    
    const journey = await journeyService.buildWalletJourney(walletAddress, contractAddress, chain, dateRange);
    
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    
    res.json(journey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/cohorts
 * Get cohort data based on metric type
 * Requirements: 5.1, 5.2, 5.3, 5.4, 10.4
 */
router.get('/cohorts', async (req, res) => {
  try {
    const { contractAddress, chain, metricType = 'activation', cohortPeriod = 'monthly', signature } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    if (!['activation', 'retention', 'churn'].includes(metricType)) {
      return res.status(400).json({ error: 'metricType must be activation, retention, or churn' });
    }
    
    if (!['daily', 'weekly', 'monthly'].includes(cohortPeriod)) {
      return res.status(400).json({ error: 'cohortPeriod must be daily, weekly, or monthly' });
    }
    
    const dateRange = parseDateRange(req);
    
    // Check cache
    const cacheKey = cacheService.generateKey('cohorts', { contractAddress, chain, metricType, cohortPeriod, signature, dateRange });
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    let cohorts;
    if (metricType === 'activation') {
      cohorts = await cohortService.calculateActivation(contractAddress, chain, signature, cohortPeriod, dateRange);
    } else if (metricType === 'retention') {
      cohorts = await cohortService.calculateRetention(contractAddress, chain, signature, cohortPeriod, dateRange);
    } else {
      cohorts = await cohortService.calculateChurn(contractAddress, chain, signature, cohortPeriod, dateRange);
    }
    
    // Cache result
    cacheService.set(cacheKey, cohorts);
    
    res.json(cohorts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/cohorts/activation
 * Get activation cohorts
 * Requirements: 5.2
 */
router.get('/cohorts/activation', async (req, res) => {
  try {
    const { contractAddress, chain, cohortPeriod = 'monthly', signature, interactions, days } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    const activationConfig = (interactions && days) ? { 
      interactions: parseInt(interactions), 
      days: parseInt(days) 
    } : null;
    
    const cohorts = await cohortService.calculateActivation(
      contractAddress, 
      chain, 
      signature, 
      cohortPeriod, 
      dateRange, 
      activationConfig
    );
    
    res.json(cohorts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/cohorts/retention
 * Get retention cohorts
 * Requirements: 5.4
 */
router.get('/cohorts/retention', async (req, res) => {
  try {
    const { contractAddress, chain, cohortPeriod = 'monthly', signature } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    
    const cohorts = await cohortService.calculateRetention(contractAddress, chain, signature, cohortPeriod, dateRange);
    
    res.json(cohorts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/functions/cohorts/churn
 * Get churn cohorts
 * Requirements: 5.3
 */
router.get('/cohorts/churn', async (req, res) => {
  try {
    const { contractAddress, chain, cohortPeriod = 'monthly', signature, inactiveDays } = req.query;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const dateRange = parseDateRange(req);
    const churnConfig = inactiveDays ? { inactiveDays: parseInt(inactiveDays) } : null;
    
    const cohorts = await cohortService.calculateChurn(
      contractAddress, 
      chain, 
      signature, 
      cohortPeriod, 
      dateRange, 
      churnConfig
    );
    
    res.json(cohorts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/functions/cache/invalidate
 * Invalidate cache for contract
 */
router.post('/cache/invalidate', async (req, res) => {
  try {
    const { contractAddress, chain } = req.body;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain are required' });
    }
    
    const prefix = `${contractAddress}_${chain}`;
    const count = cacheService.invalidate(prefix);
    
    res.json({ invalidated: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
