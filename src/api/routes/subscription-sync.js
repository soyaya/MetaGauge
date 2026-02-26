/**
 * Subscription sync endpoint
 * Syncs subscription data from smart contract to backend
 */

import express from 'express';
import { UserStorage } from '../database/index.js';
import SubscriptionService from '../../services/SubscriptionService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * Get fresh subscription data from smart contract
 */
router.get('/fresh', asyncHandler(async (req, res) => {
  const user = await UserStorage.findById(req.user.id);
  
  if (!user.walletAddress) {
    return res.status(400).json({
      error: 'No wallet address',
      message: 'Please connect your wallet first'
    });
  }
  
  // Get fresh data from smart contract
  const subInfo = await SubscriptionService.getSubscriptionInfo(user.walletAddress);
  
  // Update user record
  await UserStorage.update(req.user.id, {
    tier: subInfo.tier,
    subscription: {
      tier: subInfo.tier,
      isActive: subInfo.isActive,
      endTime: subInfo.endTime,
      lastSynced: new Date().toISOString()
    }
  });
  
  res.json({
    tier: subInfo.tier,
    tierName: subInfo.tierName,
    isActive: subInfo.isActive,
    endTime: subInfo.endTime,
    daysRemaining: subInfo.daysRemaining
  });
}));

export default router;
