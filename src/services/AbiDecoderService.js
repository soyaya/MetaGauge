import { ethers } from 'ethers';

/**
 * Multi-Chain ABI Decoder Service
 * 
 * Decodes transaction input data using contract ABI to extract function calls and parameters.
 * Supports Ethereum/Lisk (standard ABI) and Starknet (Cairo ABI) formats.
 * Provides caching for performance optimization.
 * 
 * Multi-Chain RPC Integration - Task 3
 * Requirements: 1.2, 4.2, 7.1, 7.2
 * 
 * @class AbiDecoderService
 */
export class AbiDecoderService {
  /**
   * Creates an instance of AbiDecoderService
   * @param {Array<object>} abi - The contract ABI as a JSON array
   * @param {string} chain - Blockchain network (ethereum, lisk, starknet)
   * @throws {Error} If ABI is invalid or cannot be parsed
   */
  constructor(abi, chain = 'ethereum') {
    if (!Array.isArray(abi)) {
      throw new Error('ABI must be an array');
    }

    this.chain = chain.toLowerCase();
    this.abi = abi;
    
    // Cache for function signatures to names
    this.signatureCache = new Map();
    this.eventSignatureCache = new Map();
    
    try {
      if (this.chain === 'starknet') {
        // Initialize Starknet Cairo ABI decoder
        this._initializeStarknetDecoder();
      } else {
        // Initialize standard Ethereum-compatible decoder (for Ethereum, Lisk, etc.)
        this.interface = new ethers.Interface(abi);
        this._buildSignatureCache();
      }
    } catch (error) {
      throw new Error(`Failed to initialize ABI decoder for ${this.chain}: ${error.message}`);
    }
  }

  /**
   * Initialize Starknet Cairo ABI decoder
   * @private
   */
  _initializeStarknetDecoder() {
    // Starknet uses Cairo ABI format which is different from Ethereum ABI
    // Cairo ABI has different structure with 'name', 'type', 'inputs', 'outputs'
    
    for (const fragment of this.abi) {
      if (fragment.type === 'function') {
        try {
          // Cairo function signature is computed differently
          const signature = this._computeCairoFunctionSignature(fragment);
          this.signatureCache.set(signature, fragment.name);
          
          // Also store by name for reverse lookup
          this.signatureCache.set(fragment.name, fragment);
        } catch (error) {
          console.warn(`Warning: Could not process Cairo ABI fragment for ${fragment.name}`);
        }
      } else if (fragment.type === 'event') {
        try {
          const signature = this._computeCairoEventSignature(fragment);
          this.eventSignatureCache.set(signature, fragment.name);
          this.eventSignatureCache.set(fragment.name, fragment);
        } catch (error) {
          console.warn(`Warning: Could not process Cairo event fragment for ${fragment.name}`);
        }
      }
    }
  }

  /**
   * Compute Cairo function signature (Starknet-specific)
   * @private
   */
  _computeCairoFunctionSignature(fragment) {
    // In Starknet, function selectors are computed using starknet_keccak
    // For now, we'll use the function name as identifier
    // In a full implementation, you'd use the proper Cairo signature computation
    return fragment.name;
  }

  /**
   * Compute Cairo event signature (Starknet-specific)
   * @private
   */
  _computeCairoEventSignature(fragment) {
    // Similar to functions, events in Cairo have different signature computation
    return fragment.name;
  }

  /**
   * Build cache of function signatures to names from the ABI (Ethereum/Lisk)
   * @private
   */
  _buildSignatureCache() {
    // Iterate through ABI and cache all function signatures
    for (const fragment of this.abi) {
      if (fragment.type === 'function') {
        try {
          const func = this.interface.getFunction(fragment.name);
          if (func) {
            const signature = func.selector; // 4-byte signature
            this.signatureCache.set(signature, fragment.name);
          }
        } catch (error) {
          // Skip invalid fragments
          console.warn(`Warning: Could not process ABI fragment for ${fragment.name}`);
        }
      } else if (fragment.type === 'event') {
        try {
          const event = this.interface.getEvent(fragment.name);
          if (event) {
            const signature = event.topicHash;
            this.eventSignatureCache.set(signature, fragment.name);
          }
        } catch (error) {
          console.warn(`Warning: Could not process event fragment for ${fragment.name}`);
        }
      }
    }
  }

  /**
   * Decode transaction input data to extract function call information
   * @param {string} input - The transaction input data (hex string starting with 0x)
   * @returns {DecodedMethod|null} Decoded method information or null if decoding fails
   */
  decodeMethod(input) {
    if (!input || typeof input !== 'string') {
      return null;
    }

    if (this.chain === 'starknet') {
      return this._decodeStarknetMethod(input);
    } else {
      return this._decodeEthereumMethod(input);
    }
  }

