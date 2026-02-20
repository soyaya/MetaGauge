/**
 * Chain Normalizer
 * 
 * Normalizes transaction data from different blockchain networks into a unified format
 * for storage in PostgreSQL database with proper relational structure.
 * 
 * Multi-Chain RPC Integration - Task 5
 * Requirements: 3.3, 4.3, 5.1, 5.2
 */

import { ethers } from 'ethers';
import { AbiDecoderService } from './AbiDecoderService.js';

export class ChainNormalizer {
  constructor(contractAbi = null, chain = 'ethereum') {
    this.supportedChains = ['ethereum', 'starknet', 'lisk'];
    this.abiDecoder = null;
    
    // Initialize ABI decoder if ABI is provided
    if (contractAbi && Array.isArray(contractAbi)) {
      try {
        this.abiDecoder = new AbiDecoderService(contractAbi, chain);
      } catch (error) {
        console.warn(`Failed to initialize ABI decoder: ${error.message}`);
      }
    }
    
    this.chainConfigs = {
      ethereum: {
        nativeCurrency: 'ETH',
        decimals: 18,
        chainId: 1,
        blockTimeMs: 12000
      },
      starknet: {
        nativeCurrency: 'ETH',
        decimals: 18,
        chainId: 'SN_MAIN',
        blockTimeMs: 30000
      },
      lisk: {
        nativeCurrency: 'ETH',
        decimals: 18,
        chainId: 1135,
        blockTimeMs: 12000
      }
    };
  }

  /**
   * Normalize transactions from any supported chain to unified format
   * @param {Array<Object>} transactions - Raw transactions from blockchain
   * @param {string} chain - Source blockchain network
   * @param {Array<Object>} contractAbi - Optional contract ABI for function name decoding
   * @returns {Array<Object>} Normalized transactions
   */
  normalizeTransactions(transactions, chain, contractAbi = null) {
    if (!Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }

    if (!chain) {
      throw new Error('Chain parameter is required and cannot be null or undefined');
    }

    const chainLower = chain.toLowerCase();
    if (!this.supportedChains.includes(chainLower)) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    // Initialize ABI decoder if provided and not already initialized
    if (contractAbi && !this.abiDecoder) {
      try {
        this.abiDecoder = new AbiDecoderService(contractAbi, chainLower);
      } catch (error) {
        console.warn(`Failed to initialize ABI decoder: ${error.message}`);
      }
    }

    const normalized = [];
    
    for (const tx of transactions) {
      try {
        const normalizedTx = this._normalizeTransaction(tx, chainLower);
        if (normalizedTx) {
          normalized.push(normalizedTx);
        }
      } catch (error) {
        console.warn(`Failed to normalize transaction ${tx.hash || 'unknown'}: ${error.message}`);
      }
    }

    return normalized;
  }

  /**
   * Normalize a single transaction
   * @private
   */
  _normalizeTransaction(transaction, chain) {
    const chainConfig = this.chainConfigs[chain];
    
    // Base normalized structure
    const normalized = {
      // Core transaction fields
      hash: this._normalizeHash(transaction.hash, chain),
      block_number: this._normalizeBlockNumber(transaction.blockNumber || transaction.block_number),
      block_timestamp: this._normalizeTimestamp(transaction.blockTimestamp || transaction.timestamp || transaction.block_timestamp),
      transaction_index: this._normalizeTransactionIndex(transaction.transactionIndex || transaction.transaction_index),
      
      // Address fields
      from_address: this._normalizeAddress(transaction.from || transaction.sender_address, chain),
      to_address: this._normalizeAddress(transaction.to || transaction.contract_address || transaction.recipient_address, chain),
      
      // Value fields
      value_wei: this._normalizeValue(transaction.value, chain),
      value_eth: this._normalizeValueToEth(transaction.value, chain),
      
      // Gas fields
      gas_limit: this._normalizeGas(transaction.gasLimit || transaction.max_fee || transaction.gas_limit),
      gas_used: this._normalizeGas(transaction.gasUsed || transaction.actual_fee || transaction.gas_used),
      gas_price_wei: this._normalizeGasPrice(transaction.gasPrice || transaction.gas_price, chain),
      gas_cost_wei: this._calculateGasCost(transaction, chain),
      gas_cost_eth: null, // Will be calculated from gas_cost_wei
      
      // Status and type
      status: this._normalizeStatus(transaction.status, chain),
      chain: chain,
      
      // Transaction type and nonce
      nonce: this._normalizeNonce(transaction.nonce),
      transaction_type: this._normalizeTransactionType(transaction.type || transaction.transaction_type, chain),
      
      // Raw data preservation
      raw_data: this._preserveRawData(transaction, chain),
      
      // Function information (extracted from input data using ABI)
      method_id: this._extractMethodId(transaction, chain),
      functionName: this._extractFunctionName(transaction, chain),
      function_name: this._extractFunctionName(transaction, chain), // Alias for compatibility
      
      // Timestamps
      created_at: new Date().toISOString()
    };

    // Calculate gas_cost_eth from gas_cost_wei
    if (normalized.gas_cost_wei) {
      normalized.gas_cost_eth = this._weiToEth(normalized.gas_cost_wei);
    }

    // Chain-specific normalization
    if (chain === 'starknet') {
      this._normalizeStarknetSpecific(normalized, transaction);
    } else if (chain === 'lisk') {
      this._normalizeLiskSpecific(normalized, transaction);
    } else {
      this._normalizeEthereumLikeSpecific(normalized, transaction, chain);
    }

    return normalized;
  }

