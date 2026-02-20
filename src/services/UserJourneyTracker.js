/**
 * User Journey Tracking System
 * Multi-Chain RPC Integration - Task 18
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { errorHandler } from './ErrorHandler.js';
import { dbOptimizer } from './DatabaseOptimizer.js';

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
    
    // Store activity
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
      
      // Store bridge activity
      await this._storeBridgeActivity(address, transaction, chain);
    }
  }

  /**
   * Generate comprehensive multi-chain user profile
   */
  async generateUserProfile(address) {
    // Get user activities across all chains
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
   * Detect bot behavior
   */
  async _detectBotBehavior(address, profile) {
    // Check for regular timing patterns
    const result = await dbOptimizer.query(`
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        COUNT(*) as tx_count
      FROM user_activities 
      WHERE address = $1
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY tx_count DESC
    `, [address]);
    
    if (result.rows.length === 0) return false;
    
    // Bot indicator: very regular activity patterns
    const maxHourlyTxs = result.rows[0].tx_count;
    const totalTxs = result.rows.reduce((sum, row) => sum + parseInt(row.tx_count), 0);
    
    return (maxHourlyTxs / totalTxs) > 0.8; // 80% of transactions in single hour
  }

  /**
   * Detect wash trading patterns
   */
  async _detectWashTrading(address, profile) {
    // Look for back-and-forth transactions with same counterparty
    const result = await dbOptimizer.query(`
      SELECT 
        counterparty,
        COUNT(*) as interaction_count,
        SUM(CASE WHEN from_address = $1 THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN to_address = $1 THEN 1 ELSE 0 END) as received_count
      FROM (
        SELECT from_address, to_address,
               CASE WHEN from_address = $1 THEN to_address ELSE from_address END as counterparty
        FROM user_activities 
        WHERE address = $1
      ) interactions
      GROUP BY counterparty
      HAVING COUNT(*) > 10
      ORDER BY interaction_count DESC
    `, [address]);
    
    // Wash trading indicator: high bidirectional activity with few counterparties
    return result.rows.some(row => 
      Math.abs(row.sent_count - row.received_count) < 2 && row.interaction_count > 20
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
   * Get user activities from database
   */
  async _getUserActivities(address) {
    try {
      const result = await dbOptimizer.query(`
        SELECT 
          chain,
          COUNT(*) as transaction_count,
          SUM(CAST(value AS NUMERIC)) as total_volume,
          SUM(gas_used * gas_price) as gas_spent,
          MIN(timestamp) as first_seen,
          MAX(timestamp) as last_seen
        FROM user_activities 
        WHERE address = $1
        GROUP BY chain
      `, [address]);
      
      return result.rows;
    } catch (error) {
      errorHandler.warn('Failed to get user activities', { address, error: error.message });
      return [];
    }
  }

  /**
   * Get bridge activities
   */
  async _getBridgeActivities(address) {
    try {
      const result = await dbOptimizer.query(`
        SELECT * FROM bridge_activities 
        WHERE address = $1
        ORDER BY timestamp DESC
      `, [address]);
      
      return result.rows;
    } catch (error) {
      errorHandler.warn('Failed to get bridge activities', { address, error: error.message });
      return [];
    }
  }

  /**
   * Store user activity
   */
  async _storeUserActivity(address, transaction, chain, session) {
    try {
      await dbOptimizer.bulkInsert('user_activities', [{
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
      }]);
    } catch (error) {
      errorHandler.warn('Failed to store user activity', { address, error: error.message });
    }
  }

  /**
   * Store bridge activity
   */
  async _storeBridgeActivity(address, transaction, chain) {
    try {
      await dbOptimizer.bulkInsert('bridge_activities', [{
        address,
        transaction_hash: transaction.hash,
        from_chain: chain,
        to_chain: this._inferDestinationChain(transaction),
        amount: transaction.value,
        asset: this._extractAsset(transaction),
        timestamp: new Date(transaction.timestamp || Date.now())
      }]);
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
    
    // Get user counts
    const userResult = await dbOptimizer.query(`
      SELECT 
        COUNT(DISTINCT address) as total_users,
        COUNT(DISTINCT CASE WHEN chain_count > 1 THEN address END) as cross_chain_users
      FROM (
        SELECT address, COUNT(DISTINCT chain) as chain_count
        FROM user_activities
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY address
      ) user_chains
    `, [new Date(timeRange.start), new Date(timeRange.end)]);
    
    if (userResult.rows.length > 0) {
      analytics.totalUsers = parseInt(userResult.rows[0].total_users);
      analytics.crossChainUsers = parseInt(userResult.rows[0].cross_chain_users);
    }
    
    // Get bridge volume
    const bridgeResult = await dbOptimizer.query(`
      SELECT SUM(CAST(amount AS NUMERIC)) as total_volume
      FROM bridge_activities
      WHERE timestamp BETWEEN $1 AND $2
    `, [new Date(timeRange.start), new Date(timeRange.end)]);
    
    if (bridgeResult.rows.length > 0) {
      analytics.bridgeVolume = parseFloat(bridgeResult.rows[0].total_volume || 0);
    }
    
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
