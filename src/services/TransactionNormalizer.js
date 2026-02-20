import { ethers } from 'ethers';

/**
 * Transaction Normalizer
 * 
 * Normalizes transaction data across chains and enriches with decoded function information.
 * Converts values to common units (ETH equivalent), standardizes timestamps, and links cross-chain wallets.
 */
export class TransactionNormalizer {
  /**
   * Creates an instance of TransactionNormalizer
   * @param {Object} conversionRates - Optional conversion rates for chains (default: 1:1 for EVM chains)
   */
  constructor(conversionRates = {}) {
    // Default conversion rates to ETH equivalent
    // For EVM-compatible chains, 1:1 ratio is standard
    this.conversionRates = {
      ethereum: 1.0,
      polygon: 1.0,  // MATIC to ETH equivalent (simplified, in reality would use market rates)
      starknet: 1.0, // ETH on Starknet
      base: 1.0,     // ETH on Base
      arbitrum: 1.0, // ETH on Arbitrum
      optimism: 1.0, // ETH on Optimism
      ...conversionRates
    };
  }

  /**
   * Normalize a transaction with decoded method information
   * @param {Object} transaction - Raw transaction from RPC
   * @param {Object|null} decodedMethod - Decoded method from ABI decoder
   * @returns {Object} Normalized transaction
   */
  normalize(transaction, decodedMethod = null) {
    if (!transaction) {
      throw new Error('Transaction is required');
    }

    // Convert value to ETH equivalent
    const valueEth = this.convertToEthEquivalent(
      transaction.value || '0',
      transaction.chain
    );

    // Calculate gas cost in ETH equivalent
    const gasCostEth = this.calculateGasCost(
      transaction.gasUsed || transaction.gasLimit || '0',
      transaction.gasPrice || '0',
      transaction.chain
    );

    // Normalize timestamp
    const timestamp = this.normalizeTimestamp(transaction.blockTimestamp);

    // Extract function information
    const functionName = decodedMethod ? decodedMethod.name : 'unknown';
    const functionSignature = decodedMethod ? decodedMethod.signature : this._extractSignature(transaction.input);
    const decodedParams = decodedMethod ? this._formatParams(decodedMethod.params) : {};

    return {
      hash: transaction.hash,
      wallet: transaction.from.toLowerCase(),
      contractAddress: transaction.to ? transaction.to.toLowerCase() : null,
      chain: transaction.chain.toLowerCase(),
      functionName,
      functionSignature,
      valueEth,
      gasCostEth,
      timestamp,
      success: transaction.status === true || transaction.status === 1,
      blockNumber: transaction.blockNumber,
      decodedParams,
      // Additional metadata
      nonce: transaction.nonce,
      gasLimit: transaction.gasLimit ? transaction.gasLimit.toString() : '0',
      gasUsed: transaction.gasUsed ? transaction.gasUsed.toString() : '0',
      gasPrice: transaction.gasPrice ? transaction.gasPrice.toString() : '0'
    };
  }