  /**
   * Normalize transaction hash
   * @private
   */
  _normalizeHash(hash, chain) {
    if (!hash) return null;
    
    // Ethereum-like chains use 0x prefixed hashes
    return hash.startsWith('0x') ? hash : `0x${hash}`;
  }

  /**
   * Normalize block number
   * @private
   */
  _normalizeBlockNumber(blockNumber) {
    if (blockNumber === null || blockNumber === undefined) return null;
    
    if (typeof blockNumber === 'string') {
      if (blockNumber.startsWith('0x')) {
        return parseInt(blockNumber, 16);
      }
      return parseInt(blockNumber, 10);
    }
    
    return Number(blockNumber);
  }

  /**
   * Normalize timestamp to UTC ISO string
   * @private
   */
  _normalizeTimestamp(timestamp) {
    if (!timestamp) return null;
    
    let date;
    
    if (typeof timestamp === 'number') {
      // Unix timestamp (seconds or milliseconds)
      if (timestamp > 1e12) {
        // Milliseconds
        date = new Date(timestamp);
      } else {
        // Seconds
        date = new Date(timestamp * 1000);
      }
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return null;
    }
    
    return date.toISOString();
  }

  /**
   * Normalize transaction index
   * @private
   */
  _normalizeTransactionIndex(index) {
    if (index === null || index === undefined) return null;
    return Number(index);
  }

  /**
   * Normalize address format
   * @private
   */
  _normalizeAddress(address, chain) {
    if (!address) return null;
    
    if (chain === 'starknet') {
      // Starknet addresses are different format (felt252)
      return address.toString();
    }
    
    // Ethereum-like addresses (both Ethereum and Lisk use same format)
    if (typeof address === 'string') {
      return address.toLowerCase();
    }
    
    return address ? address.toString().toLowerCase() : null;
  }

  /**
   * Normalize value to wei (string)
   * @private
   */
  _normalizeValue(value, chain) {
    if (!value || value === '0' || value === 0) return '0';
    
    try {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      
      if (typeof value === 'string') {
        if (value.startsWith('0x')) {
          return BigInt(value).toString();
        }
        return value;
      }
      
      if (typeof value === 'number') {
        return value.toString();
      }
      
      return value.toString();
    } catch (error) {
      console.warn(`Failed to normalize value ${value}: ${error.message}`);
      return '0';
    }
  }

  /**
   * Normalize value to ETH (decimal string)
   * @private
   */
  _normalizeValueToEth(value, chain) {
    const weiValue = this._normalizeValue(value, chain);
    return this._weiToEth(weiValue);
  }

  /**
   * Normalize gas values
   * @private
   */
  _normalizeGas(gas) {
    if (!gas || gas === '0' || gas === 0) return '0';
    
    try {
      if (typeof gas === 'bigint') {
        return gas.toString();
      }
      
      if (typeof gas === 'string') {
        if (gas.startsWith('0x')) {
          return BigInt(gas).toString();
        }
        return gas;
      }
      
      return gas.toString();
    } catch (error) {
      return '0';
    }
  }

  /**
   * Normalize gas price
   * @private
   */
  _normalizeGasPrice(gasPrice, chain) {
    if (chain === 'starknet') {
      // Starknet doesn't use gas price in the same way
      return '0';
    }
    
    return this._normalizeGas(gasPrice);
  }

