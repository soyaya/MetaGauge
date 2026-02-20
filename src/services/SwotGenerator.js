/**
 * SWOT Generator
 * 
 * Generates automated SWOT (Strengths, Weaknesses, Opportunities, Threats) analysis
 * by comparing target contract metrics against competitors:
 * - Strengths: Metrics > competitor median
 * - Weaknesses: Metrics < competitor * 0.8
 * - Opportunities: High-usage competitor features not in target
 * - Threats: Competitors with accelerating growth + user overlap
 * - Strategic gaps: Feature set differences
 */
export class SwotGenerator {
  constructor() {
    this.weaknessThreshold = 0.8; // 80% of competitor performance
    this.threatGrowthThreshold = 0.1; // 10% accelerating growth
    this.threatOverlapThreshold = 0.2; // 20% user overlap
  }

  /**
   * Generate complete SWOT analysis
   * @param {Object} targetMetrics - Metrics for target contract
   * @param {Array<Object>} competitorMetrics - Array of competitor metrics
   * @param {Object} ecosystemMetrics - Optional ecosystem-wide metrics
   * @returns {Object} SWOT analysis
   */
  generateSwot(targetMetrics, competitorMetrics, ecosystemMetrics = null) {
    if (!targetMetrics || !Array.isArray(competitorMetrics) || competitorMetrics.length === 0) {
      return this._getEmptySwot();
    }

    const competitorMedians = this._calculateCompetitorMedians(competitorMetrics);
    
    const strengths = this.identifyStrengths(targetMetrics, competitorMedians);
    const weaknesses = this.identifyWeaknesses(targetMetrics, competitorMetrics);
    const opportunities = this.identifyOpportunities(targetMetrics, competitorMetrics);
    const threats = this.identifyThreats(competitorMetrics, targetMetrics);
    const strategicGaps = this.calculateStrategicGaps(targetMetrics, competitorMetrics);

    return {
      strengths,
      weaknesses,
      opportunities,
      threats,
      strategicGaps,
      summary: {
        strengthCount: strengths.length,
        weaknessCount: weaknesses.length,
        opportunityCount: opportunities.length,
        threatCount: threats.length,
        overallScore: this._calculateOverallScore(strengths, weaknesses, opportunities, threats)
      }
    };
  }

  /**
   * Identify strengths (metrics > competitor median)
   * @param {Object} targetMetrics - Target contract metrics
   * @param {Object} competitorMedians - Median values from competitors
   * @returns {Array<Object>} List of strengths
   */
  identifyStrengths(targetMetrics, competitorMedians) {
    const strengths = [];
    
    // Compare key metrics
    const metricsToCompare = [
      { key: 'retentionRate', name: 'User Retention Rate', higherIsBetter: true },
      { key: 'gasEfficiency', name: 'Gas Efficiency', higherIsBetter: false }, // Lower is better
      { key: 'transactionSuccessRate', name: 'Transaction Success Rate', higherIsBetter: true },
      { key: 'averageSessionDuration', name: 'Average Session Duration', higherIsBetter: true },
      { key: 'userGrowthRate', name: 'User Growth Rate', higherIsBetter: true }
    ];

    for (const metric of metricsToCompare) {
      const targetValue = targetMetrics[metric.key];
      const medianValue = competitorMedians[metric.key];

      if (targetValue === undefined || medianValue === undefined) continue;

      let isStrength = false;
      if (metric.higherIsBetter) {
        isStrength = targetValue > medianValue;
      } else {
        isStrength = targetValue < medianValue;
      }

      if (isStrength) {
        const advantage = metric.higherIsBetter
          ? ((targetValue - medianValue) / medianValue) * 100
          : ((medianValue - targetValue) / medianValue) * 100;

        strengths.push({
          metric: metric.name,
          targetValue,
          competitorMedian: medianValue,
          advantage: Math.abs(advantage),
          description: `${metric.name} is ${advantage.toFixed(1)}% better than competitor median`
        });
      }
    }

    return strengths;
  }

