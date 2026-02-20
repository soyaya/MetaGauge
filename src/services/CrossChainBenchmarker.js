/**
 * Cross-Chain Competitive Benchmarker
 * 
 * Compares target contract against competitors both on the same chain and across different chains:
 * - Same-chain competitor identification (similar function signatures)
 * - Cross-chain competitor comparison (same features, different chains)
 * - Feature parity calculation
 * - Competitive velocity measurement (feature release speed)
 * - Competitor chain expansion detection
 */
export class CrossChainBenchmarker {
  constructor() {
    this.featureParityThreshold = 0.8; // 80% feature parity
    this.signatureSimilarityThreshold = 0.5; // 50% signature overlap
  }

  /**
   * Perform comprehensive cross-chain benchmarking
   * @param {Object} targetContract - Target contract data
   * @param {Array<Object>} competitors - Array of competitor contracts
   * @returns {Object} Cross-chain benchmarking analysis
   */
  benchmarkCrossChain(targetContract, competitors) {
    if (!targetContract || !Array.isArray(competitors) || competitors.length === 0) {
      return this._getEmptyAnalysis();
    }

    const sameChainCompetitors = this.identifySameChainCompetitors(targetContract, competitors);
    const crossChainCompetitors = this._identifyCrossChainCompetitors(targetContract, competitors);
    const featureParity = this.calculateFeatureParity(targetContract, competitors);
    const competitiveVelocity = this._measureCompetitiveVelocity(targetContract, competitors);
    const chainExpansions = this._detectChainExpansions(competitors);

    return {
      sameChainCompetitors,
      crossChainCompetitors,
      featureParity,
      competitiveVelocity,
      chainExpansions,
      summary: {
        totalCompetitors: competitors.length,
        sameChainCount: sameChainCompetitors.length,
        crossChainCount: crossChainCompetitors.length,
        averageFeatureParity: featureParity.averageParity,
        competitivePosition: this._calculateCompetitivePosition(targetContract, competitors)
      }
    };
  }

  /**
   * Identify same-chain competitors (similar function signatures)
   * @param {Object} targetContract - Target contract data
   * @param {Array<Object>} competitors - Array of competitor contracts
   * @returns {Array<Object>} Same-chain competitors
   */
  identifySameChainCompetitors(targetContract, competitors) {
    const targetChain = targetContract.chain;
    const targetSignatures = new Set(targetContract.functionSignatures || []);
    
    const sameChainCompetitors = [];

    for (const competitor of competitors) {
      // Must be on same chain
      if (competitor.chain !== targetChain) continue;

      const competitorSignatures = new Set(competitor.functionSignatures || []);
      
      // Calculate signature overlap
      const overlap = this._calculateSetOverlap(targetSignatures, competitorSignatures);
      
      // Consider as competitor if significant overlap
      if (overlap >= this.signatureSimilarityThreshold) {
        const commonSignatures = this._getSetIntersection(targetSignatures, competitorSignatures);
        const uniqueToCompetitor = this._getSetDifference(competitorSignatures, targetSignatures);
        
        sameChainCompetitors.push({
          name: competitor.name || competitor.address,
          address: competitor.address,
          chain: competitor.chain,
          signatureOverlap: overlap,
          commonSignatures: Array.from(commonSignatures),
          uniqueSignatures: Array.from(uniqueToCompetitor),
          metrics: {
            userCount: competitor.userCount || 0,
            transactionVolume: competitor.transactionVolume || 0,
            totalValue: competitor.totalValue || 0
          }
        });
      }
    }

    // Sort by overlap (highest first)
    sameChainCompetitors.sort((a, b) => b.signatureOverlap - a.signatureOverlap);

    return sameChainCompetitors;
  }

