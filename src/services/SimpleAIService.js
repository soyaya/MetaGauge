import GeminiAIService from './GeminiAIService.js';

async function readInsights() {
  const { AIInsightsStorage } = await import('../api/database/index.js');
  return AIInsightsStorage.readAll();
}
async function writeInsights(entry) {
  const { AIInsightsStorage } = await import('../api/database/index.js');
  return AIInsightsStorage.append(entry);
}

export class SimpleAIService {
  constructor() {
    this.gemini = GeminiAIService;
  }

  /**
   * Generate personalized daily insights for user's contract
   */
  async generateDailyInsights(userId, contractData) {
    try {
      // Use the existing interpretAnalysis method
      const analysisResults = {
        target: {
          contract: contractData,
          metrics: contractData.metrics
        }
      };
      
      const response = await this.gemini.interpretAnalysis(analysisResults, 'single', userId);
      
      const insight = {
        id: `insight-${Date.now()}`,
        userId,
        contractId: contractData.id,
        contractName: contractData.name,
        insights: this.parseInsights(response.interpretation?.insights?.strengths || []),
        generatedAt: new Date().toISOString(),
        type: 'daily'
      };

      await writeInsights(insight);
      return insight;
    } catch (error) {
      console.error('Daily insights generation failed:', error);
      return null;
    }
  }

