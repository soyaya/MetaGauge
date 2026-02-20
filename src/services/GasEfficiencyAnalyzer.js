/**
 * Gas Efficiency Analyzer
 * 
 * Analyzes gas usage patterns, transaction success rates, and gas efficiency metrics.
 * Tracks average gas per function, failure rates, wasted gas, and gas price trends.
 */
export class GasEfficiencyAnalyzer {
  /**
   * Creates an instance of GasEfficiencyAnalyzer
   * @param {Object} benchmarks - Optional industry standard benchmarks
   */
  constructor(benchmarks = {}) {
    // Default industry benchmarks for common function types (in gas units)
    this.benchmarks = {
      transfer: benchmarks.transfer || 21000,
      swap: benchmarks.swap || 150000,
      addLiquidity: benchmarks.addLiquidity || 200000,
      removeLiquidity: benchmarks.removeLiquidity || 180000,
      approve: benchmarks.approve || 45000,
      ...benchmarks
    };
  }

  /**
   * Analyze gas efficiency for all transactions
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Gas efficiency analysis
   */
  analyzeGasEfficiency(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return this._getEmptyAnalysis();
    }

    // Calculate metrics by function
    const functionMetrics = this._calculateFunctionMetrics(transactions);
    
    // Calculate overall metrics
    const overallMetrics = this._calculateOverallMetrics(transactions);
    
    // Track gas price trends
    const gasPriceTrends = this._calculateGasPriceTrends(transactions);
    
    // Benchmark against industry standards
    const benchmarkComparison = this._benchmarkAgainstStandards(functionMetrics);
    
