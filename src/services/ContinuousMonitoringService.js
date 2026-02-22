/**
 * Continuous Monitoring Service
 * Automatically monitors contracts for new blocks and respects subscription limits
 * Keeps data fresh by polling for new transactions until monthly API limits are reached
 */

import { UserStorage, AnalysisStorage } from '../api/database/index.js';
import { EnhancedAnalyticsEngine } from './EnhancedAnalyticsEngine.js';
import SubscriptionService from './SubscriptionService.js';
import { EventEmitter } from 'events';

export class ContinuousMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.activeMonitors = new Map(); // userId -> monitor state
    this.pollingInterval = 30000; // 30 seconds
  }

  /**
   * Start continuous monitoring for a user's contract
   * @param {string} userId - User ID
   * @param {Object} contract - Contract details
   * @param {Object} subscription - Subscription info with tier and limits
   * @param {string} analysisId - Analysis ID to update
   */
  async startMonitoring(userId, contract, subscription, analysisId) {
    try {
      // Check if already monitoring
      if (this.activeMonitors.has(userId)) {
        console.log(`⚠️ Already monitoring for user ${userId}`);
        return { success: false, reason: 'already_monitoring' };
      }

      // Check if tier allows continuous monitoring
      if (!subscription.continuousSync) {
        console.log(`❌ Tier ${subscription.tierName} does not support continuous monitoring`);
        return { success: false, reason: 'tier_not_supported' };
      }

      console.log(`🚀 Starting continuous monitoring for user ${userId}`);
      console.log(`   Contract: ${contract.address} on ${contract.chain}`);
      console.log(`   Tier: ${subscription.tierName}`);
      console.log(`   Monthly limit: ${subscription.apiCallsPerMonth} calls`);

      // Get current API usage
      const apiCallsThisMonth = await this.getMonthlyApiCallCount(userId);
      
      // Check if already at limit
      if (apiCallsThisMonth >= subscription.apiCallsPerMonth) {
        console.log(`🛑 User ${userId} already at monthly API limit`);
        return { success: false, reason: 'limit_reached' };
      }

      // Create monitor state
      const monitor = {
        userId,
        contract,
        subscription,
        analysisId,
        isActive: true,
        apiCallsThisMonth,
        lastBlockProcessed: null,
        startedAt: new Date(),
        cycleCount: 0,
        totalNewTransactions: 0,
        totalNewEvents: 0
      };

      this.activeMonitors.set(userId, monitor);

      // Update user record
      await UserStorage.update(userId, {
        onboarding: {
          defaultContract: {
            continuousMonitoring: true,
            monitoringStartedAt: new Date(),
            monitoringStatus: 'active'
          }
        }
      });

      // Start monitoring loop in background
      setImmediate(() => this.runMonitoringLoop(monitor));

      return { success: true, monitor };
    } catch (error) {
      console.error(`❌ Failed to start monitoring for user ${userId}:`, error);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Monitoring loop - polls for new blocks every 30 seconds
   * @private
   */
  async runMonitoringLoop(monitor) {
    console.log(`🔄 Starting monitoring loop for user ${monitor.userId}`);

    while (monitor.isActive) {
      try {
        monitor.cycleCount++;
        console.log(`\n🔄 Monitoring cycle ${monitor.cycleCount} for user ${monitor.userId}`);

        // Check if monthly limit reached
        if (monitor.apiCallsThisMonth >= monitor.subscription.apiCallsPerMonth) {
          console.log(`🛑 Monthly API limit reached for user ${monitor.userId}`);
          console.log(`   Used: ${monitor.apiCallsThisMonth}/${monitor.subscription.apiCallsPerMonth}`);
          await this.stopMonitoring(monitor.userId, 'monthly_limit_reached');
          break;
        }

        // Check if subscription still active and supports continuous sync
        const currentSub = await this.checkSubscription(monitor.userId);
        if (!currentSub.isActive || !currentSub.continuousSync) {
          console.log(`🛑 Subscription changed for user ${monitor.userId}`);
          await this.stopMonitoring(monitor.userId, 'subscription_changed');
          break;
        }

        // Fetch new blocks and update metrics
        const result = await this.fetchAndProcessNewBlocks(monitor);
        
        if (result.success) {
          // Increment API call count
          monitor.apiCallsThisMonth++;
          monitor.totalNewTransactions += result.newTransactions;
          monitor.totalNewEvents += result.newEvents;
          
          await this.updateApiCallCount(monitor.userId, monitor.apiCallsThisMonth);
          
          console.log(`✅ Cycle ${monitor.cycleCount} complete`);
          console.log(`   New data: ${result.newTransactions} txs, ${result.newEvents} events`);
          console.log(`   API calls: ${monitor.apiCallsThisMonth}/${monitor.subscription.apiCallsPerMonth}`);
          console.log(`   Total accumulated: ${monitor.totalNewTransactions} txs, ${monitor.totalNewEvents} events`);
          
          // Emit event for real-time updates
          this.emit('monitoring:update', {
            userId: monitor.userId,
            cycle: monitor.cycleCount,
            newTransactions: result.newTransactions,
            newEvents: result.newEvents,
            apiCalls: monitor.apiCallsThisMonth,
            apiLimit: monitor.subscription.apiCallsPerMonth
          });
        } else {
          console.log(`⚠️ Cycle ${monitor.cycleCount} - No new data or error`);
        }

        // Wait before next check (30 seconds)
        console.log(`   ⏳ Waiting 30 seconds before next cycle...`);
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));

      } catch (error) {
        console.error(`❌ Monitoring error for user ${monitor.userId}:`, error);
        // Continue monitoring despite errors (with backoff)
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      }
    }

    console.log(`🏁 Monitoring loop ended for user ${monitor.userId}`);
  }

  /**
   * Fetch new blocks and process them
   * @private
   */
  async fetchAndProcessNewBlocks(monitor) {
    try {
      // Initialize analytics engine
      const engine = new EnhancedAnalyticsEngine({
        [monitor.contract.chain]: [
          process.env[`${monitor.contract.chain.toUpperCase()}_RPC_URL1`],
          process.env[`${monitor.contract.chain.toUpperCase()}_RPC_URL2`],
          process.env[`${monitor.contract.chain.toUpperCase()}_RPC_URL3`]
        ].filter(Boolean)
      });

      // Get current block
      const currentBlock = await engine.fetcher.getCurrentBlockNumber(monitor.contract.chain);
      
      // Determine block range to fetch
      let fromBlock, toBlock;
      
      if (monitor.lastBlockProcessed === null) {
        // First cycle - fetch last 100 blocks
        fromBlock = Math.max(0, currentBlock - 100);
        toBlock = currentBlock;
      } else {
        // Subsequent cycles - fetch from last processed to current
        fromBlock = monitor.lastBlockProcessed + 1;
        toBlock = currentBlock;
      }

      // Skip if no new blocks
      if (fromBlock > toBlock) {
        console.log(`   ℹ️ No new blocks (last: ${monitor.lastBlockProcessed}, current: ${currentBlock})`);
        return { success: true, newTransactions: 0, newEvents: 0 };
      }

      console.log(`   📊 Fetching blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);

      // Fetch contract interactions
      const interactionData = await engine.fetcher.fetchContractInteractions(
        monitor.contract.address,
        fromBlock,
        toBlock,
        monitor.contract.chain
      );

      const newTransactions = interactionData.summary.totalTransactions;
      const newEvents = interactionData.summary.totalEvents;

      console.log(`   📋 Found ${newTransactions} transactions, ${newEvents} events`);

      // Update analysis with new data
      if (newTransactions > 0 || newEvents > 0) {
        await this.updateAnalysisWithNewData(monitor, interactionData, fromBlock, toBlock);
      }

      // Update last processed block
      monitor.lastBlockProcessed = toBlock;

      return {
        success: true,
        newTransactions,
        newEvents,
        fromBlock,
        toBlock
      };

    } catch (error) {
      console.error(`   ❌ Failed to fetch new blocks:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update analysis record with new data
   * @private
   */
  async updateAnalysisWithNewData(monitor, interactionData, fromBlock, toBlock) {
    try {
      // Get current analysis
      const analysis = await AnalysisStorage.findById(monitor.analysisId);
      if (!analysis) {
        console.warn(`   ⚠️ Analysis ${monitor.analysisId} not found`);
        return;
      }

      // Merge new data with existing data (simple append for now)
      const existingTxs = analysis.results?.target?.fullReport?.transactions || [];
      const existingEvents = analysis.results?.target?.fullReport?.events || [];

      const updatedResults = {
        ...analysis.results,
        target: {
          ...analysis.results?.target,
          fullReport: {
            ...analysis.results?.target?.fullReport,
            transactions: [...existingTxs, ...interactionData.transactions].slice(-1000), // Keep last 1000
            events: [...existingEvents, ...interactionData.events].slice(-1000), // Keep last 1000
            summary: {
              ...analysis.results?.target?.fullReport?.summary,
              totalTransactions: (analysis.results?.target?.fullReport?.summary?.totalTransactions || 0) + interactionData.summary.totalTransactions,
              totalEvents: (analysis.results?.target?.fullReport?.summary?.totalEvents || 0) + interactionData.summary.totalEvents,
              lastUpdated: new Date().toISOString()
            },
            metadata: {
              ...analysis.results?.target?.fullReport?.metadata,
              continuousMonitoring: true,
              lastBlockProcessed: toBlock,
              monitoringCycle: monitor.cycleCount,
              lastUpdated: new Date().toISOString()
            }
          }
        }
      };

      // Update analysis
      await AnalysisStorage.update(monitor.analysisId, {
        results: updatedResults,
        logs: [
          ...(analysis.logs || []).slice(-50), // Keep last 50 logs
          `Monitoring cycle ${monitor.cycleCount}: Added ${interactionData.summary.totalTransactions} txs, ${interactionData.summary.totalEvents} events (blocks ${fromBlock}-${toBlock})`
        ]
      });

      console.log(`   ✅ Analysis updated with new data`);
    } catch (error) {
      console.error(`   ❌ Failed to update analysis:`, error);
    }
  }

  /**
   * Stop monitoring for a user
   * @param {string} userId - User ID
   * @param {string} reason - Reason for stopping
   */
  async stopMonitoring(userId, reason) {
    const monitor = this.activeMonitors.get(userId);
    if (!monitor) {
      console.log(`⚠️ No active monitor found for user ${userId}`);
      return { success: false, reason: 'not_monitoring' };
    }

    monitor.isActive = false;
    this.activeMonitors.delete(userId);

    console.log(`🛑 Stopped monitoring for user ${userId}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Cycles completed: ${monitor.cycleCount}`);
    console.log(`   Total new data: ${monitor.totalNewTransactions} txs, ${monitor.totalNewEvents} events`);
    console.log(`   API calls used: ${monitor.apiCallsThisMonth}/${monitor.subscription.apiCallsPerMonth}`);

    // Update user record
    try {
      const user = await UserStorage.findById(userId);
      if (user && user.onboarding?.defaultContract) {
        await UserStorage.update(userId, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...user.onboarding.defaultContract,
              continuousMonitoring: false,
              monitoringStoppedAt: new Date(),
              monitoringStopReason: reason,
              monitoringStats: {
                cyclesCompleted: monitor.cycleCount,
                totalNewTransactions: monitor.totalNewTransactions,
                totalNewEvents: monitor.totalNewEvents,
                apiCallsUsed: monitor.apiCallsThisMonth,
                duration: Date.now() - monitor.startedAt.getTime()
              }
            }
          }
        });
      }
    } catch (error) {
      console.error(`Failed to update user record:`, error);
    }

    // Emit event
    this.emit('monitoring:stopped', {
      userId,
      reason,
      stats: {
        cycles: monitor.cycleCount,
        transactions: monitor.totalNewTransactions,
        events: monitor.totalNewEvents,
        apiCalls: monitor.apiCallsThisMonth
      }
    });

    return { success: true, reason };
  }

  /**
   * Check subscription status
   * @private
   */
  async checkSubscription(userId) {
    try {
      const user = await UserStorage.findById(userId);
      if (!user || !user.walletAddress) {
        return { isActive: false, continuousSync: false };
      }

      const subInfo = await SubscriptionService.getSubscriptionInfo(user.walletAddress);
      
      return {
        isActive: subInfo.isActive,
        continuousSync: subInfo.tier > 0, // Tiers 1, 2, 3 support continuous sync
        tier: subInfo.tier,
        tierName: subInfo.tierName,
        apiCallsPerMonth: await this.getApiLimitForTier(subInfo.tier)
      };
    } catch (error) {
      console.error('Error checking subscription:', error);
      return { isActive: false, continuousSync: false };
    }
  }

  /**
   * Get API limit for tier
   * @private
   */
  getApiLimitForTier(tier) {
    const limits = {
      0: 1000,      // Free
      1: 10000,     // Starter
      2: 50000,     // Pro
      3: 250000     // Enterprise
    };
    return limits[tier] || 1000;
  }

  /**
   * Get monthly API call count for user
   */
  async getMonthlyApiCallCount(userId) {
    try {
      const user = await UserStorage.findById(userId);
      if (!user) return 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Check if usage data is for current month
      if (user.usage?.month === currentMonth && user.usage?.year === currentYear) {
        return user.usage.apiCalls || 0;
      }

      // New month, reset counter
      await UserStorage.update(userId, {
        usage: {
          apiCalls: 0,
          month: currentMonth,
          year: currentYear,
          lastReset: new Date()
        }
      });

      return 0;
    } catch (error) {
      console.error('Error getting API call count:', error);
      return 0;
    }
  }

  /**
   * Update API call count for user
   */
  async updateApiCallCount(userId, count) {
    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      await UserStorage.update(userId, {
        usage: {
          apiCalls: count,
          month: currentMonth,
          year: currentYear,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating API call count:', error);
    }
  }

  /**
   * Get monitoring status for a user
   */
  getMonitoringStatus(userId) {
    const monitor = this.activeMonitors.get(userId);
    if (!monitor) {
      return { isActive: false };
    }

    return {
      isActive: true,
      contract: monitor.contract,
      subscription: monitor.subscription,
      cycleCount: monitor.cycleCount,
      apiCallsUsed: monitor.apiCallsThisMonth,
      apiCallsLimit: monitor.subscription.apiCallsPerMonth,
      totalNewTransactions: monitor.totalNewTransactions,
      totalNewEvents: monitor.totalNewEvents,
      startedAt: monitor.startedAt,
      lastBlockProcessed: monitor.lastBlockProcessed
    };
  }

  /**
   * Get all active monitors
   */
  getAllActiveMonitors() {
    const monitors = [];
    for (const [userId, monitor] of this.activeMonitors.entries()) {
      monitors.push({
        userId,
        contract: monitor.contract.address,
        chain: monitor.contract.chain,
        tier: monitor.subscription.tierName,
        cycleCount: monitor.cycleCount,
        apiCallsUsed: monitor.apiCallsThisMonth,
        apiCallsLimit: monitor.subscription.apiCallsPerMonth
      });
    }
    return monitors;
  }

  /**
   * Stop all monitors (for graceful shutdown)
   */
  async stopAllMonitors() {
    console.log(`🛑 Stopping all active monitors (${this.activeMonitors.size})`);
    const userIds = Array.from(this.activeMonitors.keys());
    
    for (const userId of userIds) {
      await this.stopMonitoring(userId, 'service_shutdown');
    }
    
    console.log(`✅ All monitors stopped`);
  }
}

// Export singleton instance
export default new ContinuousMonitoringService();
