/**
 * Subscription API Routes
 * Handles subscription-related API endpoints
 */

import express from 'express';
import subscriptionService from '../../services/SubscriptionService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/subscription/status/:walletAddress
 * Get subscription status for a wallet address
 */
router.get('/status/:walletAddress', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const isActive = await subscriptionService.isSubscriberActive(walletAddress);
    
    if (!isActive) {
      return res.json({
        isActive: false,
        tier: 0,
        tierName: 'Free'
      });
    }

    const subscriptionInfo = await subscriptionService.getSubscriptionInfo(walletAddress);
    
    res.json({
      isActive: true,
      ...subscriptionInfo
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({
      error: 'Failed to get subscription status',
      message: error.message
    });
  }
});

/**
 * GET /api/subscription/info/:walletAddress
 * Get detailed subscription information
 */
router.get('/info/:walletAddress', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const subscriptionInfo = await subscriptionService.getSubscriptionInfo(walletAddress);
    
    res.json(subscriptionInfo);
  } catch (error) {
    console.error('Error getting subscription info:', error);
    res.status(500).json({
      error: 'Failed to get subscription info',
      message: error.message
    });
  }
});

/**
 * GET /api/subscription/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await subscriptionService.getAllPlans();
    
    res.json({
      plans,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting subscription plans:', error);
    res.status(500).json({
      error: 'Failed to get subscription plans',
      message: error.message
    });
  }
});

/**
 * GET /api/subscription/plan/:tier
 * Get specific plan information
 */
router.get('/plan/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    const tierNumber = parseInt(tier);
    
    if (isNaN(tierNumber) || tierNumber < 0 || tierNumber > 3) {
      return res.status(400).json({
        error: 'Invalid tier. Must be 0-3'
      });
    }

    const planInfo = await subscriptionService.getPlanInfo(tierNumber);
    
    res.json(planInfo);
  } catch (error) {
    console.error('Error getting plan info:', error);
    res.status(500).json({
      error: 'Failed to get plan info',
      message: error.message
    });
  }
});

/**
 * POST /api/subscription/validate
 * Validate user access for specific features
 */
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, requiredFeature, requiredTier } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const access = await subscriptionService.validateUserAccess(walletAddress, requiredFeature);
    
    // Check tier requirement if specified
    if (requiredTier !== undefined && access.hasAccess && access.tier < requiredTier) {
      access.hasAccess = false;
      access.reason = `Tier ${requiredTier} or higher required`;
    }

    res.json(access);
  } catch (error) {
    console.error('Error validating subscription:', error);
    res.status(500).json({
      error: 'Failed to validate subscription',
      message: error.message
    });
  }
});

/**
 * GET /api/subscription/stats
 * Get subscription statistics (admin only)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (implement your admin check logic)
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const stats = await subscriptionService.getSubscriptionStats();
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting subscription stats:', error);
    res.status(500).json({
      error: 'Failed to get subscription stats',
      message: error.message
    });
  }
});

/**
 * POST /api/subscription/link
 * Link wallet address to user account
 */
router.post('/link', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const userId = req.user.id;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    // Validate wallet address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    // Here you would typically save the wallet-user mapping to your database
    // Example:
    // await User.updateOne(
    //   { _id: userId },
    //   { walletAddress: walletAddress.toLowerCase() }
    // );

    console.log(`Linking wallet ${walletAddress} to user ${userId}`);

    // Get subscription status for the linked wallet
    const subscriptionStatus = await subscriptionService.isSubscriberActive(walletAddress);
    let subscriptionInfo = null;

    if (subscriptionStatus) {
      subscriptionInfo = await subscriptionService.getSubscriptionInfo(walletAddress);
    }

    res.json({
      success: true,
      walletAddress: walletAddress.toLowerCase(),
      subscriptionActive: subscriptionStatus,
      subscriptionInfo
    });
  } catch (error) {
    console.error('Error linking wallet:', error);
    res.status(500).json({
      error: 'Failed to link wallet',
      message: error.message
    });
  }
});

/**
 * GET /api/subscription/user/:userId
 * Get subscription info for a user ID
 */
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Here you would typically get the wallet address from your database
    // Example:
    // const user = await User.findById(userId);
    // if (!user || !user.walletAddress) {
    //   return res.status(404).json({ error: 'User wallet not found' });
    // }
    // const walletAddress = user.walletAddress;

    // For now, return a placeholder response
    res.json({
      error: 'User-wallet mapping not implemented',
      message: 'Please implement user-wallet database mapping'
    });
  } catch (error) {
    console.error('Error getting user subscription:', error);
    res.status(500).json({
      error: 'Failed to get user subscription',
      message: error.message
    });
  }
});

/**
 * Middleware for protecting routes based on subscription
 */
export const requireSubscription = (requiredTier = 0, requiredFeature = null) => {
  return subscriptionService.createSubscriptionMiddleware(requiredTier, requiredFeature);
};

export default router;