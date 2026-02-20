/**
 * User Behavior Analyzer
 * Multi-Chain RPC Integration - Task 7
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { ethers } from 'ethers';

/**
 * Comprehensive user behavior analyzer with 20 behavioral metrics
 * Analyzes transaction patterns, risk profiles, and engagement levels
 */
export class UserBehaviorAnalyzer {
  constructor(config = {}) {
    this.config = {
      // Analysis windows
      shortTermDays: config.shortTermDays || 7,
      mediumTermDays: config.mediumTermDays || 30,
      longTermDays: config.longTermDays || 90,
      
      // Thresholds
      whaleThreshold: config.whaleThreshold || ethers.parseEther('10'),
      highFrequencyThreshold: config.highFrequencyThreshold || 10, // transactions per day
      gasOptimizationThreshold: config.gasOptimizationThreshold || 0.1, // 10% variance
      
      // Classification settings
      enableUserClassification: config.enableUserClassification !== false,
      maxBehaviorHistory: config.maxBehaviorHistory || 1000,
      
      ...config
    };
    
    // Internal storage
    this.userProfiles = new Map();
    this.behaviorHistory = [];
    this.classifications = new Map();
  }

  /**
   * Analyze user behavior from transaction data
   * @param {Array} transactions - Normalized transaction array
   * @param {string} chain - Blockchain network
   * @returns {Object} Complete behavior analysis
   */
  analyzeUserBehavior(transactions, chain = 'ethereum') {
    // Build user profiles
    this._buildUserProfiles(transactions, chain);
    
    // Calculate all 20 behavioral metrics
    const behaviorMetrics = {
      // Transaction Behavior Metrics (5)
      transactionBehavior: this._calculateTransactionBehaviorMetrics(),
      
      // Risk & Value Behavior Metrics (5)
      riskValueBehavior: this._calculateRiskValueBehaviorMetrics(),
      
      // Engagement & Loyalty Metrics (5)
      engagementLoyalty: this._calculateEngagementLoyaltyMetrics(),
      
      // Advanced Behavioral Patterns (5)
      advancedPatterns: this._calculateAdvancedBehaviorMetrics(),
      
      // User Classifications
      userClassifications: this._classifyUsers()
    };
    
    // Store behavior snapshot
    this._storeBehaviorSnapshot(behaviorMetrics, chain);
    
    return behaviorMetrics;
  }

  /**
   * Calculate Transaction Behavior Metrics (5 metrics)
   * @private
   */
  _calculateTransactionBehaviorMetrics() {
    const users = Array.from(this.userProfiles.values());
    
    if (users.length === 0) {
      return {
        transactionFrequencyScore: 0,
        transactionTimingPatterns: { peak_hours: [], consistency_score: 0 },
        transactionSizeConsistency: 0,
        gasPriceSensitivity: 0,
        functionDiversityScore: 0
      };
    }

    // 1. Transaction Frequency Score (0-100)
    const frequencies = users.map(user => user.txCount / user.activeDays);
    const avgFrequency = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
    const transactionFrequencyScore = Math.min(100, avgFrequency * 10);

    // 2. Transaction Timing Patterns
    const hourCounts = new Array(24).fill(0);
    users.forEach(user => {
      user.transactions.forEach(tx => {
        const hour = new Date(tx.timestamp).getHours();
        hourCounts[hour]++;
      });
    });
    
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);
    
    const consistencyScore = this._calculateTimingConsistency(hourCounts);

    // 3. Transaction Size Consistency (coefficient of variation)
    const sizeVariations = users.map(user => {
      if (user.transactions.length < 2) return 0;
      const values = user.transactions.map(tx => tx.valueEth);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      return mean > 0 ? Math.sqrt(variance) / mean : 0;
    });
    const transactionSizeConsistency = 100 - (sizeVariations.reduce((sum, v) => sum + v, 0) / sizeVariations.length * 100);

    // 4. Gas Price Sensitivity (variance in gas prices used)
    const gasPriceVariations = users.map(user => {
      if (user.transactions.length < 2) return 0;
      const gasPrices = user.transactions.map(tx => tx.gasCostEth);
      const mean = gasPrices.reduce((sum, g) => sum + g, 0) / gasPrices.length;
      const variance = gasPrices.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gasPrices.length;
      return mean > 0 ? Math.sqrt(variance) / mean : 0;
    });
    const gasPriceSensitivity = gasPriceVariations.reduce((sum, v) => sum + v, 0) / gasPriceVariations.length * 100;

