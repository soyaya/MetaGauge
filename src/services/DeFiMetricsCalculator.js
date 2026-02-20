/**
 * DeFi Metrics Calculator
 * Multi-Chain RPC Integration - Task 6
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { ethers } from 'ethers';

/**
 * Comprehensive DeFi metrics calculator with 20 key metrics
 * Supports time-series aggregations and multi-chain data
 */
export class DeFiMetricsCalculator {
  constructor(config = {}) {
    this.config = {
      // Time windows for calculations
      timeWindows: {
        hourly: 3600000,    // 1 hour in ms
        daily: 86400000,    // 1 day in ms
        weekly: 604800000,  // 1 week in ms
        monthly: 2592000000 // 30 days in ms
      },
      
      // Thresholds
      whaleThreshold: config.whaleThreshold || ethers.parseEther('10'), // 10 ETH
      activeUserThreshold: config.activeUserThreshold || 1, // 1 transaction
      
      // Aggregation settings
      enableTimeSeriesStorage: config.enableTimeSeriesStorage !== false,
      maxHistoryDays: config.maxHistoryDays || 365,
      
      ...config
    };
    
    // Internal storage
    this.transactions = [];
    this.users = new Map();
    this.timeSeriesData = new Map();
    this.lastCalculation = null;
  }

  /**
   * Add transaction data for metrics calculation
   * @param {Array} transactions - Normalized transaction array
   * @param {string} chain - Blockchain network
   */
  addTransactionData(transactions, chain = 'ethereum') {
    transactions.forEach(tx => {
      const enrichedTx = {
        ...tx,
        chain: chain,
        timestamp: new Date(tx.block_timestamp || tx.timestamp || Date.now()),
        valueEth: parseFloat(tx.value_eth || 0),
        gasCostEth: parseFloat(tx.gas_cost_eth || 0)
      };
      
      this.transactions.push(enrichedTx);
      this._updateUserData(enrichedTx);
    });
    
    // Sort by timestamp for time-series calculations
    this.transactions.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate all 20 DeFi metrics
   * @param {Date} startDate - Start date for calculation
   * @param {Date} endDate - End date for calculation
   * @returns {Object} Complete metrics object
   */
  calculateAllMetrics(startDate = null, endDate = null) {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - this.config.timeWindows.monthly);
    const end = endDate || now;
    
    const filteredTxs = this._filterTransactionsByDate(start, end);
    
    const metrics = {
      // Metadata
      calculatedAt: now.toISOString(),
      timeRange: { start: start.toISOString(), end: end.toISOString() },
      totalTransactions: filteredTxs.length,
      
      // User Lifecycle Metrics (5)
      userLifecycle: this._calculateUserLifecycleMetrics(filteredTxs, start, end),
      
      // Transaction & Activity Metrics (5)
      activity: this._calculateActivityMetrics(filteredTxs, start, end),
      
      // Financial Flow Metrics (5)
      financial: this._calculateFinancialMetrics(filteredTxs, start, end),
      
      // Protocol Performance Metrics (5)
      performance: this._calculatePerformanceMetrics(filteredTxs, start, end)
    };
    
    // Store time-series data
    if (this.config.enableTimeSeriesStorage) {
      this._storeTimeSeriesData(metrics, end);
    }
    
    this.lastCalculation = metrics;
    return metrics;
  }

