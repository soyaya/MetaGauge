/**
 * Market Landscape Analyzer - Task 24
 * Multi-Chain RPC Integration
 * Requirements: 17.5, 18.3, 19.3
 */

export class MarketLandscapeAnalyzer {
  constructor(competitiveData, marketData) {
    this.competitiveData = competitiveData;
    this.marketData = marketData;
    this.landscapeAnalysis = new Map();
  }

  /**
   * Analyze comprehensive market landscape
   */
  async analyzeMarketLandscape() {
    const analysis = {
      strategicGroups: await this._identifyStrategicGroups(),
      competitiveSegmentation: await this._performCompetitiveSegmentation(),
      crossChainComparison: await this._analyzeCrossChainMarket(),
      competitiveVelocity: await this._trackCompetitiveVelocity(),
      marketConcentration: await this._analyzeMarketConcentration(),
      timestamp: new Date()
    };

    this.landscapeAnalysis.set('latest', analysis);
    return analysis;
  }

  /**
   * Identify strategic groups in the market
   */
  async _identifyStrategicGroups() {
    const competitors = Object.entries(this.competitiveData.competitors || {});
    const groups = new Map();

    // Group by key strategic dimensions
    competitors.forEach(([name, data]) => {
      const metrics = data.metrics || {};
      const groupKey = this._calculateGroupKey(metrics);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          characteristics: this._getGroupCharacteristics(groupKey),
          members: [],
          avgMetrics: {}
        });
      }
      
