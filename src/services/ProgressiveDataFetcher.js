/**
 * Progressive Data Fetcher - Fetches data day by day
 * Shows results immediately as data comes in
 */

export class ProgressiveDataFetcher {
  constructor(fetcher, config = {}) {
    this.fetcher = fetcher;
    this.config = {
      daysToFetch: config.daysToFetch || 7, // Fetch 7 days total
      blocksPerDay: config.blocksPerDay || 7200, // ~12 sec blocks
      onDayComplete: config.onDayComplete || null, // Callback when each day completes
      onProgress: config.onProgress || null,
      ...config
    };
  }

  /**
   * Fetch data day by day, showing results after each day
   */
  async fetchProgressively(contractAddress, chain) {
    console.log(`\n📅 PROGRESSIVE FETCH - Day by Day Analysis`);
    console.log(`📍 Contract: ${contractAddress}`);
    console.log(`🔗 Chain: ${chain}`);
    console.log(`📆 Fetching ${this.config.daysToFetch} days of data\n`);

    const allResults = {
      transactions: [],
      events: [],
      accounts: new Set(),
      blocks: new Set(),
      dayResults: []
    };

    try {
      // Get current block
      const currentBlock = await this.fetcher.getCurrentBlockNumber(chain);
      console.log(`📊 Current block: ${currentBlock.toLocaleString()}`);

      // Fetch each day
      for (let day = 0; day < this.config.daysToFetch; day++) {
        const dayLabel = day === 0 ? 'Today' : `${day} day${day > 1 ? 's' : ''} ago`;
        
        this._emitProgress(
          'fetching',
          Math.floor((day / this.config.daysToFetch) * 100),
          `Fetching ${dayLabel}...`
        );

        console.log(`\n📅 Day ${day + 1}/${this.config.daysToFetch}: ${dayLabel}`);

        // Calculate block range for this day
        const toBlock = currentBlock - (day * this.config.blocksPerDay);
        const fromBlock = toBlock - this.config.blocksPerDay + 1;

        console.log(`   📦 Blocks: ${fromBlock.toLocaleString()} → ${toBlock.toLocaleString()}`);

        try {
          // Fetch this day's data
          const dayData = await this.fetcher.fetchTransactions(
            contractAddress,
            fromBlock,
            toBlock,
            chain
          );

          // Accumulate results
          if (dayData.transactions) {
            allResults.transactions.push(...dayData.transactions);
          }
          if (dayData.events) {
            allResults.events.push(...dayData.events);
          }

          // Track accounts and blocks
          dayData.transactions?.forEach(tx => {
            allResults.accounts.add(tx.from);
            if (tx.to) allResults.accounts.add(tx.to);
            allResults.blocks.add(tx.blockNumber);
          });

          const dayResult = {
            day: day + 1,
            label: dayLabel,
            blockRange: { from: fromBlock, to: toBlock },
            transactions: dayData.transactions?.length || 0,
            events: dayData.events?.length || 0,
            timestamp: new Date().toISOString()
          };

          allResults.dayResults.push(dayResult);

          console.log(`   ✅ Found ${dayResult.transactions} transactions, ${dayResult.events} events`);
          console.log(`   📊 Total so far: ${allResults.transactions.length} transactions`);

          // Callback with partial results
          if (this.config.onDayComplete) {
            await this.config.onDayComplete({
              ...allResults,
              accounts: Array.from(allResults.accounts),
              blocks: Array.from(allResults.blocks),
              daysCompleted: day + 1,
              totalDays: this.config.daysToFetch
            });
          }

        } catch (dayError) {
          console.error(`   ❌ Failed to fetch day ${day + 1}: ${dayError.message}`);
          // Continue with next day even if this one fails
        }

        // Small delay between days to avoid rate limiting
        if (day < this.config.daysToFetch - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this._emitProgress('complete', 100, 'Progressive fetch complete!');

      console.log(`\n✅ PROGRESSIVE FETCH COMPLETE`);
      console.log(`📊 Total: ${allResults.transactions.length} transactions`);
      console.log(`📋 Total: ${allResults.events.length} events`);
      console.log(`👥 Unique accounts: ${allResults.accounts.size}`);

      return {
        ...allResults,
        accounts: Array.from(allResults.accounts),
        blocks: Array.from(allResults.blocks),
        metrics: {
          totalTransactions: allResults.transactions.length,
          totalEvents: allResults.events.length,
          uniqueAccounts: allResults.accounts.size,
          uniqueBlocks: allResults.blocks.size,
          daysAnalyzed: this.config.daysToFetch
        }
      };

    } catch (error) {
      console.error(`❌ Progressive fetch failed:`, error);
      throw error;
    }
  }

  _emitProgress(step, progress, message) {
    if (this.config.onProgress) {
      this.config.onProgress({ step, progress, message, timestamp: new Date().toISOString() });
    }
  }
}