  /**
   * Calculate User Lifecycle Metrics (5 metrics)
   * @private
   */
  _calculateUserLifecycleMetrics(transactions, start, end) {
    const users = this._getUniqueUsers(transactions);
    const totalUsers = users.size;
    
    if (totalUsers === 0) {
      return {
        activationRate: 0,
        adoptionRate: 0,
        retentionRate: 0,
        churnRate: 0,
        lifecycleDistribution: { new: 0, active: 0, established: 0, veteran: 0, dormant: 0 }
      };
    }

    // 1. Activation Rate - users who made >1 transaction
    const activatedUsers = Array.from(users.values()).filter(user => user.txCount > 1).length;
    const activationRate = (activatedUsers / totalUsers) * 100;

    // 2. Adoption Rate - new users in period
    const periodStart = start.getTime();
    const newUsers = Array.from(users.values()).filter(user => 
      user.firstSeen >= periodStart
    ).length;
    const adoptionRate = totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0;

    // 3. Retention Rate - users active in both periods
    const midPoint = new Date((start.getTime() + end.getTime()) / 2);
    const firstHalfUsers = new Set();
    const secondHalfUsers = new Set();
    
    transactions.forEach(tx => {
      if (tx.timestamp < midPoint) {
        firstHalfUsers.add(tx.from_address);
      } else {
        secondHalfUsers.add(tx.from_address);
      }
    });
    
    const retainedUsers = [...firstHalfUsers].filter(user => secondHalfUsers.has(user)).length;
    const retentionRate = firstHalfUsers.size > 0 ? (retainedUsers / firstHalfUsers.size) * 100 : 0;

    // 4. Churn Rate
    const churnRate = 100 - retentionRate;

    // 5. User Lifecycle Stage Distribution
    const lifecycleDistribution = this._calculateLifecycleDistribution(users);

    return {
      activationRate: Math.round(activationRate * 100) / 100,
      adoptionRate: Math.round(adoptionRate * 100) / 100,
      retentionRate: Math.round(retentionRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      lifecycleDistribution
    };
  }

  /**
   * Calculate Transaction & Activity Metrics (5 metrics)
   * @private
   */
  _calculateActivityMetrics(transactions, start, end) {
    const now = end.getTime();
    const dayMs = this.config.timeWindows.daily;
    const weekMs = this.config.timeWindows.weekly;
    const monthMs = this.config.timeWindows.monthly;

    // 1. DAU - Daily Active Users
    const dau = this._getActiveUsersInPeriod(transactions, now - dayMs, now);

    // 2. WAU - Weekly Active Users  
    const wau = this._getActiveUsersInPeriod(transactions, now - weekMs, now);

    // 3. MAU - Monthly Active Users
    const mau = this._getActiveUsersInPeriod(transactions, now - monthMs, now);

    // 4. Transaction Volume (total value)
    const transactionVolume = transactions.reduce((sum, tx) => sum + tx.valueEth, 0);

    // 5. Average Transaction Size
    const averageTransactionSize = transactions.length > 0 ? 
      transactionVolume / transactions.length : 0;

    return {
      dau,
      wau, 
      mau,
      transactionVolume: Math.round(transactionVolume * 1000000) / 1000000, // 6 decimals
      averageTransactionSize: Math.round(averageTransactionSize * 1000000) / 1000000
    };
  }

  /**
   * Calculate Financial Flow Metrics (5 metrics)
   * @private
   */
  _calculateFinancialMetrics(transactions, start, end) {
    // 1. TVL - Total Value Locked (simplified as total inflow - outflow)
    let totalInflow = 0;
    let totalOutflow = 0;
    
    transactions.forEach(tx => {
      if (tx.to_address && this._isProtocolAddress(tx.to_address)) {
        totalInflow += tx.valueEth;
      }
      if (tx.from_address && this._isProtocolAddress(tx.from_address)) {
        totalOutflow += tx.valueEth;
      }
    });
    
    const tvl = Math.max(0, totalInflow - totalOutflow);

    // 2. Net Inflow/Outflow
    const netFlow = totalInflow - totalOutflow;

    // 3. Revenue per User
    const uniqueUsers = this._getUniqueUsers(transactions).size;
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.gasCostEth, 0);
    const revenuePerUser = uniqueUsers > 0 ? totalRevenue / uniqueUsers : 0;

    // 4. Protocol Revenue (total gas fees)
    const protocolRevenue = totalRevenue;

    // 5. Whale Activity Ratio
    const whaleTransactions = transactions.filter(tx => {
      try {
        // Convert scientific notation to decimal string if needed
        const valueStr = tx.valueEth.toString();
        const valueInEth = parseFloat(valueStr);
        
        // Skip extremely small values that would cause parseEther to fail
        if (valueInEth < 1e-15) {
          return false;
        }
        
        // Skip extremely large values that would overflow
        if (valueInEth > 1e18) {
          console.warn(`Value too large for parseEther: ${valueInEth}`);
          return true; // Assume it's a whale transaction
        }
        
        // Convert to proper decimal string format
        const decimalStr = valueInEth.toFixed(18);
        return ethers.parseEther(decimalStr) >= this.config.whaleThreshold;
      } catch (error) {
        console.warn(`Failed to parse value for whale detection: ${tx.valueEth}`, error);
        return false;
      }
    }).length;
    const whaleActivityRatio = transactions.length > 0 ? 
      (whaleTransactions / transactions.length) * 100 : 0;

    return {
      tvl: Math.round(tvl * 1000000) / 1000000,
      netInflow: Math.round(totalInflow * 1000000) / 1000000,
      netOutflow: Math.round(totalOutflow * 1000000) / 1000000,
      netFlow: Math.round(netFlow * 1000000) / 1000000,
      revenuePerUser: Math.round(revenuePerUser * 1000000) / 1000000,
      protocolRevenue: Math.round(protocolRevenue * 1000000) / 1000000,
      whaleActivityRatio: Math.round(whaleActivityRatio * 100) / 100
    };
  }

