/**
 * Subscription Routes
 * Handles subscription status and usage tracking
 */

import express from 'express';
import { UserStorage } from '../database/index.js';
import subscriptionService from '../../services/SubscriptionService.js';

const router = express.Router();

/**
 * GET /api/subscription/status
 * Returns user's subscription status and tier information
 */
router.get('/status', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get subscription status from service
    const status = await subscriptionService.getSubscriptionStatus(req.user.id);

    res.json({
      tier: user.tier || 'free',
      tierName: getTierDisplayName(user.tier || 'free'),
      isActive: user.isActive !== false,
      limits: {
        monthly: status.limits?.monthly || 10,
        remaining: status.limits?.remaining || 10,
        maxProjects: status.limits?.maxProjects || 1,
        maxAlerts: status.limits?.maxAlerts || 3,
        historicalDays: status.limits?.historicalDays || 7
      },
      usage: {
        analysisCount: user.usage?.analysisCount || 0,
        monthlyAnalysisCount: user.usage?.monthlyAnalysisCount || 0,
        lastAnalysis: user.usage?.lastAnalysis || null,
        monthlyResetDate: user.usage?.monthlyResetDate || new Date().toISOString()
      },
      features: {
        aiInsights: ['pro', 'enterprise'].includes(user.tier),
        competitiveAnalysis: ['enterprise'].includes(user.tier),
        apiAccess: ['pro', 'enterprise'].includes(user.tier),
        continuousSync: ['starter', 'pro', 'enterprise'].includes(user.tier)
      }
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      error: 'Failed to get subscription status',
      message: error.message
    });
  }
});

/**
 * GET /api/subscription/usage
 * Returns detailed usage statistics
 */
router.get('/usage', async (req, res) => {
  try {
    const usage = await subscriptionService.getUsage(req.user.id);
    res.json(usage);
  } catch (error) {
    console.error('Subscription usage error:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/subscription/verify
 * Verifies subscription payment and updates user tier
 */
router.post('/verify', async (req, res) => {
  try {
    const { transactionHash, chain = 'ethereum' } = req.body;

    if (!transactionHash) {
      return res.status(400).json({
        error: 'Missing transaction hash',
        message: 'Transaction hash is required for verification'
      });
    }

    // Verify the transaction (placeholder - implement actual verification)
    const verification = await verifySubscriptionPayment(transactionHash, chain);
    
    if (!verification.valid) {
      return res.status(400).json({
        error: 'Invalid transaction',
        message: verification.reason || 'Transaction could not be verified'
      });
    }

    // Update user subscription
    const user = await UserStorage.findById(req.user.id);
    const updatedUser = await UserStorage.update(req.user.id, {
      tier: verification.tier,
      subscriptionTier: verification.tier,
      subscriptionExpiry: verification.expiryDate,
      lastPayment: {
        transactionHash,
        amount: verification.amount,
        tier: verification.tier,
        date: new Date().toISOString(),
        chain
      }
    });

    res.json({
      success: true,
      message: 'Subscription verified and updated',
      tier: verification.tier,
      expiryDate: verification.expiryDate,
      user: {
        id: updatedUser.id,
        tier: updatedUser.tier,
        subscriptionTier: updatedUser.subscriptionTier
      }
    });

  } catch (error) {
    console.error('Subscription verification error:', error);
    res.status(500).json({
      error: 'Failed to verify subscription',
      message: error.message
    });
  }
});

// Helper functions
function getTierDisplayName(tier) {
  const tierNames = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise'
  };
  return tierNames[tier] || 'Free';
}

async function verifySubscriptionPayment(transactionHash, chain) {
  // Placeholder implementation
  // In production, this would verify the transaction on-chain
  
  // For now, return a mock verification
  return {
    valid: true,
    tier: 'starter',
    amount: '0.01',
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    reason: null
  };
}

export default router;
