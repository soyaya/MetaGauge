/**
 * User Lifecycle and Engagement Scorer
 * 
 * Classifies users by lifecycle stage and calculates engagement scores:
 * - Lifecycle stages: new, active, established, veteran, dormant
 * - Engagement scores (0-100) based on frequency, diversity, and value
 * - Engagement change detection
 * - Churn probability prediction
 * - At-risk high-value user prioritization
 */
export class UserLifecycleScorer {
  constructor() {
    // Lifecycle stage thresholds (in days)
    this.lifecycleThresholds = {
      new: 7,
      active: 30,
      established: 90,
      veteran: 90, // 90+ days
      dormant: 30 // No activity for 30+ days
    };
    
    // Engagement scoring weights
    this.engagementWeights = {
      frequency: 0.4,
      diversity: 0.3,
      value: 0.3
    };
    
    this.engagementDropThreshold = 30; // 30 point drop
    this.engagementDropWindow = 14; // 14 days
  }

  /**
   * Analyze user lifecycle and engagement
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {Date} currentDate - Current date for calculations
   * @returns {Object} Lifecycle and engagement analysis
   */
  analyzeUserLifecycle(transactions, currentDate = new Date()) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    const walletData = this._groupByWallet(transactions);
    const userProfiles = [];

    for (const [wallet, txs] of walletData) {
      const profile = this._analyzeUser(wallet, txs, currentDate);
      userProfiles.push(profile);
    }

    // Categorize users
    const byLifecycleStage = this._categorizeByLifecycle(userProfiles);
    const atRiskUsers = userProfiles.filter(u => u.atRisk);
    const highValueAtRisk = atRiskUsers
      .filter(u => u.totalValue > this._calculateMedian(userProfiles.map(u => u.totalValue)))
      .sort((a, b) => b.churnProbability - a.churnProbability);