  /**
   * Calculate Protocol Performance Metrics (5 metrics)
   * @private
   */
  _calculatePerformanceMetrics(transactions, start, end) {
    // 1. Function Success Rate
    const successfulTxs = transactions.filter(tx => tx.status === true || tx.status === 1).length;
    const functionSuccessRate = transactions.length > 0 ? 
      (successfulTxs / transactions.length) * 100 : 0;

    // 2. Average Gas Cost
    const totalGasCost = transactions.reduce((sum, tx) => sum + tx.gasCostEth, 0);
    const averageGasCost = transactions.length > 0 ? totalGasCost / transactions.length : 0;

    // 3. Contract Utilization Rate (transactions per day)
    const periodDays = (end.getTime() - start.getTime()) / this.config.timeWindows.daily;
    const contractUtilizationRate = periodDays > 0 ? transactions.length / periodDays : 0;

    // 4. Cross-Contract Interaction Rate
    const uniqueContracts = new Set();
    transactions.forEach(tx => {
      if (tx.to_address) uniqueContracts.add(tx.to_address);
      if (tx.from_address) uniqueContracts.add(tx.from_address);
    });
    const crossContractInteractionRate = uniqueContracts.size;

    // 5. Protocol Stickiness (repeat users ratio)
    const users = this._getUniqueUsers(transactions);
    const repeatUsers = Array.from(users.values()).filter(user => user.txCount > 1).length;
    const protocolStickiness = users.size > 0 ? (repeatUsers / users.size) * 100 : 0;

    return {
      functionSuccessRate: Math.round(functionSuccessRate * 100) / 100,
      averageGasCost: Math.round(averageGasCost * 1000000) / 1000000,
      contractUtilizationRate: Math.round(contractUtilizationRate * 100) / 100,
      crossContractInteractionRate,
      protocolStickiness: Math.round(protocolStickiness * 100) / 100
    };
  }

  /**
   * Get time-series data for specific metric
   * @param {string} metric - Metric name
   * @param {string} timeframe - hourly, daily, weekly, monthly
   * @param {number} periods - Number of periods to return
   * @returns {Array} Time-series data points
   */
  getTimeSeriesData(metric, timeframe = 'daily', periods = 30) {
    const key = `${metric}_${timeframe}`;
    const data = this.timeSeriesData.get(key) || [];
    
    return data.slice(-periods).map(point => ({
      timestamp: point.timestamp,
      value: point.value,
      period: point.period
    }));
  }

  /**
   * Get metrics summary for dashboard
   * @returns {Object} Key metrics summary
   */
  getMetricsSummary() {
    if (!this.lastCalculation) {
      return { error: 'No metrics calculated yet' };
    }

    const metrics = this.lastCalculation;
    
    return {
      // Key Performance Indicators
      totalUsers: this._getUniqueUsers(this.transactions).size,
      dau: metrics.activity.dau,
      mau: metrics.activity.mau,
      tvl: metrics.financial.tvl,
      
      // Growth Metrics
      adoptionRate: metrics.userLifecycle.adoptionRate,
      retentionRate: metrics.userLifecycle.retentionRate,
      
      // Performance Metrics
      successRate: metrics.performance.functionSuccessRate,
      avgGasCost: metrics.performance.averageGasCost,
      
      // Financial Metrics
      volume: metrics.activity.transactionVolume,
      revenue: metrics.financial.protocolRevenue,
      
      // Last updated
      lastUpdated: metrics.calculatedAt
    };
  }

