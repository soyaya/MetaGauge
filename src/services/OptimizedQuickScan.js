/**
 * Optimized Quick Scan Service
 * Fast, contract-focused data fetching with deployment detection
 * 
 * Features:
 * - Fetches 1 week of data (50k-100k blocks)
 * - Detects contract deployment date
 * - Scans only contract-related: transactions, events, accounts, blocks
 * - Fast execution (30-60 seconds)
 */

export class OptimizedQuickScan {
  constructor(fetcher, config = {}) {
    this.fetcher = fetcher;
    this.config = {
      weekInBlocks: config.weekInBlocks || 50000, // ~7 days (increased for more data)
      maxScanBlocks: config.maxScanBlocks || 50000,
      minScanBlocks: config.minScanBlocks || 10000,
      chunkSize: config.chunkSize || 100000, // 100k blocks per request
      batchSize: config.batchSize || 10,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      cacheTimeout: config.cacheTimeout || 30000,
      onProgress: config.onProgress || null,
      ...config
    };
    
    // Cache for block numbers
    this.blockNumberCache = {
      value: null,
      timestamp: null
    };
  }

  /**
   * Emit progress update
   * @private
   */
  _emitProgress(step, progress, message, data = {}) {
    const progressData = {
      step,
      progress, // 0-100
      message,
      timestamp: new Date().toISOString(),
      ...data
    };

    // Console logging
    console.log(`   📊 [${progress}%] ${message}`);

    // Callback for frontend
    if (this.config.onProgress && typeof this.config.onProgress === 'function') {
      this.config.onProgress(progressData);
    }
  }

  /**
   * Get cached block number or fetch new one
   * @private
   */
  async _getCachedBlockNumber(chain) {
    const now = Date.now();
    
    // Return cached value if still valid
    if (this.blockNumberCache.value && 
        this.blockNumberCache.timestamp && 
        (now - this.blockNumberCache.timestamp) < this.config.cacheTimeout) {
      console.log(`   💾 Using cached block number: ${this.blockNumberCache.value}`);
      return this.blockNumberCache.value;
    }
    
    // Fetch new block number with timeout
    const blockNumber = await this._withTimeout(
      this.fetcher.getCurrentBlockNumber(chain),
      15000,
      'Block number fetch timeout'
    );
    
    // Update cache
    this.blockNumberCache = {
      value: blockNumber,
      timestamp: now
    };
    
    return blockNumber;
  }

