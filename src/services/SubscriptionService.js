/**
 * Subscription Service
 * Handles Web3 subscription integration with backend
 */

import { ethers } from 'ethers';
import { createRobustProvider } from './RobustProvider.js';
import dotenv from 'dotenv';

dotenv.config();

// Contract addresses
const CONTRACTS = {
  MGT_TOKEN: process.env.MGT_TOKEN_ADDRESS || '0xB51623F59fF9f2AA7d3bC1Afa99AE0fA8049ed3D',
  SUBSCRIPTION: process.env.SUBSCRIPTION_ADDRESS || '0x577d9A43D0fa564886379bdD9A56285769683C38'
};

// Lisk Sepolia configuration
const LISK_SEPOLIA_RPC = process.env.LISK_SEPOLIA_RPC || 'https://rpc.sepolia-api.lisk.com';

// Contract ABIs
const SUBSCRIPTION_ABI = [
  'function isSubscriberActive(address user) view returns (bool)',
  'function getSubscriptionInfo(address user) view returns (tuple(address userAddress, uint8 tier, uint8 role, uint8 billingCycle, uint256 startTime, uint256 endTime, uint256 periodStart, uint256 periodEnd, bool isActive, bool cancelAtPeriodEnd, uint256 gracePeriodEnd, uint256 amountPaid, uint8 currency))',
  'function plans(uint8 tier) view returns (string name, uint256 monthlyPrice, uint256 yearlyPrice, tuple(uint256 apiCallsPerMonth, uint256 maxProjects, uint256 maxAlerts, bool exportAccess, bool comparisonTool, bool walletIntelligence, bool apiAccess, bool prioritySupport, bool customInsights) features, tuple(uint256 historicalData, uint256 teamMembers, uint256 dataRefreshRate) limits, bool active)',
  'function totalSubscribers() view returns (uint256)',
  'function totalRevenue() view returns (uint256)',
  
  // Events
  'event SubscriptionCreated(address indexed user, uint8 tier, uint8 role, uint8 billingCycle, uint256 startTime, uint256 endTime)',
  'event SubscriptionCancelled(address indexed user)',
  'event SubscriptionRenewed(address indexed user, uint256 newEndTime)',
  'event SubscriptionChanged(address indexed user, uint8 newTier, uint8 newCycle)'
];

// Subscription tiers mapping
const SUBSCRIPTION_TIERS = {
  0: 'Free',
  1: 'Starter', 
  2: 'Pro',
  3: 'Enterprise'
};

const USER_ROLES = {
  0: 'Developer',
  1: 'Analyst', 
  2: 'Researcher'
};

const BILLING_CYCLES = {
  0: 'Monthly',
  1: 'Yearly'
};

