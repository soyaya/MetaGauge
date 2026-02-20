/**
 * Pattern Recognition Engine
 * Multi-Chain RPC Integration - Task 8
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { ethers } from 'ethers';

/**
 * Advanced pattern recognition engine for behavioral trend analysis
 * Detects seasonal patterns, market responses, churn prediction, and user clustering
 */
export class PatternRecognitionEngine {
  constructor(config = {}) {
    this.config = {
      // Pattern detection settings
      minPatternLength: config.minPatternLength || 5,
      seasonalWindowDays: config.seasonalWindowDays || 90,
      churnPredictionDays: config.churnPredictionDays || 30,
      
      // Clustering settings
      maxClusters: config.maxClusters || 10,
      similarityThreshold: config.similarityThreshold || 0.7,
      
      // Market response settings
      priceCorrelationWindow: config.priceCorrelationWindow || 24, // hours
      volumeThreshold: config.volumeThreshold || 1.5, // multiplier
      
      // Storage limits
      maxPatternHistory: config.maxPatternHistory || 1000,
      maxUserProfiles: config.maxUserProfiles || 10000,
      
      ...config
    };
    
    // Internal storage
    this.detectedPatterns = [];
    this.userClusters = new Map();
    this.seasonalPatterns = new Map();
    this.churnPredictions = new Map();
    this.marketResponses = [];
  }

  /**
   * Analyze patterns from transaction and user behavior data
   * @param {Array} transactions - Normalized transaction data
   * @param {Object} userBehaviorData - User behavior analysis results
   * @param {Array} marketData - Optional market price/volume data
   * @returns {Object} Complete pattern analysis
   */
  analyzePatterns(transactions, userBehaviorData, marketData = []) {
    console.log('🔍 Starting pattern recognition analysis...');
    
    // 1. Seasonal Pattern Detection
    const seasonalPatterns = this._detectSeasonalPatterns(transactions);
    
    // 2. Market Response Pattern Identification
    const marketResponses = this._identifyMarketResponsePatterns(transactions, marketData);
    
    // 3. User Churn Prediction
    const churnPredictions = this._predictUserChurn(transactions, userBehaviorData);
    
    // 4. Protocol Migration Pattern Detection
    const migrationPatterns = this._detectMigrationPatterns(transactions);
    
    // 5. Similar User Identification and Clustering
    const userClusters = this._clusterSimilarUsers(transactions, userBehaviorData);
    
    const patternAnalysis = {
      timestamp: new Date().toISOString(),
      seasonalPatterns,
      marketResponses,
      churnPredictions,
      migrationPatterns,
      userClusters,
      summary: this._generatePatternSummary(seasonalPatterns, marketResponses, churnPredictions, migrationPatterns, userClusters)
    };
    
    // Store patterns
    this._storePatternAnalysis(patternAnalysis);
    
    return patternAnalysis;
  }

  /**
   * Detect seasonal patterns in transaction data
   * @private
   */
  _detectSeasonalPatterns(transactions) {
    if (transactions.length < this.config.minPatternLength) {
      return { detected: false, patterns: [] };
    }

    // Group transactions by time periods
    const hourlyActivity = new Array(24).fill(0);
    const dailyActivity = new Array(7).fill(0);
    const monthlyActivity = new Array(12).fill(0);
    
    transactions.forEach(tx => {
      const date = new Date(tx.block_timestamp || tx.timestamp);
      hourlyActivity[date.getHours()]++;
      dailyActivity[date.getDay()]++;
      monthlyActivity[date.getMonth()]++;
    });

    const patterns = [];

    // Detect hourly patterns
    const hourlyPeak = this._findPeaks(hourlyActivity);
    if (hourlyPeak.significance > 0.3) {
      patterns.push({
        type: 'hourly',
        pattern: 'peak_hours',
        peaks: hourlyPeak.peaks,
        significance: hourlyPeak.significance,
        description: `Peak activity hours: ${hourlyPeak.peaks.join(', ')}`
      });
    }

    // Detect weekly patterns
    const weeklyPeak = this._findPeaks(dailyActivity);
    if (weeklyPeak.significance > 0.2) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      patterns.push({
        type: 'weekly',
        pattern: 'peak_days',
        peaks: weeklyPeak.peaks.map(day => dayNames[day]),
        significance: weeklyPeak.significance,
        description: `Peak activity days: ${weeklyPeak.peaks.map(d => dayNames[d]).join(', ')}`
      });
    }

