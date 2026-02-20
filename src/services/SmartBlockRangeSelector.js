/**
 * Smart Block Range Selector
 * Inspired by Orbiter Finance's priority-based multi-range search strategy
 * Optimizes data fetching by focusing on recent activity first
 */

export class SmartBlockRangeSelector {
  constructor(config = {}) {
    this.config = {
      stopOnLowActivity: config.stopOnLowActivity !== false, // Default true
      maxBlocksToSearch: config.maxBlocksToSearch || 1000000,
      minActivityThreshold: config.minActivityThreshold || 5,
      highActivityThreshold: config.highActivityThreshold || 10,
      ...config
    };

    // Search strategies inspired by Orbiter Finance approach
    this.searchStrategies = {
      quick: [
        { 
          name: 'Recent Activity (Last 10k blocks)', 
          blocks: 10000, 
          priority: 'HIGH',
          description: 'Quick scan for recent activity'
        }
      ],
      
      standard: [
        { 
          name: 'Recent Activity (Last 50k blocks)', 
          blocks: 50000, 
          priority: 'HIGH',
          description: 'Recent high-priority activity'
        },
        { 
          name: 'Medium Term (50k-200k blocks ago)', 
          blocks: 200000, 
          priority: 'MEDIUM',
          description: 'Medium-term activity patterns'
        }
      ],
      
      comprehensive: [
        { 
          name: 'Recent Activity (Last 50k blocks)', 
          blocks: 50000, 
          priority: 'HIGH',
          description: 'Recent high-priority activity'
        },
        { 
          name: 'Medium Term (50k-200k blocks ago)', 
          blocks: 200000, 
          priority: 'HIGH',
          description: 'Medium-term high-priority activity'
        },
        { 
          name: 'Historical (200k-500k blocks ago)', 
          blocks: 500000, 
          priority: 'MEDIUM',
          description: 'Historical activity patterns'
        },
        { 
          name: 'Deep History (500k-1M blocks ago)', 
          blocks: 1000000, 
          priority: 'LOW',
          description: 'Deep historical analysis'
        }
      ],

      bridge: [
        { 
          name: 'Recent Bridge Activity (Last 50k blocks)', 
          blocks: 50000, 
          priority: 'HIGH',
          description: 'Recent cross-chain bridge activity'
        },
        { 
          name: 'Medium Bridge History (50k-200k blocks ago)', 
          blocks: 200000, 
          priority: 'HIGH',
          description: 'Medium-term bridge patterns'
        },
        { 
          name: 'Historical Bridge Data (200k-500k blocks ago)', 
          blocks: 500000, 
          priority: 'MEDIUM',
          description: 'Historical bridge operations'
        },
        { 
          name: 'Early Bridge Era (500k-2M blocks ago)', 
          blocks: 2000000, 
          priority: 'LOW',
          description: 'Early bridge protocol activity'
        }
      ]
    };
  }

  /**
   * Get search ranges for a specific strategy
   */
  getSearchRanges(strategy = 'standard') {
    const ranges = this.searchStrategies[strategy];
    if (!ranges) {
      console.warn(`⚠️  Unknown strategy '${strategy}', using 'standard'`);
      return this.searchStrategies.standard;
    }
    return ranges;
  }

  /**
   * Generate block ranges for current block
   */
  generateBlockRanges(currentBlock, strategy = 'standard') {
    const ranges = this.getSearchRanges(strategy);
    const blockRanges = [];
    
    let previousEnd = currentBlock;
    
    for (const range of ranges) {
      const start = Math.max(0, currentBlock - range.blocks);
      const end = previousEnd;
      
      // Skip if range is invalid
      if (start >= end) continue;
      
      blockRanges.push({
        ...range,
        start,
        end,
        totalBlocks: end - start
      });
      
      previousEnd = start;
    }
    
    return blockRanges;
  }

  /**
   * Determine if we should continue searching based on activity
   */
  shouldContinueSearch(transactions, range, totalTransactionsFound) {
    const activityLevel = transactions.length;
    
    // Always continue for HIGH priority ranges
    if (range.priority === 'HIGH') {
      return true;
    }
    
    // For MEDIUM priority, continue if we found significant activity
    if (range.priority === 'MEDIUM') {
      return activityLevel >= this.config.minActivityThreshold;
    }
    
    // For LOW priority, only continue if we found high activity
    if (range.priority === 'LOW') {
      return activityLevel >= this.config.highActivityThreshold;
    }
    
    return false;
  }

