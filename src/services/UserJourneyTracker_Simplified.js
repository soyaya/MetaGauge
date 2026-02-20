/**
 * Simplified User Journey Tracking System
 * In-memory tracking without SQL dependencies
 * Focuses on cross-chain user journey tracking and behavior analysis
 */

import { errorHandler } from './ErrorHandler.js';

/**
 * Cross-chain user journey tracking and behavior analysis
 */
export class UserJourneyTracker {
  constructor(config = {}) {
    this.config = {
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      bridgeDetectionWindow: config.bridgeDetectionWindow || 300000, // 5 minutes
      anomalyThreshold: config.anomalyThreshold || 0.8,
      ...config
    };
    
    this.userSessions = new Map();
    this.bridgePatterns = new Map();
    this.userActivities = new Map(); // In-memory storage
    this.bridgeActivities = new Map(); // In-memory storage
  }

  /**
   * Track user activity across chains
   */
  async trackUserActivity(address, transaction, chain) {
    const sessionKey = `${address}_${chain}`;
    const now = Date.now();
    
    // Get or create session
    let session = this.userSessions.get(sessionKey);
    if (!session || now - session.lastActivity > this.config.sessionTimeout) {
      session = {
        address,
        chain,
        startTime: now,
        transactions: [],
        totalValue: 0,
        gasSpent: 0
      };
    }
    
    // Update session
    session.lastActivity = now;
    session.transactions.push(transaction);
    session.totalValue += parseFloat(transaction.value || 0);
    session.gasSpent += parseFloat(transaction.gasUsed || 0) * parseFloat(transaction.gasPrice || 0);
    
    this.userSessions.set(sessionKey, session);
    
    // Check for bridge activity
    await this._detectBridgeActivity(address, transaction, chain);
    
    // Store activity in memory
    await this._storeUserActivity(address, transaction, chain, session);
  }

  /**
   * Detect bridge usage and asset migration
   */
  async _detectBridgeActivity(address, transaction, chain) {
    const bridgeContracts = {
      ethereum: ['0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', '0xa0b86a33e6441e8c8c7014b37c2a747b0c0d0e05'],
      starknet: ['0x073314940630fd6dcda0d772d4c972c4e0a9946bef9dabf4ef84eda8ef542b82'],
      lisk: ['0x1234567890123456789012345678901234567890']
    };
    
    const isBridgeContract = bridgeContracts[chain]?.includes(transaction.to?.toLowerCase());
    
    if (isBridgeContract) {
      const bridgeKey = `${address}_bridge`;
      
      if (!this.bridgePatterns.has(bridgeKey)) {
        this.bridgePatterns.set(bridgeKey, []);
      }
      
      this.bridgePatterns.get(bridgeKey).push({
        timestamp: Date.now(),
        fromChain: chain,
        toChain: this._inferDestinationChain(transaction),
        amount: transaction.value,
        asset: this._extractAsset(transaction)
      });
      
      // Store bridge activity in memory
      await this._storeBridgeActivity(address, transaction, chain);
    }
  }

  /**
   * Generate comprehensive multi-chain user profile
   */
  async generateUserProfile(address) {
    // Get user activities from memory
    const activities = await this._getUserActivities(address);
    
    // Calculate cross-chain metrics
    const profile = {
      address,
      chains: new Set(),
      totalTransactions: 0,
      totalVolume: 0,
      totalGasSpent: 0,
      bridgeUsage: 0,
      firstSeen: null,
      lastSeen: null,
      behaviorFlags: [],
      riskScore: 0,
      chainPreferences: {},
      assetMigrations: []
    };
    
    // Process activities
    activities.forEach(activity => {
      profile.chains.add(activity.chain);
      profile.totalTransactions += activity.transaction_count;
      profile.totalVolume += parseFloat(activity.total_volume);
      profile.totalGasSpent += parseFloat(activity.gas_spent);
      
      if (!profile.firstSeen || activity.first_seen < profile.firstSeen) {
        profile.firstSeen = activity.first_seen;
      }
      
      if (!profile.lastSeen || activity.last_seen > profile.lastSeen) {
        profile.lastSeen = activity.last_seen;
      }
      
      profile.chainPreferences[activity.chain] = {
        transactions: activity.transaction_count,
        volume: parseFloat(activity.total_volume),
        avgValue: parseFloat(activity.total_volume) / activity.transaction_count
      };
    });
    
    // Get bridge activities
    const bridgeActivities = await this._getBridgeActivities(address);
    profile.bridgeUsage = bridgeActivities.length;
    profile.assetMigrations = bridgeActivities;
    
    // Detect anomalous behavior
    profile.behaviorFlags = await this._detectAnomalousbehavior(address, profile);
    profile.riskScore = this._calculateRiskScore(profile);
    
    // Convert Set to Array for JSON serialization
    profile.chains = Array.from(profile.chains);
    
    return profile;
  }

