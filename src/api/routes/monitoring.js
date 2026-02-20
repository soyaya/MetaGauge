/**
 * Continuous Monitoring API Routes
 * Endpoints for managing continuous contract monitoring
 */

import express from 'express';
import ContinuousMonitoringService from '../../services/ContinuousMonitoringService.js';
import { UserStorage } from '../database/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/monitoring/status:
 *   get:
 *     summary: Get monitoring status for current user
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring status retrieved successfully
 */
router.get('/status', async (req, res) => {
  try {
    const status = ContinuousMonitoringService.getMonitoringStatus(req.user.id);
    
    // Get API usage
    const apiCallsUsed = await ContinuousMonitoringService.getMonthlyApiCallCount(req.user.id);
    
    res.json({
      ...status,
      apiCallsUsed,
      percentUsed: status.isActive ? 
        ((apiCallsUsed / status.apiCallsLimit) * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get monitoring status',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/stop:
 *   post:
 *     summary: Stop continuous monitoring for current user
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring stopped successfully
 */
router.post('/stop', async (req, res) => {
  try {
    const result = await ContinuousMonitoringService.stopMonitoring(
      req.user.id,
      'user_requested'
    );
    
    if (result.success) {
      res.json({
        message: 'Continuous monitoring stopped successfully',
        reason: result.reason
      });
    } else {
      res.status(400).json({
        error: 'Failed to stop monitoring',
        reason: result.reason
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to stop monitoring',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/start:
 *   post:
 *     summary: Manually start continuous monitoring
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring started successfully
 */
router.post('/start', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    
    if (!user || !user.onboarding?.defaultContract?.address) {
      return res.status(400).json({
        error: 'No default contract found',
        message: 'Please complete onboarding first'
      });
    }

    const contract = user.onboarding.defaultContract;
    
    // Get subscription info
    const SubscriptionService = (await import('../../services/SubscriptionService.js')).default;
    const subscriptionInfo = await SubscriptionService.getSubscriptionInfo(user.walletAddress);
    
    if (subscriptionInfo.tier === 0) {
      return res.status(403).json({
        error: 'Tier not supported',
        message: 'Continuous monitoring is only available for Starter, Pro, and Enterprise tiers'
      });
    }

    const result = await ContinuousMonitoringService.startMonitoring(
      req.user.id,
      contract,
      {
        tierName: subscriptionInfo.tierName,
        tierNumber: subscriptionInfo.tier,
        continuousSync: true,
        apiCallsPerMonth: ContinuousMonitoringService.getApiLimitForTier(subscriptionInfo.tier)
      },
      contract.lastAnalysisId
    );
    
    if (result.success) {
      res.json({
        message: 'Continuous monitoring started successfully',
        status: result.monitor
      });
    } else {
      res.status(400).json({
        error: 'Failed to start monitoring',
        reason: result.reason
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to start monitoring',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/usage:
 *   get:
 *     summary: Get API usage statistics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 */
router.get('/usage', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    const apiCallsUsed = await ContinuousMonitoringService.getMonthlyApiCallCount(req.user.id);
    
    // Get subscription info
    const SubscriptionService = (await import('../../services/SubscriptionService.js')).default;
    let subscriptionInfo = { tier: 0, tierName: 'Free' };
    
    if (user.walletAddress) {
      try {
        subscriptionInfo = await SubscriptionService.getSubscriptionInfo(user.walletAddress);
      } catch (error) {
        console.warn('Could not fetch subscription:', error.message);
      }
    }
    
    const apiLimit = ContinuousMonitoringService.getApiLimitForTier(subscriptionInfo.tier);
    
    res.json({
      tier: subscriptionInfo.tierName,
      apiCallsUsed,
      apiCallsLimit: apiLimit,
      percentUsed: ((apiCallsUsed / apiLimit) * 100).toFixed(1),
      remaining: Math.max(0, apiLimit - apiCallsUsed),
      resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      currentMonth: new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/all:
 *   get:
 *     summary: Get all active monitors (admin only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All active monitors retrieved successfully
 */
router.get('/all', async (req, res) => {
  try {
    // TODO: Add admin check
    const monitors = ContinuousMonitoringService.getAllActiveMonitors();
    
    res.json({
      totalActive: monitors.length,
      monitors
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get active monitors',
      message: error.message
    });
  }
});

export default router;
