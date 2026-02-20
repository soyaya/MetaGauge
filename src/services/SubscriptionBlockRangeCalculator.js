/**
 * Subscription Block Range Calculator
 * Calculates block ranges based on subscription tier and historical data limits
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import subscriptionService from './SubscriptionService.js';

// Subscription tier definitions aligned with smart contract
// Contract: 0x577d9A43D0fa564886379bdD9A56285769683C38 (Lisk Sepolia)
export const SUBSCRIPTION_TIERS = {
  FREE: {
    tier: 0,
    name: 'Free',
    historicalDays: 30, // ✅ FIXED - Matches contract (30 days)
    continuousSync: false,
    maxContracts: 5, // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 1000,
    maxAlerts: 3,
    teamMembers: 1,
    dataRefreshRate: 24 * 60 * 60 // 24 hours in seconds
  },
  STARTER: {
    tier: 1,
    name: 'Starter',
    historicalDays: 90, // ✅ FIXED - Matches contract (90 days)
    continuousSync: true,
    maxContracts: 20, // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 10000,
    maxAlerts: 15,
    teamMembers: 3,
    dataRefreshRate: 12 * 60 * 60 // 12 hours in seconds
  },
  PRO: {
    tier: 2,
    name: 'Pro',
    historicalDays: 365, // ✅ FIXED - Matches contract (365 days / 1 year)
    continuousSync: true,
    maxContracts: 100, // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 50000,
    maxAlerts: 50,
    teamMembers: 10,
    dataRefreshRate: 6 * 60 * 60 // 6 hours in seconds
  },
  ENTERPRISE: {
    tier: 3,
    name: 'Enterprise',
    historicalDays: 730, // ✅ FIXED - Matches contract (730 days / 2 years)
    continuousSync: true,
    maxContracts: 1000, // ✅ FIXED - Matches contract maxProjects
    apiCallsPerMonth: 250000,
    maxAlerts: 200,
    teamMembers: 50,
    dataRefreshRate: 1 * 60 * 60 // 1 hour in seconds
  }
};

// Blocks per day by chain (approximate)
export const BLOCKS_PER_DAY = {
  ethereum: 7200,  // ~12 second blocks
  lisk: 7200,      // ~12 second blocks
  starknet: 14400  // ~6 second blocks
};

export class SubscriptionBlockRangeCalculator {
  constructor() {
    this.subscriptionService = subscriptionService;
  }

  /**
   * Get subscription tier configuration by tier number
   */
  getTierConfig(tierNumber) {
    const tiers = Object.values(SUBSCRIPTION_TIERS);
    return tiers.find(t => t.tier === tierNumber) || SUBSCRIPTION_TIERS.FREE;
  }

  /**
   * Calculate block range based on subscription tier
   * @param {string} walletAddress - User's wallet address
   * @param {string} chain - Chain name (ethereum, lisk, starknet)
   * @param {number} deploymentBlock - Contract deployment block
   * @param {number} currentBlock - Current blockchain block number
   * @returns {Promise<Object>} Block range with metadata
   */
  async calculateBlockRange(walletAddress, chain, deploymentBlock, currentBlock) {
    try {
      console.log(`📊 Calculating block range for ${walletAddress} on ${chain}`);
      
      // Get user's subscription info
      const subInfo = await this.subscriptionService.getSubscriptionInfo(walletAddress);
      const tierConfig = this.getTierConfig(subInfo.tier);
      
      console.log(`   Subscription: ${tierConfig.name} (Tier ${tierConfig.tier})`);
      console.log(`   Historical data: ${tierConfig.historicalDays} days`);
      
      // Calculate start block based on tier
      let startBlock;
      let maxBlocks = 0;
      
      // Calculate blocks from days
      const blocksPerDay = BLOCKS_PER_DAY[chain.toLowerCase()] || 7200;
      maxBlocks = tierConfig.historicalDays * blocksPerDay;
      const calculatedStart = currentBlock - maxBlocks;
      
      // Ensure we don't go before deployment
      startBlock = Math.max(deploymentBlock, calculatedStart);
      
      console.log(`   📅 ${tierConfig.historicalDays} days = ${maxBlocks.toLocaleString()} blocks`);
      console.log(`   🧱 Calculated start: ${calculatedStart.toLocaleString()}`);
      console.log(`   🧱 Deployment block: ${deploymentBlock.toLocaleString()}`);
      console.log(`   ✅ Actual start: ${startBlock.toLocaleString()}`);
      
      const actualBlocks = currentBlock - startBlock;
      
      return {
        startBlock,
        endBlock: currentBlock,
        deploymentBlock,
        historicalDays: tierConfig.historicalDays,
        tierName: tierConfig.name,
        tierNumber: tierConfig.tier,
        maxBlocks,
        actualBlocks,
        continuousSync: tierConfig.continuousSync,
        blocksPerDay: BLOCKS_PER_DAY[chain.toLowerCase()] || 7200,
        chain,
        walletAddress,
        subscription: {
          tier: subInfo.tier,
          isActive: subInfo.isActive,
          endTime: subInfo.endTime,
          daysRemaining: subInfo.daysRemaining
        }
      };
      
    } catch (error) {
      console.error('❌ Error calculating block range:', error);
      
      // Fallback to Free tier if subscription check fails
      console.warn('⚠️  Falling back to Free tier (30 days)');
      const blocksPerDay = BLOCKS_PER_DAY[chain.toLowerCase()] || 7200;
      const maxBlocks = 30 * blocksPerDay; // 30 days (Free tier)
      const startBlock = Math.max(deploymentBlock, currentBlock - maxBlocks);
      
      return {
        startBlock,
        endBlock: currentBlock,
        deploymentBlock,
        historicalDays: 30,
        tierName: 'Free',
        tierNumber: 0,
        maxBlocks,
        actualBlocks: currentBlock - startBlock,
        continuousSync: false,
        blocksPerDay,
        chain,
        walletAddress,
        subscription: {
          tier: 0,
          isActive: false,
          error: error.message
        }
      };
    }
  }

  /**
   * Check if user can enable continuous sync based on tier
   */
  async canEnableContinuousSync(walletAddress) {
    try {
      const subInfo = await this.subscriptionService.getSubscriptionInfo(walletAddress);
      const tierConfig = this.getTierConfig(subInfo.tier);
      return tierConfig.continuousSync && subInfo.isActive;
    } catch (error) {
      console.error('Error checking continuous sync eligibility:', error);
      return false;
    }
  }

  /**
   * Get tier limits for display
   */
  async getTierLimits(walletAddress) {
    try {
      const subInfo = await this.subscriptionService.getSubscriptionInfo(walletAddress);
      const tierConfig = this.getTierConfig(subInfo.tier);
      
      return {
        tier: tierConfig.name,
        tierNumber: tierConfig.tier,
        historicalDays: tierConfig.historicalDays,
        continuousSync: tierConfig.continuousSync,
        maxContracts: tierConfig.maxContracts,
        isActive: subInfo.isActive,
        daysRemaining: subInfo.daysRemaining
      };
    } catch (error) {
      console.error('Error getting tier limits:', error);
      return {
        tier: 'Free',
        tierNumber: 0,
        historicalDays: 30,
        continuousSync: false,
        maxContracts: 5,
        isActive: false,
        error: error.message
      };
    }
  }
}

export default new SubscriptionBlockRangeCalculator();
