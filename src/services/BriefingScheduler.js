/**
 * BriefingScheduler - Daily, weekly, monthly briefings
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import GeminiAIService from './GeminiAIService.js';

const BRIEFINGS_FILE = './data/briefings.json';

function readBriefings() {
  if (!existsSync(BRIEFINGS_FILE)) return [];
  try { return JSON.parse(readFileSync(BRIEFINGS_FILE, 'utf8')); } catch { return []; }
}

function writeBriefings(briefings) {
  writeFileSync(BRIEFINGS_FILE, JSON.stringify(briefings, null, 2), 'utf8');
}

export class BriefingScheduler {
  constructor() {
    this.gemini = GeminiAIService; // singleton instance
  }

  initialize() {
    // Schedule briefings
    this.scheduleDailyBrief();
    this.scheduleWeeklyStrategy();
    this.scheduleMonthlyBoardSummary();
  }

  scheduleDailyBrief() {
    // Daily at 08:00 UTC
    setInterval(async () => {
      const now = new Date();
      if (now.getUTCHours() === 8 && now.getUTCMinutes() === 0) {
        await this.generateDailyBrief('all-users');
      }
    }, 60000); // Check every minute
  }

  scheduleWeeklyStrategy() {
    // Weekly on Monday 08:00 UTC
    setInterval(async () => {
      const now = new Date();
      if (now.getUTCDay() === 1 && now.getUTCHours() === 8 && now.getUTCMinutes() === 0) {
        await this.generateWeeklyStrategy('all-users');
      }
    }, 60000);
  }

  scheduleMonthlyBoardSummary() {
    // Monthly on 1st at 08:00 UTC
    setInterval(async () => {
      const now = new Date();
      if (now.getUTCDate() === 1 && now.getUTCHours() === 8 && now.getUTCMinutes() === 0) {
        await this.generateMonthlyBoardSummary('all-users');
      }
    }, 60000);
  }

  async generateDailyBrief(userId) {
    try {
      const metrics = await this.getYesterdayMetrics(userId);
      const competitors = await this.getCompetitorMovements(userId);
      
      const prompt = `
Generate a daily brief for ${new Date().toDateString()}:

Yesterday's Metrics: ${JSON.stringify(metrics)}
Competitor Movements: ${JSON.stringify(competitors)}

Include:
1. Key metric changes from previous day
2. One actionable insight
3. New competitor movements
`;

      const content = await this.gemini.generateContent(prompt);
      
      const briefing = {
        id: `brief-${Date.now()}`,
        userId,
        type: 'daily',
        title: `Daily Brief - ${new Date().toDateString()}`,
        content,
        createdAt: new Date().toISOString()
      };

      const briefings = readBriefings();
      briefings.unshift(briefing);
      writeBriefings(briefings);

      return briefing;
    } catch (error) {
      console.error('Daily brief generation failed:', error);
      return null;
    }
  }

  async generateWeeklyStrategy(userId) {
    try {
      const weeklyData = await this.getWeeklyData(userId);
      
      const prompt = `
Generate a weekly strategy brief:

Weekly Data: ${JSON.stringify(weeklyData)}

Include:
1. Deep dive on one strategic area
2. Competitive landscape changes
3. Recommended focus for next week
`;

      const content = await this.gemini.generateContent(prompt);
      
      const briefing = {
        id: `weekly-${Date.now()}`,
        userId,
        type: 'weekly',
        title: `Weekly Strategy - Week of ${new Date().toDateString()}`,
        content,
        createdAt: new Date().toISOString()
      };

      const briefings = readBriefings();
      briefings.unshift(briefing);
      writeBriefings(briefings);

      return briefing;
    } catch (error) {
      console.error('Weekly strategy generation failed:', error);
      return null;
    }
  }

  async generateMonthlyBoardSummary(userId) {
    try {
      const monthlyData = await this.getMonthlyData(userId);
      
      const prompt = `
Generate an investor-ready monthly board summary:

Monthly Data: ${JSON.stringify(monthlyData)}

Include:
1. Investor-ready metrics summary
2. Progress against goals
3. Key risks and opportunities
`;

      const content = await this.gemini.generateContent(prompt);
      
      const briefing = {
        id: `monthly-${Date.now()}`,
        userId,
        type: 'monthly',
        title: `Monthly Board Summary - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        content,
        createdAt: new Date().toISOString()
      };

      const briefings = readBriefings();
      briefings.unshift(briefing);
      writeBriefings(briefings);

      return briefing;
    } catch (error) {
      console.error('Monthly summary generation failed:', error);
      return null;
    }
  }

  async getYesterdayMetrics(userId) {
    // Mock yesterday's metrics
    return { activeUsers: 150, transactions: 45, revenue: 1200 };
  }

  async getCompetitorMovements(userId) {
    // Mock competitor data
    return [{ name: 'Competitor A', change: '+15% users' }];
  }

  async getWeeklyData(userId) {
    // Mock weekly data
    return { weeklyGrowth: 8, newFeatures: 2, churnRate: 12 };
  }

  async getMonthlyData(userId) {
    // Mock monthly data
    return { monthlyRevenue: 45000, userGrowth: 25, marketShare: 3.2 };
  }
}