    return {
      userProfiles,
      byLifecycleStage,
      atRiskUsers,
      highValueAtRisk,
      summary: {
        totalUsers: userProfiles.length,
        averageEngagementScore: this._calculateAverage(userProfiles.map(u => u.engagementScore)),
        atRiskCount: atRiskUsers.length,
        highValueAtRiskCount: highValueAtRisk.length
      }
    };
  }

  /**
   * Classify user lifecycle stage
   * @param {Object} userProfile - User profile data
   * @param {Date} currentDate - Current date
   * @returns {string} Lifecycle stage
   */
  classifyLifecycleStage(userProfile, currentDate = new Date()) {
    const daysSinceFirst = this._daysBetween(userProfile.firstSeen, currentDate);
    const daysSinceLast = this._daysBetween(userProfile.lastSeen, currentDate);

    // Dormant: No activity for 30+ days
    if (daysSinceLast >= this.lifecycleThresholds.dormant) {
      return 'dormant';
    }

    // New: 0-7 days since first interaction
    if (daysSinceFirst <= this.lifecycleThresholds.new) {
      return 'new';
    }

    // Active: 8-30 days since first interaction
    if (daysSinceFirst <= this.lifecycleThresholds.active) {
      return 'active';
    }

    // Established: 31-90 days since first interaction
    if (daysSinceFirst <= this.lifecycleThresholds.established) {
      return 'established';
    }

    // Veteran: 90+ days since first interaction
    return 'veteran';
  }

  /**
   * Calculate engagement score (0-100)
   * @param {Object} userProfile - User profile data
   * @returns {number} Engagement score
   */
  calculateEngagementScore(userProfile) {
    // Frequency score (0-100)
    const frequencyScore = this._calculateFrequencyScore(userProfile);
    
    // Diversity score (0-100)
    const diversityScore = this._calculateDiversityScore(userProfile);
    
    // Value score (0-100)
    const valueScore = this._calculateValueScore(userProfile);

    // Weighted average
    const engagementScore = 
      (frequencyScore * this.engagementWeights.frequency) +
      (diversityScore * this.engagementWeights.diversity) +
      (valueScore * this.engagementWeights.value);

    return Math.round(engagementScore);
  }

  /**
   * Analyze individual user
   * @private
   */
  _analyzeUser(wallet, transactions, currentDate) {
    // Sort by timestamp
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    
    const firstSeen = sortedTxs[0].timestamp;
    const lastSeen = sortedTxs[sortedTxs.length - 1].timestamp;
    const transactionCount = sortedTxs.length;
    
    // Calculate metrics
    const uniqueFunctions = new Set(sortedTxs.map(tx => tx.functionName)).size;
    const totalValue = sortedTxs.reduce((sum, tx) => sum + tx.valueEth + tx.gasCostEth, 0);
    const successRate = sortedTxs.filter(tx => tx.success).length / transactionCount;
    
    // Create profile
    const profile = {
      wallet,
      firstSeen,
      lastSeen,
      transactionCount,
      uniqueFunctions,
      totalValue,
      successRate,
      daysSinceFirst: this._daysBetween(firstSeen, currentDate),
      daysSinceLast: this._daysBetween(lastSeen, currentDate)
    };

    // Classify lifecycle stage
    profile.lifecycleStage = this.classifyLifecycleStage(profile, currentDate);
    
    // Calculate engagement score
    profile.engagementScore = this.calculateEngagementScore(profile);
    
    // Detect engagement changes
    profile.engagementChange = this._detectEngagementChange(sortedTxs, currentDate);
    
    // Calculate churn probability
    profile.churnProbability = this._calculateChurnProbability(profile);
    
    // Flag at-risk users
    profile.atRisk = profile.engagementChange && profile.engagementChange.dropped;

    return profile;
  }

  /**
   * Calculate frequency score
   * @private
   */
  _calculateFrequencyScore(profile) {
    const daysSinceFirst = profile.daysSinceFirst || 1;
    const transactionsPerDay = profile.transactionCount / daysSinceFirst;
    
    // Score based on transactions per day
    // 1+ tx/day = 100, 0.1 tx/day = 50, 0.01 tx/day = 10
    const score = Math.min(100, transactionsPerDay * 100);
    
    return score;
  }

  /**
   * Calculate diversity score
   * @private
   */
  _calculateDiversityScore(profile) {
    // Score based on unique functions used
    // 10+ functions = 100, 5 functions = 50, 1 function = 10
    const score = Math.min(100, (profile.uniqueFunctions / 10) * 100);
    
    return score;
  }

  /**
   * Calculate value score
   * @private
   */
  _calculateValueScore(profile) {
    // Score based on total value (logarithmic scale)
    // 100+ ETH = 100, 10 ETH = 75, 1 ETH = 50, 0.1 ETH = 25
    if (profile.totalValue <= 0) return 0;
    
    const logValue = Math.log10(profile.totalValue + 1);
    const score = Math.min(100, logValue * 50);
    
    return score;
  }

  /**
   * Detect engagement changes
   * @private
   */
  _detectEngagementChange(transactions, currentDate) {
    if (transactions.length < 2) return null;

    // Split into recent and previous periods
    const windowMs = this.engagementDropWindow * 24 * 60 * 60 * 1000;
    const recentStart = new Date(currentDate.getTime() - windowMs);
    const previousStart = new Date(currentDate.getTime() - 2 * windowMs);

    const recentTxs = transactions.filter(tx => tx.timestamp >= recentStart);
    const previousTxs = transactions.filter(tx => 
      tx.timestamp >= previousStart && tx.timestamp < recentStart
    );

    if (previousTxs.length === 0) return null;

    // Calculate engagement for each period
    const recentProfile = {
      transactionCount: recentTxs.length,
      uniqueFunctions: new Set(recentTxs.map(tx => tx.functionName)).size,
      totalValue: recentTxs.reduce((sum, tx) => sum + tx.valueEth, 0),
      daysSinceFirst: this.engagementDropWindow,
      daysSinceLast: 0
    };

    const previousProfile = {
      transactionCount: previousTxs.length,
      uniqueFunctions: new Set(previousTxs.map(tx => tx.functionName)).size,
      totalValue: previousTxs.reduce((sum, tx) => sum + tx.valueEth, 0),
      daysSinceFirst: this.engagementDropWindow,
      daysSinceLast: 0
    };

    const recentScore = this.calculateEngagementScore(recentProfile);
    const previousScore = this.calculateEngagementScore(previousProfile);
    const scoreDrop = previousScore - recentScore;

    return {
      recentScore,
      previousScore,
      scoreDrop,
      dropped: scoreDrop >= this.engagementDropThreshold
    };
  }

  /**
   * Calculate churn probability (0-100%)
   * @private
   */
  _calculateChurnProbability(profile) {
    let probability = 0;

    // Factor 1: Days since last activity (0-40 points)
    const daysSinceLast = profile.daysSinceLast;
    if (daysSinceLast > 30) probability += 40;
    else if (daysSinceLast > 14) probability += 30;
    else if (daysSinceLast > 7) probability += 20;
    else probability += (daysSinceLast / 7) * 10;

    // Factor 2: Engagement score (0-30 points)
    const engagementPenalty = (100 - profile.engagementScore) * 0.3;
    probability += engagementPenalty;

    // Factor 3: Engagement drop (0-30 points)
    if (profile.engagementChange && profile.engagementChange.dropped) {
      probability += 30;
    }

    return Math.min(100, Math.round(probability));
  }

  /**
   * Categorize users by lifecycle stage
   * @private
   */
  _categorizeByLifecycle(userProfiles) {
    const categories = {
      new: [],
      active: [],
      established: [],
      veteran: [],
      dormant: []
    };

    for (const profile of userProfiles) {
      categories[profile.lifecycleStage].push(profile);
    }

    return categories;
  }

  /**
   * Group transactions by wallet
   * @private
   */
  _groupByWallet(transactions) {
    const walletMap = new Map();

    for (const tx of transactions) {
      const wallet = tx.wallet.toLowerCase();
      
      if (!walletMap.has(wallet)) {
        walletMap.set(wallet, []);
      }
      
      walletMap.get(wallet).push(tx);
    }

    return walletMap;
  }

  /**
   * Calculate days between two dates
   * @private
   */
  _daysBetween(date1, date2) {
    const diffMs = date2 - date1;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate average
   * @private
   */
  _calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate median
   * @private
   */
  _calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      userProfiles: [],
      byLifecycleStage: {
        new: [],
        active: [],
        established: [],
        veteran: [],
        dormant: []
      },
      atRiskUsers: [],
      highValueAtRisk: [],
      summary: {
        totalUsers: 0,
        averageEngagementScore: 0,
        atRiskCount: 0,
        highValueAtRiskCount: 0
      }
    };
  }
}

export default UserLifecycleScorer;