  /**
   * Convert value to ETH equivalent
   * @param {string|BigInt} value - Value in wei
   * @param {string} chain - Chain name
   * @returns {number} Value in ETH equivalent
   */
  convertToEthEquivalent(value, chain) {
    try {
      // Convert to BigInt if string
      const valueBigInt = typeof value === 'string' ? BigInt(value) : value;
      
      // Convert wei to ETH (divide by 10^18)
      const ethValue = Number(valueBigInt) / 1e18;
      
      // Apply chain-specific conversion rate
      const rate = this.conversionRates[chain.toLowerCase()] || 1.0;
      
      return ethValue * rate;
    } catch (error) {
      console.warn(`Failed to convert value ${value} for chain ${chain}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Calculate gas cost in ETH equivalent
   * @param {string|BigInt} gasUsed - Gas used
   * @param {string|BigInt} gasPrice - Gas price in wei
   * @param {string} chain - Chain name
   * @returns {number} Gas cost in ETH equivalent
   */
  calculateGasCost(gasUsed, gasPrice, chain) {
    try {
      const gasUsedBigInt = typeof gasUsed === 'string' ? BigInt(gasUsed) : gasUsed;
      const gasPriceBigInt = typeof gasPrice === 'string' ? BigInt(gasPrice) : gasPrice;
      
      // Calculate total gas cost in wei
      const gasCostWei = gasUsedBigInt * gasPriceBigInt;
      
      // Convert to ETH equivalent
      return this.convertToEthEquivalent(gasCostWei, chain);
    } catch (error) {
      console.warn(`Failed to calculate gas cost for chain ${chain}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Normalize timestamp to Date object
   * @param {number|string} timestamp - Unix timestamp
   * @returns {Date} Normalized date
   */
  normalizeTimestamp(timestamp) {
    try {
      const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
      return new Date(ts * 1000); // Convert seconds to milliseconds
    } catch (error) {
      console.warn(`Failed to normalize timestamp ${timestamp}: ${error.message}`);
      return new Date(0);
    }
  }

  /**
   * Link cross-chain wallet activity
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Array<Object>} Wallet linkage information
   */
  linkCrossChainWallets(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    // Group transactions by wallet address
    const walletMap = new Map();
    
    for (const tx of transactions) {
      const wallet = tx.wallet.toLowerCase();
      
      if (!walletMap.has(wallet)) {
        walletMap.set(wallet, {
          wallet,
          chains: new Set(),
          contracts: new Set(),
          totalTransactions: 0,
          firstSeen: tx.timestamp,
          lastSeen: tx.timestamp
        });
      }
      
      const walletData = walletMap.get(wallet);
      walletData.chains.add(tx.chain);
      if (tx.contractAddress) {
        walletData.contracts.add(tx.contractAddress);
      }
      walletData.totalTransactions++;
      
      // Update first and last seen
      if (tx.timestamp < walletData.firstSeen) {
        walletData.firstSeen = tx.timestamp;
      }
      if (tx.timestamp > walletData.lastSeen) {
        walletData.lastSeen = tx.timestamp;
      }
    }
    
    // Convert to array and format
    return Array.from(walletMap.values()).map(data => ({
      wallet: data.wallet,
      chains: Array.from(data.chains),
      contracts: Array.from(data.contracts),
      totalTransactions: data.totalTransactions,
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      isCrossChain: data.chains.size > 1
    }));
  }

  /**
   * Batch normalize multiple transactions
   * @param {Array<Object>} transactions - Array of raw transactions
   * @param {Map<string, Object>} decodedMethods - Map of tx hash to decoded method
   * @returns {Array<Object>} Array of normalized transactions
   */
  batchNormalize(transactions, decodedMethods = new Map()) {
    if (!Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }

    return transactions.map(tx => {
      const decoded = decodedMethods.get(tx.hash) || null;
      return this.normalize(tx, decoded);
    });
  }

  /**
   * Extract function signature from input data
   * @private
   * @param {string} input - Transaction input data
   * @returns {string} Function signature
   */
  _extractSignature(input) {
    if (!input || typeof input !== 'string' || !input.startsWith('0x')) {
      return '0x00000000';
    }
    
    if (input.length < 10) {
      return '0x00000000';
    }
    
    return input.slice(0, 10);
  }

  /**
   * Format decoded parameters
   * @private
   * @param {Array} params - Decoded parameters
   * @returns {Object} Formatted parameters
   */
  _formatParams(params) {
    if (!Array.isArray(params)) {
      return {};
    }

    const formatted = {};
    for (const param of params) {
      // Convert BigInt values to strings for JSON serialization
      let value = param.value;
      if (typeof value === 'bigint') {
        value = value.toString();
      } else if (Array.isArray(value)) {
        value = value.map(v => typeof v === 'bigint' ? v.toString() : v);
      }
      
      formatted[param.name] = {
        type: param.type,
        value: value
      };
    }
    
    return formatted;
  }

  /**
   * Get conversion rate for a chain
   * @param {string} chain - Chain name
   * @returns {number} Conversion rate
   */
  getConversionRate(chain) {
    return this.conversionRates[chain.toLowerCase()] || 1.0;
  }

  /**
   * Set conversion rate for a chain
   * @param {string} chain - Chain name
   * @param {number} rate - Conversion rate
   */
  setConversionRate(chain, rate) {
    if (typeof rate !== 'number' || rate <= 0 || isNaN(rate)) {
      throw new Error('Conversion rate must be a positive number');
    }
    this.conversionRates[chain.toLowerCase()] = rate;
  }

  /**
   * Aggregate metrics across chains
   * @param {Array<Object>} transactions - Array of normalized transactions
   * @returns {Object} Aggregated metrics by chain
   */
  aggregateByChain(transactions) {
    if (!Array.isArray(transactions)) {
      return {};
    }

    const chainMetrics = {};
    
    for (const tx of transactions) {
      const chain = tx.chain;
      
      if (!chainMetrics[chain]) {
        chainMetrics[chain] = {
          chain,
          transactionCount: 0,
          totalValueEth: 0,
          totalGasCostEth: 0,
          uniqueWallets: new Set(),
          successfulTransactions: 0,
          failedTransactions: 0
        };
      }
      
      const metrics = chainMetrics[chain];
      metrics.transactionCount++;
      metrics.totalValueEth += tx.valueEth;
      metrics.totalGasCostEth += tx.gasCostEth;
      metrics.uniqueWallets.add(tx.wallet);
      
      if (tx.success) {
        metrics.successfulTransactions++;
      } else {
        metrics.failedTransactions++;
      }
    }
    
    // Convert Sets to counts
    for (const chain in chainMetrics) {
      chainMetrics[chain].uniqueWallets = chainMetrics[chain].uniqueWallets.size;
    }
    
    return chainMetrics;
  }
}

export default TransactionNormalizer;
