/**
 * Financial Flow Analyzer
 * 
 * Analyzes financial behavior including inflow/outflow, spending power segmentation,
 * engagement value, cash flow velocity, and Sankey diagram data generation.
 */
export class FinancialFlowAnalyzer {
  /**
   * Creates an instance of FinancialFlowAnalyzer
   * @param {Object} thresholds - Spending power thresholds
   */
  constructor(thresholds = {}) {
    // Default thresholds for spending power classification (in ETH)
    this.thresholds = {
      whale: thresholds.whale || 10,      // >= 10 ETH
      dolphin: thresholds.dolphin || 1,   // >= 1 ETH and < 10 ETH
      // shrimp: < 1 ETH
      ...thresholds
    };
  }

  /**
   * Analyze financial flows for all wallets
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {string} targetContract - Target contract address to analyze
   * @returns {Object} Financial flow analysis
   */
  analyzeFinancialFlows(transactions, targetContract) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        wallets: [],
        summary: this._getEmptySummary()
      };
    }

    const targetContractLower = targetContract ? targetContract.toLowerCase() : null;
    
    // Group transactions by wallet
    const walletTransactions = this._groupByWallet(transactions);
    
    // Analyze each wallet
    const walletAnalyses = [];
    for (const [wallet, txs] of walletTransactions) {
      const analysis = this.analyzeWallet(txs, targetContractLower);
      walletAnalyses.push(analysis);
    }
    
    // Generate summary statistics
    const summary = this._generateSummary(walletAnalyses);
    
    return {
      wallets: walletAnalyses,
      summary
    };
  }

  /**
   * Analyze financial flows for a single wallet
   * @param {Array<Object>} transactions - Wallet's transactions
   * @param {string|null} targetContract - Optional target contract address
   * @returns {Object} Wallet financial analysis
   */
  analyzeWallet(transactions, targetContract = null) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyWalletAnalysis(null);
    }

    const wallet = transactions[0].wallet;
    
    // Calculate inflow and outflow
    const { totalInflow, totalOutflow } = this._calculateFlows(transactions, wallet);
    
    // Calculate net position
    const netPosition = totalInflow - totalOutflow;
    
    // Calculate engagement value (ETH + gas spent on target contract)
    const engagementValue = this._calculateEngagementValue(transactions, targetContract);
    
    // Calculate cash flow velocity (turnover ratio)
    const velocity = this._calculateVelocity(transactions, totalInflow, totalOutflow);
    
    // Classify spending power
    const totalVolume = totalInflow + totalOutflow;
    const spendingPower = this._classifySpendingPower(totalVolume);
    
    return {
      wallet,
      totalInflow,
      totalOutflow,
      netPosition,
      engagementValue,
      velocity,
      spendingPower,
      transactionCount: transactions.length,
      totalGasSpent: transactions.reduce((sum, tx) => sum + tx.gasCostEth, 0)
    };
  }

  /**
   * Segment users by spending power
   * @param {Array<Object>} walletAnalyses - Array of wallet analyses
   * @returns {Object} Segmented users
   */
  segmentBySpendingPower(walletAnalyses) {
    const segments = {
      whale: [],
      dolphin: [],
      shrimp: []
    };
    
    for (const analysis of walletAnalyses) {
      segments[analysis.spendingPower].push(analysis);
    }
    
    return segments;
  }

  /**
   * Generate Sankey diagram data showing value flows
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {string} targetContract - Target contract address
   * @returns {Object} Sankey diagram data
   */
  generateSankeyData(transactions, targetContract) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        nodes: [],
        links: [],
        totalFlow: 0
      };
    }

    const targetContractLower = targetContract ? targetContract.toLowerCase() : null;
    
    // Create nodes and links
    const nodes = new Map();
    const links = [];
    let nodeIndex = 0;
    
    // Helper to get or create node
    const getNodeIndex = (address, label) => {
      if (!nodes.has(address)) {
        nodes.set(address, {
          index: nodeIndex++,
          id: address,
          label: label || this._shortenAddress(address)
        });
      }
      return nodes.get(address).index;
    };
    
    // Add target contract node
    const targetIndex = getNodeIndex(targetContractLower, 'Target Contract');
    
    // Track flows
    const flowMap = new Map();
    
    for (const tx of transactions) {
      const from = tx.wallet.toLowerCase();
      const to = tx.contractAddress ? tx.contractAddress.toLowerCase() : null;
      
      if (!to) continue;
      
      const value = tx.valueEth + tx.gasCostEth;
      
      // Create flow key
      const flowKey = `${from}->${to}`;
      
      if (!flowMap.has(flowKey)) {
        flowMap.set(flowKey, {
          source: from,
          target: to,
          value: 0
        });
      }
      
      flowMap.get(flowKey).value += value;
    }
    
    // Convert flows to links
    for (const flow of flowMap.values()) {
      const sourceIndex = getNodeIndex(flow.source, null);
      const targetIndex = getNodeIndex(flow.target, null);
      
      links.push({
        source: sourceIndex,
        target: targetIndex,
        value: flow.value
      });
    }
    
    // Calculate total flow
    const totalFlow = links.reduce((sum, link) => sum + link.value, 0);
    
    return {
      nodes: Array.from(nodes.values()),
      links,
      totalFlow
    };
  }

  /**
   * Calculate total inflow and outflow for a wallet
   * @private
   */
  _calculateFlows(transactions, wallet) {
    let totalInflow = 0;
    let totalOutflow = 0;
    
    for (const tx of transactions) {
      const value = tx.valueEth;
      const gas = tx.gasCostEth;
      
      // Determine if this is inflow or outflow
      // If wallet is sender (from), it's outflow
      // If wallet is receiver (to), it's inflow
      if (tx.wallet.toLowerCase() === wallet.toLowerCase()) {
        // Wallet is sender - outflow
        totalOutflow += value + gas;
      } else {
        // Wallet is receiver - inflow
        totalInflow += value;
      }
    }
    
    return { totalInflow, totalOutflow };
  }

  /**
   * Calculate engagement value (ETH + gas spent on target contract)
   * @private
   */
  _calculateEngagementValue(transactions, targetContract) {
    if (!targetContract) {
      // If no target contract specified, sum all value and gas
      return transactions.reduce((sum, tx) => sum + tx.valueEth + tx.gasCostEth, 0);
    }
    
    const targetLower = targetContract.toLowerCase();
    let engagementValue = 0;
    
    for (const tx of transactions) {
      if (tx.contractAddress && tx.contractAddress.toLowerCase() === targetLower) {
        engagementValue += tx.valueEth + tx.gasCostEth;
      }
    }
    
    return engagementValue;
  }

  /**
   * Calculate cash flow velocity (turnover ratio)
   * @private
   */
  _calculateVelocity(transactions, totalInflow, totalOutflow) {
    if (transactions.length === 0) {
      return 0;
    }
    
    // Get time span
    const timestamps = transactions.map(tx => tx.timestamp.getTime()).sort((a, b) => a - b);
    const timeSpanDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 60 * 60 * 1000);
    
    if (timeSpanDays === 0) {
      return 0;
    }
    
    // Calculate average balance
    const avgBalance = (totalInflow + totalOutflow) / 2;
    
    if (avgBalance === 0) {
      return 0;
    }
    
    // Velocity = total volume / (average balance * time period)
    const totalVolume = totalInflow + totalOutflow;
    const velocity = totalVolume / (avgBalance * timeSpanDays);
    
    return velocity;
  }

  /**
   * Classify spending power based on total volume
   * @private
   */
  _classifySpendingPower(totalVolume) {
    if (totalVolume >= this.thresholds.whale) {
      return 'whale';
    } else if (totalVolume >= this.thresholds.dolphin) {
      return 'dolphin';
    } else {
      return 'shrimp';
    }
  }

  /**
   * Group transactions by wallet
   * @private
   */
  _groupByWallet(transactions) {
    const walletMap = new Map();
    
    for (const tx of transactions) {
      const wallet = tx.wallet.toLowerCase();
      
      if (!walletMap.has(wallet)) {
        walletMap.set(wallet, []);
      }
      
      walletMap.get(wallet).push(tx);
    }
    
    return walletMap;
  }

  /**
   * Generate summary statistics
   * @private
   */
  _generateSummary(walletAnalyses) {
    if (walletAnalyses.length === 0) {
      return this._getEmptySummary();
    }
    
    const totalInflow = walletAnalyses.reduce((sum, w) => sum + w.totalInflow, 0);
    const totalOutflow = walletAnalyses.reduce((sum, w) => sum + w.totalOutflow, 0);
    const totalEngagement = walletAnalyses.reduce((sum, w) => sum + w.engagementValue, 0);
    const totalGas = walletAnalyses.reduce((sum, w) => sum + w.totalGasSpent, 0);
    
    // Count by spending power
    const whales = walletAnalyses.filter(w => w.spendingPower === 'whale').length;
    const dolphins = walletAnalyses.filter(w => w.spendingPower === 'dolphin').length;
    const shrimps = walletAnalyses.filter(w => w.spendingPower === 'shrimp').length;
    
    return {
      totalWallets: walletAnalyses.length,
      totalInflow,
      totalOutflow,
      netPosition: totalInflow - totalOutflow,
      totalEngagementValue: totalEngagement,
      totalGasSpent: totalGas,
      averageEngagementPerWallet: totalEngagement / walletAnalyses.length,
      spendingPowerDistribution: {
        whale: whales,
        dolphin: dolphins,
        shrimp: shrimps
      }
    };
  }

  /**
   * Get empty summary
   * @private
   */
  _getEmptySummary() {
    return {
      totalWallets: 0,
      totalInflow: 0,
      totalOutflow: 0,
      netPosition: 0,
      totalEngagementValue: 0,
      totalGasSpent: 0,
      averageEngagementPerWallet: 0,
      spendingPowerDistribution: {
        whale: 0,
        dolphin: 0,
        shrimp: 0
      }
    };
  }

  /**
   * Get empty wallet analysis
   * @private
   */
  _getEmptyWalletAnalysis(wallet) {
    return {
      wallet,
      totalInflow: 0,
      totalOutflow: 0,
      netPosition: 0,
      engagementValue: 0,
      velocity: 0,
      spendingPower: 'shrimp',
      transactionCount: 0,
      totalGasSpent: 0
    };
  }

  /**
   * Shorten address for display
   * @private
   */
  _shortenAddress(address) {
    if (!address || address.length < 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Set spending power thresholds
   * @param {Object} thresholds - New thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };
  }

  /**
   * Get current thresholds
   * @returns {Object} Current thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }
}

export default FinancialFlowAnalyzer;
