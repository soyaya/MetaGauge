import GeminiAIService from './GeminiAIService.js';

async function db() { return import('../api/database/index.js'); }

export class AIGrowthAdvisor {
  constructor() {
    this.gemini = GeminiAIService; // singleton instance, not a class
  }

  async generateDailyAdvice(userId) {
    // Get user's contracts and metrics
    const triggers = [
      'retention_below_average',
      'competitor_spike',
      'feature_gap',
      'churn_increase',
      'rpaw_decline',
      'bot_surge'
    ];

    for (const trigger of triggers) {
      await this.generateAdvice(trigger, userId);
    }
  }

  async generateAdvice(trigger, userId = null, contractId = null) {
    try {
      const metrics = await this.getMetrics(contractId);
      const competitors = await this.getCompetitorData(contractId);
      const prompt = this.buildPrompt(metrics, competitors, trigger);
      
      const response = await this.gemini.generateContent(prompt);
      
      const advice = {
        id: `advice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId, contractId, trigger,
        title: this.getTriggerTitle(trigger),
        message: response,
        metricName: this.getTriggerMetric(trigger),
        metricValue: metrics[this.getTriggerMetric(trigger)],
        createdAt: new Date().toISOString(),
        implemented: false, feedback: null
      };

      const { AIAdviceStorage } = await db();
      await AIAdviceStorage.append(advice);

      // Send notification
      this.sendNotification(userId, advice);
      
      return advice;
    } catch (error) {
      console.error('Advice generation failed:', error);
      return null;
    }
  }

  buildPrompt(metrics, competitors, trigger) {
    const context = `
Contract Metrics: ${JSON.stringify(metrics, null, 2)}
Competitors: ${competitors.length} analyzed
Trigger: ${trigger}
`;

    const prompts = {
      retention_below_average: `D7 retention is ${metrics.d7Retention}% which is below category average. Provide specific actionable advice.`,
      competitor_spike: `A competitor saw ${metrics.competitorGrowth}% user growth. Analyze and suggest response strategies.`,
      feature_gap: `Competitors use functions we don't have. Recommend feature priorities.`,
      churn_increase: `Churn rate increased to ${metrics.churnRate}%. Suggest retention improvements.`,
      rpaw_decline: `RPAW declined to $${metrics.rpaw}. Recommend revenue optimization.`,
      bot_surge: `Bot activity at ${metrics.botActivity}%. Suggest mitigation strategies.`
    };

    return context + prompts[trigger];
  }

  getTriggerTitle(trigger) {
    const titles = {
      retention_below_average: 'Retention Below Category Average',
      competitor_spike: 'Competitor Acquisition Spike',
      feature_gap: 'Feature Gap Detected',
      churn_increase: 'Churn Rate Increasing',
      rpaw_decline: 'Revenue Per Active Wallet Declining',
      bot_surge: 'High Bot Activity Detected'
    };
    return titles[trigger] || 'Growth Opportunity';
  }

  getTriggerMetric(trigger) {
    const metrics = {
      retention_below_average: 'd7Retention',
      competitor_spike: 'competitorGrowth',
      feature_gap: 'featureGapScore',
      churn_increase: 'churnRate',
      rpaw_decline: 'rpaw',
      bot_surge: 'botActivity'
    };
    return metrics[trigger] || 'unknown';
  }

  async getMetrics(contractId) {
    // Mock metrics - in real implementation, fetch from analysis results
    return {
      d7Retention: 45,
      churnRate: 25,
      rpaw: 150,
      botActivity: 15,
      competitorGrowth: 30,
      featureGapScore: 60
    };
  }

  async getCompetitorData(contractId) {
    // Mock competitor data
    return [];
  }

  sendNotification(userId, advice) {
    // Mock notification - integrate with WebSocket manager
    console.log(`Notification sent to ${userId}: ${advice.title}`);
  }

  adjustFrequency(userId, adviceType, feedback) {
    // Reduce frequency for thumbs-down feedback
    if (feedback === 'thumbs_down') {
      // Implementation for frequency adjustment
      console.log(`Reducing frequency for ${adviceType} for user ${userId}`);
    }
  }
}