  /**
   * Smart search with activity-based stopping
   */
  async smartSearch(contractAddress, chain, fetcher, strategy = 'standard') {
    console.log(`🔍 SMART BLOCK RANGE SEARCH - ${strategy.toUpperCase()} STRATEGY`);
    console.log('========================================================');
    
    const startTime = Date.now();
    let totalTransactions = 0;
    let totalEvents = 0;
    let allTransactions = [];
    let uniqueUsers = new Set();
    
    try {
      // Get current block
      const currentBlock = await fetcher.getCurrentBlockNumber(chain);
      console.log(`📊 Current ${chain} block: ${currentBlock.toLocaleString()}\n`);
      
      // Generate block ranges
      const blockRanges = this.generateBlockRanges(currentBlock, strategy);
      
      for (const range of blockRanges) {
        console.log(`🔍 Searching ${range.name} [${range.priority} priority]`);
        console.log(`   📊 Blocks: ${range.start.toLocaleString()} - ${range.end.toLocaleString()} (${range.totalBlocks.toLocaleString()} blocks)`);
        
        try {
          // Fetch transactions for this range
          const rangeTransactions = await fetcher.fetchTransactions(
            contractAddress,
            range.start,
            range.end,
            chain
          );
          
          if (rangeTransactions.length > 0) {
            console.log(`   ✅ Found ${rangeTransactions.length} transactions`);
            
            // Add to results
            allTransactions.push(...rangeTransactions);
            totalTransactions += rangeTransactions.length;
            
            // Track unique users
            rangeTransactions.forEach(tx => {
              if (tx.from) uniqueUsers.add(tx.from);
              if (tx.from_address) uniqueUsers.add(tx.from_address);
            });
            
            // Check if we should continue
            if (this.shouldContinueSearch(rangeTransactions, range, totalTransactions)) {
              if (rangeTransactions.length >= this.config.highActivityThreshold) {
                console.log(`   🎯 High activity detected (${rangeTransactions.length} txs) - continuing detailed search`);
              } else {
                console.log(`   📊 Moderate activity detected - continuing search`);
              }
            } else if (this.config.stopOnLowActivity && range.priority === 'LOW') {
              console.log(`   ⏹️  Low activity in ${range.priority} priority range - stopping search`);
              break;
            }
          } else {
            console.log(`   ⚪ No activity found in ${range.name}`);
            
            // Stop early if no activity in high priority ranges
            if (range.priority === 'HIGH' && totalTransactions === 0) {
              console.log(`   ⏹️  No activity in HIGH priority range - contract may be inactive`);
              // Continue to next range but with warning
            }
          }
          
        } catch (error) {
          console.log(`   ❌ Error searching ${range.name}: ${error.message}`);
        }
        
        // Add delay between ranges to avoid rate limiting
        if (blockRanges.indexOf(range) < blockRanges.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const searchTime = (Date.now() - startTime) / 1000;
      
      // Generate search summary
      const searchSummary = {
        strategy: strategy,
        totalTransactionsFound: totalTransactions,
        uniqueUsers: uniqueUsers.size,
        rangesSearched: blockRanges.length,
        blocksSearched: blockRanges.reduce((total, range) => total + range.totalBlocks, 0),
        searchTime: `${searchTime.toFixed(2)} seconds`,
        currentBlock: currentBlock,
        activityLevel: this.classifyActivityLevel(totalTransactions),
        searchMethods: ['smart_range_selection', 'activity_based_stopping', 'priority_optimization']
      };
      
      console.log(`\n📊 SMART SEARCH RESULTS:`);
      console.log(`🔗 Total Transactions: ${totalTransactions}`);
      console.log(`👥 Unique Users: ${uniqueUsers.size}`);
      console.log(`📊 Ranges Searched: ${blockRanges.length}`);
      console.log(`🧱 Blocks Searched: ${searchSummary.blocksSearched.toLocaleString()}`);
      console.log(`⏱️  Search Time: ${searchTime.toFixed(2)} seconds`);
      console.log(`📈 Activity Level: ${searchSummary.activityLevel}`);
      
      return {
        transactions: allTransactions,
        searchSummary: searchSummary
      };
      
    } catch (error) {
      console.error('❌ Error in smart block range search:', error);
      throw error;
    }
  }

  /**
   * Classify activity level based on transaction count
   */
  classifyActivityLevel(transactionCount) {
    if (transactionCount >= 100) return 'HIGH';
    if (transactionCount >= 20) return 'MEDIUM';
    if (transactionCount >= 5) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Get recommended strategy based on contract type or user preference
   */
  getRecommendedStrategy(contractType = 'generic', userPreference = null) {
    if (userPreference && this.searchStrategies[userPreference]) {
      return userPreference;
    }
    
    switch (contractType.toLowerCase()) {
      case 'bridge':
      case 'cross-chain':
        return 'bridge';
      case 'defi':
      case 'dex':
        return 'comprehensive';
      case 'nft':
        return 'standard';
      default:
        return 'standard';
    }
  }

  /**
   * Get strategy info for user display
   */
  getStrategyInfo(strategy = 'standard') {
    const ranges = this.getSearchRanges(strategy);
    const totalBlocks = ranges.reduce((sum, range) => sum + range.blocks, 0);
    
    return {
      name: strategy,
      ranges: ranges.length,
      maxBlocks: Math.max(...ranges.map(r => r.blocks)),
      totalBlocks: totalBlocks,
      description: `${ranges.length} ranges, up to ${totalBlocks.toLocaleString()} blocks`
    };
  }
}

export default SmartBlockRangeSelector;