  /**
   * Retry logic with exponential backoff
   * @private
   */
  async _withRetry(fn, retries = this.config.maxRetries) {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < retries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, i);
          console.log(`   ⚠️  Retry ${i + 1}/${retries} after ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Add timeout to promise
   * @private
   */
  async _withTimeout(promise, timeoutMs, errorMessage) {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Fetch data in chunks with parallel processing
   * @private
   */
  async _fetchInChunks(contractAddress, chain, fromBlock, toBlock) {
    const chunks = [];
    const chunkSize = this.config.chunkSize;
    
    // Create chunks
    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, toBlock);
      chunks.push({ start, end });
    }
    
    console.log(`   📦 Split into ${chunks.length} chunks of ${chunkSize} blocks`);
    
    const allTransactions = [];
    const allEvents = [];
    
    // Process chunks in parallel (max 3 concurrent)
    const maxConcurrent = 3;
    for (let i = 0; i < chunks.length; i += maxConcurrent) {
      const batch = chunks.slice(i, i + maxConcurrent);
      const progress = 20 + Math.floor((i / chunks.length) * 60);
      
      this._emitProgress('fetching', progress, 
        `Fetching chunk ${i + 1}-${Math.min(i + maxConcurrent, chunks.length)} of ${chunks.length}...`
      );
      
      const results = await Promise.all(
        batch.map(chunk => 
          this._withRetry(() => 
            this._fetchChunkData(contractAddress, chain, chunk.start, chunk.end)
          )
        )
      );
      
      // Merge results
      results.forEach(result => {
        allTransactions.push(...result.transactions);
        allEvents.push(...result.events);
      });
    }
    
    return { transactions: allTransactions, events: allEvents };
  }

  /**
   * Fetch data for a single chunk
   * @private
   */
  async _fetchChunkData(contractAddress, chain, fromBlock, toBlock) {
    console.log(`   🔍 Fetching chunk: ${fromBlock}-${toBlock}`);
    
    // Fetch transactions
    const txData = await this._withTimeout(
      this.fetcher.fetchTransactions(contractAddress, fromBlock, toBlock, chain),
      30000,
      'Transaction fetch timeout'
    );
    
    // Handle different return formats
    // LiskRpcClient returns array directly
    // Some clients might return {transactions, events}
    if (Array.isArray(txData)) {
      return {
        transactions: txData,
        events: []
      };
    } else if (txData && typeof txData === 'object') {
      return {
        transactions: txData.transactions || [],
        events: txData.events || []
      };
    } else {
      return {
        transactions: [],
        events: []
      };
    }
  }

  /**
   * Fast Quick Scan - 1 week of contract data with deployment detection
   * @param {string} contractAddress - Contract address
   * @param {string} chain - Blockchain network
   * @returns {Promise<Object>} Scan results with deployment info
   */
  async quickScan(contractAddress, chain) {
    console.log(`\n⚡ OPTIMIZED QUICK SCAN - Contract-Focused Analysis`);
    console.log('========================================================');
    console.log(`📍 Contract: ${contractAddress}`);
    console.log(`🔗 Chain: ${chain}`);
    
    const startTime = Date.now();
    const results = {
      contractAddress,
      chain,
      deploymentInfo: null,
      transactions: [],
      events: [],
      accounts: new Set(),
      blocks: new Set(),
      metrics: {
        totalTransactions: 0,
        totalEvents: 0,
        uniqueAccounts: 0,
        uniqueBlocks: 0,
        scanDuration: 0,
        blockRange: { from: 0, to: 0 },
        dataQuality: 'high'
      }
    };

    try {
      // Step 1: Get current block with caching and timeout
      this._emitProgress('init', 5, 'Getting current block number...');
      const currentBlock = await this._getCachedBlockNumber(chain);
      console.log(`📊 Current block: ${currentBlock.toLocaleString()}`);

      // Step 2: Calculate optimized scan range (10k blocks = 1-2 days)
      this._emitProgress('init', 10, 'Calculating block range...');
      const scanBlocks = Math.min(this.config.weekInBlocks, this.config.maxScanBlocks);
      const fromBlock = Math.max(0, currentBlock - scanBlocks);
      const toBlock = currentBlock;
      
      results.metrics.blockRange = { from: fromBlock, to: toBlock };
      
      console.log(`📅 Scanning last 1-2 days: ${fromBlock.toLocaleString()} → ${toBlock.toLocaleString()}`);
      console.log(`📦 Total blocks: ${(toBlock - fromBlock).toLocaleString()}`);
      console.log(`📦 Chunks: ${Math.ceil((toBlock - fromBlock) / this.config.chunkSize)}\n`);

      // Step 3: Fetch data in parallel chunks with retry
      this._emitProgress('fetching', 20, 'Fetching contract data in parallel chunks...');
      
      const { transactions, events } = await this._fetchInChunks(
        contractAddress, 
        chain, 
        fromBlock, 
        toBlock
      );
      
      results.transactions = transactions;
      results.events = events;
      
      console.log(`✅ Fetched ${transactions.length} transactions, ${events.length} events`);
      
      // Step 4: Process accounts and blocks
      this._emitProgress('processing', 85, 'Processing accounts and blocks...');
      
      transactions.forEach(tx => {
        results.accounts.add(tx.from);
        if (tx.to) results.accounts.add(tx.to);
        results.blocks.add(tx.blockNumber);
      });
      
      events.forEach(event => {
        results.blocks.add(event.blockNumber);
      });
      
      // Step 5: Calculate metrics
      this._emitProgress('finalizing', 95, 'Calculating metrics...');
      
      results.metrics.totalTransactions = transactions.length;
      results.metrics.totalEvents = events.length;
      results.metrics.uniqueAccounts = results.accounts.size;
      results.metrics.uniqueBlocks = results.blocks.size;
      results.metrics.scanDuration = Date.now() - startTime;
      
      // Convert Sets to Arrays for JSON serialization
      results.accounts = Array.from(results.accounts);
      results.blocks = Array.from(results.blocks);
      
      this._emitProgress('complete', 100, 'Quick scan complete!');
      
      console.log(`\n✅ QUICK SCAN COMPLETE`);
      console.log(`⏱️  Duration: ${(results.metrics.scanDuration / 1000).toFixed(2)}s`);
      console.log(`📊 Transactions: ${results.metrics.totalTransactions}`);
      console.log(`📋 Events: ${results.metrics.totalEvents}`);
      console.log(`👥 Unique Accounts: ${results.metrics.uniqueAccounts}`);
      console.log(`📦 Unique Blocks: ${results.metrics.uniqueBlocks}`);
      
      return results;
      
    } catch (error) {
      console.error(`❌ Quick scan failed:`, error);
      this._emitProgress('error', 0, `Scan failed: ${error.message}`);
      throw error;
    }
  }
}
