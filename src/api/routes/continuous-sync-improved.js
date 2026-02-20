/**
 * Improved Continuous Sync Function
 * Uses interaction-based fetching with proper deduplication
 */

import { EnhancedAnalyticsEngine } from '../../services/EnhancedAnalyticsEngine.js';
import { UserStorage, AnalysisStorage } from '../database/index.js';

// Perform continuous refresh analysis for default contract with interaction-based approach
export async function performContinuousContractSync(analysisId, config, userId) {
  // Use stderr for debug logs to avoid HTTP response contamination
  if (process.env.NODE_ENV !== 'production') {
    process.stderr.write(`🔄 Starting continuous contract sync for user ${userId} (interaction-based)\n`);
  }
  
  let syncCycle = 1;
  let lastProcessedBlock = null; // Track last processed block to avoid duplicates
  let cyclesWithoutData = 0; // Track cycles with no new data
  const MAX_EMPTY_CYCLES = 10; // Stop after 10 cycles with no data (5 minutes)
  let accumulatedData = {
    transactions: new Map(), // Use Map for efficient deduplication by hash
    events: new Map(), // Use Map for efficient deduplication by tx hash + log index
    users: new Map(),
    metrics: null,
    processedBlocks: new Set(), // Track processed block ranges
    interactionHashes: new Set() // Track processed interaction hashes
  };

  const runSyncCycle = async () => {
    try {
      // Check if continuous sync should continue (more lenient checking)
      const currentAnalysis = await AnalysisStorage.findById(analysisId);
      if (!currentAnalysis) {
        console.log(`🛑 Analysis ${analysisId} not found, stopping continuous sync`);
        return false;
      }
      
      // Only stop if explicitly marked as failed or if continuous flag is explicitly set to false
      if (currentAnalysis.status === 'failed') {
        console.log(`🛑 Analysis status is failed, stopping continuous sync`);
        return false;
      }
      
      if (currentAnalysis.metadata?.continuous === false) {
        console.log(`🛑 Continuous flag explicitly set to false, stopping continuous sync`);
        return false;
      }

      // Continue if status is running or if continuous flag is true (even if status changed)
      if (currentAnalysis.status !== 'running' && currentAnalysis.metadata?.continuous !== true) {
        console.log(`🛑 Analysis status changed to ${currentAnalysis.status} and continuous not explicitly true, stopping continuous sync`);
        return false;
      }

      // Use stderr for debug logs to avoid HTTP response contamination
      if (process.env.NODE_ENV !== 'production') {
        process.stderr.write(`🔄 Running sync cycle ${syncCycle} for user ${userId} (interaction-based)\n`);
      }
      console.log(`   Analysis status: ${currentAnalysis.status}`);
      console.log(`   Continuous flag: ${currentAnalysis.metadata?.continuous}`);
      
      const engine = new EnhancedAnalyticsEngine(config.rpcConfig);
      
      // Update progress for this cycle (slower, more realistic progress)
      const cycleProgress = Math.min(90, 10 + (syncCycle * 2)); // Slower progress increment
      const cycleStartTime = new Date().toISOString();
      
      await AnalysisStorage.update(analysisId, { 
        progress: cycleProgress,
        metadata: {
          ...currentAnalysis.metadata,
          syncCycle: syncCycle,
          lastCycleStarted: cycleStartTime,
          lastProcessedBlock: lastProcessedBlock,
          fetchMethod: 'interaction-based',
          cycleStartTime: cycleStartTime,
          estimatedCycleDuration: '30-45 seconds'
        },
        logs: [
          ...(currentAnalysis.logs || []),
          `Cycle ${syncCycle}: Starting interaction-based fetch (estimated 30-45s)...`
        ]
      });
      
      // Update user progress
      const cycleUser = await UserStorage.findById(userId);
      if (cycleUser && cycleUser.onboarding?.defaultContract) {
        const cycleOnboarding = {
          ...cycleUser.onboarding,
          defaultContract: {
            ...cycleUser.onboarding.defaultContract,
            indexingProgress: cycleProgress
          }
        };
        await UserStorage.update(userId, { onboarding: cycleOnboarding });
      }

      // Use interaction-based fetching with incremental approach
      console.log(`   Using interaction-based fetching for cycle ${syncCycle}`);
      
      // Get current block for this cycle
      const currentBlock = await engine.fetcher.getCurrentBlockNumber(config.targetContract.chain);
      
      // Calculate block range for this cycle (incremental approach)
      let fromBlock, toBlock;
      
      if (lastProcessedBlock === null) {
        // First cycle: use base block range
        const baseBlockRange = config.analysisParams.searchStrategy === 'comprehensive' ? 100000 : 50000; // Smart range based on strategy
        fromBlock = Math.max(0, currentBlock - baseBlockRange);
        toBlock = currentBlock;
      } else {
        // Subsequent cycles: fetch from last processed block to current
        fromBlock = lastProcessedBlock + 1;
        toBlock = currentBlock;
        
        // If no new blocks, extend the range backwards for deeper analysis
        if (fromBlock >= toBlock) {
          const extendedRange = (config.analysisParams.blockRange || 1000) + (syncCycle * 100);
          fromBlock = Math.max(0, currentBlock - extendedRange);
          toBlock = currentBlock;
          console.log(`   No new blocks, extending range backwards: ${fromBlock} to ${toBlock}`);
        }
      }
      
      console.log(`   Fetching interactions from block ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
      
      // Fetch contract interactions directly (not full analysis to avoid duplication)
      const interactionData = await engine.fetcher.fetchContractInteractions(
        config.targetContract.address,
        fromBlock,
        toBlock,
        config.targetContract.chain
      );
      
      console.log(`   Found ${interactionData.summary.totalTransactions} transactions, ${interactionData.summary.totalEvents} events`);
      
      // Process and deduplicate the interaction data
      let newTransactionsCount = 0;
      let newEventsCount = 0;
      let newUsersCount = 0;
      let duplicatesSkipped = 0;
      
      // Normalize and deduplicate transactions
      if (!config.targetContract?.chain) {
        throw new Error('Target contract chain is missing from configuration');
      }
      
      const normalizedTxs = engine.normalizer.normalizeTransactions(interactionData.transactions, config.targetContract.chain);
      
      normalizedTxs.forEach(tx => {
        if (!accumulatedData.transactions.has(tx.hash)) {
          accumulatedData.transactions.set(tx.hash, {
            ...tx,
            syncCycle: syncCycle, // Track which cycle added this transaction
            addedAt: new Date().toISOString()
          });
          newTransactionsCount++;
        } else {
          duplicatesSkipped++;
        }
      });
      
      // Deduplicate events with enhanced tracking
      interactionData.events.forEach(event => {
        const eventKey = `${event.transactionHash}-${event.logIndex || 0}`;
        if (!accumulatedData.events.has(eventKey)) {
          accumulatedData.events.set(eventKey, {
            ...event,
            syncCycle: syncCycle,
            addedAt: new Date().toISOString()
          });
          newEventsCount++;
        }
      });
      
      // Process users from transactions and deduplicate with enhanced metrics
      const allTransactions = Array.from(accumulatedData.transactions.values());
      const userMap = new Map();
      
      allTransactions.forEach(tx => {
        const address = tx.from_address;
        if (!address) return;
        
        if (!userMap.has(address)) {
          userMap.set(address, {
            address,
            transactionCount: 0,
            totalValue: 0,
            totalGasSpent: 0,
            firstSeen: tx.block_timestamp || tx.timestamp,
            lastSeen: tx.block_timestamp || tx.timestamp,
            userType: 'regular',
            loyaltyScore: 0,
            riskScore: 0,
            eventInteractions: 0,
            syncCyclesActive: new Set(),
            lastActiveSync: syncCycle
          });
        }
        
        const user = userMap.get(address);
        user.transactionCount++;
        user.totalValue += parseFloat(tx.value_eth || 0);
        user.totalGasSpent += parseFloat(tx.gas_cost_eth || 0);
        user.lastSeen = tx.block_timestamp || tx.timestamp;
        user.syncCyclesActive.add(tx.syncCycle || syncCycle);
        user.lastActiveSync = Math.max(user.lastActiveSync, tx.syncCycle || syncCycle);
      });
      
      // Count events per user with cycle tracking
      const allEvents = Array.from(accumulatedData.events.values());
      allEvents.forEach(event => {
        const tx = accumulatedData.transactions.get(event.transactionHash);
        if (tx && tx.from_address && userMap.has(tx.from_address)) {
          const user = userMap.get(tx.from_address);
          user.eventInteractions++;
          user.syncCyclesActive.add(event.syncCycle || syncCycle);
        }
      });
      
      // Update accumulated users with enhanced metrics
      const previousUserCount = accumulatedData.users.size;
      userMap.forEach((user, address) => {
        // Calculate enhanced user metrics
        const timeSpan = new Date(user.lastSeen) - new Date(user.firstSeen);
        const daySpan = Math.max(1, timeSpan / (1000 * 60 * 60 * 24));
        const frequency = user.transactionCount / daySpan;
        user.loyaltyScore = Math.min(100, frequency * 20);
        
        // Enhanced risk score
        user.riskScore = user.totalValue > 0 ? 
          (user.eventInteractions / user.transactionCount) * 10 : 0;
        
        // Determine user type based on interactions and activity
        if (user.totalValue > 100) user.userType = 'whale';
        else if (user.eventInteractions > 50) user.userType = 'power_user';
        else if (user.transactionCount > 20) user.userType = 'active';
        else if (user.eventInteractions > 10) user.userType = 'event_active';
        else user.userType = 'casual';
        
        // Convert Set to array for storage
        user.syncCyclesActive = Array.from(user.syncCyclesActive);
        
        accumulatedData.users.set(address, user);
      });
      newUsersCount = accumulatedData.users.size - previousUserCount;
      
      // Calculate enhanced metrics with accumulated data
      engine.defiCalculator.addTransactionData(allTransactions, config.targetContract.chain);
      const defiMetrics = engine.defiCalculator.calculateAllMetrics();
      
      // Calculate UX and journey metrics with accumulated data
      console.log(`   Calculating UX bottlenecks and user journeys...`);
      const uxBottlenecks = engine.uxBottleneckDetector.analyzeUxBottlenecks(allTransactions);
      const userJourneys = engine.userJourneyAnalyzer.analyzeJourneys(allTransactions);
      const userLifecycle = engine.userLifecycleAnalyzer.analyzeUserLifecycle(allTransactions);
      
      console.log(`      🚧 UX bottlenecks: ${uxBottlenecks.bottlenecks.length}`);
      console.log(`      🛤️  User journeys: ${userJourneys.commonPaths.length} paths`);
      console.log(`      📊 Lifecycle stages: ${Object.keys(userLifecycle.lifecycleDistribution).length}`);
      
      accumulatedData.metrics = {
        ...defiMetrics.financial,
        ...defiMetrics.activity,
        ...defiMetrics.performance,
        // Enhanced metrics with accumulated data
        totalTransactions: accumulatedData.transactions.size,
        uniqueUsers: accumulatedData.users.size,
        totalEvents: accumulatedData.events.size,
        totalValue: Array.from(accumulatedData.users.values())
          .reduce((sum, user) => sum + user.totalValue, 0),
        avgTransactionsPerUser: accumulatedData.users.size > 0 ? 
          accumulatedData.transactions.size / accumulatedData.users.size : 0,
        dataFreshness: new Date().toISOString(),
        syncCyclesCompleted: syncCycle,
        lastProcessedBlock: toBlock,
        blockRangeProcessed: `${fromBlock}-${toBlock}`,
        interactionBased: true,
        deduplicationEnabled: true,
        duplicatesSkipped: duplicatesSkipped,
        dataIntegrityScore: 100 - (duplicatesSkipped / Math.max(normalizedTxs.length, 1)) * 100,
        // UX Metrics
        uxGrade: uxBottlenecks.uxGrade.grade,
        uxCompletionRate: uxBottlenecks.uxGrade.completionRate,
        uxBottleneckCount: uxBottlenecks.bottlenecks.length,
        averageSessionDuration: uxBottlenecks.sessionDurations.averageDuration,
        userRetentionRate: userLifecycle.summary.retentionRate,
        userActivationRate: userLifecycle.activationMetrics.activationRate,
        averageJourneyLength: userJourneys.averageJourneyLength
      };
      
      // Track processed blocks
      accumulatedData.processedBlocks.add(`${fromBlock}-${toBlock}`);
      
      // Prepare accumulated results with interaction-based metadata
      const accumulatedResults = {
        target: {
          contract: config.targetContract.address,
          chain: config.targetContract.chain,
          metrics: accumulatedData.metrics,
          transactions: accumulatedData.transactions.size,
          blockRange: { from: fromBlock, to: toBlock },
          fullReport: {
            transactions: Array.from(accumulatedData.transactions.values()).slice(0, 500), // Limit for performance
            events: Array.from(accumulatedData.events.values()).slice(0, 500),
            users: Array.from(accumulatedData.users.values()).slice(0, 100),
            defiMetrics: accumulatedData.metrics,
            // UX Analysis Results
            uxAnalysis: {
              bottlenecks: uxBottlenecks.bottlenecks,
              sessionDurations: uxBottlenecks.sessionDurations,
              failurePatterns: uxBottlenecks.failurePatterns,
              uxGrade: uxBottlenecks.uxGrade,
              timeToFirstSuccess: uxBottlenecks.timeToFirstSuccess,
              summary: uxBottlenecks.summary
            },
            userJourneys: {
              totalUsers: userJourneys.totalUsers,
              averageJourneyLength: userJourneys.averageJourneyLength,
              commonPaths: userJourneys.commonPaths,
              entryPoints: userJourneys.entryPoints,
              featureAdoption: userJourneys.featureAdoption,
              dropoffPoints: userJourneys.dropoffPoints,
              journeyDistribution: userJourneys.journeyDistribution
            },
            userLifecycle: {
              lifecycleDistribution: userLifecycle.lifecycleDistribution,
              walletClassification: userLifecycle.walletClassification,
              cohortAnalysis: userLifecycle.cohortAnalysis,
              activationMetrics: userLifecycle.activationMetrics,
              progressionAnalysis: userLifecycle.progressionAnalysis,
              summary: userLifecycle.summary
            },
            summary: {
              totalTransactions: accumulatedData.transactions.size,
              uniqueUsers: accumulatedData.users.size,
              totalEvents: accumulatedData.events.size,
              totalValue: accumulatedData.metrics?.totalValue || 0,
              interactionBased: true,
              deduplicationEnabled: true,
              dataIntegrityScore: accumulatedData.metrics?.dataIntegrityScore || 100,
              // UX Summary Metrics
              uxGrade: uxBottlenecks.uxGrade.grade,
              uxBottleneckCount: uxBottlenecks.bottlenecks.length,
              userRetentionRate: userLifecycle.summary.retentionRate,
              averageJourneyLength: userJourneys.averageJourneyLength
            },
            metadata: {
              syncCycle: syncCycle,
              accumulatedData: true,
              continuousSync: true,
              interactionBased: true,
              deduplicationEnabled: true,
              lastUpdated: new Date().toISOString(),
              processedBlockRanges: Array.from(accumulatedData.processedBlocks),
              lastProcessedBlock: toBlock,
              fetchMethod: 'contract-interactions',
              dataIntegrityScore: accumulatedData.metrics?.dataIntegrityScore || 100,
              duplicatesSkipped: duplicatesSkipped
            }
          }
        },
        competitors: [],
        comparative: null,
        metadata: {
          blockRange: { from: fromBlock, to: toBlock },
          chainsAnalyzed: [config.targetContract.chain],
          totalTransactions: accumulatedData.transactions.size,
          executionTimeMs: Date.now() - new Date().getTime(),
          isDefaultContract: true,
          continuous: true,
          syncCycle: syncCycle,
          accumulatedData: true,
          interactionBased: true,
          deduplicationEnabled: true,
          fetchMethod: 'contract-interactions',
          dataIntegrityScore: accumulatedData.metrics?.dataIntegrityScore || 100
        }
      };

      // Update analysis with accumulated results
      await AnalysisStorage.update(analysisId, {
        results: accumulatedResults,
        logs: [
          ...(currentAnalysis.logs || []),
          `Cycle ${syncCycle}: Added ${newTransactionsCount} new transactions, ${newEventsCount} new events, ${newUsersCount} new users (${duplicatesSkipped} duplicates skipped)`,
          `Cycle ${syncCycle}: Total accumulated - ${accumulatedData.transactions.size} transactions, ${accumulatedData.users.size} users, ${accumulatedData.events.size} events`,
          `Cycle ${syncCycle}: UX Grade: ${uxBottlenecks.uxGrade.grade}, Bottlenecks: ${uxBottlenecks.bottlenecks.length}, Retention: ${userLifecycle.summary.retentionRate.toFixed(1)}%`,
          `Cycle ${syncCycle}: Data integrity score: ${Math.round(accumulatedData.metrics?.dataIntegrityScore || 100)}%`
        ]
      });

      console.log(`✅ Sync cycle ${syncCycle} completed (interaction-based)`);
      console.log(`   New data: ${newTransactionsCount} txs, ${newEventsCount} events, ${newUsersCount} users`);
      console.log(`   Duplicates skipped: ${duplicatesSkipped}`);
      console.log(`   Total accumulated: ${accumulatedData.transactions.size} txs, ${accumulatedData.users.size} users, ${accumulatedData.events.size} events`);
      console.log(`   Data integrity: ${Math.round(accumulatedData.metrics?.dataIntegrityScore || 100)}%`);
      
      // Track cycles without new data
      if (newTransactionsCount === 0 && newEventsCount === 0) {
        cyclesWithoutData++;
        console.log(`   📊 Cycles without new data: ${cyclesWithoutData}/${MAX_EMPTY_CYCLES}`);
        
        // Auto-stop if no new data for too long
        if (cyclesWithoutData >= MAX_EMPTY_CYCLES) {
          console.log(`🛑 Auto-stopping continuous sync after ${MAX_EMPTY_CYCLES} cycles without new data`);
          
          // Mark as completed
          await AnalysisStorage.update(analysisId, {
            status: 'completed',
            progress: 100,
            metadata: {
              ...currentAnalysis.metadata,
              continuous: false,
              completedAfterCycles: syncCycle,
              autoStoppedReason: 'No new data detected',
              emptyCycles: cyclesWithoutData
            },
            logs: [
              ...(currentAnalysis.logs || []),
              `Continuous sync auto-stopped after ${cyclesWithoutData} cycles without new data`
            ],
            completedAt: new Date().toISOString()
          });
          
          // Update user status with enhanced completion handling
          const autoStopUser = await UserStorage.findById(userId);
          if (autoStopUser && autoStopUser.onboarding?.defaultContract) {
            const autoStopOnboarding = {
              ...autoStopUser.onboarding,
              defaultContract: {
                ...autoStopUser.onboarding.defaultContract,
                continuousSync: false,
                isIndexed: true,
                indexingProgress: 100,
                lastUpdate: new Date().toISOString(),
                completionReason: 'auto-stopped-no-data'
              }
            };
            await UserStorage.update(userId, { onboarding: autoStopOnboarding });
            console.log(`✅ User ${userId} progress updated to 100% (auto-stop completion)`);
          }
          
          return false; // Stop the sync loop
        }
      } else {
        cyclesWithoutData = 0; // Reset counter when new data is found
      }
      
      // Update last processed block for next cycle
      lastProcessedBlock = toBlock;
      syncCycle++;
      
      // Wait before next cycle (longer interval for better stability and proper timing)
      console.log(`   Waiting 30 seconds before next cycle...`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds between cycles for proper timing
      
      return true; // Continue syncing
    } catch (error) {
      console.error(`❌ Sync cycle ${syncCycle} failed:`, error);
      
      // Log error but continue if possible
      try {
        const errorAnalysis = await AnalysisStorage.findById(analysisId);
        if (errorAnalysis) {
          await AnalysisStorage.update(analysisId, {
            logs: [
              ...(errorAnalysis.logs || []),
              `Cycle ${syncCycle}: Error - ${error.message} (interaction-based fetch)`
            ]
          });
        }
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
      
      // Wait before retry (longer wait for stability)
      console.log(`   Waiting 30 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Don't stop on single errors, continue trying
      syncCycle++; // Increment cycle even on error to prevent infinite loops
      return true; // Continue despite error
    }
  };

  // Run continuous sync cycles
  try {
    console.log(`🚀 Starting continuous sync loop for analysis ${analysisId} (interaction-based)`);
    
    while (await runSyncCycle()) {
      // Check if we should stop (max 50 cycles for reasonable marathon sync duration)
      if (syncCycle > 50) {
        console.log(`🛑 Stopping continuous sync after 50 cycles for reasonable duration (approximately 25-30 minutes)`);
        
        // Mark as completed instead of continuing indefinitely
        await AnalysisStorage.update(analysisId, {
          status: 'completed',
          progress: 100,
          metadata: {
            ...currentAnalysis.metadata,
            continuous: false,
            completedAfterCycles: syncCycle - 1,
            autoStoppedReason: 'Maximum cycles reached'
          },
          logs: [
            ...(currentAnalysis.logs || []),
            `Continuous sync completed after ${syncCycle - 1} cycles (auto-stopped)`
          ],
          completedAt: new Date().toISOString()
        });
        
        // Update user status with enhanced completion handling
        const finalUser = await UserStorage.findById(userId);
        if (finalUser && finalUser.onboarding?.defaultContract) {
          const finalOnboarding = {
            ...finalUser.onboarding,
            defaultContract: {
              ...finalUser.onboarding.defaultContract,
              continuousSync: false,
              isIndexed: true,
              indexingProgress: 100,
              lastUpdate: new Date().toISOString(),
              completionReason: 'max-cycles-reached'
            }
          };
          await UserStorage.update(userId, { onboarding: finalOnboarding });
          console.log(`✅ User ${userId} progress updated to 100% (max cycles completion)`);
        }
        
        break;
      }
      
      console.log(`🔄 Continuing to cycle ${syncCycle}... (${syncCycle}/200 max cycles)`);
    }
    
    console.log(`🏁 Continuous sync loop ended for analysis ${analysisId}`);
    
    // Update user status when continuous sync ends normally
    try {
      const endUser = await UserStorage.findById(userId);
      if (endUser && endUser.onboarding?.defaultContract) {
        const endOnboarding = {
          ...endUser.onboarding,
          defaultContract: {
            ...endUser.onboarding.defaultContract,
            continuousSync: false,
            isIndexed: true,
            indexingProgress: 100,
            lastUpdate: new Date().toISOString(),
            completionReason: 'normal-completion'
          }
        };
        await UserStorage.update(userId, { onboarding: endOnboarding });
        console.log(`✅ User ${userId} status updated after continuous sync completion`);
      }
    } catch (updateError) {
      console.error('Failed to update user status on continuous sync completion:', updateError);
    }
  } catch (error) {
    console.error('Continuous sync error:', error);
    
    // Update user status on continuous sync error
    try {
      const errorUser = await UserStorage.findById(userId);
      if (errorUser && errorUser.onboarding?.defaultContract) {
        const errorOnboarding = {
          ...errorUser.onboarding,
          defaultContract: {
            ...errorUser.onboarding.defaultContract,
            continuousSync: false,
            indexingProgress: 0,
            isIndexed: false,
            error: error.message,
            lastUpdate: new Date().toISOString()
          }
        };
        await UserStorage.update(userId, { onboarding: errorOnboarding });
        console.log('✅ User status updated after continuous sync error');
      }
    } catch (updateError) {
      console.error('Failed to update user status on continuous sync error:', updateError);
    }
    
    throw error;
  }
}