  /**
   * Decode Ethereum/Lisk method (standard ABI)
   * @private
   */
  _decodeEthereumMethod(input) {
    // Ensure input starts with 0x
    if (!input.startsWith('0x')) {
      return null;
    }

    // Input must be at least 10 characters (0x + 4 bytes signature = 10 hex chars)
    if (input.length < 10) {
      return null;
    }

    try {
      const signature = this.getFunctionSignature(input);
      const transaction = this.interface.parseTransaction({ data: input });
      
      if (!transaction) {
        return null;
      }

      // Extract parameters
      const params = [];
      if (transaction.fragment && transaction.fragment.inputs) {
        for (let i = 0; i < transaction.fragment.inputs.length; i++) {
          const inputParam = transaction.fragment.inputs[i];
          params.push({
            name: inputParam.name || `param${i}`,
            type: inputParam.type,
            value: transaction.args[i]
          });
        }
      }

      return {
        name: transaction.name,
        signature: signature,
        params: params,
        chain: this.chain
      };
    } catch (error) {
      // If decoding fails, return basic signature info
      const signature = this.getFunctionSignature(input);
      const name = this.getFunctionName(signature);
      
      if (name) {
        return {
          name: name,
          signature: signature,
          params: [],
          chain: this.chain
        };
      }
      
      return null;
    }
  }

  /**
   * Decode Starknet method (Cairo ABI)
   * @private
   */
  _decodeStarknetMethod(input) {
    try {
      // Starknet transaction input is typically JSON with calldata array
      let calldata;
      
      if (typeof input === 'string') {
        if (input.startsWith('{') || input.startsWith('[')) {
          calldata = JSON.parse(input);
        } else {
          // Might be a function name or selector
          calldata = input;
        }
      } else {
        calldata = input;
      }

      // If calldata is an array, the first element is usually the function selector
      if (Array.isArray(calldata) && calldata.length > 0) {
        const functionSelector = calldata[0];
        const functionName = this.signatureCache.get(functionSelector) || functionSelector;
        
        // Try to find the function in ABI
        const functionFragment = this.abi.find(f => 
          f.type === 'function' && (f.name === functionName || f.name === functionSelector)
        );
        
        if (functionFragment) {
          const params = [];
          
          // Decode parameters based on function inputs
          if (functionFragment.inputs && calldata.length > 1) {
            for (let i = 0; i < functionFragment.inputs.length && i + 1 < calldata.length; i++) {
              const input = functionFragment.inputs[i];
              params.push({
                name: input.name || `param${i}`,
                type: input.type,
                value: calldata[i + 1]
              });
            }
          }
          
          return {
            name: functionFragment.name,
            signature: functionSelector,
            params: params,
            chain: 'starknet'
          };
        }
      }
      
      // If we can't decode, return basic info
      return {
        name: typeof calldata === 'string' ? calldata : 'unknown',
        signature: Array.isArray(calldata) ? calldata[0] : calldata,
        params: [],
        chain: 'starknet'
      };
    } catch (error) {
      console.warn(`Failed to decode Starknet method: ${error.message}`);
      return null;
    }
  }

  /**
   * Decode event logs
   * @param {Array} logs - Array of event logs
   * @returns {Array} Array of decoded events
   */
  decodeEvents(logs) {
    if (!Array.isArray(logs)) {
      return [];
    }

    const decodedEvents = [];
    
    for (const log of logs) {
      try {
        let decodedEvent;
        
        if (this.chain === 'starknet') {
          decodedEvent = this._decodeStarknetEvent(log);
        } else {
          decodedEvent = this._decodeEthereumEvent(log);
        }
        
        if (decodedEvent) {
          decodedEvents.push(decodedEvent);
        }
      } catch (error) {
        console.warn(`Failed to decode event log: ${error.message}`);
      }
    }
    
    return decodedEvents;
  }