  /**
   * Identify cross-chain competitors (same features, different chains)
   * @private
   */
  _identifyCrossChainCompetitors(targetContract, competitors) {
    const targetChain = targetContract.chain;
    const targetFeatures = new Set(targetContract.features || []);
    
    const crossChainCompetitors = [];

    for (const competitor of competitors) {
      // Must be on different chain
      if (competitor.chain === targetChain) continue;

      const competitorFeatures = new Set(competitor.features || []);
      
      // Calculate feature overlap
      const overlap = this._calculateSetOverlap(targetFeatures, competitorFeatures);
      
      // Consider as cross-chain competitor if significant overlap
      if (overlap >= this.signatureSimilarityThreshold) {
        const commonFeatures = this._getSetIntersection(targetFeatures, competitorFeatures);
        
        crossChainCompetitors.push({
          name: competitor.name || competitor.address,
          address: competitor.address,
          chain: competitor.chain,
          featureOverlap: overlap,
          commonFeatures: Array.from(commonFeatures),
          metrics: {
            userCount: competitor.userCount || 0,
            transactionVolume: competitor.transactionVolume || 0,
            totalValue: competitor.totalValue || 0
          },
          performance: this._comparePerformance(targetContract, competitor)
        });
      }
    }

    // Sort by overlap (highest first)
    crossChainCompetitors.sort((a, b) => b.featureOverlap - a.featureOverlap);

    return crossChainCompetitors;
  }

  /**
   * Calculate feature parity percentage
   * @param {Object} targetContract - Target contract data
   * @param {Array<Object>} competitors - Array of competitor contracts
   * @returns {Object} Feature parity analysis
   */
  calculateFeatureParity(targetContract, competitors) {
    const targetFeatures = new Set(targetContract.features || []);
    const parityResults = [];

    for (const competitor of competitors) {
      const competitorFeatures = new Set(competitor.features || []);
      
      if (competitorFeatures.size === 0) continue;

      const commonFeatures = this._getSetIntersection(targetFeatures, competitorFeatures);
      const parity = (commonFeatures.size / competitorFeatures.size) * 100;

      parityResults.push({
        competitor: competitor.name || competitor.address,
        chain: competitor.chain,
        parity,
        targetFeatureCount: targetFeatures.size,
        competitorFeatureCount: competitorFeatures.size,
        commonFeatureCount: commonFeatures.size,
        missingFeatures: Array.from(this._getSetDifference(competitorFeatures, targetFeatures))
      });
    }

    // Calculate average parity
    const averageParity = parityResults.length > 0
      ? parityResults.reduce((sum, r) => sum + r.parity, 0) / parityResults.length
      : 0;

    // Sort by parity (lowest first to highlight gaps)
    parityResults.sort((a, b) => a.parity - b.parity);

    return {
      averageParity,
      parityByCompetitor: parityResults,
      targetFeatureCount: targetFeatures.size
    };
  }

  /**
   * Measure competitive velocity (feature release speed)
   * @private
   */
  _measureCompetitiveVelocity(targetContract, competitors) {
    const velocityData = [];

    // Add target
    if (targetContract.featureHistory) {
      velocityData.push({
        name: 'Target',
        chain: targetContract.chain,
        featuresAdded: targetContract.featureHistory.length,
        timeSpan: this._calculateTimeSpan(targetContract.featureHistory),
        velocity: this._calculateVelocity(targetContract.featureHistory)
      });
    }

    // Add competitors
    for (const competitor of competitors) {
      if (competitor.featureHistory && competitor.featureHistory.length > 0) {
        velocityData.push({
          name: competitor.name || competitor.address,
          chain: competitor.chain,
          featuresAdded: competitor.featureHistory.length,
          timeSpan: this._calculateTimeSpan(competitor.featureHistory),
          velocity: this._calculateVelocity(competitor.featureHistory)
        });
      }
    }

    // Sort by velocity (highest first)
    velocityData.sort((a, b) => b.velocity - a.velocity);

    const targetVelocity = velocityData.find(v => v.name === 'Target');
    const competitorMedianVelocity = this._calculateMedian(
      velocityData.filter(v => v.name !== 'Target').map(v => v.velocity)
    );

    return {
      velocityData,
      targetVelocity: targetVelocity ? targetVelocity.velocity : 0,
      competitorMedianVelocity,
      relativeVelocity: targetVelocity && competitorMedianVelocity > 0
        ? (targetVelocity.velocity / competitorMedianVelocity) * 100
        : 0
    };
  }