  /**
   * Calculate gas cost in wei
   * @private
   */
  _calculateGasCost(transaction, chain) {
    if (chain === 'starknet') {
      // In Starknet, actual_fee is the total cost
      return this._normalizeGas(transaction.gasUsed || transaction.actual_fee || '0');
    }
    
    // Ethereum-like chains: gas_cost = gas_used * gas_price
    const gasUsed = this._normalizeGas(transaction.gasUsed || '0');
    const gasPrice = this._normalizeGas(transaction.gasPrice || '0');
    
    try {
      const gasUsedBig = BigInt(gasUsed);
      const gasPriceBig = BigInt(gasPrice);
      return (gasUsedBig * gasPriceBig).toString();
    } catch (error) {
      return '0';
    }
  }

  /**
   * Normalize transaction status
   * @private
   */
  _normalizeStatus(status, chain) {
    if (chain === 'starknet') {
      // Starknet status values
      if (typeof status === 'string') {
        return status === 'ACCEPTED_ON_L2' || status === 'ACCEPTED_ON_L1' || status === 'SUCCEEDED';
      }
      return Boolean(status);
    }
    
    // Ethereum-like chains use 1/0 or true/false
    if (typeof status === 'number') {
      return status === 1;
    }
    
    return Boolean(status);
  }

  /**
   * Normalize nonce
   * @private
   */
  _normalizeNonce(nonce) {
    if (nonce === null || nonce === undefined) return null;
    
    if (typeof nonce === 'string' && nonce.startsWith('0x')) {
      return parseInt(nonce, 16);
    }
    
    return Number(nonce);
  }

  /**
   * Normalize transaction type
   * @private
   */
  _normalizeTransactionType(type, chain) {
    if (chain === 'starknet') {
      return type || 'INVOKE';
    }
    
    // Ethereum transaction types
    if (type === null || type === undefined) return 0;
    
    if (typeof type === 'string' && type.startsWith('0x')) {
      return parseInt(type, 16);
    }
    
    return Number(type);
  }

  /**
   * Preserve raw transaction data as JSONB
   * @private
   */
  _preserveRawData(transaction, chain) {
    // Remove large or redundant fields, keep essential raw data
    const preserved = { ...transaction };
    
    // Remove fields that are already normalized
    delete preserved.hash;
    delete preserved.blockNumber;
    delete preserved.block_number;
    delete preserved.blockTimestamp;
    delete preserved.timestamp;
    delete preserved.block_timestamp;
    delete preserved.from;
    delete preserved.to;
    delete preserved.value;
    delete preserved.gasUsed;
    delete preserved.gas_used;
    delete preserved.gasPrice;
    delete preserved.gas_price;
    delete preserved.gasLimit;
    delete preserved.gas_limit;
    delete preserved.status;
    delete preserved.nonce;
    delete preserved.type;
    
    // Add chain-specific metadata
    preserved._chain = chain;
    preserved._normalized_at = new Date().toISOString();
    
    return preserved;
  }

  /**
   * Apply Starknet-specific normalization
   * @private
   */
  _normalizeStarknetSpecific(normalized, transaction) {
    // Starknet-specific fields
    normalized.starknet_version = transaction.version;
    normalized.starknet_type = transaction.type;
    normalized.max_fee = this._normalizeGas(transaction.max_fee);
    
    // Starknet calldata
    if (transaction.calldata) {
      normalized.raw_data.calldata = transaction.calldata;
    }
    
    // Starknet signature
    if (transaction.signature) {
      normalized.raw_data.signature = transaction.signature;
    }
  }

  /**
   * Apply Lisk-specific normalization
   * @private
   */
  _normalizeLiskSpecific(normalized, transaction) {
    // EIP-1559 fields for Lisk
    if (transaction.maxFeePerGas) {
      normalized.max_fee_per_gas = this._normalizeGas(transaction.maxFeePerGas);
    }
    
    if (transaction.maxPriorityFeePerGas) {
      normalized.max_priority_fee_per_gas = this._normalizeGas(transaction.maxPriorityFeePerGas);
    }
    
    // Lisk-specific metadata
    normalized.raw_data.lisk_chain_id = 1135;
  }