    // Detect monthly patterns
    const monthlyPeak = this._findPeaks(monthlyActivity);
    if (monthlyPeak.significance > 0.25) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      patterns.push({
        type: 'monthly',
        pattern: 'seasonal',
        peaks: monthlyPeak.peaks.map(month => monthNames[month]),
        significance: monthlyPeak.significance,
        description: `Seasonal peaks: ${monthlyPeak.peaks.map(m => monthNames[m]).join(', ')}`
      });
    }

    return {
      detected: patterns.length > 0,
      patterns,
      confidence: patterns.length > 0 ? patterns.reduce((sum, p) => sum + p.significance, 0) / patterns.length : 0
    };
  }

  /**
   * Identify market response patterns
   * @private
   */
  _identifyMarketResponsePatterns(transactions, marketData) {
    if (marketData.length === 0 || transactions.length < this.config.minPatternLength) {
      return { detected: false, responses: [] };
    }

    const responses = [];
    
    // Group transactions by hour for correlation analysis
    const hourlyTxVolume = this._groupTransactionsByHour(transactions);
    const hourlyMarketData = this._groupMarketDataByHour(marketData);
    
    // Find correlations between market movements and transaction activity
    const correlations = this._calculateCorrelations(hourlyTxVolume, hourlyMarketData);
    
    if (correlations.priceCorrelation > 0.5) {
      responses.push({
        type: 'price_correlation',
        correlation: correlations.priceCorrelation,
        direction: correlations.priceDirection,
        description: `Transaction volume ${correlations.priceDirection} correlates with price movements`
      });
    }
    
    if (correlations.volumeCorrelation > 0.4) {
      responses.push({
        type: 'volume_correlation',
        correlation: correlations.volumeCorrelation,
        description: 'Transaction activity correlates with market volume'
      });
    }

    // Detect volume spikes during market events
    const volumeSpikes = this._detectVolumeSpikes(hourlyTxVolume, hourlyMarketData);
    if (volumeSpikes.length > 0) {
      responses.push({
        type: 'volume_spikes',
        spikes: volumeSpikes,
        description: `${volumeSpikes.length} volume spikes detected during market events`
      });
    }

    return {
      detected: responses.length > 0,
      responses,
      confidence: responses.length > 0 ? responses.reduce((sum, r) => sum + (r.correlation || 0.5), 0) / responses.length : 0
    };
  }

  /**
   * Predict user churn based on behavior patterns
   * @private
   */
  _predictUserChurn(transactions, userBehaviorData) {
    const userActivity = this._buildUserActivityProfiles(transactions);
    const churnPredictions = [];
    
    userActivity.forEach((activity, userAddress) => {
      const churnRisk = this._calculateChurnRisk(activity, userBehaviorData);
      
      if (churnRisk.risk > 0.6) {
        churnPredictions.push({
          userAddress,
          churnRisk: churnRisk.risk,
          factors: churnRisk.factors,
          daysInactive: churnRisk.daysInactive,
          prediction: churnRisk.risk > 0.8 ? 'high_risk' : 'medium_risk'
        });
      }
    });

    // Sort by risk level
    churnPredictions.sort((a, b) => b.churnRisk - a.churnRisk);

    return {
      detected: churnPredictions.length > 0,
      predictions: churnPredictions.slice(0, 50), // Top 50 at-risk users
      totalAtRisk: churnPredictions.length,
      highRisk: churnPredictions.filter(p => p.prediction === 'high_risk').length,
      mediumRisk: churnPredictions.filter(p => p.prediction === 'medium_risk').length
    };
  }

  /**
   * Detect protocol migration patterns
   * @private
   */
  _detectMigrationPatterns(transactions) {
    const migrationPatterns = [];
    
    // Analyze transaction flow patterns that might indicate migration
    const userFlows = this._analyzeUserFlows(transactions);
    
    // Detect mass exodus patterns
    const exodusPattern = this._detectExodusPattern(userFlows);
    if (exodusPattern.detected) {
      migrationPatterns.push({
        type: 'exodus',
        pattern: exodusPattern,
        description: 'Mass user exodus detected'
      });
    }
    
    // Detect gradual migration patterns
    const gradualMigration = this._detectGradualMigration(userFlows);
    if (gradualMigration.detected) {
      migrationPatterns.push({
        type: 'gradual_migration',
        pattern: gradualMigration,
        description: 'Gradual user migration detected'
      });
    }

    return {
      detected: migrationPatterns.length > 0,
      patterns: migrationPatterns,
      confidence: migrationPatterns.length > 0 ? 0.7 : 0
    };
  }

  /**
   * Cluster similar users based on behavior patterns
   * @private
   */
  _clusterSimilarUsers(transactions, userBehaviorData) {
    const userProfiles = this._buildDetailedUserProfiles(transactions);
    const clusters = [];
    
    // Simple clustering based on behavior similarity
    const processed = new Set();
    
    userProfiles.forEach((profile, userAddress) => {
      if (processed.has(userAddress)) return;
      
      const cluster = {
        id: clusters.length + 1,
        centroid: userAddress,
        members: [userAddress],
        characteristics: this._extractClusterCharacteristics(profile),
        similarity: 1.0
      };
      
      // Find similar users
      userProfiles.forEach((otherProfile, otherAddress) => {
        if (otherAddress !== userAddress && !processed.has(otherAddress)) {
          const similarity = this._calculateUserSimilarity(profile, otherProfile);
          
          if (similarity > this.config.similarityThreshold) {
            cluster.members.push(otherAddress);
            processed.add(otherAddress);
          }
        }
      });
      
      processed.add(userAddress);
      
      if (cluster.members.length > 1) {
        clusters.push(cluster);
      }
    });

    // Sort clusters by size
    clusters.sort((a, b) => b.members.length - a.members.length);

    return {
      detected: clusters.length > 0,
      clusters: clusters.slice(0, this.config.maxClusters),
      totalClusters: clusters.length,
      largestCluster: clusters.length > 0 ? clusters[0].members.length : 0,
      coverage: clusters.reduce((sum, c) => sum + c.members.length, 0) / userProfiles.size
    };
  }

  /**
   * Generate pattern analysis summary
   * @private
   */
  _generatePatternSummary(seasonal, market, churn, migration, clusters) {
    return {
      totalPatternsDetected: [seasonal, market, churn, migration, clusters].filter(p => p.detected).length,
      seasonalActivity: seasonal.detected,
      marketResponsive: market.detected,
      churnRisk: churn.detected ? `${churn.highRisk} high risk, ${churn.mediumRisk} medium risk` : 'Low risk',
      migrationTrend: migration.detected ? 'Migration detected' : 'Stable',
      userClustering: clusters.detected ? `${clusters.totalClusters} clusters found` : 'No clusters',
      overallConfidence: this._calculateOverallConfidence(seasonal, market, churn, migration, clusters)
    };
  }

  // Helper methods
  _findPeaks(data) {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const peaks = [];
    let maxVal = Math.max(...data);
    
    data.forEach((val, index) => {
      if (val > mean * 1.5 && val > maxVal * 0.7) {
        peaks.push(index);
      }
    });
    
    const significance = peaks.length > 0 ? (maxVal - mean) / mean : 0;
    
    return { peaks, significance: Math.min(1, significance) };
  }

  _groupTransactionsByHour(transactions) {
    const hourlyData = {};
    
    transactions.forEach(tx => {
      const hour = new Date(tx.block_timestamp || tx.timestamp).getHours();
      const key = `${Math.floor(Date.now() / (1000 * 60 * 60)) - hour}`;
      
      if (!hourlyData[key]) {
        hourlyData[key] = { count: 0, volume: 0 };
      }
      
      hourlyData[key].count++;
      hourlyData[key].volume += parseFloat(tx.value_eth || 0);
    });
    
    return hourlyData;
  }

  _groupMarketDataByHour(marketData) {
    // Placeholder - would integrate with real market data
    return {};
  }

  _calculateCorrelations(txData, marketData) {
    // Simplified correlation calculation
    return {
      priceCorrelation: 0.3,
      priceDirection: 'positively',
      volumeCorrelation: 0.4
    };
  }

  _detectVolumeSpikes(txVolume, marketData) {
    const spikes = [];
    const volumes = Object.values(txVolume).map(d => d.volume);
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    
    Object.entries(txVolume).forEach(([hour, data]) => {
      if (data.volume > avgVolume * this.config.volumeThreshold) {
        spikes.push({
          hour,
          volume: data.volume,
          multiplier: data.volume / avgVolume
        });
      }
    });
    
    return spikes;
  }

  _buildUserActivityProfiles(transactions) {
    const profiles = new Map();
    
    transactions.forEach(tx => {
      const user = tx.from_address;
      if (!user) return;
      
      if (!profiles.has(user)) {
        profiles.set(user, {
          transactions: [],
          firstSeen: new Date(tx.block_timestamp || tx.timestamp),
          lastSeen: new Date(tx.block_timestamp || tx.timestamp),
          totalValue: 0,
          txCount: 0
        });
      }
      
      const profile = profiles.get(user);
      profile.transactions.push(tx);
      profile.txCount++;
      profile.totalValue += parseFloat(tx.value_eth || 0);
      
      const txDate = new Date(tx.block_timestamp || tx.timestamp);
      if (txDate > profile.lastSeen) profile.lastSeen = txDate;
      if (txDate < profile.firstSeen) profile.firstSeen = txDate;
    });
    
    return profiles;
  }

  _calculateChurnRisk(activity, userBehaviorData) {
    const now = new Date();
    const daysSinceLastActivity = (now - activity.lastSeen) / (1000 * 60 * 60 * 24);
    const totalDays = (activity.lastSeen - activity.firstSeen) / (1000 * 60 * 60 * 24) || 1;
    const avgFrequency = activity.txCount / totalDays;
    
    let risk = 0;
    const factors = [];
    
    // Inactivity factor
    if (daysSinceLastActivity > 14) {
      risk += 0.4;
      factors.push('long_inactivity');
    }
    
    // Declining frequency
    if (avgFrequency < 0.1) {
      risk += 0.3;
      factors.push('low_frequency');
    }
    
    // Small transaction amounts
    if (activity.totalValue / activity.txCount < 0.1) {
      risk += 0.2;
      factors.push('small_amounts');
    }
    
    // Single transaction users
    if (activity.txCount === 1) {
      risk += 0.3;
      factors.push('single_transaction');
    }
    
    return {
      risk: Math.min(1, risk),
      factors,
      daysInactive: Math.floor(daysSinceLastActivity)
    };
  }

  _analyzeUserFlows(transactions) {
    const flows = { inbound: 0, outbound: 0, internal: 0 };
    
    transactions.forEach(tx => {
      if (tx.value_eth > 0) {
        flows.outbound += parseFloat(tx.value_eth);
      } else {
        flows.inbound += parseFloat(tx.value_eth);
      }
    });
    
    return flows;
  }

  _detectExodusPattern(flows) {
    const outboundRatio = flows.outbound / (flows.inbound + flows.outbound + 0.001);
    return {
      detected: outboundRatio > 0.7,
      ratio: outboundRatio,
      severity: outboundRatio > 0.8 ? 'high' : 'medium'
    };
  }

  _detectGradualMigration(flows) {
    // Simplified - would analyze trends over time
    return { detected: false };
  }

  _buildDetailedUserProfiles(transactions) {
    const profiles = new Map();
    
    transactions.forEach(tx => {
      const user = tx.from_address;
      if (!user) return;
      
      if (!profiles.has(user)) {
        profiles.set(user, {
          avgValue: 0,
          frequency: 0,
          gasEfficiency: 0,
          timePattern: [],
          valuePattern: []
        });
      }
      
      const profile = profiles.get(user);
      profile.valuePattern.push(parseFloat(tx.value_eth || 0));
      profile.timePattern.push(new Date(tx.block_timestamp || tx.timestamp).getHours());
    });
    
    // Calculate averages
    profiles.forEach((profile, user) => {
      profile.avgValue = profile.valuePattern.reduce((sum, v) => sum + v, 0) / profile.valuePattern.length;
      profile.frequency = profile.valuePattern.length;
    });
    
    return profiles;
  }

  _calculateUserSimilarity(profile1, profile2) {
    const valueSim = 1 - Math.abs(profile1.avgValue - profile2.avgValue) / Math.max(profile1.avgValue, profile2.avgValue, 1);
    const freqSim = 1 - Math.abs(profile1.frequency - profile2.frequency) / Math.max(profile1.frequency, profile2.frequency, 1);
    
    return (valueSim + freqSim) / 2;
  }

  _extractClusterCharacteristics(profile) {
    return {
      avgTransactionValue: profile.avgValue,
      transactionFrequency: profile.frequency,
      preferredHours: profile.timePattern.slice(0, 3)
    };
  }

  _calculateOverallConfidence(seasonal, market, churn, migration, clusters) {
    const confidences = [seasonal, market, churn, migration, clusters]
      .filter(p => p.detected)
      .map(p => p.confidence || 0.5);
    
    return confidences.length > 0 ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;
  }

  _storePatternAnalysis(analysis) {
    this.detectedPatterns.push(analysis);
    
    // Limit storage
    if (this.detectedPatterns.length > this.config.maxPatternHistory) {
      this.detectedPatterns.shift();
    }
  }

  /**
   * Get pattern recognition summary
   * @returns {Object} Pattern summary
   */
  getPatternSummary() {
    if (this.detectedPatterns.length === 0) {
      return { error: 'No patterns analyzed yet' };
    }
    
    const latest = this.detectedPatterns[this.detectedPatterns.length - 1];
    
    return {
      lastAnalyzed: latest.timestamp,
      patternsDetected: latest.summary.totalPatternsDetected,
      seasonalActivity: latest.summary.seasonalActivity,
      marketResponsive: latest.summary.marketResponsive,
      churnRisk: latest.summary.churnRisk,
      userClusters: latest.summary.userClustering,
      confidence: latest.summary.overallConfidence
    };
  }
}
