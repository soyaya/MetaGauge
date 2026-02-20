/**
 * User Lifecycle Analyzer
 * 
 * Tracks wallet activation, lifecycle stages, and cohort analysis.
 * Classifies wallet types and measures user progression through contract functions.
 */
export class UserLifecycleAnalyzer {
  constructor() {
    this.lifecycleStages = {
      NEW: 'new',           // First transaction within 24 hours
      ACTIVE: 'active',     // Regular transactions (last 7 days)
      INACTIVE: 'inactive', // No transactions 7-30 days
      DORMANT: 'dormant',   // No transactions 30-90 days
      CHURNED: 'churned'    // No transactions >90 days
    };
    
    this.walletTypes = {
      WHALE: 'whale',           // High value transactions
      RETAIL: 'retail',         // Regular user transactions
      BOT: 'bot',              // Automated/high frequency
      ARBITRAGEUR: 'arbitrageur', // Cross-function patterns
      EXPERIMENTER: 'experimenter' // Single/few transactions
    };
  }

  /**
   * Analyze user lifecycle and cohort patterns
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Lifecycle analysis results
   */
  analyzeUserLifecycle(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyLifecycleAnalysis();
    }

    const walletData = this._processWalletData(transactions);
    const lifecycleDistribution = this._calculateLifecycleDistribution(walletData);
    const walletClassification = this._classifyWallets(walletData);
    const cohortAnalysis = this._performCohortAnalysis(walletData);
    const activationMetrics = this._calculateActivationMetrics(walletData);
    const progressionAnalysis = this._analyzeUserProgression(walletData);

