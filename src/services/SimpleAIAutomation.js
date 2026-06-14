/**
 * Simple AI Automation - Daily checks and insights
 */
import { SimpleAIService } from './SimpleAIService.js';
import { findAll as findAllUsers } from '../api/database/UserStorage.js';
import { findByUserId } from '../api/database/ContractStorage.js';
import { findAnalysisByContractId } from '../api/database/AnalysisStorage.js';
import { MetricsHistoryStorage } from '../api/database/index.js';

export class SimpleAIAutomation {
  constructor() {
    this.aiService = new SimpleAIService();
    this.isRunning = false;
  }

  /**
   * Start automated daily checks
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🤖 Simple AI Automation started');
    
    // Run daily at 9 AM
    this.scheduleDaily();
    
    // Run initial check after 30 seconds
    setTimeout(() => this.runDailyChecks(), 30000);
  }

  scheduleDaily() {
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        await this.runDailyChecks();
      }
    }, 60000); // Check every minute
  }

  /**
   * Run daily checks for all users
   */
  async runDailyChecks() {
    try {
      console.log('🔍 Running daily AI checks...');
      
      const users = await findAllUsers();
      let processedCount = 0;
      
      for (const user of users) {
        if (!user.isActive) continue;
        
        try {
          await this.processUserContracts(user);
          processedCount++;
        } catch (error) {
          console.error(`Failed to process user ${user.id}:`, error);
        }
      }
      
      console.log(`✅ Daily AI checks completed for ${processedCount} users`);
    } catch (error) {
      console.error('Daily AI checks failed:', error);
    }
  }

  /**
   * Process all contracts for a user
   */
  async processUserContracts(user) {
    const contracts = await findByUserId(user.id);
    
    for (const contract of contracts) {
      if (!contract.isActive) continue;
      
      try {
        const analysis = await findAnalysisByContractId(contract.id);
        if (!analysis) continue;
        
        const contractData = {
          id: contract.id,
          name: contract.name,
          address: contract.targetContract.address,
          chain: contract.targetContract.chain,
          metrics: analysis.results?.summary || {}
        };

        // Generate daily insights
        const insights = await this.aiService.generateDailyInsights(user.id, contractData);
        
        // Check for anomalies
        const alert = await this.checkContractAnomalies(user.id, contractData);
        if (alert) {
          console.log(`🚨 Anomaly detected for contract ${contract.name}: ${alert.message}`);
        }
        
        // Run health check
        const healthCheck = await this.aiService.runHealthCheck(user.id, contractData);
        
        // Send email summary if user has email
        if (user.email && (insights || alert || healthCheck)) {
          await this.sendDailySummaryEmail(user, contractData, { insights, alert, healthCheck });
        }
        
        console.log(`✓ Processed contract ${contract.name} for user ${user.name}`);
        
      } catch (error) {
        console.error(`Failed to process contract ${contract.id}:`, error);
      }
    }
  }

  /**
   * Send daily summary email
   */
  async sendDailySummaryEmail(user, contractData, results) {
    try {
      const emailContent = `
        <h2>Daily AI Summary for ${contractData.name}</h2>
        <p>Here's your personalized AI analysis:</p>
        
        ${results.insights ? `
          <h3>📊 Key Insights</h3>
          <ul>
            ${results.insights.insights.map(insight => `<li>${insight}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${results.alert ? `
          <h3>🚨 Alert</h3>
          <p><strong>${results.alert.severity.toUpperCase()}:</strong> ${results.alert.message}</p>
        ` : ''}
        
        ${results.healthCheck ? `
          <h3>🏥 Health Score</h3>
          <p>Score: ${results.healthCheck.healthScore}/100</p>
        ` : ''}
        
        <p><a href="http://localhost:3000/analyzer">View Full Analysis</a></p>
      `;
      
      console.log(`📧 Sending daily summary to ${user.email} for ${contractData.name}`);
      // Email service integration would go here
      
    } catch (error) {
      console.error('Email send failed:', error);
    }
  }

  /**
   * Check for anomalies in contract data using real historical metrics
   */
  async checkContractAnomalies(userId, contractData) {
    const history = await MetricsHistoryStorage.get(userId).catch(() => []);
    if (history.length < 2) return null;

    // Use the second-most-recent snapshot as "previous"
    const previousSnapshot = history[history.length - 2];
    const previousData = { metrics: previousSnapshot };

    return this.aiService.checkForAnomalies(userId, contractData, previousData);
  }

  stop() {
    this.isRunning = false;
    console.log('🤖 Simple AI Automation stopped');
  }
}
