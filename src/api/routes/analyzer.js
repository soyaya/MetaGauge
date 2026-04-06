/**
 * Analyzer routes
 * Optimized contract analysis endpoint using OptimizedQuickScan
 */

import express from 'express';
import { OptimizedQuickScan } from '../../services/OptimizedQuickScan.js';
import { AnalysisStorage, UserStorage } from '../database/index.js';
import { MetricsNormalizer } from '../../services/MetricsNormalizer.js';

const router = express.Router();

/**
 * POST /api/analyzer/analyze
 * Analyze a contract using optimized quick scan
 */
router.post('/analyze', async (req, res) => {
  try {
    const { contractAddress, chain, contractName } = req.body;

    if (!contractAddress || !chain) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'contractAddress and chain are required'
      });
    }

    // Get user's subscription tier from DB
    const dbUser = await UserStorage.findById(req.user.id);
    const tierName = dbUser?.tier || 'free';
    const HISTORICAL_DAYS = { free: 7, starter: 90, pro: 365, enterprise: 730 };
    let subscriptionTier = tierName.charAt(0).toUpperCase() + tierName.slice(1);
    let historicalDays = HISTORICAL_DAYS[tierName] || 7;

    console.log(`📊 Starting optimized analysis for ${contractAddress} on ${chain}`);
    console.log(`   Subscription: ${subscriptionTier} (${historicalDays} days)`);

    // Create analysis record
    const analysis = await AnalysisStorage.create({
      userId: req.user.id,
      analysisType: 'quick_scan',
      status: 'running',
      metadata: {
        contractAddress,
        chain,
        contractName: contractName || 'Unknown Contract',
        subscription: {
          tier: subscriptionTier,
          historicalDays
        }
      }
    });

    // Run optimized quick scan
    const quickScan = new OptimizedQuickScan();
    const results = await quickScan.analyze(contractAddress, chain, {
      subscriptionTier,
      historicalDays,
      contractName: contractName || 'Unknown Contract'
    });

    // Normalize metrics
    const normalizedMetrics = results.metrics && !results.metrics.error
      ? MetricsNormalizer.normalizeDeFiMetrics(results.metrics)
      : MetricsNormalizer.getDefaultDeFiMetrics();

    const normalizedBehavior = results.behavior
      ? MetricsNormalizer.normalizeUserBehavior(results.behavior)
      : MetricsNormalizer.getDefaultUserBehavior();

    // Update analysis with results
    await AnalysisStorage.update(analysis.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      results: {
        target: {
          ...results,
          metrics: normalizedMetrics,
          behavior: normalizedBehavior,
          defiMetrics: normalizedMetrics,
          userBehavior: normalizedBehavior
        }
      },
      metadata: {
        ...analysis.metadata,
        executionTimeMs: Date.now() - new Date(analysis.createdAt).getTime(),
        blockRange: results.blockRange
      }
    });

    console.log(`✅ Analysis completed: ${analysis.id}`);

    res.json({
      analysisId: analysis.id,
      status: 'completed',
      results: {
        target: {
          ...results,
          metrics: normalizedMetrics,
          behavior: normalizedBehavior,
          defiMetrics: normalizedMetrics,
          userBehavior: normalizedBehavior
        }
      },
      metadata: {
        subscription: {
          tier: subscriptionTier,
          historicalDays
        },
        blockRange: results.blockRange
      }
    });

  } catch (error) {
    console.error('❌ Analyzer error:', error);
    
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      results: {
        target: {
          metrics: MetricsNormalizer.getDefaultDeFiMetrics(),
          behavior: MetricsNormalizer.getDefaultUserBehavior()
        }
      }
    });
  }
});

export default router;