  // Helper methods
  _updateUserData(tx) {
    const address = tx.from_address;
    if (!address) return;
    
    if (!this.users.has(address)) {
      this.users.set(address, {
        address,
        firstSeen: tx.timestamp.getTime(),
        lastSeen: tx.timestamp.getTime(),
        txCount: 0,
        totalValue: 0,
        totalGasCost: 0
      });
    }
    
    const user = this.users.get(address);
    user.txCount++;
    user.totalValue += tx.valueEth;
    user.totalGasCost += tx.gasCostEth;
    user.lastSeen = Math.max(user.lastSeen, tx.timestamp.getTime());
  }

  _filterTransactionsByDate(start, end) {
    return this.transactions.filter(tx => 
      tx.timestamp >= start && tx.timestamp <= end
    );
  }

  _getUniqueUsers(transactions) {
    const users = new Map();
    transactions.forEach(tx => {
      if (tx.from_address) {
        if (!users.has(tx.from_address)) {
          users.set(tx.from_address, {
            address: tx.from_address,
            txCount: 0,
            firstSeen: tx.timestamp.getTime(),
            lastSeen: tx.timestamp.getTime()
          });
        }
        const user = users.get(tx.from_address);
        user.txCount++;
        user.lastSeen = Math.max(user.lastSeen, tx.timestamp.getTime());
      }
    });
    return users;
  }

  _getActiveUsersInPeriod(transactions, startTime, endTime) {
    const activeUsers = new Set();
    transactions.forEach(tx => {
      if (tx.timestamp.getTime() >= startTime && tx.timestamp.getTime() <= endTime) {
        if (tx.from_address) activeUsers.add(tx.from_address);
      }
    });
    return activeUsers.size;
  }

  _calculateLifecycleDistribution(users) {
    const now = Date.now();
    const dayMs = this.config.timeWindows.daily;
    
    const distribution = { new: 0, active: 0, established: 0, veteran: 0, dormant: 0 };
    
    users.forEach(user => {
      const daysSinceFirst = (now - user.firstSeen) / dayMs;
      const daysSinceLast = (now - user.lastSeen) / dayMs;
      
      if (daysSinceLast > 30) {
        distribution.dormant++;
      } else if (daysSinceFirst < 7) {
        distribution.new++;
      } else if (daysSinceFirst < 30) {
        distribution.active++;
      } else if (daysSinceFirst < 90) {
        distribution.established++;
      } else {
        distribution.veteran++;
      }
    });
    
    return distribution;
  }

  _isProtocolAddress(address) {
    // Simplified - in real implementation, check against known protocol addresses
    return address && address.length === 42;
  }

  _storeTimeSeriesData(metrics, timestamp) {
    const timeKey = timestamp.toISOString().split('T')[0]; // Daily key
    
    // Store key metrics in time series
    const metricsToStore = [
      { key: 'dau_daily', value: metrics.activity.dau },
      { key: 'tvl_daily', value: metrics.financial.tvl },
      { key: 'volume_daily', value: metrics.activity.transactionVolume },
      { key: 'revenue_daily', value: metrics.financial.protocolRevenue }
    ];
    
    metricsToStore.forEach(({ key, value }) => {
      if (!this.timeSeriesData.has(key)) {
        this.timeSeriesData.set(key, []);
      }
      
      const series = this.timeSeriesData.get(key);
      series.push({
        timestamp: timestamp.toISOString(),
        value,
        period: timeKey
      });
      
      // Limit history
      const maxPoints = this.config.maxHistoryDays;
      if (series.length > maxPoints) {
        series.splice(0, series.length - maxPoints);
      }
    });
  }
}