      groups.get(groupKey).members.push({ name, ...data });
    });

    // Calculate average metrics for each group
    groups.forEach((group, key) => {
      group.avgMetrics = this._calculateGroupAverages(group.members);
      group.size = group.members.length;
      group.marketShare = group.members.reduce((sum, member) => 
        sum + (member.metrics?.marketShare || 0), 0);
    });

    return Object.fromEntries(groups);
  }

  /**
   * Calculate strategic group key based on key dimensions
   */
  _calculateGroupKey(metrics) {
    const gasEfficiency = metrics.avgGasCost < 0.001 ? 'high' : 'low';
    const marketPosition = metrics.marketShare > 0.1 ? 'leader' : 'follower';
    const userBase = metrics.totalUsers > 10000 ? 'large' : 'small';
    
    return `${gasEfficiency}_${marketPosition}_${userBase}`;
  }

  /**
   * Get characteristics for strategic group
   */
  _getGroupCharacteristics(groupKey) {
    const [gasEfficiency, marketPosition, userBase] = groupKey.split('_');
    
    return {
      gasEfficiency,
      marketPosition,
      userBase,
      description: `${gasEfficiency} gas efficiency, ${marketPosition} market position, ${userBase} user base`
    };
  }

  /**
   * Calculate average metrics for group members
   */
  _calculateGroupAverages(members) {
    const metrics = {};
    const keys = ['avgGasCost', 'successRate', 'marketShare', 'totalUsers', 'txVolume'];
    
    keys.forEach(key => {
      const values = members.map(m => m.metrics?.[key]).filter(v => v != null);
      metrics[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });
    
    return metrics;
  }

  /**
   * Perform competitive segmentation analysis
   */
  async _performCompetitiveSegmentation() {
    const segments = {
      leaders: [],
      challengers: [],
      followers: [],
      niche: []
    };

    Object.entries(this.competitiveData.competitors || {}).forEach(([name, data]) => {
      const metrics = data.metrics || {};
      const segment = this._determineCompetitiveSegment(metrics);
      segments[segment].push({ name, ...data, segment });
    });

    // Add our position
    const ourSegment = this._determineCompetitiveSegment(this.competitiveData.target?.metrics || {});
    segments[ourSegment].push({ 
      name: 'target', 
      ...this.competitiveData.target, 
      segment: ourSegment,
      isTarget: true 
    });

    return segments;
  }

  /**
   * Determine competitive segment for entity
   */
  _determineCompetitiveSegment(metrics) {
    const marketShare = metrics.marketShare || 0;
    const growthRate = metrics.userGrowthRate || 0;
    const innovation = metrics.featureCount || 0;

    if (marketShare > 0.15 && growthRate > 0.1) return 'leaders';
    if (marketShare > 0.05 && (growthRate > 0.15 || innovation > 20)) return 'challengers';
    if (marketShare > 0.02) return 'followers';
    return 'niche';
  }

  /**
   * Analyze cross-chain market comparison
   */
  async _analyzeCrossChainMarket() {
    const chainAnalysis = {
      ethereum: this._analyzeChainMetrics('ethereum'),
      starknet: this._analyzeChainMetrics('starknet'),
      lisk: this._analyzeChainMetrics('lisk')
    };

    return {
      chainMetrics: chainAnalysis,
      crossChainOpportunities: this._identifyCrossChainOpportunities(chainAnalysis),
      migrationPatterns: this._analyzeMigrationPatterns(),
      ecosystemHealth: this._assessEcosystemHealth(chainAnalysis)
    };
  }

  /**
   * Analyze metrics for specific chain
   */
  _analyzeChainMetrics(chain) {
    const chainCompetitors = Object.entries(this.competitiveData.competitors || {})
      .filter(([_, data]) => data.chain === chain);

    if (chainCompetitors.length === 0) {
      return { competitors: 0, totalVolume: 0, avgGasCost: 0 };
    }

    const totalVolume = chainCompetitors.reduce((sum, [_, data]) => 
      sum + (data.metrics?.txVolume || 0), 0);
    const avgGasCost = chainCompetitors.reduce((sum, [_, data]) => 
      sum + (data.metrics?.avgGasCost || 0), 0) / chainCompetitors.length;

    return {
      competitors: chainCompetitors.length,
      totalVolume,
      avgGasCost,
      marketLeader: chainCompetitors.reduce((leader, [name, data]) => 
        (data.metrics?.marketShare || 0) > (leader.marketShare || 0) ? 
        { name, marketShare: data.metrics?.marketShare } : leader, {})
    };
  }

  /**
   * Identify cross-chain opportunities
   */
  _identifyCrossChainOpportunities(chainAnalysis) {
    const opportunities = [];

    // Find chains with lower competition
    const competitionLevels = Object.entries(chainAnalysis)
      .map(([chain, data]) => ({ chain, competitors: data.competitors }))
      .sort((a, b) => a.competitors - b.competitors);

    if (competitionLevels[0].competitors < competitionLevels[2].competitors) {
      opportunities.push({
        type: 'low_competition',
        chain: competitionLevels[0].chain,
        description: `Lower competition on ${competitionLevels[0].chain}`,
        potential: 'high'
      });
    }

    // Find chains with better economics
    const gasCosts = Object.entries(chainAnalysis)
      .map(([chain, data]) => ({ chain, gasCost: data.avgGasCost }))
      .sort((a, b) => a.gasCost - b.gasCost);

    if (gasCosts[0].gasCost < gasCosts[2].gasCost * 0.5) {
      opportunities.push({
        type: 'cost_advantage',
        chain: gasCosts[0].chain,
        description: `Significant cost advantage on ${gasCosts[0].chain}`,
        potential: 'medium'
      });
    }

    return opportunities;
  }

  /**
   * Analyze migration patterns between chains
   */
  _analyzeMigrationPatterns() {
    // Simplified migration analysis
    return {
      ethereumToL2: 0.15, // 15% migration rate
      l2ToEthereum: 0.05, // 5% return rate
      crossChainActivity: 0.08, // 8% cross-chain activity
      trends: [
        'Increasing migration to L2 solutions',
        'Growing cross-chain DeFi activity',
        'Ethereum remains primary hub'
      ]
    };
  }

  /**
   * Assess ecosystem health across chains
   */
  _assessEcosystemHealth(chainAnalysis) {
    const healthScores = {};

    Object.entries(chainAnalysis).forEach(([chain, data]) => {
      const competitionScore = Math.min(data.competitors / 10, 1); // Normalize
      const volumeScore = Math.min(data.totalVolume / 1000000, 1); // Normalize
      const efficiencyScore = 1 - Math.min(data.avgGasCost / 0.01, 1); // Lower gas = higher score

      healthScores[chain] = {
        overall: (competitionScore + volumeScore + efficiencyScore) / 3,
        competition: competitionScore,
        volume: volumeScore,
        efficiency: efficiencyScore,
        rating: this._getRating((competitionScore + volumeScore + efficiencyScore) / 3)
      };
    });

    return healthScores;
  }

  /**
   * Get rating based on score
   */
  _getRating(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'poor';
  }

  /**
   * Track competitive velocity
   */
  async _trackCompetitiveVelocity() {
    const velocity = {};

    Object.entries(this.competitiveData.competitors || {}).forEach(([name, data]) => {
      const metrics = data.metrics || {};
      
      velocity[name] = {
        marketShareVelocity: this._calculateVelocity(metrics.marketShare, metrics.previousMarketShare),
        userGrowthVelocity: metrics.userGrowthRate || 0,
        featureVelocity: this._calculateVelocity(metrics.featureCount, metrics.previousFeatureCount),
        innovationIndex: this._calculateInnovationIndex(metrics),
        momentum: this._calculateMomentum(metrics)
      };
    });

    return velocity;
  }

  /**
   * Calculate velocity between current and previous values
   */
  _calculateVelocity(current, previous) {
    if (!previous || previous === 0) return 0;
    return (current - previous) / previous;
  }

  /**
   * Calculate innovation index
   */
  _calculateInnovationIndex(metrics) {
    const factors = [
      metrics.featureCount || 0,
      metrics.userGrowthRate || 0,
      metrics.txVolume || 0,
      1 - (metrics.avgGasCost || 1) // Lower gas cost = higher innovation
    ];

    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  /**
   * Calculate competitive momentum
   */
  _calculateMomentum(metrics) {
    const growthRate = metrics.userGrowthRate || 0;
    const marketShare = metrics.marketShare || 0;
    const efficiency = 1 - (metrics.avgGasCost || 1);

    return (growthRate * 0.4 + marketShare * 0.3 + efficiency * 0.3);
  }

  /**
   * Analyze market concentration
   */
  async _analyzeMarketConcentration() {
    const marketShares = Object.values(this.competitiveData.competitors || {})
      .map(data => data.metrics?.marketShare || 0)
      .sort((a, b) => b - a);

    const hhi = this._calculateHHI(marketShares);
    const cr4 = marketShares.slice(0, 4).reduce((sum, share) => sum + share, 0);

    return {
      herfindahlIndex: hhi,
      concentrationRatio4: cr4,
      marketStructure: this._determineMarketStructure(hhi),
      topPlayers: marketShares.slice(0, 5),
      competitiveIntensity: this._assessCompetitiveIntensity(hhi, cr4)
    };
  }

  /**
   * Calculate Herfindahl-Hirschman Index
   */
  _calculateHHI(marketShares) {
    return marketShares.reduce((sum, share) => sum + (share * share), 0);
  }

  /**
   * Determine market structure based on HHI
   */
  _determineMarketStructure(hhi) {
    if (hhi < 0.15) return 'highly_competitive';
    if (hhi < 0.25) return 'moderately_competitive';
    return 'concentrated';
  }

  /**
   * Assess competitive intensity
   */
  _assessCompetitiveIntensity(hhi, cr4) {
    const hhi_score = hhi < 0.15 ? 1 : hhi < 0.25 ? 0.6 : 0.3;
    const cr4_score = cr4 < 0.4 ? 1 : cr4 < 0.6 ? 0.6 : 0.3;
    
    const intensity = (hhi_score + cr4_score) / 2;
    
    if (intensity >= 0.8) return 'very_high';
    if (intensity >= 0.6) return 'high';
    if (intensity >= 0.4) return 'moderate';
    return 'low';
  }

  /**
   * Generate market positioning recommendations
   */
  generatePositioningRecommendations() {
    const analysis = this.landscapeAnalysis.get('latest');
    if (!analysis) return [];

    const recommendations = [];

    // Strategic group recommendations
    const ourGroup = this._findOurStrategicGroup(analysis.strategicGroups);
    if (ourGroup) {
      recommendations.push({
        type: 'strategic_positioning',
        recommendation: `Focus on differentiating within ${ourGroup.characteristics.description} segment`,
        rationale: `You are positioned in a group with ${ourGroup.size} competitors`
      });
    }

    // Cross-chain recommendations
    analysis.crossChainComparison.crossChainOpportunities.forEach(opp => {
      recommendations.push({
        type: 'expansion',
        recommendation: `Consider expanding to ${opp.chain}`,
        rationale: opp.description,
        potential: opp.potential
      });
    });

    return recommendations;
  }

  /**
   * Find our strategic group
   */
  _findOurStrategicGroup(strategicGroups) {
    const ourMetrics = this.competitiveData.target?.metrics || {};
    const ourGroupKey = this._calculateGroupKey(ourMetrics);
    return strategicGroups[ourGroupKey];
  }
}