  /**
   * Identify weaknesses (metrics < competitor * 0.8)
   * @param {Object} targetMetrics - Target contract metrics
   * @param {Array<Object>} competitorMetrics - Array of competitor metrics
   * @returns {Array<Object>} List of weaknesses
   */
  identifyWeaknesses(targetMetrics, competitorMetrics) {
    const weaknesses = [];
    
    const metricsToCompare = [
      { key: 'retentionRate', name: 'User Retention Rate', higherIsBetter: true },
      { key: 'gasEfficiency', name: 'Gas Efficiency', higherIsBetter: false },
      { key: 'transactionSuccessRate', name: 'Transaction Success Rate', higherIsBetter: true },
      { key: 'averageSessionDuration', name: 'Average Session Duration', higherIsBetter: true },
      { key: 'userGrowthRate', name: 'User Growth Rate', higherIsBetter: true }
    ];

    for (const metric of metricsToCompare) {
      const targetValue = targetMetrics[metric.key];
      
      if (targetValue === undefined) continue;

      // Check against each competitor
      for (const competitor of competitorMetrics) {
        const competitorValue = competitor[metric.key];
        
        if (competitorValue === undefined) continue;

        let isWeakness = false;
        const epsilon = 0.0001; // Tolerance for floating point comparison
        
        if (metric.higherIsBetter) {
          const threshold = competitorValue * this.weaknessThreshold;
          isWeakness = targetValue < (threshold - epsilon);
        } else {
          const threshold = competitorValue / this.weaknessThreshold;
          isWeakness = targetValue > (threshold + epsilon);
        }

        if (isWeakness) {
          const gap = metric.higherIsBetter
            ? ((competitorValue - targetValue) / competitorValue) * 100
            : ((targetValue - competitorValue) / competitorValue) * 100;

          weaknesses.push({
            metric: metric.name,
            targetValue,
            competitorValue,
            competitorName: competitor.name || 'Unknown',
            gap: Math.abs(gap),
            description: `${metric.name} is ${gap.toFixed(1)}% behind ${competitor.name || 'competitor'}`
          });
        }
      }
    }

    // Remove duplicates and keep worst cases
    const uniqueWeaknesses = new Map();
    for (const weakness of weaknesses) {
      const key = weakness.metric;
      if (!uniqueWeaknesses.has(key) || weakness.gap > uniqueWeaknesses.get(key).gap) {
        uniqueWeaknesses.set(key, weakness);
      }
    }

    return Array.from(uniqueWeaknesses.values());
  }

  /**
   * Identify opportunities (high-usage competitor features not in target)
   * @param {Object} targetMetrics - Target contract metrics
   * @param {Array<Object>} competitorMetrics - Array of competitor metrics
   * @returns {Array<Object>} List of opportunities
   */
  identifyOpportunities(targetMetrics, competitorMetrics) {
    const opportunities = [];
    
    const targetFeatures = new Set(targetMetrics.features || []);
    
    // Analyze competitor features
    const competitorFeatureUsage = new Map();

    for (const competitor of competitorMetrics) {
      const features = competitor.features || [];
      const usage = competitor.featureUsage || {};

      for (const feature of features) {
        if (!targetFeatures.has(feature)) {
          if (!competitorFeatureUsage.has(feature)) {
            competitorFeatureUsage.set(feature, {
              feature,
              competitors: [],
              totalUsage: 0,
              averageUsage: 0
            });
          }

          const featureData = competitorFeatureUsage.get(feature);
          featureData.competitors.push(competitor.name || 'Unknown');
          featureData.totalUsage += usage[feature] || 0;
        }
      }
    }

    // Calculate average usage and identify high-usage features
    for (const [feature, data] of competitorFeatureUsage) {
      data.averageUsage = data.totalUsage / data.competitors.length;
      
      // Consider it an opportunity if average usage is significant
      if (data.averageUsage > 0) {
        opportunities.push({
          feature,
          averageUsage: data.averageUsage,
          competitorCount: data.competitors.length,
          competitors: data.competitors,
          description: `Feature "${feature}" is used by ${data.competitors.length} competitor(s) but not implemented in target`
        });
      }
    }

    // Sort by usage (highest first)
    opportunities.sort((a, b) => b.averageUsage - a.averageUsage);

    return opportunities;
  }

  /**
   * Identify threats (competitors with accelerating growth + user overlap)
   * @param {Array<Object>} competitorMetrics - Array of competitor metrics
   * @param {Object} targetMetrics - Target contract metrics
   * @returns {Array<Object>} List of threats
   */
  identifyThreats(competitorMetrics, targetMetrics) {
    const threats = [];

    for (const competitor of competitorMetrics) {
      const growthRate = competitor.userGrowthRate || 0;
      const userOverlap = competitor.userOverlap || 0;

      // Threat if competitor has accelerating growth AND significant user overlap
      const hasAcceleratingGrowth = growthRate > this.threatGrowthThreshold;
      const hasSignificantOverlap = userOverlap > this.threatOverlapThreshold;

      if (hasAcceleratingGrowth && hasSignificantOverlap) {
        threats.push({
          competitorName: competitor.name || 'Unknown',
          growthRate,
          userOverlap,
          severity: this._calculateThreatSeverity(growthRate, userOverlap),
          description: `${competitor.name || 'Competitor'} has ${(growthRate * 100).toFixed(1)}% growth rate with ${(userOverlap * 100).toFixed(1)}% user overlap`
        });
      }
    }

    // Sort by severity (highest first)
    threats.sort((a, b) => b.severity - a.severity);

    return threats;
  }

