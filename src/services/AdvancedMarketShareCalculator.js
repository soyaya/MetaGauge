/**
 * Market Share Calculation and Competitive Benchmarking
 * Multi-Chain RPC Integration - Task 21
 */

import { errorHandler } from './ErrorHandler.js';
import { dbOptimizer } from './DatabaseOptimizer.js';

/**
 * Advanced market share calculator with cross-chain normalization
 */
export class AdvancedMarketShareCalculator {
  constructor(config = {}) {
    this.config = {
      normalizationWeights: {
        ethereum: 1.0,
        starknet: 0.3,
        lisk: 0.1
      },
      benchmarkMetrics: ['tvl', 'volume', 'users', 'transactions'],
      ...config
    };
    
    this.benchmarkEngine = new CompetitiveBenchmarkEngine();
  }

  /**
   * Calculate normalized cross-chain market share
   */
  async calculateNormalizedMarketShare(competitorData) {
    const normalizedData = new Map();
    
    // Normalize metrics across chains
    for (const [chain, competitors] of competitorData.entries()) {
      const weight = this.config.normalizationWeights[chain] || 1.0;
      
      const normalizedCompetitors = competitors.map(competitor => ({
        ...competitor,
        normalizedMetrics: {
          tvl: (competitor.metrics.tvl || 0) * weight,
          volume: (competitor.metrics.volume24h || 0) * weight,
          users: (competitor.metrics.uniqueUsers24h || 0) * weight,
          transactions: (competitor.metrics.transactions24h || 0) * weight
        }
      }));
      
      normalizedData.set(chain, normalizedCompetitors);
    }
    
    // Calculate total market
    const totalMarket = this._calculateTotalMarket(normalizedData);
    
    // Calculate individual shares
    const marketShares = this._calculateIndividualShares(normalizedData, totalMarket);
    
    // Rank competitors
    const rankings = this._rankCompetitors(marketShares);
    
    return {
      totalMarket,
      marketShares,
      rankings,
      dominanceIndex: this._calculateDominanceIndex(marketShares),
      competitionLevel: this._assessCompetitionLevel(marketShares)
    };
  }

  /**
   * Perform competitive benchmarking
   */
  async performBenchmarking(ourMetrics, competitorData) {
    const benchmarks = await this.benchmarkEngine.generateBenchmarks(competitorData);
    
    const comparison = {
      ourPosition: {},
      percentileRanks: {},
      competitiveGaps: {},
      strengths: [],
      weaknesses: []
    };
    
    // Compare against benchmarks
    this.config.benchmarkMetrics.forEach(metric => {
      const ourValue = ourMetrics[metric] || 0;
      const benchmark = benchmarks[metric];
      
      comparison.ourPosition[metric] = ourValue;
      comparison.percentileRanks[metric] = this._calculatePercentile(ourValue, benchmark.distribution);
      
      const gap = benchmark.median - ourValue;
      comparison.competitiveGaps[metric] = {
        absolute: gap,
        relative: gap / benchmark.median,
        vsLeader: benchmark.max - ourValue
      };
      
      // Identify strengths and weaknesses
      if (comparison.percentileRanks[metric] > 0.75) {
        comparison.strengths.push(metric);
      } else if (comparison.percentileRanks[metric] < 0.25) {
        comparison.weaknesses.push(metric);
      }
    });
    
    return comparison;
  }