    // 5. Function Diversity Score
    const functionDiversities = users.map(user => {
      const uniqueFunctions = new Set(user.transactions.map(tx => tx.functionName || 'transfer'));
      return uniqueFunctions.size;
    });
    const functionDiversityScore = functionDiversities.reduce((sum, d) => sum + d, 0) / functionDiversities.length;

    return {
      transactionFrequencyScore: Math.round(transactionFrequencyScore * 100) / 100,
      transactionTimingPatterns: {
        peak_hours: peakHours,
        consistency_score: Math.round(consistencyScore * 100) / 100
      },
      transactionSizeConsistency: Math.round(transactionSizeConsistency * 100) / 100,
      gasPriceSensitivity: Math.round(gasPriceSensitivity * 100) / 100,
      functionDiversityScore: Math.round(functionDiversityScore * 100) / 100
    };
  }

  /**
   * Calculate Risk & Value Behavior Metrics (5 metrics)
   * @private
   */
  _calculateRiskValueBehaviorMetrics() {
    const users = Array.from(this.userProfiles.values());
    
    if (users.length === 0) {
      return {
        riskToleranceLevel: 0,
        valueAccumulationPattern: 'stable',
        whaleBehaviorScore: 0,
        arbitrageActivityLevel: 0,
        liquidityProviderBehavior: 0
      };
    }

    // 1. Risk Tolerance Level (based on transaction size variance)
    const riskScores = users.map(user => {
      const maxTx = Math.max(...user.transactions.map(tx => tx.valueEth));
      const avgTx = user.transactions.reduce((sum, tx) => sum + tx.valueEth, 0) / user.transactions.length;
      return avgTx > 0 ? maxTx / avgTx : 1;
    });
    const riskToleranceLevel = riskScores.reduce((sum, r) => sum + r, 0) / riskScores.length;

    // 2. Value Accumulation Pattern
    const accumulationPatterns = users.map(user => {
      const values = user.transactions.map(tx => tx.valueEth);
      const trend = this._calculateTrend(values);
      if (trend > 0.1) return 'accumulating';
      if (trend < -0.1) return 'distributing';
      return 'stable';
    });
    
    const patternCounts = accumulationPatterns.reduce((counts, pattern) => {
      counts[pattern] = (counts[pattern] || 0) + 1;
      return counts;
    }, {});
    
    const dominantPattern = Object.keys(patternCounts).reduce((a, b) => 
      patternCounts[a] > patternCounts[b] ? a : b
    );

    // 3. Whale Behavior Score
    const whaleUsers = users.filter(user => 
      user.transactions.some(tx => {
        try {
          const valueStr = tx.valueEth.toString();
          const valueInEth = parseFloat(valueStr);
          
          // Skip extremely small values that would cause parseEther to fail
          if (valueInEth < 1e-15) {
            return false;
          }
          
          // Skip extremely large values that would overflow
          if (valueInEth > 1e18) {
            return true; // Assume it's a whale transaction
          }
          
          const decimalStr = valueInEth.toFixed(18);
          return ethers.parseEther(decimalStr) >= this.config.whaleThreshold;
        } catch (error) {
          console.warn(`Failed to parse value for whale detection: ${tx.valueEth}`, error);
          return false;
        }
      })
    );
    const whaleBehaviorScore = (whaleUsers.length / users.length) * 100;

    // 4. Arbitrage Activity Level (quick buy-sell patterns)
    const arbitrageScores = users.map(user => {
      let arbitrageCount = 0;
      for (let i = 0; i < user.transactions.length - 1; i++) {
        const tx1 = user.transactions[i];
        const tx2 = user.transactions[i + 1];
        const timeDiff = Math.abs(new Date(tx2.timestamp) - new Date(tx1.timestamp)) / 1000 / 60; // minutes
        
        if (timeDiff < 60 && tx1.valueEth > 0 && tx2.valueEth > 0) { // Within 1 hour
          arbitrageCount++;
        }
      }
      return user.transactions.length > 0 ? arbitrageCount / user.transactions.length : 0;
    });
    const arbitrageActivityLevel = arbitrageScores.reduce((sum, s) => sum + s, 0) / arbitrageScores.length * 100;

    // 5. Liquidity Provider Behavior (consistent bidirectional flows)
    const lpScores = users.map(user => {
      const inflows = user.transactions.filter(tx => tx.to_address === user.address).length;
      const outflows = user.transactions.filter(tx => tx.from_address === user.address).length;
      const total = inflows + outflows;
      
      if (total < 4) return 0; // Need minimum activity
      
      const balance = Math.abs(inflows - outflows) / total;
      return (1 - balance) * 100; // More balanced = higher LP score
    });
    const liquidityProviderBehavior = lpScores.reduce((sum, s) => sum + s, 0) / lpScores.length;

    return {
      riskToleranceLevel: Math.round(riskToleranceLevel * 100) / 100,
      valueAccumulationPattern: dominantPattern,
      whaleBehaviorScore: Math.round(whaleBehaviorScore * 100) / 100,
      arbitrageActivityLevel: Math.round(arbitrageActivityLevel * 100) / 100,
      liquidityProviderBehavior: Math.round(liquidityProviderBehavior * 100) / 100
    };
  }

  /**
   * Calculate Engagement & Loyalty Metrics (5 metrics)
   * @private
   */
  _calculateEngagementLoyaltyMetrics() {
    const users = Array.from(this.userProfiles.values());
    
    if (users.length === 0) {
      return {
        protocolLoyaltyScore: 0,
        earlyAdopterTendency: 0,
        socialTradingBehavior: 0,
        seasonalActivityPattern: 'stable',
        retryBehaviorScore: 0
      };
    }

    // 1. Protocol Loyalty Score (repeat usage over time)
    const loyaltyScores = users.map(user => {
      const daySpan = user.activeDays;
      const txFrequency = user.txCount / Math.max(daySpan, 1);
      return Math.min(100, txFrequency * 30); // Scale to 0-100
    });
    const protocolLoyaltyScore = loyaltyScores.reduce((sum, s) => sum + s, 0) / loyaltyScores.length;

    // 2. Early Adopter Tendency (activity in early blocks)
    const blockNumbers = users.flatMap(user => user.transactions.map(tx => tx.blockNumber));
    const minBlock = Math.min(...blockNumbers);
    const blockRange = Math.max(...blockNumbers) - minBlock;
    
    const earlyAdopters = users.filter(user => {
      const userMinBlock = Math.min(...user.transactions.map(tx => tx.blockNumber));
      const earlyThreshold = minBlock + (blockRange * 0.2); // First 20% of blocks
      return userMinBlock <= earlyThreshold;
    });
    const earlyAdopterTendency = (earlyAdopters.length / users.length) * 100;

    // 3. Social Trading Behavior (similar transaction patterns)
    const socialScores = users.map(user => {
      let similarityCount = 0;
      const userPattern = this._getUserPattern(user);
      
      users.forEach(otherUser => {
        if (user.address !== otherUser.address) {
          const otherPattern = this._getUserPattern(otherUser);
          const similarity = this._calculatePatternSimilarity(userPattern, otherPattern);
          if (similarity > 0.7) similarityCount++;
        }
      });
      
      return users.length > 1 ? similarityCount / (users.length - 1) : 0;
    });
    const socialTradingBehavior = socialScores.reduce((sum, s) => sum + s, 0) / socialScores.length * 100;

    // 4. Seasonal Activity Pattern
    const monthlyActivity = new Array(12).fill(0);
    users.forEach(user => {
      user.transactions.forEach(tx => {
        const month = new Date(tx.timestamp).getMonth();
        monthlyActivity[month]++;
      });
    });
    
    const seasonalPattern = this._identifySeasonalPattern(monthlyActivity);

    // 5. Retry Behavior Score (failed then successful transactions)
    const retryScores = users.map(user => {
      let retryCount = 0;
      for (let i = 0; i < user.transactions.length - 1; i++) {
        const tx1 = user.transactions[i];
        const tx2 = user.transactions[i + 1];
        
        if (!tx1.status && tx2.status) { // Failed then successful
          const timeDiff = Math.abs(new Date(tx2.timestamp) - new Date(tx1.timestamp)) / 1000 / 60;
          if (timeDiff < 120) { // Within 2 hours
            retryCount++;
          }
        }
      }
      return user.transactions.length > 0 ? retryCount / user.transactions.length : 0;
    });
    const retryBehaviorScore = retryScores.reduce((sum, s) => sum + s, 0) / retryScores.length * 100;

    return {
      protocolLoyaltyScore: Math.round(protocolLoyaltyScore * 100) / 100,
      earlyAdopterTendency: Math.round(earlyAdopterTendency * 100) / 100,
      socialTradingBehavior: Math.round(socialTradingBehavior * 100) / 100,
      seasonalActivityPattern: seasonalPattern,
      retryBehaviorScore: Math.round(retryBehaviorScore * 100) / 100
    };
  }

  /**
   * Calculate Advanced Behavioral Patterns (5 metrics)
   * @private
   */
  _calculateAdvancedBehaviorMetrics() {
    const users = Array.from(this.userProfiles.values());
    
    if (users.length === 0) {
      return {
        botLikeActivityScore: 0,
        crossChainBehavior: 0,
        defiStrategyComplexity: 0,
        marketTimingBehavior: 0,
        communityParticipationScore: 0
      };
    }

    // 1. Bot-like Activity Score
    const botScores = users.map(user => {
      let botIndicators = 0;
      
      // Regular timing intervals
      const intervals = [];
      for (let i = 1; i < user.transactions.length; i++) {
        const interval = new Date(user.transactions[i].timestamp) - new Date(user.transactions[i-1].timestamp);
        intervals.push(interval);
      }
      
      if (intervals.length > 2) {
        const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        const consistency = 1 - (Math.sqrt(variance) / avgInterval);
        
        if (consistency > 0.8) botIndicators += 30; // Very regular timing
      }
      
      // Identical transaction amounts
      const amounts = user.transactions.map(tx => tx.valueEth);
      const uniqueAmounts = new Set(amounts);
      if (uniqueAmounts.size < amounts.length * 0.3) botIndicators += 40; // Few unique amounts
      
      // High frequency
      if (user.txCount / user.activeDays > this.config.highFrequencyThreshold) {
        botIndicators += 30;
      }
      
      return Math.min(100, botIndicators);
    });
    const botLikeActivityScore = botScores.reduce((sum, s) => sum + s, 0) / botScores.length;

    // 2. Cross-Chain Behavior (simplified - would need multi-chain data)
    const crossChainBehavior = 0; // Placeholder - requires cross-chain transaction correlation

    // 3. DeFi Strategy Complexity
    const complexityScores = users.map(user => {
      const uniqueFunctions = new Set(user.transactions.map(tx => tx.functionName || 'transfer'));
      const uniqueContracts = new Set(user.transactions.map(tx => tx.to_address));
      const valueVariation = this._calculateValueVariation(user.transactions);
      
      return (uniqueFunctions.size * 10) + (uniqueContracts.size * 5) + (valueVariation * 20);
    });
    const defiStrategyComplexity = complexityScores.reduce((sum, s) => sum + s, 0) / complexityScores.length;

    // 4. Market Timing Behavior
    const timingScores = users.map(user => {
      // Analyze if user transactions cluster around certain time periods
      const timestamps = user.transactions.map(tx => new Date(tx.timestamp).getTime());
      const clusters = this._findTimeClusters(timestamps);
      return clusters.length > 1 ? clusters.length * 10 : 0;
    });
    const marketTimingBehavior = timingScores.reduce((sum, s) => sum + s, 0) / timingScores.length;

    // 5. Community Participation Score
    const participationScores = users.map(user => {
      const uniqueInteractions = new Set();
      user.transactions.forEach(tx => {
        if (tx.from_address !== user.address) uniqueInteractions.add(tx.from_address);
        if (tx.to_address !== user.address) uniqueInteractions.add(tx.to_address);
      });
      
      return Math.min(100, uniqueInteractions.size * 5);
    });
    const communityParticipationScore = participationScores.reduce((sum, s) => sum + s, 0) / participationScores.length;

    return {
      botLikeActivityScore: Math.round(botLikeActivityScore * 100) / 100,
      crossChainBehavior: Math.round(crossChainBehavior * 100) / 100,
      defiStrategyComplexity: Math.round(defiStrategyComplexity * 100) / 100,
      marketTimingBehavior: Math.round(marketTimingBehavior * 100) / 100,
      communityParticipationScore: Math.round(communityParticipationScore * 100) / 100
    };
  }

  /**
   * Classify users into behavioral categories
   * @private
   */
  _classifyUsers() {
    const users = Array.from(this.userProfiles.values());
    const classifications = {
      whale: 0,
      retail: 0,
      bot: 0,
      arbitrageur: 0,
      hodler: 0,
      trader: 0,
      liquidity_provider: 0,
      early_adopter: 0,
      casual: 0,
      power_user: 0
    };

    users.forEach(user => {
      const userClass = this._classifyUser(user);
      classifications[userClass]++;
    });

    // Convert to percentages
    const total = users.length;
    Object.keys(classifications).forEach(key => {
      classifications[key] = total > 0 ? Math.round((classifications[key] / total) * 10000) / 100 : 0;
    });

    return classifications;
  }

  // Helper methods
  _buildUserProfiles(transactions, chain) {
    transactions.forEach(tx => {
      const address = tx.from_address;
      if (!address) return;
      
      if (!this.userProfiles.has(address)) {
        this.userProfiles.set(address, {
          address,
          chain,
          transactions: [],
          txCount: 0,
          totalValue: 0,
          totalGasCost: 0,
          firstSeen: new Date(tx.block_timestamp || tx.timestamp),
          lastSeen: new Date(tx.block_timestamp || tx.timestamp),
          activeDays: 1
        });
      }
      
      const user = this.userProfiles.get(address);
      user.transactions.push({
        ...tx,
        timestamp: tx.block_timestamp || tx.timestamp,
        valueEth: parseFloat(tx.value_eth || 0),
        gasCostEth: parseFloat(tx.gas_cost_eth || 0),
        blockNumber: parseInt(tx.block_number || 0),
        status: tx.status === true || tx.status === 1
      });
      
      user.txCount++;
      user.totalValue += parseFloat(tx.value_eth || 0);
      user.totalGasCost += parseFloat(tx.gas_cost_eth || 0);
      
      const txDate = new Date(tx.block_timestamp || tx.timestamp);
      if (txDate > user.lastSeen) user.lastSeen = txDate;
      if (txDate < user.firstSeen) user.firstSeen = txDate;
      
      user.activeDays = Math.max(1, Math.ceil((user.lastSeen - user.firstSeen) / (1000 * 60 * 60 * 24)));
    });
  }

  _calculateTimingConsistency(hourCounts) {
    const total = hourCounts.reduce((sum, count) => sum + count, 0);
    if (total === 0) return 0;
    
    const expected = total / 24;
    const variance = hourCounts.reduce((sum, count) => sum + Math.pow(count - expected, 2), 0) / 24;
    return Math.max(0, 100 - (Math.sqrt(variance) / expected * 100));
  }

  _calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + (i * v), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  _getUserPattern(user) {
    return {
      avgValue: user.totalValue / user.txCount,
      frequency: user.txCount / user.activeDays,
      gasEfficiency: user.totalGasCost / user.txCount
    };
  }

  _calculatePatternSimilarity(pattern1, pattern2) {
    const valueSim = 1 - Math.abs(pattern1.avgValue - pattern2.avgValue) / Math.max(pattern1.avgValue, pattern2.avgValue, 1);
    const freqSim = 1 - Math.abs(pattern1.frequency - pattern2.frequency) / Math.max(pattern1.frequency, pattern2.frequency, 1);
    const gasSim = 1 - Math.abs(pattern1.gasEfficiency - pattern2.gasEfficiency) / Math.max(pattern1.gasEfficiency, pattern2.gasEfficiency, 1);
    
    return (valueSim + freqSim + gasSim) / 3;
  }

  _identifySeasonalPattern(monthlyActivity) {
    const max = Math.max(...monthlyActivity);
    const min = Math.min(...monthlyActivity);
    const variance = max - min;
    
    if (variance < max * 0.3) return 'stable';
    
    const maxMonth = monthlyActivity.indexOf(max);
    if (maxMonth >= 5 && maxMonth <= 7) return 'summer_peak';
    if (maxMonth >= 11 || maxMonth <= 1) return 'winter_peak';
    return 'variable';
  }

  _calculateValueVariation(transactions) {
    const values = transactions.map(tx => tx.valueEth);
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return mean > 0 ? Math.sqrt(variance) / mean : 0;
  }

  _findTimeClusters(timestamps) {
    if (timestamps.length < 2) return [];
    
    timestamps.sort((a, b) => a - b);
    const clusters = [];
    let currentCluster = [timestamps[0]];
    
    for (let i = 1; i < timestamps.length; i++) {
      const timeDiff = timestamps[i] - timestamps[i-1];
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) { // Same cluster if within 24 hours
        currentCluster.push(timestamps[i]);
      } else {
        if (currentCluster.length > 1) clusters.push(currentCluster);
        currentCluster = [timestamps[i]];
      }
    }
    
    if (currentCluster.length > 1) clusters.push(currentCluster);
    return clusters;
  }

  _classifyUser(user) {
    // Whale classification
    if (user.transactions.some(tx => {
      try {
        const valueStr = tx.valueEth.toString();
        const valueInEth = parseFloat(valueStr);
        
        // Skip extremely small values that would cause parseEther to fail
        if (valueInEth < 1e-15) {
          return false;
        }
        
        // Skip extremely large values that would overflow
        if (valueInEth > 1e18) {
          return true; // Assume it's a whale transaction
        }
        
        const decimalStr = valueInEth.toFixed(18);
        return ethers.parseEther(decimalStr) >= this.config.whaleThreshold;
      } catch (error) {
        console.warn(`Failed to parse value for whale classification: ${tx.valueEth}`, error);
        return false;
      }
    })) {
      return 'whale';
    }
    
    // Bot classification
    if (user.txCount / user.activeDays > this.config.highFrequencyThreshold) {
      return 'bot';
    }
    
    // Power user classification
    if (user.txCount > 50 && user.activeDays > 30) {
      return 'power_user';
    }
    
    // Early adopter (first 20% of users)
    const allFirstSeen = Array.from(this.userProfiles.values()).map(u => u.firstSeen.getTime());
    const earliestTime = Math.min(...allFirstSeen);
    const timeRange = Math.max(...allFirstSeen) - earliestTime;
    if (user.firstSeen.getTime() <= earliestTime + (timeRange * 0.2)) {
      return 'early_adopter';
    }
    
    // Trader (high frequency, varied amounts)
    const valueVariation = this._calculateValueVariation(user.transactions);
    if (user.txCount > 10 && valueVariation > 0.5) {
      return 'trader';
    }
    
    // HODLer (low frequency, consistent amounts)
    if (user.txCount < 5 && valueVariation < 0.2) {
      return 'hodler';
    }
    
    // Default to retail
    return 'retail';
  }

  _storeBehaviorSnapshot(metrics, chain) {
    this.behaviorHistory.push({
      timestamp: new Date().toISOString(),
      chain,
      metrics,
      userCount: this.userProfiles.size
    });
    
    // Limit history
    if (this.behaviorHistory.length > this.config.maxBehaviorHistory) {
      this.behaviorHistory.shift();
    }
  }

  /**
   * Get behavior summary for dashboard
   * @returns {Object} Behavior summary
   */
  getBehaviorSummary() {
    if (this.behaviorHistory.length === 0) {
      return { error: 'No behavior analysis completed yet' };
    }
    
    const latest = this.behaviorHistory[this.behaviorHistory.length - 1];
    
    return {
      totalUsers: this.userProfiles.size,
      transactionFrequency: latest.metrics.transactionBehavior.transactionFrequencyScore,
      riskTolerance: latest.metrics.riskValueBehavior.riskToleranceLevel,
      protocolLoyalty: latest.metrics.engagementLoyalty.protocolLoyaltyScore,
      botActivity: latest.metrics.advancedPatterns.botLikeActivityScore,
      userClassifications: latest.metrics.userClassifications,
      lastAnalyzed: latest.timestamp
    };
  }
}
