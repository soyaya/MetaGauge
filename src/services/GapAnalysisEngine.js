/**
 * Gap Analysis Engine - Task 22
 * Multi-Chain RPC Integration
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5
 */

export class GapAnalysisEngine {
  constructor(competitiveData, marketData) {
    this.competitiveData = competitiveData;
    this.marketData = marketData;
    this.gapAnalysis = new Map();
  }

  /**
   * Perform multi-dimensional gap analysis
   */
  async performGapAnalysis() {
    const gaps = {
      feature: await this._analyzeFeatureGaps(),
      performance: await this._analyzePerformanceGaps(),
      market: await this._analyzeMarketGaps(),
      user: await this._analyzeUserExperienceGaps(),
      technical: await this._analyzeTechnicalGaps()
    };

    this.gapAnalysis.set('latest', {
      timestamp: new Date(),
      gaps,
      priority: this._prioritizeGaps(gaps),
      opportunities: this._identifyOpportunities(gaps)
    });

    return gaps;
  }

  /**
   * Analyze feature gaps
   */
  async _analyzeFeatureGaps() {
    const ourFeatures = this.competitiveData.target?.features || [];
    const competitorFeatures = new Set();
    
    Object.values(this.competitiveData.competitors || {}).forEach(competitor => {
      competitor.features?.forEach(feature => competitorFeatures.add(feature));
    });

    return {
      missing: Array.from(competitorFeatures).filter(f => !ourFeatures.includes(f)),
      unique: ourFeatures.filter(f => !competitorFeatures.has(f)),
      common: ourFeatures.filter(f => competitorFeatures.has(f))
    };
  }

  /**
   * Analyze performance gaps
   */
  async _analyzePerformanceGaps() {
    const ourMetrics = this.competitiveData.target?.metrics || {};
    const competitorMetrics = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics || {});