  /**
   * Detect competitor chain expansions
   * @private
   */
  _detectChainExpansions(competitors) {
    const expansions = [];

    for (const competitor of competitors) {
      if (competitor.chainHistory && competitor.chainHistory.length > 1) {
        const recentExpansion = competitor.chainHistory[competitor.chainHistory.length - 1];
        
        expansions.push({
          competitor: competitor.name || competitor.address,
          newChain: recentExpansion.chain,
          expansionDate: recentExpansion.date,
          initialMetrics: recentExpansion.metrics || {},
          currentChains: competitor.chainHistory.map(h => h.chain)
        });
      }
    }

    // Sort by expansion date (most recent first)
    expansions.sort((a, b) => new Date(b.expansionDate) - new Date(a.expansionDate));

    return expansions;
  }

  /**
   * Calculate set overlap (Jaccard similarity)
   * @private
   */
  _calculateSetOverlap(set1, set2) {
    const intersection = this._getSetIntersection(set1, set2);
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get set intersection
   * @private
   */
  _getSetIntersection(set1, set2) {
    return new Set([...set1].filter(x => set2.has(x)));
  }

  /**
   * Get set difference (in set1 but not in set2)
   * @private
   */
  _getSetDifference(set1, set2) {
    return new Set([...set1].filter(x => !set2.has(x)));
  }

  /**
   * Compare performance between two contracts
   * @private
   */
  _comparePerformance(target, competitor) {
    const metrics = ['userCount', 'transactionVolume', 'totalValue'];
    const comparison = {};

    for (const metric of metrics) {
      const targetValue = target[metric] || 0;
      const competitorValue = competitor[metric] || 0;
      
      comparison[metric] = {
        target: targetValue,
        competitor: competitorValue,
        difference: targetValue - competitorValue,
        ratio: competitorValue > 0 ? targetValue / competitorValue : 0
      };
    }

    return comparison;
  }

  /**
   * Calculate time span from feature history
   * @private
   */
  _calculateTimeSpan(featureHistory) {
    if (!featureHistory || featureHistory.length < 2) return 0;
    
    const dates = featureHistory.map(f => new Date(f.date)).sort((a, b) => a - b);
    const spanMs = dates[dates.length - 1] - dates[0];
    return spanMs / (1000 * 60 * 60 * 24); // Convert to days
  }

  /**
   * Calculate velocity (features per month)
   * @private
   */
  _calculateVelocity(featureHistory) {
    if (!featureHistory || featureHistory.length === 0) return 0;
    
    const timeSpanDays = this._calculateTimeSpan(featureHistory);
    if (timeSpanDays === 0) return 0;
    
    const timeSpanMonths = timeSpanDays / 30;
    return featureHistory.length / timeSpanMonths;
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
   * Calculate competitive position
   * @private
   */
  _calculateCompetitivePosition(targetContract, competitors) {
    const targetValue = targetContract.totalValue || 0;
    
    const sorted = [targetContract, ...competitors]
      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
    
    const position = sorted.findIndex(c => c.address === targetContract.address) + 1;
    
    return {
      rank: position,
      total: sorted.length,
      percentile: ((sorted.length - position) / sorted.length) * 100
    };
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      sameChainCompetitors: [],
      crossChainCompetitors: [],
      featureParity: {
        averageParity: 0,
        parityByCompetitor: [],
        targetFeatureCount: 0
      },
      competitiveVelocity: {
        velocityData: [],
        targetVelocity: 0,
        competitorMedianVelocity: 0,
        relativeVelocity: 0
      },
      chainExpansions: [],
      summary: {
        totalCompetitors: 0,
        sameChainCount: 0,
        crossChainCount: 0,
        averageFeatureParity: 0,
        competitivePosition: {
          rank: 0,
          total: 0,
          percentile: 0
        }
      }
    };
  }
}

export default CrossChainBenchmarker;
