/**
 * Gemini AI Service for Contract Analysis Interpretation
 * Provides intelligent insights, recommendations, and alerts based on analysis data
 */

import { GoogleGenAI } from '@google/genai';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map();

class GeminiAIService {
  constructor() {
    this.genAI = null;
    this.enabled = null;
    this.initialized = false;
  }

  /**
   * Initialize the service lazily
   */
  initialize() {
    if (this.initialized) return;

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured - AI features will be disabled');
      this.enabled = false;
      this.initialized = true;
      return;
    }

    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.enabled = true;
    this.initialized = true;
  }

  /**
   * Check rate limit for AI requests
   */
  checkRateLimit(userId = 'anonymous') {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 50; // 50 requests per 15 minutes per user

    const record = rateLimitStore.get(userId);
    
    if (!record || now > record.resetTime) {
      rateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (record.count >= maxRequests) {
      return false;
    }
    
    record.count++;
    return true;
  }

  /**
   * Generate AI interpretation of analysis results
   */
  async interpretAnalysis(analysisResults, analysisType = 'single', userId = 'anonymous') {
    this.initialize();
    
    if (!this.enabled) {
      return this.getFallbackInterpretation(analysisResults);
    }

    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const prompt = this.buildInterpretationPrompt(analysisResults, analysisType);
      
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite', // Latest model for best performance
        contents: [
          {
            text: prompt,
          },
        ],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent analysis
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      });
      
      let jsonResponse = response.text || '';
      
      // Clean up response - remove markdown formatting if present
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to parse the JSON
      let interpretation;
      try {
        interpretation = JSON.parse(jsonResponse);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          interpretation = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response from Gemini');
        }
      }
      
      return {
        success: true,
        interpretation,
        generatedAt: new Date().toISOString(),
        model: 'gemini-2.5-flash-lite'
      };

    } catch (error) {
      console.error('Gemini AI interpretation error:', error);
      return {
        success: false,
        error: error.message,
        fallback: this.getFallbackInterpretation(analysisResults)
      };
    }
  }

  /**
   * Build comprehensive prompt for analysis interpretation
   */
  buildInterpretationPrompt(analysisResults, analysisType) {
    const { target, competitors, comparative } = analysisResults.results || {};
    const metadata = analysisResults.metadata || {};

    return `
You are an expert blockchain analyst. Analyze the following smart contract data and provide actionable insights.

ANALYSIS DATA:
${JSON.stringify({
  analysisType,
  target: {
    contract: target?.contract,
    transactions: target?.transactions,
    metrics: target?.metrics,
    behavior: target?.behavior,
    fullReport: target?.fullReport
  },
  competitors: competitors?.map(c => ({
    contract: c.contract,
    transactions: c.transactions,
    metrics: c.metrics,
    error: c.error
  })),
  comparative,
  metadata
}, null, 2)}

Provide a comprehensive analysis in the following JSON format (return ONLY valid JSON):

{
  "summary": {
    "overallHealth": "excellent|good|fair|poor",
    "keyFindings": ["finding1", "finding2", "finding3"],
    "riskLevel": "low|medium|high|critical",
    "performanceScore": 85
  },
  "insights": {
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "opportunities": ["opportunity1", "opportunity2"],
    "threats": ["threat1", "threat2"]
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "security|performance|growth|optimization",
      "title": "Recommendation title",
      "description": "Detailed recommendation",
      "impact": "Expected impact description",
      "effort": "low|medium|high"
    }
  ],
  "alerts": [
    {
      "severity": "critical|warning|info",
      "category": "security|performance|liquidity|usage",
      "title": "Alert title",
      "message": "Alert description",
      "actionRequired": true,
      "suggestedAction": "What to do about this alert"
    }
  ],
  "marketPosition": {
    "competitiveRanking": "1st|2nd|3rd|etc",
    "marketShare": "estimated percentage or description",
    "differentiators": ["unique aspect 1", "unique aspect 2"],
    "competitiveAdvantages": ["advantage 1", "advantage 2"]
  },
  "technicalAnalysis": {
    "gasEfficiency": "excellent|good|fair|poor",
    "codeQuality": "high|medium|low",
    "securityPosture": "strong|moderate|weak",
    "scalabilityAssessment": "highly scalable|moderately scalable|limited scalability"
  },
  "actionItems": [
    {
      "timeframe": "immediate|short-term|medium-term|long-term",
      "action": "Specific action to take",
      "expectedOutcome": "What this should achieve",
      "priority": "high|medium|low"
    }
  ]
}

ANALYSIS GUIDELINES:
- Focus on actionable insights based on the actual data
- Consider transaction patterns, user behavior, and financial metrics
- Compare against competitors if available
- Identify security risks, performance issues, and growth opportunities
- Provide specific, measurable recommendations
- Use blockchain and DeFi terminology appropriately
- Be objective and data-driven in your assessment
- If data is limited, acknowledge limitations but still provide valuable insights
`;
  }

  /**
   * Generate quick insights for real-time display
   */
  async generateQuickInsights(analysisResults, userId = 'anonymous') {
    this.initialize();
    
    if (!this.enabled) {
      return this.getFallbackQuickInsights(analysisResults);
    }

    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const prompt = `
Analyze this smart contract data and provide 3-5 quick insights in JSON format:

${JSON.stringify(analysisResults.results?.target?.fullReport || analysisResults.results?.target, null, 2)}

Return ONLY this JSON structure (no additional text or explanations):
{
  "insights": [
    "Insight 1 (one sentence)",
    "Insight 2 (one sentence)",
    "Insight 3 (one sentence)"
  ],
  "score": 85,
  "status": "healthy|concerning|critical",
  "keyMetrics": {
    "transactionVolume": "high|medium|low",
    "userGrowth": "growing|stable|declining",
    "gasEfficiency": "excellent|good|poor"
  }
}

Important rules:
- Return ONLY valid JSON, no markdown or explanations
- Keep insights concise and actionable
- Base score on actual performance metrics
- Use null for any field that cannot be determined
`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      });

      let jsonResponse = response.text || '';
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonResponse);
      } catch (parseError) {
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }
      
      return parsed;

    } catch (error) {
      console.error('Quick insights error:', error);
      return this.getFallbackQuickInsights(analysisResults);
    }
  }

  /**
   * Generate recommendations based on specific metrics
   */
  async generateRecommendations(metrics, contractType = 'defi', userId = 'anonymous') {
    this.initialize();
    
    if (!this.enabled) {
      return this.getFallbackRecommendations(metrics);
    }

    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const prompt = `
As a blockchain expert, analyze these contract metrics and provide specific recommendations:

METRICS:
${JSON.stringify(metrics, null, 2)}

CONTRACT TYPE: ${contractType}

Provide recommendations in JSON format (return ONLY valid JSON):
{
  "recommendations": [
    {
      "category": "performance|security|growth|optimization",
      "priority": "high|medium|low",
      "title": "Short title",
      "description": "Detailed recommendation",
      "expectedImpact": "What this will achieve",
      "implementationEffort": "low|medium|high",
      "timeframe": "immediate|short-term|medium-term|long-term"
    }
  ],
  "priorityActions": [
    "Most critical action to take immediately",
    "Second priority action"
  ],
  "riskAssessment": {
    "currentRisk": "low|medium|high|critical",
    "riskFactors": ["factor1", "factor2"],
    "mitigationSteps": ["step1", "step2"]
  }
}

Important rules:
- Return ONLY valid JSON, no markdown or explanations
- Focus on actionable, specific recommendations
- Prioritize based on impact and urgency
- Consider gas optimization, security, and user experience
`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });

      let jsonResponse = response.text || '';
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonResponse);
      } catch (parseError) {
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }
      
      return parsed;

    } catch (error) {
      console.error('Recommendations error:', error);
      return this.getFallbackRecommendations(metrics);
    }
  }

  /**
   * Generate real-time alerts based on analysis data and user configuration
   */
  async generateRealTimeAlerts(analysisResults, previousResults = null, userId = 'anonymous', userConfig = null) {
    this.initialize();
    
    if (!this.enabled) {
      return this.getFallbackAlerts(analysisResults);
    }

    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      // Build alert criteria based on user configuration
      const alertCriteria = this.buildAlertCriteria(userConfig);
      
      const prompt = `
Analyze this smart contract data and generate real-time alerts based on user preferences:

CURRENT ANALYSIS:
${JSON.stringify(analysisResults.results?.target?.fullReport || analysisResults.results?.target, null, 2)}

${previousResults ? `
PREVIOUS ANALYSIS (for comparison):
${JSON.stringify(previousResults.results?.target?.fullReport || previousResults.results?.target, null, 2)}
` : ''}

USER ALERT PREFERENCES:
${JSON.stringify(alertCriteria, null, 2)}

Generate alerts in JSON format (return ONLY valid JSON):
{
  "alerts": [
    {
      "id": "unique-alert-id",
      "severity": "critical|high|medium|low",
      "category": "security|performance|liquidity|anomaly|growth",
      "title": "Alert title",
      "message": "Detailed alert message",
      "timestamp": "${new Date().toISOString()}",
      "actionRequired": true,
      "suggestedActions": ["action1", "action2"],
      "metrics": {
        "currentValue": "current metric value",
        "threshold": "threshold that was crossed",
        "change": "percentage or absolute change"
      }
    }
  ],
  "summary": {
    "totalAlerts": 0,
    "criticalCount": 0,
    "newAlertsCount": 0,
    "overallRiskLevel": "low|medium|high|critical"
  }
}

IMPORTANT RULES:
- Only generate alerts for enabled categories: ${alertCriteria.enabledCategories.join(', ')}
- Only include severity levels: ${alertCriteria.enabledSeverities.join(', ')}
- Check custom thresholds: ${JSON.stringify(alertCriteria.thresholds)}
- Return ONLY valid JSON, no markdown
- Focus on actionable alerts
- Use unique IDs for each alert
- Be conservative - only alert on significant issues
`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3072,
        },
      });

      let jsonResponse = response.text || '';
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonResponse);
      } catch (parseError) {
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }
      
      // Filter alerts based on user preferences
      if (userConfig) {
        parsed.alerts = this.filterAlertsByConfig(parsed.alerts, userConfig);
        parsed.summary.totalAlerts = parsed.alerts.length;
        parsed.summary.criticalCount = parsed.alerts.filter(a => a.severity === 'critical').length;
      }
      
      return parsed;

    } catch (error) {
      console.error('Real-time alerts error:', error);
      return this.getFallbackAlerts(analysisResults);
    }
  }

  /**
   * Build alert criteria from user configuration
   */
  buildAlertCriteria(userConfig) {
    if (!userConfig) {
      return {
        enabledCategories: ['security', 'performance', 'liquidity', 'anomaly', 'growth'],
        enabledSeverities: ['critical', 'high', 'medium', 'low'],
        thresholds: {}
      };
    }

    const enabledCategories = Object.entries(userConfig.categories || {})
      .filter(([_, enabled]) => enabled)
      .map(([category]) => category);

    const enabledSeverities = Object.entries(userConfig.severityLevels || {})
      .filter(([_, enabled]) => enabled)
      .map(([severity]) => severity);

    const thresholds = Object.entries(userConfig.thresholds || {})
      .filter(([_, config]) => config.enabled)
      .reduce((acc, [key, config]) => {
        acc[key] = { value: config.value, unit: config.unit };
        return acc;
      }, {});

    return { enabledCategories, enabledSeverities, thresholds };
  }

  /**
   * Filter alerts based on user configuration
   */
  filterAlertsByConfig(alerts, userConfig) {
    if (!userConfig) return alerts;

    return alerts.filter(alert => {
      // Check category
      if (userConfig.categories && !userConfig.categories[alert.category]) {
        return false;
      }

      // Check severity
      if (userConfig.severityLevels && !userConfig.severityLevels[alert.severity]) {
        return false;
      }

      return true;
    });
  }

  /**
   * Generate market sentiment analysis
   */
  async generateMarketSentiment(analysisResults, marketData = null, userId = 'anonymous') {
    this.initialize();
    
    if (!this.enabled) {
      return this.getFallbackSentiment();
    }

    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const prompt = `
Analyze the market sentiment and positioning for this smart contract:

CONTRACT DATA:
${JSON.stringify(analysisResults.results?.target?.fullReport || analysisResults.results?.target, null, 2)}

${marketData ? `
MARKET DATA:
${JSON.stringify(marketData, null, 2)}
` : ''}

COMPETITOR DATA:
${JSON.stringify(analysisResults.results?.competitors || [], null, 2)}

Generate sentiment analysis in JSON format (return ONLY valid JSON):
{
  "sentiment": {
    "overall": "bullish|bearish|neutral",
    "confidence": 85,
    "factors": [
      {
        "factor": "Transaction Volume",
        "impact": "positive|negative|neutral",
        "weight": 0.3,
        "description": "Explanation of impact"
      }
    ]
  },
  "marketPosition": {
    "strength": "strong|moderate|weak",
    "competitiveAdvantage": ["advantage1", "advantage2"],
    "marketShare": "estimated percentage or description",
    "growthPotential": "high|medium|low",
    "riskFactors": ["risk1", "risk2"]
  },
  "predictions": {
    "shortTerm": "1-week outlook",
    "mediumTerm": "1-month outlook",
    "longTerm": "3-month outlook",
    "keyMetricsToWatch": ["metric1", "metric2"]
  },
  "investmentThesis": {
    "bullishCase": "Why this could perform well",
    "bearishCase": "Potential risks and concerns",
    "neutralCase": "Balanced perspective"
  }
}

Important rules:
- Return ONLY valid JSON, no markdown or explanations
- Base analysis on actual metrics, user behavior, and competitive positioning
- Be objective and data-driven
- Consider both technical and fundamental factors
`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 3072,
        },
      });

      let jsonResponse = response.text || '';
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonResponse);
      } catch (parseError) {
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }
      
      return parsed;

    } catch (error) {
      console.error('Market sentiment error:', error);
      return this.getFallbackSentiment();
    }
  }

  /**
   * Generate optimization suggestions
   */
  async generateOptimizationSuggestions(analysisResults, contractType = 'defi', userId = 'anonymous') {
    this.initialize();
    
    if (!this.enabled) {
      return this.getFallbackOptimizations();
    }

    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const prompt = `
Analyze this ${contractType} smart contract and provide specific optimization suggestions:

CONTRACT ANALYSIS:
${JSON.stringify(analysisResults.results?.target?.fullReport || analysisResults.results?.target, null, 2)}

Generate optimization suggestions in JSON format (return ONLY valid JSON):
{
  "optimizations": [
    {
      "category": "gas|security|performance|user-experience|liquidity",
      "priority": "critical|high|medium|low",
      "title": "Optimization title",
      "description": "Detailed description of the optimization",
      "currentIssue": "What problem this solves",
      "proposedSolution": "Specific solution to implement",
      "expectedBenefit": "Quantified benefit (e.g., 20% gas reduction)",
      "implementationComplexity": "low|medium|high",
      "estimatedCost": "development cost estimate",
      "timeline": "estimated implementation time"
    }
  ],
  "quickWins": [
    {
      "action": "Easy optimization to implement immediately",
      "benefit": "Expected immediate benefit",
      "effort": "minimal|low|medium"
    }
  ],
  "longTermStrategy": {
    "vision": "Long-term optimization strategy",
    "milestones": ["milestone1", "milestone2"],
    "expectedOutcome": "Overall expected improvement"
  },
  "performanceMetrics": {
    "currentGasUsage": "current average gas per transaction",
    "optimizedGasUsage": "projected gas usage after optimizations",
    "potentialSavings": "estimated cost savings"
  }
}

Important rules:
- Return ONLY valid JSON, no markdown or explanations
- Focus on practical, implementable optimizations
- Provide specific, measurable benefits
- Consider both technical and business impact
- Prioritize based on ROI and implementation difficulty
`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      });

      let jsonResponse = response.text || '';
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonResponse);
      } catch (parseError) {
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }
      
      return parsed;

    } catch (error) {
      console.error('Optimization suggestions error:', error);
      return this.getFallbackOptimizations();
    }
  }
  getFallbackInterpretation(analysisResults) {
    const target = analysisResults.results?.target;
    const transactions = target?.transactions || 0;
    const metrics = target?.metrics || {};
    const fullReport = target?.fullReport || {};

    return {
      summary: {
        overallHealth: transactions > 1000 ? 'good' : transactions > 100 ? 'fair' : 'poor',
        keyFindings: [
          `Contract processed ${transactions.toLocaleString()} transactions`,
          `Analysis completed for ${target?.contract?.chain || 'unknown'} chain`,
          fullReport.summary?.successRate ? `${fullReport.summary.successRate}% success rate` : 'Transaction data analyzed'
        ],
        riskLevel: 'medium',
        performanceScore: Math.min(100, Math.max(0, (transactions / 10) + 50))
      },
      insights: {
        strengths: ['Contract is operational', 'Transaction history available'],
        weaknesses: ['Limited analysis without AI interpretation'],
        opportunities: ['Enable AI analysis for deeper insights'],
        threats: ['Manual analysis may miss important patterns']
      },
      recommendations: [
        {
          priority: 'high',
          category: 'optimization',
          title: 'Enable AI Analysis',
          description: 'Configure Gemini API key to unlock intelligent insights and recommendations',
          impact: 'Get automated security alerts, performance recommendations, and competitive analysis',
          effort: 'low'
        }
      ],
      alerts: [],
      marketPosition: {
        competitiveRanking: 'Unknown',
        marketShare: 'Requires AI analysis',
        differentiators: [],
        competitiveAdvantages: []
      },
      technicalAnalysis: {
        gasEfficiency: 'unknown',
        codeQuality: 'unknown',
        securityPosture: 'unknown',
        scalabilityAssessment: 'unknown'
      },
      actionItems: [
        {
          timeframe: 'immediate',
          action: 'Configure GEMINI_API_KEY environment variable',
          expectedOutcome: 'Enable AI-powered analysis and recommendations',
          priority: 'high'
        }
      ]
    };
  }

  /**
   * Fallback quick insights
   */
  getFallbackQuickInsights(analysisResults) {
    const target = analysisResults.results?.target;
    const transactions = target?.transactions || 0;

    return {
      insights: [
        `Contract has ${transactions.toLocaleString()} transactions`,
        'Analysis completed successfully',
        'Enable AI for deeper insights'
      ],
      score: Math.min(100, Math.max(20, (transactions / 10) + 40)),
      status: transactions > 500 ? 'healthy' : 'concerning'
    };
  }

  /**
   * Fallback recommendations
   */
  getFallbackRecommendations(metrics) {
    return {
      recommendations: [
        {
          category: 'optimization',
          priority: 'high',
          title: 'Enable AI Analysis',
          description: 'Configure Gemini API to get intelligent recommendations based on your contract metrics',
          expectedImpact: 'Automated insights and actionable recommendations'
        }
      ]
    };
  }

  /**
   * Check if AI service is enabled
   */
  isEnabled() {
    this.initialize();
    return this.enabled;
  }

  /**
   * Fallback alerts
   */
  getFallbackAlerts(analysisResults) {
    return {
      alerts: [
        {
          id: 'ai-disabled',
          severity: 'medium',
          category: 'performance',
          title: 'AI Analysis Disabled',
          message: 'Enable Gemini AI for real-time alerts and advanced monitoring',
          timestamp: new Date().toISOString(),
          actionRequired: true,
          suggestedActions: ['Configure GEMINI_API_KEY', 'Restart application'],
          metrics: {
            currentValue: 'disabled',
            threshold: 'enabled',
            change: 'N/A'
          }
        }
      ],
      summary: {
        totalAlerts: 1,
        criticalCount: 0,
        newAlertsCount: 1,
        overallRiskLevel: 'medium'
      }
    };
  }

  /**
   * Fallback sentiment analysis
   */
  getFallbackSentiment() {
    return {
      sentiment: {
        overall: 'neutral',
        confidence: 50,
        factors: [
          {
            factor: 'AI Analysis Disabled',
            impact: 'neutral',
            weight: 1.0,
            description: 'Cannot determine sentiment without AI analysis'
          }
        ]
      },
      marketPosition: {
        strength: 'unknown',
        competitiveAdvantage: ['Requires AI analysis'],
        marketShare: 'Unknown',
        growthPotential: 'unknown',
        riskFactors: ['Limited analysis capabilities']
      },
      predictions: {
        shortTerm: 'Enable AI for predictions',
        mediumTerm: 'Enable AI for predictions',
        longTerm: 'Enable AI for predictions',
        keyMetricsToWatch: ['Transaction volume', 'User growth']
      },
      investmentThesis: {
        bullishCase: 'Enable AI analysis for detailed thesis',
        bearishCase: 'Enable AI analysis for detailed thesis',
        neutralCase: 'Insufficient data without AI analysis'
      }
    };
  }

  /**
   * Fallback optimizations
   */
  getFallbackOptimizations() {
    return {
      optimizations: [
        {
          category: 'performance',
          priority: 'high',
          title: 'Enable AI-Powered Optimization Analysis',
          description: 'Configure Gemini AI to get detailed optimization suggestions',
          currentIssue: 'Limited optimization insights without AI',
          proposedSolution: 'Enable AI analysis for comprehensive optimization recommendations',
          expectedBenefit: 'Detailed gas optimization and performance improvements',
          implementationComplexity: 'low',
          estimatedCost: 'Free (API usage)',
          timeline: 'Immediate'
        }
      ],
      quickWins: [
        {
          action: 'Configure GEMINI_API_KEY environment variable',
          benefit: 'Unlock AI-powered optimization suggestions',
          effort: 'minimal'
        }
      ],
      longTermStrategy: {
        vision: 'Enable comprehensive AI analysis for continuous optimization',
        milestones: ['Configure AI', 'Regular analysis', 'Implement suggestions'],
        expectedOutcome: 'Improved performance and reduced costs'
      },
      performanceMetrics: {
        currentGasUsage: 'Unknown without AI analysis',
        optimizedGasUsage: 'Requires AI analysis',
        potentialSavings: 'Enable AI for estimates'
      }
    };
  }
}

export default new GeminiAIService();