  /**
   * Apply Ethereum-like chain specific normalization
   * @private
   */
  _normalizeEthereumLikeSpecific(normalized, transaction, chain) {
    // EIP-1559 fields
    if (transaction.maxFeePerGas) {
      normalized.max_fee_per_gas = this._normalizeGas(transaction.maxFeePerGas);
    }
    
    if (transaction.maxPriorityFeePerGas) {
      normalized.max_priority_fee_per_gas = this._normalizeGas(transaction.maxPriorityFeePerGas);
    }
    
    // Access list for EIP-2930/EIP-1559
    if (transaction.accessList) {
      normalized.raw_data.access_list = transaction.accessList;
    }
    
    // Chain-specific chain ID
    const chainConfig = this.chainConfigs[chain];
    if (chainConfig) {
      normalized.raw_data.chain_id = chainConfig.chainId;
    }
  }

  /**
   * Extract method ID from transaction input
   * @private
   */
  _extractMethodId(transaction, chain) {
    const input = transaction.input || transaction.data || transaction.calldata;
    
    if (!input) return null;
    
    if (chain === 'starknet') {
      // Starknet uses different format
      if (Array.isArray(input) && input.length > 0) {
        return input[0]; // First element is function selector
      }
      return input;
    }
    
    // Ethereum-like chains
    if (typeof input === 'string' && input.startsWith('0x') && input.length >= 10) {
      return input.slice(0, 10); // First 4 bytes (8 hex chars + 0x)
    }
    
    return null;
  }

  /**
   * Extract human-readable function name from transaction
   * @private
   */
  _extractFunctionName(transaction, chain) {
    // Try to get from existing fields first
    if (transaction.functionName) return transaction.functionName;
    if (transaction.function_name) return transaction.function_name;
    
    // Try to decode using ABI if available
    if (this.abiDecoder) {
      try {
        const input = transaction.input || transaction.data || transaction.calldata;
        if (input) {
          const decoded = this.abiDecoder.decodeMethod(input);
          if (decoded && decoded.name) {
            return decoded.name;
          }
        }
      } catch (error) {
        // Silently continue to fallback methods
      }
    }
    
    // Fallback to method ID mapping
    const methodId = this._extractMethodId(transaction, chain);
    if (methodId) {
      const functionName = this._mapMethodIdToFunctionName(methodId);
      if (functionName !== methodId) {
        return functionName;
      }
    }
    
    // Final fallback
    return methodId || 'unknown';
  }

  /**
   * Map common method IDs to function names
   * @private
   */
  _mapMethodIdToFunctionName(methodId) {
    const commonMethods = {
      // Standard ERC-20 functions
      '0xa9059cbb': 'transfer',
      '0x095ea7b3': 'approve',
      '0x23b872dd': 'transferFrom',
      '0x70a08231': 'balanceOf',
      '0xdd62ed3e': 'allowance',
      '0x18160ddd': 'totalSupply',
      '0x06fdde03': 'name',
      '0x95d89b41': 'symbol',
      '0x313ce567': 'decimals',
      
      // Common DeFi functions (from ABI)
      '0xb6b55f25': 'deposit',
      '0x2e1a7d4d': 'withdraw',
      '0xa694fc3a': 'stake',
      '0x2e17de78': 'unstake',
      '0x40c10f19': 'mint',
      '0x42966c68': 'burn',
      '0x022c0d9f': 'swap',
      '0x38ed1739': 'swapExactTokensForTokens',
      '0xe8e33700': 'addLiquidity',
      '0xbaa2abde': 'removeLiquidity',
      '0x372500ab': 'claimRewards',
      '0xf69e2046': 'compound',
      
      // Additional common DeFi method IDs
      '0x3db6be2b': 'swap',
      '0x7ff36ab5': 'swapExactETHForTokens',
      '0x18cbafe5': 'swapTokensForExactETH',
      '0x791ac947': 'swapExactTokensForETH',
      '0x4a25d94a': 'swapTokensForExactTokens',
      '0xf305d719': 'addLiquidityETH',
      '0x02751cec': 'removeLiquidityETH',
      '0x5c11d795': 'removeLiquidityWithPermit',
      '0xded9382a': 'removeLiquidityETHWithPermit',
      '0x12d43a51': 'claim',
      '0x4e71d92d': 'claimRewards',
      '0x6a627842': 'mint',
      '0x379607f5': 'claimReward',
      '0x1c4b774b': 'unstake',
      '0x17caf6f1': 'compound',
      '0x5312ea8e': 'reinvest',
      '0x853828b6': 'harvest',
      '0x4641257d': 'exit',
      '0x1959a002': 'claimAll',
      '0x6e553f65': 'emergencyWithdraw',
      
      // Legacy mappings for backward compatibility
      '0x128acb08': 'stake',   // Alternative stake signature
      '0x3ccfd60b': 'withdraw',
      '0xe2bbb158': 'deposit',
      '0x441a3e70': 'withdraw'
    };
    
    return commonMethods[methodId] || 'unknown';
  }

