#!/usr/bin/env node

import cron from 'node-cron';
import { MetricsCalculator } from './calculate-all-metrics.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');

/**
 * Automated Metrics Scheduler
 * Runs metrics calculations on a schedule
 */
class MetricsScheduler {
  constructor() {
    this.calculator = new MetricsCalculator();
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    console.log('🕐 Starting automated metrics scheduler...');

    // Run every hour
    cron.schedule('0 * * * *', () => {
      this.runMetricsCalculation('hourly');
    });

    // Run every 6 hours for full recalculation
    cron.schedule('0 */6 * * *', () => {
      this.runMetricsCalculation('full');
    });

    // Run daily at 2 AM for comprehensive update
    cron.schedule('0 2 * * *', () => {
      this.runMetricsCalculation('daily');
    });

    console.log('✅ Metrics scheduler started successfully');
    console.log('📅 Schedule:');
    console.log('  - Hourly: Quick metrics update');
    console.log('  - Every 6 hours: Full recalculation');
    console.log('  - Daily at 2 AM: Comprehensive update');

    // Run initial calculation
    setTimeout(() => {
      this.runMetricsCalculation('initial');
    }, 5000);
  }

  /**
   * Run metrics calculation
   */
  async runMetricsCalculation(type = 'scheduled') {
    if (this.isRunning) {
      console.log('⏳ Metrics calculation already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log(`🔄 Starting ${type} metrics calculation...`);

      if (!fs.existsSync(ANALYSES_FILE)) {
        console.log('⚠️  Analyses file not found, skipping calculation');
        return;
      }

      const analysesData = JSON.parse(fs.readFileSync(ANALYSES_FILE, 'utf8'));
      let updatedCount = 0;
      let errorCount = 0;

      // Process each analysis
      for (const analysis of analysesData) {
        if (analysis.status === 'completed' && analysis.results?.target) {
          try {
            // Check if metrics need updating
            const lastUpdated = analysis.results.target.fullReport?.lastUpdated;
            const shouldUpdate = this.shouldUpdateMetrics(lastUpdated, type);

            if (shouldUpdate) {
              const metrics = this.calculator.calculateAllMetrics(analysis);
              
              // Update the analysis with calculated metrics
              if (!analysis.results.target.fullReport) {
                analysis.results.target.fullReport = {};
              }
              
              analysis.results.target.fullReport = {
                ...analysis.results.target.fullReport,
                ...metrics
              };
              
              // Add metrics to root level for backward compatibility
              analysis.results.target.metrics = metrics.defiMetrics;
              analysis.results.target.behavior = metrics.userBehavior;
              
              updatedCount++;
            }
          } catch (error) {
            console.error(`❌ Error calculating metrics for analysis ${analysis.id}:`, error.message);
            errorCount++;
          }
        }
      }

      // Save updated analyses
      if (updatedCount > 0) {
        fs.writeFileSync(ANALYSES_FILE, JSON.stringify(analysesData, null, 2));
      }

      const duration = Date.now() - startTime;
      console.log(`✅ ${type} metrics calculation completed:`);
      console.log(`  - Updated: ${updatedCount} analyses`);
      console.log(`  - Errors: ${errorCount}`);
      console.log(`  - Duration: ${duration}ms`);

      // Log summary of key metrics
      if (updatedCount > 0) {
        this.logMetricsSummary(analysesData);
      }

    } catch (error) {
      console.error(`❌ ${type} metrics calculation failed:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if metrics should be updated based on type and last update time
   */
  shouldUpdateMetrics(lastUpdated, type) {
    if (!lastUpdated) return true;

    const now = Date.now();
    const lastUpdateTime = new Date(lastUpdated).getTime();
    const timeDiff = now - lastUpdateTime;

    switch (type) {
      case 'initial':
      case 'daily':
        return true; // Always update for initial and daily runs
      case 'full':
        return timeDiff > 6 * 60 * 60 * 1000; // Update if older than 6 hours
      case 'hourly':
        return timeDiff > 60 * 60 * 1000; // Update if older than 1 hour
      default:
        return timeDiff > 30 * 60 * 1000; // Update if older than 30 minutes
    }
  }

  /**
   * Log metrics summary
   */
  logMetricsSummary(analysesData) {
    console.log('\n📊 Current Metrics Summary:');
    
    const completedAnalyses = analysesData.filter(a => 
      a.status === 'completed' && a.results?.target?.fullReport
    );

    let totalDAU = 0;
    let totalTVL = 0;
    let totalVolume = 0;
    let totalUsers = 0;

    completedAnalyses.forEach(analysis => {
      const metrics = analysis.results.target.fullReport;
      totalDAU += metrics.defiMetrics?.dau || 0;
      totalTVL += metrics.defiMetrics?.tvl || 0;
      totalVolume += metrics.defiMetrics?.transactionVolume24h || 0;
      totalUsers += metrics.summary?.uniqueUsers || 0;
    });

    console.log(`  Total Analyses: ${completedAnalyses.length}`);
    console.log(`  Total DAU: ${totalDAU}`);
    console.log(`  Total TVL: $${totalTVL.toFixed(2)}`);
    console.log(`  Total 24h Volume: $${totalVolume.toFixed(2)}`);
    console.log(`  Total Unique Users: ${totalUsers}`);
    console.log('');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('🛑 Stopping metrics scheduler...');
    // Note: node-cron doesn't provide a direct way to stop all tasks
    // In a production environment, you'd want to track task references
  }
}

// Start scheduler if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scheduler = new MetricsScheduler();
  scheduler.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    scheduler.stop();
    process.exit(0);
  });
}

export { MetricsScheduler };