  /**
   * Detect anomalous behavior patterns
   */
  async _detectAnomalousbehavior(address, profile) {
    const flags = [];
    
    // Bot detection
    if (await this._detectBotBehavior(address, profile)) {
      flags.push('potential_bot');
    }
    
    // Wash trading detection
    if (await this._detectWashTrading(address, profile)) {
      flags.push('wash_trading');
    }
    
    // High frequency trading
    if (profile.totalTransactions > 1000 && profile.chains.length === 1) {
      flags.push('high_frequency_trader');
    }
    
    // Cross-chain arbitrage
    if (profile.bridgeUsage > 10 && profile.chains.length > 2) {
      flags.push('cross_chain_arbitrageur');
    }
    
    // Unusual gas patterns
    const avgGasPerTx = profile.totalGasSpent / profile.totalTransactions;
    if (avgGasPerTx > 0.01 || avgGasPerTx < 0.0001) {
      flags.push('unusual_gas_pattern');
    }
    
    return flags;
  }

  /**
   * Detect bot behavior (simplified in-memory version)
   */
  async _detectBotBehavior(address, profile) {
    const userActivities = this.userActivities.get(address) || [];
    
    if (userActivities.length === 0) return false;
    
    // Check for regular timing patterns
    const hourlyDistribution = {};
    
    userActivities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    });
    
    const hours = Object.keys(hourlyDistribution);
    if (hours.length === 0) return false;
    
    // Bot indicator: very regular activity patterns
    const maxHourlyTxs = Math.max(...Object.values(hourlyDistribution));
    const totalTxs = Object.values(hourlyDistribution).reduce((sum, count) => sum + count, 0);
    
    return (maxHourlyTxs / totalTxs) > 0.8; // 80% of transactions in single hour
  }

  /**
   * Detect wash trading patterns (simplified in-memory version)
   */
  async _detectWashTrading(address, profile) {
    const userActivities = this.userActivities.get(address) || [];
    
    // Look for back-and-forth transactions with same counterparty
    const counterpartyInteractions = {};
    
    userActivities.forEach(activity => {
      const counterparty = activity.from_address === address ? activity.to_address : activity.from_address;
      
      if (!counterpartyInteractions[counterparty]) {
        counterpartyInteractions[counterparty] = { sent: 0, received: 0, total: 0 };
      }
      
      if (activity.from_address === address) {
        counterpartyInteractions[counterparty].sent++;
      } else {
        counterpartyInteractions[counterparty].received++;
      }
      counterpartyInteractions[counterparty].total++;
    });
    
    // Wash trading indicator: high bidirectional activity with few counterparties
    return Object.values(counterpartyInteractions).some(interaction => 
      Math.abs(interaction.sent - interaction.received) < 2 && interaction.total > 20
    );
  }

  /**
   * Calculate risk score
   */
  _calculateRiskScore(profile) {
    let score = 0;
    
    // Base score from behavior flags
    score += profile.behaviorFlags.length * 0.2;
    
    // High transaction volume
    if (profile.totalTransactions > 10000) score += 0.3;
    
    // Multiple chains (could indicate sophistication)
    if (profile.chains.length > 3) score += 0.2;
    
    // High bridge usage
    if (profile.bridgeUsage > 50) score += 0.3;
    
    // Normalize to 0-1 range
    return Math.min(score, 1.0);
  }

  /**
   * Get user activities from memory storage
   */
  async _getUserActivities(address) {
    try {
      const activities = this.userActivities.get(address) || [];
      
      // Group by chain and calculate aggregates
      const chainGroups = {};
      
      activities.forEach(activity => {
        const chain = activity.chain;
        
        if (!chainGroups[chain]) {
          chainGroups[chain] = {
            chain,
            transaction_count: 0,
            total_volume: 0,
            gas_spent: 0,
            first_seen: null,
            last_seen: null
          };
        }
        
        const group = chainGroups[chain];
        group.transaction_count++;
        group.total_volume += parseFloat(activity.value || 0);
        group.gas_spent += parseFloat(activity.gas_used || 0) * parseFloat(activity.gas_price || 0);
        
        const timestamp = new Date(activity.timestamp);
        if (!group.first_seen || timestamp < group.first_seen) {
          group.first_seen = timestamp;
        }
        if (!group.last_seen || timestamp > group.last_seen) {
          group.last_seen = timestamp;
        }
      });
      
      return Object.values(chainGroups);
    } catch (error) {
      errorHandler.warn('Failed to get user activities', { address, error: error.message });
      return [];
    }
  }

  /**
   * Get bridge activities from memory storage
   */
  async _getBridgeActivities(address) {
    try {
      return this.bridgeActivities.get(address) || [];
    } catch (error) {
      errorHandler.warn('Failed to get bridge activities', { address, error: error.message });
      return [];
    }
  }

  /**
   * Store user activity in memory
   */
  async _storeUserActivity(address, transaction, chain, session) {
    try {
      if (!this.userActivities.has(address)) {
        this.userActivities.set(address, []);
      }
      
      this.userActivities.get(address).push({
        address,
        chain,
        transaction_hash: transaction.hash,
        from_address: transaction.from,
        to_address: transaction.to,
        value: transaction.value,
        gas_used: transaction.gasUsed,
        gas_price: transaction.gasPrice,
        timestamp: new Date(transaction.timestamp || Date.now()),
        session_id: `${address}_${session.startTime}`
      });
    } catch (error) {
      errorHandler.warn('Failed to store user activity', { address, error: error.message });
    }
  }

  /**
   * Store bridge activity in memory
   */
  async _storeBridgeActivity(address, transaction, chain) {
    try {
      if (!this.bridgeActivities.has(address)) {
        this.bridgeActivities.set(address, []);
      }
      
      this.bridgeActivities.get(address).push({
        address,
        transaction_hash: transaction.hash,
        from_chain: chain,
        to_chain: this._inferDestinationChain(transaction),
        amount: transaction.value,
        asset: this._extractAsset(transaction),
        timestamp: new Date(transaction.timestamp || Date.now())
      });
    } catch (error) {
      errorHandler.warn('Failed to store bridge activity', { address, error: error.message });
    }
  }

  /**
   * Infer destination chain from transaction
   */
  _inferDestinationChain(transaction) {
    // Mock implementation - would analyze transaction data/logs
    const chains = ['ethereum', 'starknet', 'lisk'];
    return chains[Math.floor(Math.random() * chains.length)];
  }

  /**
   * Extract asset from transaction
   */
  _extractAsset(transaction) {
    // Mock implementation - would analyze transaction input/logs
    const assets = ['ETH', 'USDC', 'USDT', 'WETH'];
    return assets[Math.floor(Math.random() * assets.length)];
  }

  /**
   * Get journey analytics
   */
  async getJourneyAnalytics(timeRange) {
    const analytics = {
      totalUsers: 0,
      crossChainUsers: 0,
      bridgeVolume: 0,
      topMigrationPaths: [],
      behaviorDistribution: {},
      riskDistribution: { low: 0, medium: 0, high: 0 }
    };
    
    // Calculate from in-memory data
    const allUsers = new Set();
    const crossChainUsers = new Set();
    let totalBridgeVolume = 0;
    
    // Process user activities
    for (const [address, activities] of this.userActivities) {
      allUsers.add(address);
      
      const chains = new Set(activities.map(a => a.chain));
      if (chains.size > 1) {
        crossChainUsers.add(address);
      }
    }
    
    // Process bridge activities
    for (const [address, bridges] of this.bridgeActivities) {
      totalBridgeVolume += bridges.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    }
    
    analytics.totalUsers = allUsers.size;
    analytics.crossChainUsers = crossChainUsers.size;
    analytics.bridgeVolume = totalBridgeVolume;
    
    return analytics;
  }

  /**
   * Cleanup old sessions
   */
  cleanup() {
    const now = Date.now();
    
    for (const [key, session] of this.userSessions.entries()) {
      if (now - session.lastActivity > this.config.sessionTimeout * 2) {
        this.userSessions.delete(key);
      }
    }
    
    errorHandler.info('User journey tracker cleanup completed');
  }
}

// Export tracker
export const userJourneyTracker = new UserJourneyTracker();