  /**
   * Generate strategic recommendations
   */
  generateStrategicRecommendations(marketShare, benchmarking) {
    const recommendations = [];
    
    // Market position recommendations
    if (marketShare.rankings.ourRank > 5) {
      recommendations.push({
        category: 'market_position',
        priority: 'high',
        title: 'Improve Market Position',
        description: 'Currently ranked outside top 5 competitors',
        actions: [
          'Increase marketing spend',
          'Improve user acquisition',
          'Enhance product features'
        ],
        expectedImpact: 'Move up 2-3 positions in 6 months'
      });
    }
    
    // Metric-specific recommendations
    benchmarking.weaknesses.forEach(weakness => {
      const gap = benchmarking.competitiveGaps[weakness];
      
      recommendations.push({
        category: 'performance',
        priority: gap.relative > 0.5 ? 'high' : 'medium',
        title: `Improve ${weakness.toUpperCase()}`,
        description: `${Math.abs(gap.relative * 100).toFixed(1)}% below market median`,
        actions: this._getImprovementActions(weakness),
        expectedImpact: `Close gap by ${Math.min(50, Math.abs(gap.relative * 100)).toFixed(0)}%`
      });
    });
    
    // Cross-chain expansion recommendations
    const chainOpportunities = this._identifyChainOpportunities(marketShare);
    chainOpportunities.forEach(opportunity => {
      recommendations.push({
        category: 'expansion',
        priority: 'medium',
        title: `Expand to ${opportunity.chain}`,
        description: `Low competition detected on ${opportunity.chain}`,
        actions: [
          `Deploy contracts on ${opportunity.chain}`,
          'Adapt UI for chain-specific features',
          'Launch targeted marketing campaign'
        ],
        expectedImpact: `Capture ${opportunity.potentialShare}% market share`
      });
    });
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Private methods
  _calculateTotalMarket(normalizedData) {
    const totals = { tvl: 0, volume: 0, users: 0, transactions: 0 };
    
    normalizedData.forEach(competitors => {
      competitors.forEach(competitor => {
        Object.keys(totals).forEach(metric => {
          totals[metric] += competitor.normalizedMetrics[metric] || 0;
        });
      });
    });
    
    return totals;
  }

  _calculateIndividualShares(normalizedData, totalMarket) {
    const shares = [];
    
    normalizedData.forEach((competitors, chain) => {
      competitors.forEach(competitor => {
        const share = {
          name: competitor.name,
          chain,
          address: competitor.address,
          shares: {}
        };
        
        Object.keys(totalMarket).forEach(metric => {
          const value = competitor.normalizedMetrics[metric] || 0;
          share.shares[metric] = totalMarket[metric] > 0 ? value / totalMarket[metric] : 0;
        });
        
        // Calculate composite share (weighted average)
        share.compositeShare = (
          share.shares.tvl * 0.4 +
          share.shares.volume * 0.3 +
          share.shares.users * 0.2 +
          share.shares.transactions * 0.1
        );
        
        shares.push(share);
      });
    });
    
    return shares;
  }

  _rankCompetitors(marketShares) {
    const sorted = [...marketShares].sort((a, b) => b.compositeShare - a.compositeShare);
    
    return {
      rankings: sorted.map((competitor, index) => ({
        rank: index + 1,
        name: competitor.name,
        chain: competitor.chain,
        compositeShare: competitor.compositeShare,
        marketShare: (competitor.compositeShare * 100).toFixed(2) + '%'
      })),
      ourRank: sorted.length + 1, // Mock our position
      topCompetitors: sorted.slice(0, 5)
    };
  }

  _calculateDominanceIndex(marketShares) {
    const shares = marketShares.map(c => c.compositeShare).sort((a, b) => b - a);
    
    // Herfindahl-Hirschman Index
    const hhi = shares.reduce((sum, share) => sum + (share * share), 0);
    
    let dominanceLevel;
    if (hhi > 0.25) dominanceLevel = 'high';
    else if (hhi > 0.15) dominanceLevel = 'moderate';
    else dominanceLevel = 'low';
    
    return {
      hhi,
      dominanceLevel,
      topPlayerShare: shares[0] || 0,
      top3Share: shares.slice(0, 3).reduce((sum, share) => sum + share, 0)
    };
  }

  _assessCompetitionLevel(marketShares) {
    const effectiveCompetitors = marketShares.filter(c => c.compositeShare > 0.01).length;
    
    let level;
    if (effectiveCompetitors > 10) level = 'intense';
    else if (effectiveCompetitors > 5) level = 'moderate';
    else level = 'limited';
    
    return {
      level,
      effectiveCompetitors,
      fragmentationIndex: 1 - this._calculateDominanceIndex(marketShares).hhi
    };
  }

  _calculatePercentile(value, distribution) {
    const sorted = [...distribution].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    
    return index === -1 ? 1.0 : index / sorted.length;
  }

  _getImprovementActions(metric) {
    const actions = {
      tvl: ['Increase yield farming rewards', 'Launch liquidity mining program', 'Partner with large institutions'],
      volume: ['Reduce trading fees', 'Improve user experience', 'Add more trading pairs'],
      users: ['Referral program', 'Social media marketing', 'Educational content'],
      transactions: ['Optimize gas costs', 'Improve transaction speed', 'Add batch operations']
    };
    
    return actions[metric] || ['Analyze competitor strategies', 'Conduct user research'];
  }

  _identifyChainOpportunities(marketShare) {
    const opportunities = [];
    
    // Mock chain opportunity analysis
    const chainData = {
      polygon: { competitors: 3, totalTvl: 500000000, potentialShare: 15 },
      arbitrum: { competitors: 4, totalTvl: 800000000, potentialShare: 12 },
      optimism: { competitors: 2, totalTvl: 300000000, potentialShare: 20 }
    };
    
    Object.entries(chainData).forEach(([chain, data]) => {
      if (data.competitors < 5 && data.potentialShare > 10) {
        opportunities.push({
          chain,
          competitorCount: data.competitors,
          potentialShare: data.potentialShare,
          marketSize: data.totalTvl
        });
      }
    });
    
    return opportunities;
  }
}

/**
 * Competitive benchmark engine
 */
export class CompetitiveBenchmarkEngine {
  async generateBenchmarks(competitorData) {
    const benchmarks = {};
    const metrics = ['tvl', 'volume24h', 'uniqueUsers24h', 'transactions24h'];
    
    metrics.forEach(metric => {
      const values = [];
      
      competitorData.forEach(competitors => {
        competitors.forEach(competitor => {
          const value = competitor.metrics[metric];
          if (value !== undefined && value !== null) {
            values.push(value);
          }
        });
      });
      
      values.sort((a, b) => a - b);
      
      benchmarks[metric.replace('24h', '')] = {
        min: values[0] || 0,
        max: values[values.length - 1] || 0,
        median: values[Math.floor(values.length / 2)] || 0,
        mean: values.reduce((sum, v) => sum + v, 0) / values.length || 0,
        p25: values[Math.floor(values.length * 0.25)] || 0,
        p75: values[Math.floor(values.length * 0.75)] || 0,
        distribution: values
      };
    });
    
    return benchmarks;
  }
}

// Export calculator
export const advancedMarketShareCalculator = new AdvancedMarketShareCalculator();