  /**
   * Decode Ethereum/Lisk event log
   * @private
   */
  _decodeEthereumEvent(log) {
    try {
      const parsedLog = this.interface.parseLog(log);
      
      if (!parsedLog) {
        return null;
      }
      
      const params = [];
      if (parsedLog.fragment && parsedLog.fragment.inputs) {
        for (let i = 0; i < parsedLog.fragment.inputs.length; i++) {
          const input = parsedLog.fragment.inputs[i];
          params.push({
            name: input.name || `param${i}`,
            type: input.type,
            value: parsedLog.args[i],
            indexed: input.indexed || false
          });
        }
      }
      
      return {
        name: parsedLog.name,
        signature: parsedLog.topic,
        params: params,
        chain: this.chain,
        address: log.address,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Decode Starknet event log
   * @private
   */
  _decodeStarknetEvent(log) {
    try {
      // Starknet events have different structure
      // They typically have 'keys' and 'data' arrays
      const eventName = this.eventSignatureCache.get(log.keys?.[0]) || 'unknown';
      
      const eventFragment = this.abi.find(f => 
        f.type === 'event' && f.name === eventName
      );
      
      const params = [];
      if (eventFragment && eventFragment.inputs) {
        // Combine keys and data for parameter extraction
        const allData = [...(log.keys || []), ...(log.data || [])];
        
        for (let i = 0; i < eventFragment.inputs.length && i < allData.length; i++) {
          const input = eventFragment.inputs[i];
          params.push({
            name: input.name || `param${i}`,
            type: input.type,
            value: allData[i],
            indexed: i < (log.keys?.length || 0)
          });
        }
      }
      
      return {
        name: eventName,
        signature: log.keys?.[0] || 'unknown',
        params: params,
        chain: 'starknet',
        address: log.address,
        blockNumber: log.block_number,
        transactionHash: log.transaction_hash
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract the function signature (first 4 bytes) from transaction input
   * @param {string} input - The transaction input data (hex string)
   * @returns {string} The function signature (0x + 8 hex characters)
   */
  getFunctionSignature(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    if (this.chain === 'starknet') {
      // Starknet uses different signature format
      if (typeof input === 'string' && input.startsWith('{')) {
        try {
          const calldata = JSON.parse(input);
          return Array.isArray(calldata) ? calldata[0] : input;
        } catch {
          return input;
        }
      }
      return input;
    }

    if (!input.startsWith('0x')) {
      return '';
    }

    // Function signature is first 4 bytes (8 hex characters after 0x)
    if (input.length < 10) {
      return '';
    }

    return input.slice(0, 10);
  }

  /**
   * Get the human-readable function name from a function signature
   * @param {string} signature - The function signature (0x + 8 hex characters)
   * @returns {string} The function name or the signature if name is unknown
   */
  getFunctionName(signature) {
    if (!signature || typeof signature !== 'string') {
      return signature || 'unknown';
    }

    // Check cache first
    if (this.signatureCache.has(signature)) {
      return this.signatureCache.get(signature);
    }

    if (this.chain !== 'starknet') {
      // Try to find in interface for Ethereum/Lisk
      try {
        const fragment = this.interface.getFunction(signature);
        if (fragment) {
          const name = fragment.name;
          this.signatureCache.set(signature, name);
          return name;
        }
      } catch (error) {
        // Function not found in ABI
      }
    }

    // Return signature as fallback for unknown functions
    return signature;
  }

  /**
   * Get all function signatures and their names from the ABI
   * @returns {Map<string, string>} Map of function signatures to function names
   */
  getAllFunctionSignatures() {
    return new Map(this.signatureCache);
  }

  /**
   * Get all event signatures and their names from the ABI
   * @returns {Map<string, string>} Map of event signatures to event names
   */
  getAllEventSignatures() {
    return new Map(this.eventSignatureCache);
  }

  /**
   * Check if a function signature is known in the ABI
   * @param {string} signature - The function signature to check
   * @returns {boolean} True if the signature is known
   */
  isKnownSignature(signature) {
    return this.signatureCache.has(signature);
  }

  /**
   * Check if an event signature is known in the ABI
   * @param {string} signature - The event signature to check
   * @returns {boolean} True if the signature is known
   */
  isKnownEventSignature(signature) {
    return this.eventSignatureCache.has(signature);
  }

  /**
   * Get the number of functions in the ABI
   * @returns {number} The count of functions
   */
  getFunctionCount() {
    return this.signatureCache.size;
  }

  /**
   * Get the number of events in the ABI
   * @returns {number} The count of events
   */
  getEventCount() {
    return this.eventSignatureCache.size;
  }

  /**
   * Get the blockchain chain this decoder is configured for
   * @returns {string} The chain name
   */
  getChain() {
    return this.chain;
  }

  /**
   * Get function fragment by name
   * @param {string} functionName - Function name
   * @returns {Object|null} Function fragment or null if not found
   */
  getFunctionFragment(functionName) {
    if (this.chain === 'starknet') {
      return this.abi.find(f => f.type === 'function' && f.name === functionName) || null;
    } else {
      try {
        return this.interface.getFunction(functionName);
      } catch {
        return null;
      }
    }
  }

  /**
   * Get event fragment by name
   * @param {string} eventName - Event name
   * @returns {Object|null} Event fragment or null if not found
   */
  getEventFragment(eventName) {
    if (this.chain === 'starknet') {
      return this.abi.find(f => f.type === 'event' && f.name === eventName) || null;
    } else {
      try {
        return this.interface.getEvent(eventName);
      } catch {
        return null;
      }
    }
  }

  /**
   * Validate ABI format for the specified chain
   * @param {Array} abi - ABI to validate
   * @param {string} chain - Target chain
   * @returns {boolean} True if ABI is valid for the chain
   */
  static validateAbi(abi, chain) {
    if (!Array.isArray(abi)) {
      return false;
    }

    try {
      if (chain === 'starknet') {
        // Validate Cairo ABI format
        return abi.every(fragment => 
          fragment.hasOwnProperty('type') && 
          fragment.hasOwnProperty('name') &&
          (fragment.type === 'function' || fragment.type === 'event' || 
           fragment.type === 'struct' || fragment.type === 'constructor')
        );
      } else {
        // Validate Ethereum ABI format
        new ethers.Interface(abi);
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Create decoder instance with automatic chain detection
   * @param {Array} abi - Contract ABI
   * @param {string} chain - Blockchain network
   * @returns {AbiDecoderService} Decoder instance
   */
  static create(abi, chain) {
    if (!AbiDecoderService.validateAbi(abi, chain)) {
      throw new Error(`Invalid ABI format for chain: ${chain}`);
    }
    
    return new AbiDecoderService(abi, chain);
  }
}