  /**
   * Calculate strategic gaps (feature set differences)
   * @param {Object} targetMetrics - Target contract metrics
   * @param {Array<Object>} competitorMetrics - Array of competitor metrics
   * @returns {Object} Strategic gap analysis
   */
  calculateStrategicGaps(targetMetrics, competitorMetrics) {
    const targetFeatures = new Set(targetMetrics.features || []);
    
    // Find the most successful competitor
    const mostSuccessful = competitorMetrics.reduce((best, current) => {
      const currentScore = (current.retentionRate || 0) + (current.userGrowthRate || 0);
      const bestScore = (best.retentionRate || 0) + (best.userGrowthRate || 0);
      return currentScore > bestScore ? current : best;
    }, competitorMetrics[0]);

    const mostSuccessfulFeatures = new Set(mostSuccessful.features || []);

    // Calculate gaps
    const missingFeatures = Array.from(mostSuccessfulFeatures).filter(f => !targetFeatures.has(f));
    const uniqueFeatures = Array.from(targetFeatures).filter(f => !mostSuccessfulFeatures.has(f));
    const commonFeatures = Array.from(targetFeatures).filter(f => mostSuccessfulFeatures.has(f));

    const featureParity = targetFeatures.size > 0 
      ? (commonFeatures.length / mostSuccessfulFeatures.size) * 100
      : 0;

    return {
      targetFeatureCount: targetFeatures.size,
      competitorFeatureCount: mostSuccessfulFeatures.size,
      commonFeatures: commonFeatures.length,
      missingFeatures,
      uniqueFeatures,
      featureParity,
      mostSuccessfulCompetitor: mostSuccessful.name || 'Unknown',
      description: `Target has ${featureParity.toFixed(1)}% feature parity with most successful competitor`
    };
  }

  /**
   * Calculate competitor medians
   * @private
   */
  _calculateCompetitorMedians(competitorMetrics) {
    const medians = {};
    
    const metricsToCalculate = [
      'retentionRate',
      'gasEfficiency',
      'transactionSuccessRate',
      'averageSessionDuration',
      'userGrowthRate'
    ];

    for (const metric of metricsToCalculate) {
      const values = competitorMetrics
        .map(c => c[metric])
        .filter(v => v !== undefined && v !== null);

      if (values.length > 0) {
        medians[metric] = this._calculateMedian(values);
      }
    }

    return medians;
  }

  /**
   * Calculate median of an array
   * @private
   */
  _calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Calculate threat severity
   * @private
   */
  _calculateThreatSeverity(growthRate, userOverlap) {
    // Severity is a combination of growth rate and user overlap
    // Scale: 0-100
    const growthScore = Math.min(growthRate * 100, 50); // Max 50 points
    const overlapScore = Math.min(userOverlap * 100, 50); // Max 50 points
    return growthScore + overlapScore;
  }

  /**
   * Calculate overall SWOT score
   * @private
   */
  _calculateOverallScore(strengths, weaknesses, opportunities, threats) {
    // Positive: strengths + opportunities
    // Negative: weaknesses + threats
    const positive = strengths.length + opportunities.length;
    const negative = weaknesses.length + threats.length;
    const total = positive + negative;
    
    if (total === 0) return 50; // Neutral
    
    return (positive / total) * 100;
  }

  /**
   * Get empty SWOT structure
   * @private
   */
  _getEmptySwot() {
    return {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
      strategicGaps: {
        targetFeatureCount: 0,
        competitorFeatureCount: 0,
        commonFeatures: 0,
        missingFeatures: [],
        uniqueFeatures: [],
        featureParity: 0,
        mostSuccessfulCompetitor: 'Unknown',
        description: 'No data available'
      },
      summary: {
        strengthCount: 0,
        weaknessCount: 0,
        opportunityCount: 0,
        threatCount: 0,
        overallScore: 50
      }
    };
  }
}

export default SwotGenerator;