    return {
      functionMetrics: Array.from(functionMetrics.values()),
      overallMetrics,
      gasPriceTrends,
      benchmarkComparison
    };
  }

  /**
   * Calculate average gas used per function signature
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {string} functionSignature - Function signature to analyze
   * @returns {number} Average gas used
   */
  calculateAverageGas(transactions, functionSignature) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return 0;
    }

    const functionTxs = transactions.filter(tx => 
      tx.functionSignature === functionSignature
    );

    if (functionTxs.length === 0) {
      return 0;
    }

    const totalGas = functionTxs.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
    return totalGas / functionTxs.length;
  }

  /**
   * Calculate failure rate per function
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {string} functionSignature - Function signature to analyze
   * @returns {number} Failure rate (0-1)
   */
  calculateFailureRate(transactions, functionSignature) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return 0;
    }

    const functionTxs = transactions.filter(tx => 
      tx.functionSignature === functionSignature
    );

    if (functionTxs.length === 0) {
      return 0;
    }

    const failedCount = functionTxs.filter(tx => !tx.success).length;
    return failedCount / functionTxs.length;
  }

  /**
   * Calculate wasted gas from failed transactions
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {string} functionSignature - Function signature to analyze
   * @returns {number} Total wasted gas
   */
  calculateWastedGas(transactions, functionSignature) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return 0;
    }

    const functionTxs = transactions.filter(tx => 
      tx.functionSignature === functionSignature && !tx.success
    );

    return functionTxs.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
  }

  /**
   * Calculate metrics for each function signature
   * @private
   */
  _calculateFunctionMetrics(transactions) {
    const functionMap = new Map();

    for (const tx of transactions) {
      const sig = tx.functionSignature || 'unknown';
      
      if (!functionMap.has(sig)) {
        functionMap.set(sig, {
          functionSignature: sig,
          functionName: tx.functionName || 'unknown',
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          totalGasUsed: 0,
          totalWastedGas: 0,
          averageGasUsed: 0,
          failureRate: 0,
          gasPrices: []
        });
      }

      const metrics = functionMap.get(sig);
      metrics.totalTransactions++;
      
      if (tx.success) {
        metrics.successfulTransactions++;
      } else {
        metrics.failedTransactions++;
        metrics.totalWastedGas += (tx.gasUsed || 0);
      }
      
      metrics.totalGasUsed += (tx.gasUsed || 0);
      
      // Track gas prices (in gwei)
      if (tx.gasPrice) {
        metrics.gasPrices.push(tx.gasPrice);
      }
    }

    // Calculate derived metrics
    for (const metrics of functionMap.values()) {
      metrics.averageGasUsed = metrics.totalTransactions > 0 
        ? metrics.totalGasUsed / metrics.totalTransactions 
        : 0;
      
      metrics.failureRate = metrics.totalTransactions > 0 
        ? metrics.failedTransactions / metrics.totalTransactions 
        : 0;
      
      // Calculate average gas price
      if (metrics.gasPrices.length > 0) {
        metrics.averageGasPrice = metrics.gasPrices.reduce((sum, price) => sum + price, 0) / metrics.gasPrices.length;
      } else {
        metrics.averageGasPrice = 0;
      }
      
      // Remove raw gas prices array to keep output clean
      delete metrics.gasPrices;
    }

    return functionMap;
  }

  /**
   * Calculate overall metrics across all functions
   * @private
   */
  _calculateOverallMetrics(transactions) {
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(tx => tx.success).length;
    const failedTransactions = transactions.filter(tx => !tx.success).length;
    
    const totalGasUsed = transactions.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
    const totalWastedGas = transactions
      .filter(tx => !tx.success)
      .reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
    
    const totalGasCost = transactions.reduce((sum, tx) => sum + tx.gasCostEth, 0);
    const totalWastedGasCost = transactions
      .filter(tx => !tx.success)
      .reduce((sum, tx) => sum + tx.gasCostEth, 0);

    return {
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      overallFailureRate: totalTransactions > 0 ? failedTransactions / totalTransactions : 0,
      totalGasUsed,
      totalWastedGas,
      averageGasPerTransaction: totalTransactions > 0 ? totalGasUsed / totalTransactions : 0,
      totalGasCostEth: totalGasCost,
      totalWastedGasCostEth: totalWastedGasCost,
      wastedGasPercentage: totalGasUsed > 0 ? totalWastedGas / totalGasUsed : 0
    };
  }

  /**
   * Calculate gas price trends over time
   * @private
   */
  _calculateGasPriceTrends(transactions) {
    if (transactions.length === 0) {
      return {
        averageGasPrice: 0,
        minGasPrice: 0,
        maxGasPrice: 0,
        medianGasPrice: 0,
        trend: []
      };
    }

    // Sort transactions by timestamp
    const sortedTxs = [...transactions].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate daily averages
    const dailyAverages = new Map();
    
    for (const tx of sortedTxs) {
      if (!tx.gasPrice) continue;
      
      const dateKey = tx.timestamp.toISOString().split('T')[0];
      
      if (!dailyAverages.has(dateKey)) {
        dailyAverages.set(dateKey, {
          date: dateKey,
          prices: [],
          count: 0
        });
      }
      
      const dayData = dailyAverages.get(dateKey);
      dayData.prices.push(tx.gasPrice);
      dayData.count++;
    }

    // Calculate averages for each day
    const trend = [];
    for (const [date, data] of dailyAverages) {
      const avgPrice = data.prices.reduce((sum, price) => sum + price, 0) / data.prices.length;
      trend.push({
        date,
        averageGasPrice: avgPrice,
        transactionCount: data.count
      });
    }

    // Calculate overall statistics
    const allPrices = transactions
      .filter(tx => tx.gasPrice)
      .map(tx => tx.gasPrice)
      .sort((a, b) => a - b);

    const averageGasPrice = allPrices.length > 0 
      ? allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length 
      : 0;
    
    const minGasPrice = allPrices.length > 0 ? allPrices[0] : 0;
    const maxGasPrice = allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0;
    const medianGasPrice = allPrices.length > 0 
      ? allPrices[Math.floor(allPrices.length / 2)] 
      : 0;

    return {
      averageGasPrice,
      minGasPrice,
      maxGasPrice,
      medianGasPrice,
      trend
    };
  }

  /**
   * Benchmark gas usage against industry standards
   * @private
   */
  _benchmarkAgainstStandards(functionMetrics) {
    const comparisons = [];

    for (const metrics of functionMetrics.values()) {
      const functionName = metrics.functionName.toLowerCase();
      let benchmark = null;
      let benchmarkName = null;

      // Try to find matching benchmark
      for (const [name, value] of Object.entries(this.benchmarks)) {
        if (functionName.includes(name.toLowerCase())) {
          benchmark = value;
          benchmarkName = name;
          break;
        }
      }

      if (benchmark) {
        const efficiency = benchmark > 0 
          ? (metrics.averageGasUsed / benchmark) 
          : 0;
        
        const status = efficiency <= 1.0 ? 'efficient' 
          : efficiency <= 1.2 ? 'acceptable' 
          : 'inefficient';

        comparisons.push({
          functionSignature: metrics.functionSignature,
          functionName: metrics.functionName,
          averageGasUsed: metrics.averageGasUsed,
          benchmark,
          benchmarkName,
          efficiency,
          status,
          gasSavingsOpportunity: Math.max(0, metrics.averageGasUsed - benchmark)
        });
      }
    }

    return comparisons;
  }

  /**
   * Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      functionMetrics: [],
      overallMetrics: {
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        overallFailureRate: 0,
        totalGasUsed: 0,
        totalWastedGas: 0,
        averageGasPerTransaction: 0,
        totalGasCostEth: 0,
        totalWastedGasCostEth: 0,
        wastedGasPercentage: 0
      },
      gasPriceTrends: {
        averageGasPrice: 0,
        minGasPrice: 0,
        maxGasPrice: 0,
        medianGasPrice: 0,
        trend: []
      },
      benchmarkComparison: []
    };
  }

  /**
   * Set industry benchmarks
   * @param {Object} benchmarks - New benchmarks
   */
  setBenchmarks(benchmarks) {
    this.benchmarks = {
      ...this.benchmarks,
      ...benchmarks
    };
  }

  /**
   * Get current benchmarks
   * @returns {Object} Current benchmarks
   */
  getBenchmarks() {
    return { ...this.benchmarks };
  }

  /**
   * Identify functions with high failure rates
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @param {number} threshold - Failure rate threshold (default: 0.1 = 10%)
   * @returns {Array<Object>} Functions with high failure rates
   */
  identifyHighFailureFunctions(transactions, threshold = 0.1) {
    const functionMetrics = this._calculateFunctionMetrics(transactions);
    
    return Array.from(functionMetrics.values())
      .filter(metrics => metrics.failureRate > threshold)
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Calculate gas efficiency score (0-100)
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {number} Efficiency score
   */
  calculateEfficiencyScore(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return 0;
    }

    const overallMetrics = this._calculateOverallMetrics(transactions);
    
    // Score based on:
    // - Success rate (50% weight)
    // - Gas efficiency vs wasted gas (50% weight)
    
    const successScore = (1 - overallMetrics.overallFailureRate) * 50;
    const wasteScore = (1 - overallMetrics.wastedGasPercentage) * 50;
    
    return Math.round(successScore + wasteScore);
  }
}

export default GasEfficiencyAnalyzer;
