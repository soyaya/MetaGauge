/**
 * Transaction Flow Analyzer
 * Multi-Chain RPC Integration - Task 4
 * Requirements: 6.1, 6.3, 8.1, 8.2, 9.1, 9.2
 */

import { ethers } from 'ethers';

/**
 * Comprehensive transaction flow tracking and analysis
 * Handles gas calculations, balance tracking, and flow mapping across chains
 */
export class TransactionFlowAnalyzer {
  constructor(config = {}) {
    this.config = {
      // Gas calculation settings
      gasTrackingEnabled: config.gasTrackingEnabled !== false,
      balanceTrackingEnabled: config.balanceTrackingEnabled !== false,
      
      // Snapshot settings
      snapshotInterval: config.snapshotInterval || 'daily', // daily, hourly, block
      maxSnapshots: config.maxSnapshots || 1000,
      
      // Flow analysis settings
      flowThreshold: config.flowThreshold || ethers.parseEther('0.01'), // Minimum flow to track
      
      ...config
    };
    
    // Internal state
    this.balances = new Map(); // address -> balance
    this.flowHistory = [];
    this.gasMetrics = new Map();
    this.snapshots = [];
  }

  /**
   * Analyze transaction flow and update internal state
   * @param {Object} transaction - Normalized transaction object
   * @param {string} chain - Blockchain network
   * @returns {Object} Flow analysis result
   */
  analyzeTransaction(transaction, chain = 'ethereum') {
    const analysis = {
      transactionHash: transaction.hash,
      chain: chain,
      timestamp: transaction.timestamp,
      gasAnalysis: null,
      flowAnalysis: null,
      balanceUpdates: []
    };

    // 1. Gas fee calculation
    if (this.config.gasTrackingEnabled) {
      analysis.gasAnalysis = this._calculateGasFees(transaction, chain);
    }

    // 2. Flow analysis (inflow/outflow)
    if (transaction.from && transaction.to) {
      analysis.flowAnalysis = this._analyzeFlow(transaction, chain);
    }

    // 3. Balance tracking
    if (this.config.balanceTrackingEnabled) {
      analysis.balanceUpdates = this._updateBalances(transaction, chain);
    }

    // Store in history
    this.flowHistory.push(analysis);

    return analysis;
  }

  /**
   * Calculate comprehensive gas fees for transaction
   * @private
   */
  _calculateGasFees(transaction, chain) {
    const gasUsed = BigInt(transaction.gasUsed || 0);
    const gasPrice = BigInt(transaction.gasPrice || transaction.effectiveGasPrice || 0);
    
    // Calculate gas cost in wei
    const gasCostWei = gasUsed * gasPrice;
    
    // Convert to ETH (or native token)
    const gasCostEth = ethers.formatEther(gasCostWei);
    
    const gasAnalysis = {
      gasUsed: gasUsed.toString(),
      gasPrice: gasPrice.toString(),
      gasCostWei: gasCostWei.toString(),
      gasCostEth: parseFloat(gasCostEth),
      gasLimit: transaction.gasLimit ? BigInt(transaction.gasLimit).toString() : null,
      gasEfficiency: null
    };

    // Calculate gas efficiency (used/limit ratio)
    if (transaction.gasLimit) {
      const gasLimit = BigInt(transaction.gasLimit);
      gasAnalysis.gasEfficiency = gasLimit > 0n ? 
        Number(gasUsed * 10000n / gasLimit) / 100 : 0; // Percentage with 2 decimals
    }

    // Update gas metrics
    this._updateGasMetrics(transaction.from, gasAnalysis, chain);

    return gasAnalysis;
  }

  /**
   * Analyze transaction flow (inflow/outflow)
   * @private
   */
  _analyzeFlow(transaction, chain) {
    const value = BigInt(transaction.value || 0);
    const valueEth = parseFloat(ethers.formatEther(value));
    
    const flowAnalysis = {
      from: transaction.from,
      to: transaction.to,
      valueWei: value.toString(),
      valueEth: valueEth,
      flowType: this._determineFlowType(transaction),
      isSignificant: value >= this.config.flowThreshold
    };

    // Add source/destination mapping
    flowAnalysis.sourceType = this._classifyAddress(transaction.from, chain);
    flowAnalysis.destinationType = this._classifyAddress(transaction.to, chain);

    return flowAnalysis;
  }

  /**
   * Update balance tracking for addresses
   * @private
   */
  _updateBalances(transaction, chain) {
    const updates = [];
    const value = BigInt(transaction.value || 0);
    const gasUsed = BigInt(transaction.gasUsed || 0);
    const gasPrice = BigInt(transaction.gasPrice || transaction.effectiveGasPrice || 0);
    const gasCost = gasUsed * gasPrice;

    // Update sender balance (subtract value + gas)
    if (transaction.from) {
      const fromKey = `${chain}:${transaction.from}`;
      const currentBalance = this.balances.get(fromKey) || 0n;
      const newBalance = currentBalance - value - gasCost;
      
      this.balances.set(fromKey, newBalance);
      updates.push({
        address: transaction.from,
        chain: chain,
        previousBalance: currentBalance.toString(),
        newBalance: newBalance.toString(),
        change: (-(value + gasCost)).toString(),
        changeType: 'outflow'
      });
    }

    // Update recipient balance (add value)
    if (transaction.to && value > 0n) {
      const toKey = `${chain}:${transaction.to}`;
      const currentBalance = this.balances.get(toKey) || 0n;
      const newBalance = currentBalance + value;
      
      this.balances.set(toKey, newBalance);
      updates.push({
        address: transaction.to,
        chain: chain,
        previousBalance: currentBalance.toString(),
        newBalance: newBalance.toString(),
        change: value.toString(),
        changeType: 'inflow'
      });
    }

    return updates;
  }

