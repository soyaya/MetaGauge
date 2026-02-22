/**
 * Subscription-based rate limiting middleware
 * Different limits based on user tier
 */

import rateLimit from 'express-rate-limit';
import { UserStorage } from '../database/index.js';
import { SUBSCRIPTION_TIERS } from '../../services/SubscriptionBlockRangeCalculator.js';

// Rate limits per tier (requests per 15 minutes)
const TIER_RATE_LIMITS = {
  0: 50,    // Free: 50 requests per 15 min
  1: 200,   // Starter: 200 requests per 15 min
  2: 500,   // Pro: 500 requests per 15 min
  3: 2000   // Enterprise: 2000 requests per 15 min
};

/**
 * Create tier-based rate limiter
 */
export const createTierRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    
    // Dynamic limit based on user tier
    max: async (req) => {
      if (!req.user) {
        return 50; // Unauthenticated: Free tier limit
      }
      
      try {
        const user = await UserStorage.findById(req.user.id);
        const tier = user?.tier || 0;
        return TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS[0];
      } catch (error) {
        console.error('Error getting user tier for rate limit:', error);
        return TIER_RATE_LIMITS[0]; // Fallback to Free tier
      }
    },
    
    // Use user ID as key if authenticated, otherwise IP
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    
    message: async (req) => {
      const tier = req.user ? (await UserStorage.findById(req.user.id))?.tier || 0 : 0;
      const limit = TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS[0];
      const tierName = Object.values(SUBSCRIPTION_TIERS).find(t => t.tier === tier)?.name || 'Free';
      
      return {
        error: 'Rate limit exceeded',
        message: `Too many requests. Your ${tierName} tier allows ${limit} requests per 15 minutes.`,
        tier: tierName,
        limit: limit,
        retryAfter: '15 minutes'
      };
    },
    
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Stricter rate limiter for expensive operations (analysis, onboarding)
 */
export const createAnalysisRateLimiter = () => {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    
    max: async (req) => {
      if (!req.user) {
        return 5; // Unauthenticated: 5 per hour
      }
      
      try {
        const user = await UserStorage.findById(req.user.id);
        const tier = user?.tier || 0;
        
        // Analysis limits per hour
        const limits = {
          0: 10,   // Free: 10 analyses per hour
          1: 50,   // Starter: 50 per hour
          2: 200,  // Pro: 200 per hour
          3: 1000  // Enterprise: 1000 per hour
        };
        
        return limits[tier] || limits[0];
      } catch (error) {
        console.error('Error getting user tier for analysis rate limit:', error);
        return 10;
      }
    },
    
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    
    message: async (req) => {
      const tier = req.user ? (await UserStorage.findById(req.user.id))?.tier || 0 : 0;
      const tierName = Object.values(SUBSCRIPTION_TIERS).find(t => t.tier === tier)?.name || 'Free';
      
      return {
        error: 'Analysis rate limit exceeded',
        message: `Too many analysis requests. Upgrade your ${tierName} tier for higher limits.`,
        tier: tierName,
        upgradeUrl: '/subscription'
      };
    },
    
    standardHeaders: true,
    legacyHeaders: false,
  });
};

export default { createTierRateLimiter, createAnalysisRateLimiter };