    return {
      totalWallets: walletData.size,
      lifecycleDistribution,
      walletClassification,
      cohortAnalysis,
      activationMetrics,
      progressionAnalysis,
      summary: {
        activeUsers: lifecycleDistribution.active || 0,
        newUsers: lifecycleDistribution.new || 0,
        churnedUsers: lifecycleDistribution.churned || 0,
        retentionRate: this._calculateRetentionRate(lifecycleDistribution),
        averageLifespan: this._calculateAverageLifespan(walletData)
      }
    };
  }

  /**
   * Track wallet activation and first transaction timing
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Activation analysis
   */
  analyzeWalletActivation(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        totalActivations: 0,
        activationsByPeriod: {},
        timeToFirstSuccess: 0,
        activationFunnels: []
      };
    }

    const walletActivations = new Map();
    const activationsByPeriod = {};

    // Process each wallet's first transaction
    for (const tx of transactions) {
      // Skip transactions without wallet address
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (!wallet) {
        console.warn('Transaction missing wallet/from_address in activation analysis:', tx);
        continue;
      }
      
      // Normalize timestamp
      const timestamp = this._normalizeTimestamp(tx);
      if (!timestamp || isNaN(timestamp.getTime())) {
        console.warn('Transaction missing or invalid timestamp in activation analysis:', tx);
        continue;
      }
      
      const walletLower = wallet.toLowerCase();
      
      if (!walletActivations.has(walletLower)) {
        const period = this._getPeriodKey(timestamp);
        
        walletActivations.set(walletLower, {
          firstTransaction: tx,
          activationDate: timestamp,
          firstFunction: tx.functionName || this._extractFunctionName(tx),
          firstSuccess: tx.success || tx.status,
          timeToSuccess: null
        });

        // Count activations by period
        activationsByPeriod[period] = (activationsByPeriod[period] || 0) + 1;
      } else {
        // Update time to first success
        const activation = walletActivations.get(walletLower);
        if ((tx.success || tx.status) && !activation.timeToSuccess) {
          activation.timeToSuccess = timestamp.getTime() - activation.activationDate.getTime();
        }
      }
    }

    // Calculate activation metrics
    const activations = Array.from(walletActivations.values());
    const successfulActivations = activations.filter(a => a.firstSuccess);
    const averageTimeToSuccess = this._calculateAverageTimeToSuccess(activations);

    // Analyze activation funnels by entry function
    const activationFunnels = this._analyzeActivationFunnels(activations);

    return {
      totalActivations: activations.length,
      successfulActivations: successfulActivations.length,
      activationRate: activations.length > 0 ? successfulActivations.length / activations.length : 0,
      activationsByPeriod,
      averageTimeToSuccess,
      activationFunnels
    };
  }

  /**
   * Classify wallet types based on behavior patterns
   * @param {Map} walletData - Processed wallet data
   * @returns {Object} Wallet classification results
   */
  _classifyWallets(walletData) {
    const classification = {
      [this.walletTypes.WHALE]: [],
      [this.walletTypes.RETAIL]: [],
      [this.walletTypes.BOT]: [],
      [this.walletTypes.ARBITRAGEUR]: [],
      [this.walletTypes.EXPERIMENTER]: []
    };

    for (const [wallet, data] of walletData) {
      const type = this._determineWalletType(data);
      classification[type].push({
        wallet,
        ...data,
        type
      });
    }

    // Convert to summary format
    const summary = {};
    for (const [type, wallets] of Object.entries(classification)) {
      summary[type] = {
        count: wallets.length,
        percentage: (wallets.length / walletData.size) * 100,
        totalVolume: wallets.reduce((sum, w) => sum + w.totalVolume, 0),
        averageTransactions: wallets.length > 0 
          ? wallets.reduce((sum, w) => sum + w.transactionCount, 0) / wallets.length 
          : 0
      };
    }

    return {
      distribution: summary,
      details: classification
    };
  }

  /**
   * Perform cohort analysis based on activation periods
   * @param {Map} walletData - Processed wallet data
   * @returns {Object} Cohort analysis results
   */
  _performCohortAnalysis(walletData) {
    const cohorts = new Map();

    // Group wallets by activation month
    for (const [wallet, data] of walletData) {
      const cohortKey = this._getCohortKey(data.firstSeen);
      
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          cohortPeriod: cohortKey,
          totalUsers: 0,
          retainedUsers: new Map(), // period -> count
          totalVolume: 0,
          averageLifespan: 0
        });
      }

      const cohort = cohorts.get(cohortKey);
      cohort.totalUsers++;
      cohort.totalVolume += data.totalVolume;

      // Calculate retention for different periods
      const daysSinceActivation = this._getDaysSince(data.firstSeen);
      const retentionPeriods = [1, 7, 30, 90]; // 1 day, 1 week, 1 month, 3 months

      for (const period of retentionPeriods) {
        if (daysSinceActivation >= period && data.daysSinceLastActivity <= 7) {
          const currentCount = cohort.retainedUsers.get(period) || 0;
          cohort.retainedUsers.set(period, currentCount + 1);
        }
      }
    }

    // Calculate retention rates
    const cohortAnalysis = [];
    for (const [cohortKey, cohort] of cohorts) {
      const retentionRates = {};
      
      for (const [period, retainedCount] of cohort.retainedUsers) {
        retentionRates[`day${period}`] = cohort.totalUsers > 0 
          ? (retainedCount / cohort.totalUsers) * 100 
          : 0;
      }

      cohortAnalysis.push({
        cohortPeriod: cohortKey,
        totalUsers: cohort.totalUsers,
        retentionRates,
        totalVolume: cohort.totalVolume,
        averageVolumePerUser: cohort.totalUsers > 0 ? cohort.totalVolume / cohort.totalUsers : 0
      });
    }

    return cohortAnalysis.sort((a, b) => a.cohortPeriod.localeCompare(b.cohortPeriod));
  }

  /**
   * Analyze user progression through contract functions
   * @param {Map} walletData - Processed wallet data
   * @returns {Object} Progression analysis
   */
  _analyzeUserProgression(walletData) {
    const functionProgression = new Map();
    const progressionPaths = new Map();

    for (const [wallet, data] of walletData) {
      const functions = data.functionsUsed;
      
      // Track function adoption order
      for (let i = 0; i < functions.length; i++) {
        const func = functions[i];
        
        if (!functionProgression.has(func)) {
          functionProgression.set(func, {
            functionName: func,
            adoptionOrder: [],
            totalAdoptions: 0
          });
        }

        const progression = functionProgression.get(func);
        progression.adoptionOrder.push(i + 1); // 1-indexed
        progression.totalAdoptions++;
      }

      // Track progression paths
      if (functions.length >= 2) {
        for (let i = 0; i < functions.length - 1; i++) {
          const pathKey = `${functions[i]} → ${functions[i + 1]}`;
          progressionPaths.set(pathKey, (progressionPaths.get(pathKey) || 0) + 1);
        }
      }
    }

    // Calculate progression statistics
    const progressionStats = [];
    for (const [func, data] of functionProgression) {
      const avgOrder = data.adoptionOrder.reduce((sum, order) => sum + order, 0) / data.adoptionOrder.length;
      
      progressionStats.push({
        functionName: func,
        totalAdoptions: data.totalAdoptions,
        averageAdoptionOrder: avgOrder,
        isEntryPoint: data.adoptionOrder.filter(order => order === 1).length,
        adoptionRate: (data.totalAdoptions / walletData.size) * 100
      });
    }

    // Convert progression paths to array
    const topProgressionPaths = Array.from(progressionPaths.entries())
      .map(([path, count]) => ({
        path,
        userCount: count,
        percentage: (count / walletData.size) * 100
      }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 10);

    return {
      functionProgression: progressionStats.sort((a, b) => a.averageAdoptionOrder - b.averageAdoptionOrder),
      topProgressionPaths,
      progressionDepth: {
        singleFunction: Array.from(walletData.values()).filter(w => w.functionsUsed.length === 1).length,
        multiFunction: Array.from(walletData.values()).filter(w => w.functionsUsed.length > 1).length,
        powerUsers: Array.from(walletData.values()).filter(w => w.functionsUsed.length >= 5).length
      }
    };
  }

  /**
   * Process wallet data from transactions
   * @private
   */
  _processWalletData(transactions) {
    const walletData = new Map();
    const now = new Date();

    for (const tx of transactions) {
      // Skip transactions without wallet address
      // Use from_address as the wallet identifier for normalized transactions
      const wallet = tx.from_address || tx.wallet;
      
      if (!wallet) {
        console.warn('Transaction missing wallet/from_address in wallet data processing:', tx);
        continue;
      }
      
      // Normalize timestamp
      const timestamp = this._normalizeTimestamp(tx);
      if (!timestamp || isNaN(timestamp.getTime())) {
        console.warn('Transaction missing or invalid timestamp:', tx);
        continue;
      }
      
      const walletLower = wallet.toLowerCase();
      
      if (!walletData.has(walletLower)) {
        walletData.set(walletLower, {
          wallet: walletLower,
          firstSeen: timestamp,
          lastSeen: timestamp,
          transactionCount: 0,
          successfulTransactions: 0,
          totalVolume: 0,
          totalGasSpent: 0,
          functionsUsed: [],
          uniqueFunctions: new Set(),
          daysSinceFirstSeen: 0,
          daysSinceLastActivity: 0,
          lifecycleStage: null
        });
      }

      const data = walletData.get(walletLower);
      
      // Update basic metrics
      data.transactionCount++;
      if (tx.success || tx.status) data.successfulTransactions++;
      data.totalVolume += parseFloat(tx.value_eth || tx.value || 0);
      data.totalGasSpent += parseFloat(tx.gas_cost_eth || tx.gasUsed || 0) * parseFloat(tx.gas_price_wei || tx.gasPrice || 0);
      
      // Update timestamps
      if (timestamp < data.firstSeen) data.firstSeen = timestamp;
      if (timestamp > data.lastSeen) data.lastSeen = timestamp;
      
      // Track function usage
      const functionName = tx.functionName || this._extractFunctionName(tx);
      if (!data.uniqueFunctions.has(functionName)) {
        data.functionsUsed.push(functionName);
        data.uniqueFunctions.add(functionName);
      }
    }

    // Calculate derived metrics and lifecycle stage
    for (const [wallet, data] of walletData) {
      data.daysSinceFirstSeen = this._getDaysSince(data.firstSeen);
      data.daysSinceLastActivity = this._getDaysSince(data.lastSeen);
      data.lifecycleStage = this._determineLifecycleStage(data.daysSinceLastActivity, data.daysSinceFirstSeen);
      
      // Convert Set to Array for serialization
      data.functionsUsed = Array.from(data.uniqueFunctions);
      delete data.uniqueFunctions;
    }

    return walletData;
  }

  /**
   * Determine wallet type based on behavior patterns
   * @private
   */
  _determineWalletType(walletData) {
    const { transactionCount, totalVolume, daysSinceFirstSeen, functionsUsed } = walletData;
    
    // Whale: High volume transactions
    if (totalVolume > 100000) { // $100k+ volume
      return this.walletTypes.WHALE;
    }
    
    // Bot: High frequency, short timespan
    if (transactionCount > 100 && daysSinceFirstSeen < 7) {
      return this.walletTypes.BOT;
    }
    
    // Arbitrageur: Multiple functions, moderate volume
    if (functionsUsed.length >= 3 && totalVolume > 1000) {
      return this.walletTypes.ARBITRAGEUR;
    }
    
    // Experimenter: Few transactions
    if (transactionCount <= 3) {
      return this.walletTypes.EXPERIMENTER;
    }
    
    // Default to retail
    return this.walletTypes.RETAIL;
  }

  /**
   * Determine lifecycle stage based on activity
   * @private
   */
  _determineLifecycleStage(daysSinceLastActivity, daysSinceFirstSeen) {
    if (daysSinceFirstSeen <= 1) {
      return this.lifecycleStages.NEW;
    } else if (daysSinceLastActivity <= 7) {
      return this.lifecycleStages.ACTIVE;
    } else if (daysSinceLastActivity <= 30) {
      return this.lifecycleStages.INACTIVE;
    } else if (daysSinceLastActivity <= 90) {
      return this.lifecycleStages.DORMANT;
    } else {
      return this.lifecycleStages.CHURNED;
    }
  }

  /**
   * Calculate lifecycle distribution
   * @private
   */
  _calculateLifecycleDistribution(walletData) {
    const distribution = {};
    
    for (const stage of Object.values(this.lifecycleStages)) {
      distribution[stage] = 0;
    }
    
    for (const [wallet, data] of walletData) {
      distribution[data.lifecycleStage]++;
    }
    
    return distribution;
  }

  /**
   * Calculate activation metrics
   * @private
   */
  _calculateActivationMetrics(walletData) {
    const activationTimes = [];
    let successfulActivations = 0;

    for (const [wallet, data] of walletData) {
      if (data.successfulTransactions > 0) {
        successfulActivations++;
      }
      
      // Time to activation (first successful transaction)
      if (data.transactionCount > 0) {
        activationTimes.push(data.daysSinceFirstSeen);
      }
    }

    const avgActivationTime = activationTimes.length > 0 
      ? activationTimes.reduce((sum, time) => sum + time, 0) / activationTimes.length 
      : 0;

    return {
      totalWallets: walletData.size,
      activatedWallets: successfulActivations,
      activationRate: walletData.size > 0 ? (successfulActivations / walletData.size) * 100 : 0,
      averageActivationTime: avgActivationTime,
      activationTimeDistribution: this._calculateTimeDistribution(activationTimes)
    };
  }

  /**
   * Helper methods
   * @private
   */
  _getDaysSince(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  _getPeriodKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  _getCohortKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  _calculateRetentionRate(distribution) {
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const retained = (distribution.active || 0) + (distribution.inactive || 0);
    return total > 0 ? (retained / total) * 100 : 0;
  }

  _calculateAverageLifespan(walletData) {
    const lifespans = [];
    
    for (const [wallet, data] of walletData) {
      const lifespan = Math.abs(data.lastSeen - data.firstSeen) / (1000 * 60 * 60 * 24);
      lifespans.push(lifespan);
    }
    
    return lifespans.length > 0 
      ? lifespans.reduce((sum, span) => sum + span, 0) / lifespans.length 
      : 0;
  }

  _calculateAverageTimeToSuccess(activations) {
    const successTimes = activations
      .filter(a => a.timeToSuccess !== null)
      .map(a => a.timeToSuccess / (1000 * 60)); // Convert to minutes

    return successTimes.length > 0 
      ? successTimes.reduce((sum, time) => sum + time, 0) / successTimes.length 
      : 0;
  }

  _analyzeActivationFunnels(activations) {
    const funnels = new Map();

    for (const activation of activations) {
      const func = activation.firstFunction;
      
      if (!funnels.has(func)) {
        funnels.set(func, {
          functionName: func,
          totalAttempts: 0,
          successfulActivations: 0,
          conversionRate: 0
        });
      }

      const funnel = funnels.get(func);
      funnel.totalAttempts++;
      
      if (activation.firstSuccess) {
        funnel.successfulActivations++;
      }
    }

    // Calculate conversion rates
    const funnelArray = Array.from(funnels.values()).map(funnel => ({
      ...funnel,
      conversionRate: funnel.totalAttempts > 0 
        ? (funnel.successfulActivations / funnel.totalAttempts) * 100 
        : 0
    }));

    return funnelArray.sort((a, b) => b.totalAttempts - a.totalAttempts);
  }

  _calculateTimeDistribution(times) {
    const distribution = {
      immediate: 0,    // 0 days
      sameDay: 0,      // 1 day
      sameWeek: 0,     // 2-7 days
      sameMonth: 0,    // 8-30 days
      longTerm: 0      // 30+ days
    };

    for (const time of times) {
      if (time === 0) {
        distribution.immediate++;
      } else if (time === 1) {
        distribution.sameDay++;
      } else if (time <= 7) {
        distribution.sameWeek++;
      } else if (time <= 30) {
        distribution.sameMonth++;
      } else {
        distribution.longTerm++;
      }
    }

    return distribution;
  }

  _getEmptyLifecycleAnalysis() {
    return {
      totalWallets: 0,
      lifecycleDistribution: {},
      walletClassification: { distribution: {}, details: {} },
      cohortAnalysis: [],
      activationMetrics: {
        totalWallets: 0,
        activatedWallets: 0,
        activationRate: 0,
        averageActivationTime: 0,
        activationTimeDistribution: {}
      },
      progressionAnalysis: {
        functionProgression: [],
        topProgressionPaths: [],
        progressionDepth: { singleFunction: 0, multiFunction: 0, powerUsers: 0 }
      },
      summary: {
        activeUsers: 0,
        newUsers: 0,
        churnedUsers: 0,
        retentionRate: 0,
        averageLifespan: 0
      }
    };
  }

  /**
   * Normalize timestamp to Date object
   * @private
   */
  _normalizeTimestamp(tx) {
    // Try different timestamp fields
    const timestamp = tx.timestamp || tx.block_timestamp || tx.blockTimestamp;
    
    if (!timestamp) return null;
    
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    
    if (typeof timestamp === 'number') {
      // Handle both seconds and milliseconds
      const date = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  }

  /**
   * Extract function name from transaction
   * @private
   */
  _extractFunctionName(tx) {
    if (tx.functionName) return tx.functionName;
    if (tx.function_name) return tx.function_name;
    if (tx.method_id) return tx.method_id;
    if (tx.methodId) return tx.methodId;
    return 'unknown';
  }
}

export default UserLifecycleAnalyzer;