    return {
      gasEfficiency: this._compareMetric(ourMetrics.avgGasCost, competitorMetrics.map(m => m.avgGasCost)),
      throughput: this._compareMetric(ourMetrics.txPerSecond, competitorMetrics.map(m => m.txPerSecond)),
      successRate: this._compareMetric(ourMetrics.successRate, competitorMetrics.map(m => m.successRate)),
      userRetention: this._compareMetric(ourMetrics.retention, competitorMetrics.map(m => m.retention))
    };
  }

  /**
   * Analyze market share gap
   */
  _analyzeMarketShareGap() {
    const ourShare = this.competitiveData.target?.metrics?.marketShare || 0;
    const competitorShares = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.marketShare || 0);
    
    const avgCompetitorShare = competitorShares.length > 0 ? 
      competitorShares.reduce((a, b) => a + b, 0) / competitorShares.length : 0;
    
    return {
      ourShare,
      avgCompetitorShare,
      gap: ourShare - avgCompetitorShare,
      ranking: competitorShares.filter(s => s > ourShare).length + 1
    };
  }

  /**
   * Analyze user base gap
   */
  _analyzeUserBaseGap() {
    const ourUsers = this.competitiveData.target?.metrics?.totalUsers || 0;
    const competitorUsers = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.totalUsers || 0);
    
    const avgCompetitorUsers = competitorUsers.length > 0 ? 
      competitorUsers.reduce((a, b) => a + b, 0) / competitorUsers.length : 0;
    
    return {
      ourUsers,
      avgCompetitorUsers,
      gap: ourUsers - avgCompetitorUsers,
      percentile: this._calculatePercentile(ourUsers, competitorUsers)
    };
  }

  /**
   * Analyze market gaps
   */
  async _analyzeMarketGaps() {
    return {
      marketShare: this._analyzeMarketShareGap(),
      userBase: this._analyzeUserBaseGap(),
      revenue: this._analyzeRevenueGap(),
      growth: this._analyzeGrowthGap()
    };
  }

  /**
   * Analyze revenue gap
   */
  _analyzeRevenueGap() {
    const ourRevenue = this.competitiveData.target?.metrics?.revenue || null;
    const competitorRevenue = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.revenue)
      .filter(r => r != null);
    
    if (!ourRevenue || competitorRevenue.length === 0) {
      return { gap: null, status: 'no_data', message: 'Revenue data not available' };
    }
    
    const avgCompetitorRevenue = competitorRevenue.reduce((a, b) => a + b, 0) / competitorRevenue.length;
    
    return {
      ourRevenue,
      avgCompetitorRevenue,
      gap: ourRevenue - avgCompetitorRevenue,
      status: 'available'
    };
  }

  /**
   * Analyze growth gap
   */
  _analyzeGrowthGap() {
    const ourGrowth = this.competitiveData.target?.metrics?.userGrowthRate || 0;
    const competitorGrowth = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.userGrowthRate || 0);
    
    const avgCompetitorGrowth = competitorGrowth.length > 0 ? 
      competitorGrowth.reduce((a, b) => a + b, 0) / competitorGrowth.length : 0;
    
    return {
      ourGrowth,
      avgCompetitorGrowth,
      gap: ourGrowth - avgCompetitorGrowth
    };
  }

  /**
   * Analyze onboarding gap
   */
  _analyzeOnboardingGap() {
    const ourOnboardingTime = this.competitiveData.target?.metrics?.avgOnboardingTime || null;
    const competitorOnboardingTimes = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.avgOnboardingTime)
      .filter(t => t != null);
    
    if (!ourOnboardingTime || competitorOnboardingTimes.length === 0) {
      return { gap: null, status: 'no_data', message: 'Onboarding time data not available' };
    }
    
    const avgCompetitorTime = competitorOnboardingTimes.reduce((a, b) => a + b, 0) / competitorOnboardingTimes.length;
    
    return {
      ourTime: ourOnboardingTime,
      avgCompetitorTime,
      gap: ourOnboardingTime - avgCompetitorTime,
      status: 'available'
    };
  }

  /**
   * Analyze interface gap
   */
  _analyzeInterfaceGap() {
    const ourUxScore = this.competitiveData.target?.metrics?.uxScore || null;
    const competitorUxScores = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.uxScore)
      .filter(s => s != null);
    
    if (!ourUxScore || competitorUxScores.length === 0) {
      return { gap: null, status: 'no_data', message: 'UX score data not available' };
    }
    
    const avgCompetitorScore = competitorUxScores.reduce((a, b) => a + b, 0) / competitorUxScores.length;
    
    return {
      ourScore: ourUxScore,
      avgCompetitorScore,
      gap: ourUxScore - avgCompetitorScore,
      status: 'available'
    };
  }

  /**
   * Analyze support gap
   */
  _analyzeSupportGap() {
    const ourSupportScore = this.competitiveData.target?.metrics?.supportScore || null;
    const competitorSupportScores = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.supportScore)
      .filter(s => s != null);
    
    if (!ourSupportScore || competitorSupportScores.length === 0) {
      return { gap: null, status: 'no_data', message: 'Support score data not available' };
    }
    
    const avgCompetitorScore = competitorSupportScores.reduce((a, b) => a + b, 0) / competitorSupportScores.length;
    
    return {
      ourScore: ourSupportScore,
      avgCompetitorScore,
      gap: ourSupportScore - avgCompetitorScore,
      status: 'available'
    };
  }

  /**
   * Analyze documentation gap
   */
  _analyzeDocumentationGap() {
    const ourDocScore = this.competitiveData.target?.metrics?.documentationScore || null;
    const competitorDocScores = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.documentationScore)
      .filter(s => s != null);
    
    if (!ourDocScore || competitorDocScores.length === 0) {
      return { gap: null, status: 'no_data', message: 'Documentation score data not available' };
    }
    
    const avgCompetitorScore = competitorDocScores.reduce((a, b) => a + b, 0) / competitorDocScores.length;
    
    return {
      ourScore: ourDocScore,
      avgCompetitorScore,
      gap: ourDocScore - avgCompetitorScore,
      status: 'available'
    };
  }

  /**
   * Analyze scalability gap
   */
  _analyzeScalabilityGap() {
    const ourScalabilityScore = this.competitiveData.target?.metrics?.scalabilityScore || null;
    const competitorScalabilityScores = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.scalabilityScore)
      .filter(s => s != null);
    
    if (!ourScalabilityScore || competitorScalabilityScores.length === 0) {
      return { gap: null, status: 'no_data', message: 'Scalability score data not available' };
    }
    
    const avgCompetitorScore = competitorScalabilityScores.reduce((a, b) => a + b, 0) / competitorScalabilityScores.length;
    
    return {
      ourScore: ourScalabilityScore,
      avgCompetitorScore,
      gap: ourScalabilityScore - avgCompetitorScore,
      status: 'available'
    };
  }

  /**
   * Analyze security gap
   */
  _analyzeSecurityGap() {
    const ourSecurityScore = this.competitiveData.target?.metrics?.securityScore || null;
    const competitorSecurityScores = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.securityScore)
      .filter(s => s != null);
    
    if (!ourSecurityScore || competitorSecurityScores.length === 0) {
      return { gap: null, status: 'no_data', message: 'Security score data not available' };
    }
    
    const avgCompetitorScore = competitorSecurityScores.reduce((a, b) => a + b, 0) / competitorSecurityScores.length;
    
    return {
      ourScore: ourSecurityScore,
      avgCompetitorScore,
      gap: ourSecurityScore - avgCompetitorScore,
      status: 'available'
    };
  }

  /**
   * Analyze integration gap
   */
  _analyzeIntegrationGap() {
    const ourIntegrationCount = this.competitiveData.target?.metrics?.integrationCount || null;
    const competitorIntegrationCounts = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.integrationCount)
      .filter(i => i != null);
    
    if (!ourIntegrationCount || competitorIntegrationCounts.length === 0) {
      return { gap: null, status: 'no_data', message: 'Integration count data not available' };
    }
    
    const avgCompetitorCount = competitorIntegrationCounts.reduce((a, b) => a + b, 0) / competitorIntegrationCounts.length;
    
    return {
      ourCount: ourIntegrationCount,
      avgCompetitorCount,
      gap: ourIntegrationCount - avgCompetitorCount,
      status: 'available'
    };
  }

  /**
   * Analyze innovation gap
   */
  _analyzeInnovationGap() {
    const ourInnovationScore = this.competitiveData.target?.metrics?.innovationScore || null;
    const competitorInnovationScores = Object.values(this.competitiveData.competitors || {})
      .map(c => c.metrics?.innovationScore)
      .filter(s => s != null);
    
    if (!ourInnovationScore || competitorInnovationScores.length === 0) {
      return { gap: null, status: 'no_data', message: 'Innovation score data not available' };
    }
    
    const avgCompetitorScore = competitorInnovationScores.reduce((a, b) => a + b, 0) / competitorInnovationScores.length;
    
    return {
      ourScore: ourInnovationScore,
      avgCompetitorScore,
      gap: ourInnovationScore - avgCompetitorScore,
      status: 'available'
    };
  }

  /**
   * Analyze user experience gaps
   */
  async _analyzeUserExperienceGaps() {
    return {
      onboarding: this._analyzeOnboardingGap(),
      interface: this._analyzeInterfaceGap(),
      support: this._analyzeSupportGap(),
      documentation: this._analyzeDocumentationGap()
    };
  }

  /**
   * Analyze technical gaps
   */
  async _analyzeTechnicalGaps() {
    return {
      scalability: this._analyzeScalabilityGap(),
      security: this._analyzeSecurityGap(),
      integration: this._analyzeIntegrationGap(),
      innovation: this._analyzeInnovationGap()
    };
  }

  /**
   * Compare metric with competitors
   */
  _compareMetric(ourValue, competitorValues) {
    const validValues = competitorValues.filter(v => v != null);
    if (validValues.length === 0) return { status: 'no_data' };

    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const max = Math.max(...validValues);
    const min = Math.min(...validValues);

    return {
      ourValue,
      competitorAvg: avg,
      competitorMax: max,
      competitorMin: min,
      gap: ourValue - avg,
      percentile: this._calculatePercentile(ourValue, validValues),
      status: ourValue >= avg ? 'above_average' : 'below_average'
    };
  }

  /**
   * Calculate percentile ranking
   */
  _calculatePercentile(value, values) {
    const sorted = [...values, value].sort((a, b) => a - b);
    const index = sorted.indexOf(value);
    return (index / (sorted.length - 1)) * 100;
  }

  /**
   * Prioritize gaps by impact and effort
   */
  _prioritizeGaps(gaps) {
    const priorities = [];
    
    Object.entries(gaps).forEach(([category, categoryGaps]) => {
      Object.entries(categoryGaps).forEach(([gap, data]) => {
        const impact = this._assessImpact(category, gap, data);
        const effort = this._assessEffort(category, gap, data);
        
        priorities.push({
          category,
          gap,
          impact,
          effort,
          priority: impact / effort,
          data
        });
      });
    });

    return priorities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Assess impact of addressing gap
   */
  _assessImpact(category, gap, data) {
    const weights = {
      feature: 0.8,
      performance: 0.9,
      market: 1.0,
      user: 0.7,
      technical: 0.6
    };

    return (weights[category] || 0.5) * this._calculateGapSeverity(data);
  }

  /**
   * Assess effort required to address gap
   */
  _assessEffort(category, gap, data) {
    const baseEffort = {
      feature: 0.6,
      performance: 0.8,
      market: 0.9,
      user: 0.5,
      technical: 0.7
    };

    return baseEffort[category] || 0.5;
  }

  /**
   * Calculate gap severity
   */
  _calculateGapSeverity(data) {
    if (data.gap && typeof data.gap === 'number') {
      return Math.abs(data.gap) / 100; // Normalize
    }
    if (data.missing && Array.isArray(data.missing)) {
      return data.missing.length / 10; // Normalize
    }
    return 0.5; // Default severity
  }

  /**
   * Identify strategic opportunities
   */
  _identifyOpportunities(gaps) {
    const opportunities = [];

    // Feature opportunities
    if (gaps.feature?.missing?.length > 0) {
      opportunities.push({
        type: 'feature_development',
        description: `Develop ${gaps.feature.missing.length} missing features`,
        features: gaps.feature.missing,
        impact: 'high'
      });
    }

    // Performance opportunities
    Object.entries(gaps.performance || {}).forEach(([metric, data]) => {
      if (data.status === 'below_average') {
        opportunities.push({
          type: 'performance_improvement',
          description: `Improve ${metric} performance`,
          currentGap: data.gap,
          impact: 'medium'
        });
      }
    });

    return opportunities;
  }

  /**
   * Generate gap analysis report
   */
  generateReport() {
    const latest = this.gapAnalysis.get('latest');
    if (!latest) return null;

    return {
      timestamp: latest.timestamp,
      summary: {
        totalGaps: latest.priority.length,
        highPriorityGaps: latest.priority.filter(g => g.priority > 1).length,
        opportunities: latest.opportunities.length
      },
      gaps: latest.gaps,
      priorities: latest.priority.slice(0, 10), // Top 10
      opportunities: latest.opportunities,
      recommendations: this._generateRecommendations(latest)
    };
  }

  /**
   * Generate strategic recommendations
   */
  _generateRecommendations(analysis) {
    const recommendations = [];
    
    analysis.priority.slice(0, 5).forEach(gap => {
      recommendations.push({
        category: gap.category,
        gap: gap.gap,
        recommendation: this._getRecommendation(gap.category, gap.gap),
        priority: gap.priority,
        estimatedImpact: gap.impact
      });
    });

    return recommendations;
  }

  /**
   * Get specific recommendation for gap
   */
  _getRecommendation(category, gap) {
    const recommendations = {
      feature: {
        missing: 'Prioritize development of missing features to achieve feature parity',
        unique: 'Leverage unique features as competitive advantages in marketing'
      },
      performance: {
        gasEfficiency: 'Optimize smart contract code and gas usage patterns',
        throughput: 'Implement scaling solutions or optimize transaction processing',
        successRate: 'Improve error handling and transaction reliability'
      },
      market: {
        marketShare: 'Increase marketing efforts and user acquisition campaigns',
        userBase: 'Focus on user retention and referral programs'
      }
    };

    return recommendations[category]?.[gap] || 'Conduct detailed analysis and develop action plan';
  }
}