class SubscriptionService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.subscriptionContract = null;
    this.retryConfig = {
      maxRetries: 2,
      baseDelay: 1500,
      maxDelay: 10000
    };
  }

  /**
   * Lazy initialization - only connect when needed
   * @private
   */
  async _initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize provider with RobustProvider to prevent filter errors
      const baseProvider = new ethers.JsonRpcProvider(LISK_SEPOLIA_RPC, undefined, {
        staticNetwork: true,
        timeout: 5000 // 5 second timeout
      });
      
      // Wrap with RobustProvider to handle filter errors gracefully
      this.provider = createRobustProvider(baseProvider, {
        disableFilters: true,
        usePolling: true,
        pollingInterval: 5000,
        maxBlockRange: 2000
      });
      
      this.subscriptionContract = new ethers.Contract(
        CONTRACTS.SUBSCRIPTION,
        SUBSCRIPTION_ABI,
        this.provider.provider // Use underlying provider for contract
      );
      
      // Setup event listeners with error handling
      this.setupEventListeners();
      this.initialized = true;
      console.log('[SubscriptionService] Initialized successfully with RobustProvider');
    } catch (error) {
      console.warn('[SubscriptionService] Initialization failed:', error.message);
      // Don't throw - allow app to continue without subscription features
    }
  }

  /**
   * Execute contract call with timeout and retry logic
   * @private
   */
  async _callWithRetry(operation, operationName, timeout = 10000) {
    let lastError;
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await this._withTimeout(operation(), timeout);
      } catch (error) {
        lastError = error;
        
        // Skip retry for non-retryable errors
        if (error.message.includes('Invalid') || error.message.includes('missing')) {
          throw error;
        }
        
        if (attempt < this.retryConfig.maxRetries - 1) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );
          console.warn(`[SubscriptionService] ${operationName} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`[SubscriptionService] ${operationName} failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Execute with timeout
   * @private
   */
  async _withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Setup blockchain event listeners
   */
  setupEventListeners() {
    if (!this.subscriptionContract) return;
    
    console.log('🔗 Setting up subscription event listeners with robust polling...');

    // Use RobustProvider's event listener to avoid filter errors
    const eventFilter = {
      address: CONTRACTS.SUBSCRIPTION,
      topics: [] // Listen to all events from this contract
    };

    // Listen for new subscriptions using robust event listener
    try {
      this.provider.createRobustEventListener(eventFilter, (log) => {
        // Parse the log to determine event type
        try {
          const parsedLog = this.subscriptionContract.interface.parseLog(log);
          
          if (parsedLog.name === 'SubscriptionCreated') {
            const [user, tier, role, billingCycle, startTime, endTime] = parsedLog.args;
            console.log('📝 New subscription created:', {
              user,
              tier: SUBSCRIPTION_TIERS[tier],
              role: USER_ROLES[role],
              billingCycle: BILLING_CYCLES[billingCycle],
              startTime: new Date(Number(startTime) * 1000),
              endTime: new Date(Number(endTime) * 1000),
              transactionHash: log.transactionHash
            });

            this.handleSubscriptionCreated({
              walletAddress: user,
              tier: Number(tier),
              role: Number(role),
              billingCycle: Number(billingCycle),
              startTime: Number(startTime),
              endTime: Number(endTime),
              transactionHash: log.transactionHash
            });
          } else if (parsedLog.name === 'SubscriptionCancelled') {
            const [user] = parsedLog.args;
            console.log('❌ Subscription cancelled:', {
              user,
              transactionHash: log.transactionHash
            });

            this.handleSubscriptionCancelled({
              walletAddress: user,
              transactionHash: log.transactionHash
            });
          } else if (parsedLog.name === 'SubscriptionRenewed') {
            const [user, newEndTime] = parsedLog.args;
            console.log('🔄 Subscription renewed:', {
              user,
              newEndTime: new Date(Number(newEndTime) * 1000),
              transactionHash: log.transactionHash
            });

            this.handleSubscriptionRenewed({
              walletAddress: user,
              newEndTime: Number(newEndTime),
              transactionHash: log.transactionHash
            });
          } else if (parsedLog.name === 'SubscriptionChanged') {
            const [user, newTier, newCycle] = parsedLog.args;
            console.log('🔄 Subscription changed:', {
              user,
              newTier: SUBSCRIPTION_TIERS[newTier],
              newCycle: BILLING_CYCLES[newCycle],
              transactionHash: log.transactionHash
            });

            this.handleSubscriptionChanged({
              walletAddress: user,
              newTier: Number(newTier),
              newCycle: Number(newCycle),
              transactionHash: log.transactionHash
            });
          }
        } catch (parseError) {
          console.warn('Failed to parse event log:', parseError.message);
        }
      });
      
      console.log('✅ Event listeners configured with block-based polling (no filters)');
    } catch (error) {
      console.error('Failed to setup event listeners:', error.message);
    }
  }

  /**
   * Check if a user has an active subscription
   */
  async isSubscriberActive(walletAddress) {
    try {
      await this._initialize();
      
      if (!this.subscriptionContract) {
        console.warn('[SubscriptionService] Not initialized, returning false');
        return false;
      }
      
      if (!ethers.isAddress(walletAddress)) {
        throw new Error('Invalid wallet address');
      }

      const isActive = await this._callWithRetry(
        () => this.subscriptionContract.isSubscriberActive(walletAddress),
        'isSubscriberActive',
        10000
      );
      return isActive;
    } catch (error) {
      console.error('Error checking subscription status:', error.message);
      return false; // Return false instead of throwing
    }
  }

  /**
   * Get detailed subscription information
   */
  async getSubscriptionInfo(walletAddress) {
    try {
      await this._initialize();
      
      if (!this.subscriptionContract) {
        throw new Error('Subscription service not available');
      }
      
      if (!ethers.isAddress(walletAddress)) {
        throw new Error('Invalid wallet address');
      }

      const subInfo = await this._callWithRetry(
        () => this.subscriptionContract.getSubscriptionInfo(walletAddress),
        'getSubscriptionInfo',
        15000
      );
      
      return {
        walletAddress: subInfo.userAddress,
        tier: Number(subInfo.tier),
        tierName: SUBSCRIPTION_TIERS[Number(subInfo.tier)],
        role: Number(subInfo.role),
        roleName: USER_ROLES[Number(subInfo.role)],
        billingCycle: Number(subInfo.billingCycle),
        billingCycleName: BILLING_CYCLES[Number(subInfo.billingCycle)],
        startTime: Number(subInfo.startTime),
        endTime: Number(subInfo.endTime),
        periodStart: Number(subInfo.periodStart),
        periodEnd: Number(subInfo.periodEnd),
        isActive: subInfo.isActive,
        cancelAtPeriodEnd: subInfo.cancelAtPeriodEnd,
        gracePeriodEnd: Number(subInfo.gracePeriodEnd),
        amountPaid: ethers.formatEther(subInfo.amountPaid),
        currency: Number(subInfo.currency),
        
        // Computed fields
        daysRemaining: this.calculateDaysRemaining(Number(subInfo.endTime)),
        isInGracePeriod: this.isInGracePeriod(Number(subInfo.endTime), Number(subInfo.gracePeriodEnd)),
        isExpired: this.isExpired(Number(subInfo.endTime))
      };
    } catch (error) {
      console.error('Error getting subscription info:', error.message);
      throw error;
    }
  }

  /**
   * Get subscription plan details
   */
  async getPlanInfo(tier) {
    try {
      const plan = await this.subscriptionContract.plans(tier);
      
      return {
        name: plan.name,
        monthlyPrice: ethers.formatEther(plan.monthlyPrice),
        yearlyPrice: ethers.formatEther(plan.yearlyPrice),
        features: {
          apiCallsPerMonth: Number(plan.features.apiCallsPerMonth),
          maxProjects: Number(plan.features.maxProjects),
          maxAlerts: Number(plan.features.maxAlerts),
          exportAccess: plan.features.exportAccess,
          comparisonTool: plan.features.comparisonTool,
          walletIntelligence: plan.features.walletIntelligence,
          apiAccess: plan.features.apiAccess,
          prioritySupport: plan.features.prioritySupport,
          customInsights: plan.features.customInsights
        },
        limits: {
          historicalData: Number(plan.limits.historicalData),
          teamMembers: Number(plan.limits.teamMembers),
          dataRefreshRate: Number(plan.limits.dataRefreshRate)
        },
        active: plan.active
      };
    } catch (error) {
      console.error('Error getting plan info:', error);
      throw error;
    }
  }

  /**
   * Get all subscription plans
   */
  async getAllPlans() {
    try {
      // If blockchain not available, return hardcoded plans
      if (!this.subscriptionContract) {
        return {
          0: {
            tier: 0,
            name: 'Free',
            monthlyPrice: '0',
            yearlyPrice: '0',
            features: {
              apiCallsPerMonth: 1000,
              maxProjects: 1,
              maxAlerts: 3,
              exportAccess: false,
              comparisonTool: false,
              walletIntelligence: false,
              apiAccess: false,
              prioritySupport: false,
              customInsights: false
            },
            limits: {
              historicalData: 30,
              teamMembers: 1,
              dataRefreshRate: 3600
            }
          },
          1: {
            tier: 1,
            name: 'Starter',
            monthlyPrice: '29',
            yearlyPrice: '290',
            features: {
              apiCallsPerMonth: 10000,
              maxProjects: 3,
              maxAlerts: 10,
              exportAccess: true,
              comparisonTool: true,
              walletIntelligence: false,
              apiAccess: false,
              prioritySupport: false,
              customInsights: false
            },
            limits: {
              historicalData: 90,
              teamMembers: 2,
              dataRefreshRate: 1800
            }
          },
          2: {
            tier: 2,
            name: 'Pro',
            monthlyPrice: '99',
            yearlyPrice: '990',
            features: {
              apiCallsPerMonth: 50000,
              maxProjects: 10,
              maxAlerts: 50,
              exportAccess: true,
              comparisonTool: true,
              walletIntelligence: true,
              apiAccess: true,
              prioritySupport: true,
              customInsights: false
            },
            limits: {
              historicalData: 365,
              teamMembers: 5,
              dataRefreshRate: 900
            }
          },
          3: {
            tier: 3,
            name: 'Enterprise',
            monthlyPrice: '299',
            yearlyPrice: '2990',
            features: {
              apiCallsPerMonth: 250000,
              maxProjects: 50,
              maxAlerts: 200,
              exportAccess: true,
              comparisonTool: true,
              walletIntelligence: true,
              apiAccess: true,
              prioritySupport: true,
              customInsights: true
            },
            limits: {
              historicalData: 730,
              teamMembers: 20,
              dataRefreshRate: 300
            }
          }
        };
      }

      const plans = {};
      
      for (let tier = 0; tier <= 3; tier++) {
        try {
          plans[tier] = await this.getPlanInfo(tier);
        } catch (error) {
          console.warn(`Could not fetch plan ${tier}:`, error.message);
        }
      }
      
      return plans;
    } catch (error) {
      console.error('Error getting all plans:', error);
      throw error;
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats() {
    try {
      // If blockchain not available, return mock stats
      if (!this.subscriptionContract) {
        return {
          totalSubscribers: 0,
          totalRevenue: '0',
          timestamp: new Date().toISOString(),
          note: 'Blockchain integration not configured'
        };
      }

      const totalSubscribers = await this.subscriptionContract.totalSubscribers();
      const totalRevenue = await this.subscriptionContract.totalRevenue();
      
      return {
        totalSubscribers: Number(totalSubscribers),
        totalRevenue: ethers.formatEther(totalRevenue),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      // Return graceful fallback instead of throwing
      return {
        totalSubscribers: 0,
        totalRevenue: '0',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Validate user access based on subscription
   */
  async validateUserAccess(walletAddress, requiredFeature = null) {
    try {
      const isActive = await this.isSubscriberActive(walletAddress);
      
      if (!isActive) {
        return {
          hasAccess: false,
          reason: 'No active subscription',
          tier: 0,
          tierName: 'Free'
        };
      }

      const subInfo = await this.getSubscriptionInfo(walletAddress);
      const planInfo = await this.getPlanInfo(subInfo.tier);

      // Check specific feature access
      if (requiredFeature && !planInfo.features[requiredFeature]) {
        return {
          hasAccess: false,
          reason: `Feature '${requiredFeature}' not available in ${subInfo.tierName} plan`,
          tier: subInfo.tier,
          tierName: subInfo.tierName
        };
      }

      return {
        hasAccess: true,
        tier: subInfo.tier,
        tierName: subInfo.tierName,
        features: planInfo.features,
        limits: planInfo.limits,
        subscriptionInfo: subInfo
      };
    } catch (error) {
      console.error('Error validating user access:', error);
      return {
        hasAccess: false,
        reason: 'Error validating subscription',
        tier: 0,
        tierName: 'Free'
      };
    }
  }

  /**
   * Calculate days remaining in subscription
   */
  calculateDaysRemaining(endTime) {
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTime - now;
    return Math.max(0, Math.floor(remaining / (24 * 60 * 60)));
  }

  /**
   * Check if subscription is in grace period
   */
  isInGracePeriod(endTime, gracePeriodEnd) {
    const now = Math.floor(Date.now() / 1000);
    return now > endTime && now <= gracePeriodEnd;
  }

  /**
   * Check if subscription is expired
   */
  isExpired(endTime) {
    const now = Math.floor(Date.now() / 1000);
    return now > endTime;
  }

  /**
   * Handle subscription created event
   */
  async handleSubscriptionCreated(data) {
    // Here you would typically save to your database
    console.log('💾 Saving subscription to database:', data);
    
    // Example database save (implement based on your DB)
    // await this.saveSubscriptionToDatabase(data);
    
    // You might also want to:
    // - Send welcome email
    // - Update user permissions
    // - Log analytics event
    // - Trigger webhooks
  }

  /**
   * Handle subscription cancelled event
   */
  async handleSubscriptionCancelled(data) {
    console.log('💾 Updating cancelled subscription:', data);
    
    // Update database
    // Send cancellation email
    // Update user permissions
    // Log analytics event
  }

  /**
   * Handle subscription renewed event
   */
  async handleSubscriptionRenewed(data) {
    console.log('💾 Updating renewed subscription:', data);
    
    // Update database
    // Send renewal confirmation
    // Log analytics event
  }

  /**
   * Handle subscription changed event
   */
  async handleSubscriptionChanged(data) {
    console.log('💾 Updating changed subscription:', data);
    
    // Update database
    // Send change confirmation
    // Update user permissions
    // Log analytics event
  }

  /**
   * Middleware for API route protection
   */
  createSubscriptionMiddleware(requiredTier = 0, requiredFeature = null) {
    return async (req, res, next) => {
      try {
        const walletAddress = req.user?.walletAddress || req.headers['x-wallet-address'];
        
        if (!walletAddress) {
          return res.status(401).json({
            error: 'Wallet address required',
            code: 'WALLET_REQUIRED'
          });
        }

        const access = await this.validateUserAccess(walletAddress, requiredFeature);
        
        if (!access.hasAccess) {
          return res.status(403).json({
            error: access.reason,
            code: 'SUBSCRIPTION_REQUIRED',
            currentTier: access.tier,
            requiredTier: requiredTier
          });
        }

        if (access.tier < requiredTier) {
          return res.status(403).json({
            error: `${SUBSCRIPTION_TIERS[requiredTier]} plan or higher required`,
            code: 'UPGRADE_REQUIRED',
            currentTier: access.tier,
            requiredTier: requiredTier
          });
        }

        // Add subscription info to request
        req.subscription = access;
        next();
      } catch (error) {
        console.error('Subscription middleware error:', error);
        res.status(500).json({
          error: 'Subscription validation failed',
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }
}

// Export singleton instance
const subscriptionService = new SubscriptionService();
export default subscriptionService;