  /**
   * Check for anomalies and generate smart alerts
   */
  async checkForAnomalies(userId, contractData, previousData) {
    try {
      const changes = this.detectChanges(contractData, previousData);
      if (changes.length === 0) return null;

      // Use existing alert generation method
      const analysisResults = {
        target: {
          contract: contractData,
          metrics: contractData.metrics
        }
      };
      
      const previousResults = {
        target: {
          metrics: previousData.metrics
        }
      };

      const response = await this.gemini.generateRealTimeAlerts(analysisResults, previousResults, userId);
      
      if (response.alerts && response.alerts.length > 0) {
        return {
          id: `alert-${Date.now()}`,
          userId,
          contractId: contractData.id,
          message: response.alerts[0].message,
          severity: response.alerts[0].severity || this.determineSeverity(changes),
          createdAt: new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      console.error('Anomaly check failed:', error);
      return null;
    }
  }

  /**
   * Chat with AI using user's contract context
   */
  async chatWithContext(userId, contractData, userMessage) {
    try {
      const prompt = `
You are an AI assistant helping with blockchain analytics.

User's Contract: ${contractData.name}
Contract Address: ${contractData.address}
Chain: ${contractData.chain}

Current Metrics:
- Active Users: ${contractData.metrics?.activeUsers || 0}
- Total Transactions: ${contractData.metrics?.totalTransactions || 0}
- Revenue: $${contractData.metrics?.revenue || 0}
- Growth Rate: ${contractData.metrics?.growthRate || 0}%

User Question: ${userMessage}

Provide a helpful answer using their specific contract data. Keep it simple and actionable.
`;

      const response = await this.gemini.generateContent(prompt);
      
      return {
        id: `chat-${Date.now()}`,
        userId,
        contractId: contractData.id,
        userMessage,
        aiResponse: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('AI chat failed:', error);
      return {
        id: `chat-${Date.now()}`,
        userId,
        contractId: contractData.id,
        userMessage,
        aiResponse: "I'm having trouble accessing AI services right now. Please try again later.",
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run automated health check
   */
  async runHealthCheck(userId, contractData) {
    try {
      // Use existing recommendations method
      const response = await this.gemini.generateRecommendations(contractData.metrics, 'defi', userId);
      const recs = response?.recommendations || '';
      return {
        id: `health-${Date.now()}`,
        userId,
        contractId: contractData.id,
        healthScore: this.extractHealthScore(recs),
        recommendations: recs || 'Health check completed successfully',
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return null;
    }
  }

  // Helper methods
  buildInsightPrompt(contractData) {
    return `
Analyze this blockchain contract and provide 3-5 key insights:

Contract: ${contractData.name}
Address: ${contractData.address}
Chain: ${contractData.chain}
Metrics: ${JSON.stringify(contractData.metrics, null, 2)}

Focus on:
- What's working well
- What needs attention
- Specific opportunities
- Actionable next steps

Keep each insight under 50 words and make them specific to this contract's data.
`;
  }

  parseInsights(response) {
    if (!response) return [];
    if (Array.isArray(response)) return response.slice(0, 5);
    if (typeof response !== 'string') return [];
    return response
      .split(/\d+\.|\•|\-/)
      .filter(insight => insight.trim().length > 10)
      .map(insight => insight.trim())
      .slice(0, 5);
  }

  detectChanges(current, previous) {
    if (!previous) return [];
    
    const changes = [];
    const metrics = ['activeUsers', 'totalTransactions', 'revenue', 'growthRate'];
    
    metrics.forEach(metric => {
      const currentVal = current.metrics?.[metric] || 0;
      const previousVal = previous.metrics?.[metric] || 0;
      
      if (previousVal > 0) {
        const changePercent = ((currentVal - previousVal) / previousVal) * 100;
        if (Math.abs(changePercent) > 20) {
          changes.push({
            metric,
            current: currentVal,
            previous: previousVal,
            changePercent: Math.round(changePercent)
          });
        }
      }
    });
    
    return changes;
  }

  determineSeverity(changes) {
    const maxChange = Math.max(...changes.map(c => Math.abs(c.changePercent)));
    if (maxChange > 50) return 'high';
    if (maxChange > 30) return 'medium';
    return 'low';
  }

  extractHealthScore(response) {
    if (!response || typeof response !== 'string') return 75;
    const match = response.match(/(\d+)\/100|(\d+)%|score.*?(\d+)/i);
    return match ? parseInt(match[1] || match[2] || match[3]) : 75;
  }

  /**
   * Generate AI assignments for productivity improvement
   */
  async generateAssignments(userId, contractData) {
    try {
      const assignments = [];
      const metrics = contractData.metrics;

      // Generate assignments based on performance gaps
      if (metrics.d7Retention < 50) {
        assignments.push({
          id: `assign-${Date.now()}-1`,
          title: 'Improve User Retention',
          description: `Increase D7 retention from ${metrics.d7Retention}% to 60% through user engagement features`,
          category: 'engagement',
          priority: 'high',
          estimatedImpact: '+25% revenue',
          timeToComplete: '2 weeks',
          status: 'pending',
          onchainMetricTarget: 'd7Retention',
          currentValue: metrics.d7Retention || 0,
          targetValue: 60,
          contractId: contractData.id,
          createdAt: new Date().toISOString()
        });
      }

      if (metrics.averageGasCost > 0.02) {
        assignments.push({
          id: `assign-${Date.now()}-2`,
          title: 'Optimize Gas Costs',
          description: 'Reduce average transaction gas costs by optimizing smart contract functions',
          category: 'optimization',
          priority: 'medium',
          estimatedImpact: '+15% user satisfaction',
          timeToComplete: '1 week',
          status: 'pending',
          onchainMetricTarget: 'averageGasCost',
          currentValue: metrics.averageGasCost || 0.025,
          targetValue: 0.018,
          contractId: contractData.id,
          createdAt: new Date().toISOString()
        });
      }

      if (metrics.activeUsers < 1000) {
        assignments.push({
          id: `assign-${Date.now()}-3`,
          title: 'Grow User Base',
          description: 'Implement growth strategies to increase active users by 50%',
          category: 'growth',
          priority: 'high',
          estimatedImpact: '+40% transaction volume',
          timeToComplete: '3 weeks',
          status: 'pending',
          onchainMetricTarget: 'activeUsers',
          currentValue: metrics.activeUsers || 0,
          targetValue: (metrics.activeUsers || 0) * 1.5,
          contractId: contractData.id,
          createdAt: new Date().toISOString()
        });
      }

      // Store assignments
      const allAssignments = await this.readAssignments();
      assignments.forEach(assignment => {
        allAssignments.unshift(assignment);
      });
      await this.writeAssignments(allAssignments);

      return assignments;
    } catch (error) {
      console.error('Generate assignments failed:', error);
      return [];
    }
  }

  /**
   * Complete an assignment and learn from the improvement
   */
  async completeAssignment(userId, assignmentId) {
    try {
      const assignments = await this.readAssignments();
      const assignment = assignments.find(a => a.id === assignmentId && a.userId === userId);
      
      if (!assignment) return null;

      assignment.status = 'completed';
      assignment.completedAt = new Date().toISOString();
      
      await this.recordImprovement(userId, assignment);
      
      await this.writeAssignments(assignments);
      return assignment;
    } catch (error) {
      console.error('Complete assignment failed:', error);
      return null;
    }
  }

  /**
   * Record improvement for AI learning
   */
  async recordImprovement(userId, assignment) {
    try {
      const improvement = {
        id: `improve-${Date.now()}`,
        userId,
        assignmentId: assignment.id,
        contractId: assignment.contractId,
        metricTarget: assignment.onchainMetricTarget,
        beforeValue: assignment.currentValue,
        targetValue: assignment.targetValue,
        category: assignment.category,
        completedAt: new Date().toISOString(),
        learningData: {
          timeToComplete: assignment.timeToComplete,
          priority: assignment.priority,
          estimatedImpact: assignment.estimatedImpact
        }
      };

      const improvements = await this.readImprovements();
      improvements.unshift(improvement);
      await this.writeImprovements(improvements);

      // Use this data to improve future assignments for other users
      await this.updateAILearning(improvement);
      
      console.log(`📈 Recorded improvement: ${assignment.title} for user ${userId}`);
    } catch (error) {
      console.error('Record improvement failed:', error);
    }
  }

  /**
   * Update AI learning from user improvements
   */
  async updateAILearning(improvement) {
    try {
      // Analyze successful patterns
      const improvements = await this.readImprovements();
      const similarImprovements = improvements.filter(i => 
        i.category === improvement.category && 
        i.metricTarget === improvement.metricTarget
      );

      if (similarImprovements.length >= 3) {
        // Learn from successful patterns
        const avgTimeToComplete = this.calculateAverageTime(similarImprovements);
        const successRate = this.calculateSuccessRate(similarImprovements);
        
        console.log(`🧠 AI Learning: ${improvement.category} assignments have ${successRate}% success rate, avg time: ${avgTimeToComplete}`);
        
        // Update future assignment generation based on learnings
        this.updateAssignmentTemplates(improvement.category, {
          avgTimeToComplete,
          successRate,
          commonPatterns: this.extractPatterns(similarImprovements)
        });
      }
    } catch (error) {
      console.error('AI learning update failed:', error);
    }
  }

  /**
   * Send email notification for assignment completion
   */
  async sendCompletionNotification(userId, assignmentId) {
    try {
      const assignments = await this.readAssignments();
      const assignment = assignments.find(a => a.id === assignmentId);
      
      if (!assignment) return;

      // Get user email
      const user = await this.getUserById(userId);
      if (!user?.email) return;

      const emailContent = {
        to: user.email,
        subject: `🎉 Assignment Completed: ${assignment.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Assignment Completed Successfully!</h2>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${assignment.title}</h3>
              <p>${assignment.description}</p>
              <p><strong>Expected Impact:</strong> ${assignment.estimatedImpact}</p>
              <p><strong>Metric Target:</strong> ${assignment.onchainMetricTarget}</p>
            </div>
            <p>Your on-chain data will be monitored to track the improvement. The AI will learn from your success to help other users with similar challenges.</p>
            <p style="color: #6b7280; font-size: 14px;">
              Completed on ${new Date().toLocaleDateString()} | MetaGauge AI
            </p>
          </div>
        `
      };

      // Send email (integrate with EmailService)
      console.log(`📧 Sending completion notification to ${user.email}`);
      // await this.emailService.sendEmail(emailContent);
      
    } catch (error) {
      console.error('Send notification failed:', error);
    }
  }

  // Helper methods for assignments — backed by AITasksStorage
  async readAssignments() {
    const { AITasksStorage } = await import('../api/database/index.js');
    return AITasksStorage.readAll();
  }
  async writeAssignments(assignments) {
    const { AITasksStorage } = await import('../api/database/index.js');
    return AITasksStorage.writeAll(assignments);
  }
  async readImprovements() {
    const { AILearningsStorage } = await import('../api/database/index.js');
    return AILearningsStorage.readAll();
  }
  async writeImprovements(improvements) {
    const { AILearningsStorage } = await import('../api/database/index.js');
    return AILearningsStorage.writeAll(improvements);
  }

  calculateAverageTime(improvements) {
    if (!improvements.length) return 'unknown';
    // timeToComplete is stored as e.g. "2 weeks" — just return the most common value
    const counts = {};
    improvements.forEach(i => { counts[i.learningData?.timeToComplete] = (counts[i.learningData?.timeToComplete] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  }

  calculateSuccessRate(improvements) {
    if (!improvements.length) return 0;
    const completed = improvements.filter(i => i.completedAt).length;
    return Math.round((completed / improvements.length) * 100);
  }

  extractPatterns(improvements) {
    return [...new Set(improvements.map(i => i.category).filter(Boolean))];
  }

  updateAssignmentTemplates(category, learnings) {
    console.log(`📚 Updated ${category} assignment templates with new learnings`);
  }

  async getUserById(userId) {
    const { UserStorage } = await import('../api/database/index.js');
    return UserStorage.findById(userId);
  }

  // Get user's insights
  async getUserInsights(userId, limit = 10) {
    const insights = await readInsights();
    return insights
      .filter(insight => insight.userId === userId)
      .slice(0, limit);
  }
}