  /**
   * Convert wei to ETH
   * @private
   */
  _weiToEth(wei) {
    try {
      if (!wei || wei === '0') return '0.0';
      return ethers.formatEther(wei);
    } catch (error) {
      return '0.0';
    }
  }

  /**
   * Normalize function call data
   * @param {Object} decodedMethod - Decoded method from ABI decoder
   * @param {string} transactionHash - Transaction hash
   * @param {string} chain - Blockchain network
   * @returns {Object} Normalized function call data
   */
  normalizeFunctionCall(decodedMethod, transactionHash, chain) {
    if (!decodedMethod) return null;
    
    return {
      transaction_hash: transactionHash,
      function_signature: decodedMethod.signature || 'unknown',
      function_name: decodedMethod.name || 'unknown',
      function_selector: this._extractSelector(decodedMethod.signature, chain),
      parameters: this._normalizeParameters(decodedMethod.params || []),
      parameter_count: (decodedMethod.params || []).length,
      chain: chain,
      raw_data: {
        original_method: decodedMethod,
        _normalized_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Extract function selector from signature
   * @private
   */
  _extractSelector(signature, chain) {
    if (!signature) return null;
    
    if (chain === 'starknet') {
      return signature; // Starknet uses different selector format
    }
    
    // Ethereum-like chains use 4-byte selectors
    if (typeof signature === 'string' && signature.startsWith('0x') && signature.length >= 10) {
      return signature.slice(0, 10);
    }
    
    return signature;
  }

  /**
   * Normalize function parameters
   * @private
   */
  _normalizeParameters(params) {
    if (!Array.isArray(params)) return [];
    
    return params.map((param, index) => ({
      name: param.name || `param${index}`,
      type: param.type || 'unknown',
      value: this._normalizeParameterValue(param.value),
      indexed: param.indexed || false
    }));
  }

  /**
   * Normalize parameter value
   * @private
   */
  _normalizeParameterValue(value) {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'bigint') {
      return value.toString();
    }
    
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    
    return value.toString();
  }

  /**
   * Normalize event log data
   * @param {Object} decodedEvent - Decoded event from ABI decoder
   * @param {string} transactionHash - Transaction hash
   * @param {number} logIndex - Log index in transaction
   * @param {string} chain - Blockchain network
   * @returns {Object} Normalized event data
   */
  normalizeEvent(decodedEvent, transactionHash, logIndex, chain) {
    if (!decodedEvent) return null;
    
    return {
      transaction_hash: transactionHash,
      log_index: logIndex,
      event_signature: decodedEvent.signature || 'unknown',
      event_name: decodedEvent.name || 'unknown',
      contract_address: this._normalizeAddress(decodedEvent.address, chain),
      block_number: this._normalizeBlockNumber(decodedEvent.blockNumber),
      parameters: this._normalizeParameters(decodedEvent.params || []),
      parameter_count: (decodedEvent.params || []).length,
      chain: chain,
      raw_data: {
        original_event: decodedEvent,
        _normalized_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Get supported chains
   * @returns {Array<string>} Array of supported chain names
   */
  getSupportedChains() {
    return [...this.supportedChains];
  }

  /**
   * Get chain configuration
   * @param {string} chain - Chain name
   * @returns {Object|null} Chain configuration
   */
  getChainConfig(chain) {
    return this.chainConfigs[chain.toLowerCase()] || null;
  }

  /**
   * Validate normalized transaction
   * @param {Object} transaction - Normalized transaction
   * @returns {boolean} True if valid
   */
  validateNormalizedTransaction(transaction) {
    const required = ['hash', 'block_number', 'from_address', 'chain'];
    
    for (const field of required) {
      if (!transaction.hasOwnProperty(field) || transaction[field] === null) {
        return false;
      }
    }
    
    return true;
  }
}

export default ChainNormalizer;