  /**
   * Create balance snapshot for historical analysis
   * @param {string} label - Snapshot label
   * @returns {Object} Snapshot data
   */
  createBalanceSnapshot(label = null) {
    const snapshot = {
      id: `snapshot_${Date.now()}`,
      label: label || `Auto_${new Date().toISOString()}`,
      timestamp: new Date().toISOString(),
      totalAddresses: this.balances.size,
      balances: new Map(this.balances), // Deep copy
      summary: this._calculateBalanceSummary()
    };

    this.snapshots.push(snapshot);

    // Limit snapshots to prevent memory issues
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift(); // Remove oldest
    }

    return snapshot;
  }

  /**
   * Get flow analysis for specific address
   * @param {string} address - Address to analyze
   * @param {string} chain - Optional chain filter
   * @returns {Object} Address flow summary
   */
  getAddressFlowSummary(address, chain = null) {
    const flows = this.flowHistory.filter(flow => {
      const matchesAddress = flow.flowAnalysis && 
        (flow.flowAnalysis.from === address || flow.flowAnalysis.to === address);
      const matchesChain = !chain || flow.chain === chain;
      return matchesAddress && matchesChain;
    });

    let totalInflow = 0;
    let totalOutflow = 0;
    let transactionCount = flows.length;

    flows.forEach(flow => {
      if (flow.flowAnalysis) {
        if (flow.flowAnalysis.to === address) {
          totalInflow += flow.flowAnalysis.valueEth;
        }
        if (flow.flowAnalysis.from === address) {
          totalOutflow += flow.flowAnalysis.valueEth;
        }
      }
    });

    return {
      address,
      chain,
      transactionCount,
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      averageTransactionSize: transactionCount > 0 ? (totalInflow + totalOutflow) / transactionCount : 0
    };
  }

  /**
   * Get gas efficiency metrics for address
   * @param {string} address - Address to analyze
   * @returns {Object} Gas metrics
   */
  getGasMetrics(address) {
    return this.gasMetrics.get(address) || {
      totalTransactions: 0,
      totalGasUsed: '0',
      totalGasCost: 0,
      averageGasPrice: 0,
      averageGasUsed: 0,
      averageEfficiency: 0
    };
  }

  /**
   * Update gas metrics for address
   * @private
   */
  _updateGasMetrics(address, gasAnalysis, chain) {
    const key = `${chain}:${address}`;
    const current = this.gasMetrics.get(key) || {
      totalTransactions: 0,
      totalGasUsed: '0',
      totalGasCost: 0,
      averageGasPrice: 0,
      averageGasUsed: 0,
      averageEfficiency: 0,
      chain: chain
    };

    current.totalTransactions += 1;
    current.totalGasUsed = (BigInt(current.totalGasUsed) + BigInt(gasAnalysis.gasUsed)).toString();
    current.totalGasCost += gasAnalysis.gasCostEth;

    // Calculate averages
    current.averageGasPrice = current.totalGasCost / current.totalTransactions;
    current.averageGasUsed = Number(BigInt(current.totalGasUsed) / BigInt(current.totalTransactions));
    
    if (gasAnalysis.gasEfficiency !== null) {
      current.averageEfficiency = (current.averageEfficiency * (current.totalTransactions - 1) + 
        gasAnalysis.gasEfficiency) / current.totalTransactions;
    }

    this.gasMetrics.set(key, current);
  }

  /**
   * Determine flow type based on transaction
   * @private
   */
  _determineFlowType(transaction) {
    if (!transaction.to) return 'contract_creation';
    if (transaction.input && transaction.input !== '0x') return 'contract_interaction';
    return 'transfer';
  }

  /**
   * Classify address type
   * @private
   */
  _classifyAddress(address, chain) {
    // This could be enhanced with contract detection logic
    if (!address) return 'unknown';
    
    // Simple heuristics - could be expanded
    if (address === '0x0000000000000000000000000000000000000000') return 'burn';
    
    // Could add contract detection, exchange detection, etc.
    return 'wallet';
  }

  /**
   * Calculate balance summary statistics
   * @private
   */
  _calculateBalanceSummary() {
    if (this.balances.size === 0) {
      return { totalBalance: '0', averageBalance: '0', nonZeroAddresses: 0 };
    }

    let totalBalance = 0n;
    let nonZeroCount = 0;

    for (const balance of this.balances.values()) {
      totalBalance += balance;
      if (balance > 0n) nonZeroCount++;
    }

    return {
      totalBalance: totalBalance.toString(),
      averageBalance: this.balances.size > 0 ? 
        (totalBalance / BigInt(this.balances.size)).toString() : '0',
      nonZeroAddresses: nonZeroCount
    };
  }

  /**
   * Export flow data for analysis
   * @returns {Object} Complete flow analysis data
   */
  exportFlowData() {
    return {
      config: this.config,
      flowHistory: this.flowHistory,
      balances: Object.fromEntries(
        Array.from(this.balances.entries()).map(([k, v]) => [k, v.toString()])
      ),
      gasMetrics: Object.fromEntries(this.gasMetrics),
      snapshots: this.snapshots.map(s => ({
        ...s,
        balances: Object.fromEntries(
          Array.from(s.balances.entries()).map(([k, v]) => [k, v.toString()])
        )
      })),
      summary: {
        totalTransactions: this.flowHistory.length,
        totalAddresses: this.balances.size,
        totalSnapshots: this.snapshots.length
      }
    };
  }
}
