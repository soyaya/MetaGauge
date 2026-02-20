/**
 * Contract Relationship Mapper
 * Multi-Chain RPC Integration - Task 10
 * Requirements: 1.4, 2.4, 7.4
 */

/**
 * Contract interaction mapping and relationship analysis
 * Tracks contract-to-contract interactions, function call chains, and dependencies
 */
export class ContractRelationshipMapper {
  constructor(config = {}) {
    this.config = {
      // Interaction tracking
      maxInteractionDepth: config.maxInteractionDepth || 5,
      minInteractionCount: config.minInteractionCount || 2,
      
      // Chain analysis
      maxChainLength: config.maxChainLength || 10,
      chainTimeoutMs: config.chainTimeoutMs || 300000, // 5 minutes
      
      // Storage limits
      maxContracts: config.maxContracts || 1000,
      maxInteractions: config.maxInteractions || 10000,
      
      ...config
    };
    
    // Internal storage
    this.contracts = new Map();
    this.interactions = new Map();
    this.functionChains = new Map();
    this.dependencies = new Map();
    this.interactionRates = new Map();
  }

  /**
   * Analyze contract interactions from transaction data
   * @param {Array} transactions - Normalized transaction array
   * @param {string} chain - Blockchain network
   * @returns {Object} Complete interaction mapping
   */
  analyzeContractInteractions(transactions, chain = 'ethereum') {
    console.log('🔗 Analyzing contract interactions...');
    
    // 1. Build contract registry
    this._buildContractRegistry(transactions, chain);
    
    // 2. Map contract-to-contract interactions
    const contractInteractions = this._mapContractInteractions(transactions);
    
    // 3. Track function call chains
    const functionChains = this._trackFunctionCallChains(transactions);
    
    // 4. Create dependency mapping
    const dependencies = this._createDependencyMapping(contractInteractions);
    
    // 5. Calculate interaction rates
    const interactionRates = this._calculateInteractionRates(contractInteractions);
    
    const mappingResult = {
      timestamp: new Date().toISOString(),
      chain,
      totalContracts: this.contracts.size,
      totalInteractions: contractInteractions.length,
      contractInteractions,
      functionChains,
      dependencies,
      interactionRates,
      summary: this._generateMappingSummary(contractInteractions, functionChains, dependencies)
    };
    
    return mappingResult;
  }

  /**
   * Build registry of all contracts involved in transactions
   * @private
   */
  _buildContractRegistry(transactions, chain) {
    transactions.forEach(tx => {
      // Register 'from' contract
      if (tx.from_address && this._isContractAddress(tx.from_address)) {
        this._registerContract(tx.from_address, chain, tx);
      }
      
      // Register 'to' contract
      if (tx.to_address && this._isContractAddress(tx.to_address)) {
        this._registerContract(tx.to_address, chain, tx);
      }
    });
    
    console.log(`📋 Registered ${this.contracts.size} contracts`);
  }

  /**
   * Register a contract in the registry
   * @private
   */
  _registerContract(address, chain, transaction) {
    const key = `${chain}:${address}`;
    
    if (!this.contracts.has(key)) {
      this.contracts.set(key, {
        address,
        chain,
        firstSeen: new Date(transaction.block_timestamp || transaction.timestamp),
        lastSeen: new Date(transaction.block_timestamp || transaction.timestamp),
        transactionCount: 0,
        interactionCount: 0,
        functions: new Set(),
        connectedContracts: new Set()
      });
    }
    
    const contract = this.contracts.get(key);
    contract.transactionCount++;
    contract.lastSeen = new Date(transaction.block_timestamp || transaction.timestamp);
    
    // Track function if available
    if (transaction.functionName) {
      contract.functions.add(transaction.functionName);
    }
  }

  /**
   * Map contract-to-contract interactions
   * @private
   */
  _mapContractInteractions(transactions) {
    const interactions = [];
    
    transactions.forEach(tx => {
      const fromContract = tx.from_address;
      const toContract = tx.to_address;
      
      // Only track contract-to-contract interactions
      if (this._isContractAddress(fromContract) && this._isContractAddress(toContract)) {
        const interaction = {
          id: `${fromContract}-${toContract}`,
          fromContract,
          toContract,
          functionName: tx.functionName || 'unknown',
          value: parseFloat(tx.value_eth || 0),
          gasUsed: parseInt(tx.gas_used || 0),
          timestamp: tx.block_timestamp || tx.timestamp,
          blockNumber: parseInt(tx.block_number || 0),
          transactionHash: tx.hash,
          success: tx.status === true || tx.status === 1
        };
        
        interactions.push(interaction);
        
        // Update contract connection tracking
        this._updateContractConnections(fromContract, toContract, tx.chain || 'ethereum');
      }
    });
    
    console.log(`🔗 Mapped ${interactions.length} contract interactions`);
    return interactions;
  }

  /**
   * Track function call chains across contracts
   * @private
   */
  _trackFunctionCallChains(transactions) {
    const chains = [];
    const blockGroups = this._groupTransactionsByBlock(transactions);
    
    Object.values(blockGroups).forEach(blockTxs => {
      const contractChains = this._findContractChainsInBlock(blockTxs);
      chains.push(...contractChains);
    });
    
    // Filter chains by minimum length and interaction count
    const significantChains = chains.filter(chain => 
      chain.length >= 2 && 
      chain.filter(step => this._isContractAddress(step.contract)).length >= this.config.minInteractionCount
    );
    
    console.log(`⛓️ Found ${significantChains.length} significant function call chains`);
    return significantChains;
  }

  /**
   * Create dependency mapping between contracts
   * @private
   */
  _createDependencyMapping(interactions) {
    const dependencies = new Map();
    
    // Count interactions between contract pairs
    const interactionCounts = new Map();
    
    interactions.forEach(interaction => {
      const key = `${interaction.fromContract}-${interaction.toContract}`;
      interactionCounts.set(key, (interactionCounts.get(key) || 0) + 1);
    });
    
    // Create dependency relationships
    interactionCounts.forEach((count, key) => {
      const [fromContract, toContract] = key.split('-');
      
      if (count >= this.config.minInteractionCount) {
        if (!dependencies.has(fromContract)) {
          dependencies.set(fromContract, {
            contract: fromContract,
            dependsOn: [],
            dependents: [],
            interactionStrength: 0
          });
        }
        
        if (!dependencies.has(toContract)) {
          dependencies.set(toContract, {
            contract: toContract,
            dependsOn: [],
            dependents: [],
            interactionStrength: 0
          });
        }
        
        const fromDep = dependencies.get(fromContract);
        const toDep = dependencies.get(toContract);
        
        fromDep.dependsOn.push({
          contract: toContract,
          interactionCount: count,
          strength: this._calculateDependencyStrength(count, interactions.length)
        });
        
        toDep.dependents.push({
          contract: fromContract,
          interactionCount: count,
          strength: this._calculateDependencyStrength(count, interactions.length)
        });
        
        fromDep.interactionStrength += count;
        toDep.interactionStrength += count;
      }
    });
    
    console.log(`🕸️ Created dependency mapping for ${dependencies.size} contracts`);
    return Array.from(dependencies.values());
  }

  /**
   * Calculate cross-contract interaction rates
   * @private
   */
  _calculateInteractionRates(interactions) {
    const rates = {
      totalInteractions: interactions.length,
      uniqueContractPairs: new Set(interactions.map(i => `${i.fromContract}-${i.toContract}`)).size,
      averageInteractionsPerPair: 0,
      topInteractionPairs: [],
      interactionFrequency: this._calculateInteractionFrequency(interactions),
      crossContractRatio: 0
    };
    
    // Calculate averages
    if (rates.uniqueContractPairs > 0) {
      rates.averageInteractionsPerPair = rates.totalInteractions / rates.uniqueContractPairs;
    }
    
    // Find top interaction pairs
    const pairCounts = new Map();
    interactions.forEach(interaction => {
      const pair = `${interaction.fromContract}-${interaction.toContract}`;
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    });
    
    rates.topInteractionPairs = Array.from(pairCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pair, count]) => {
        const [from, to] = pair.split('-');
        return { from, to, count };
      });
    
    // Calculate cross-contract ratio
    const totalContracts = this.contracts.size;
    if (totalContracts > 1) {
      rates.crossContractRatio = (rates.uniqueContractPairs / (totalContracts * (totalContracts - 1))) * 100;
    }
    
    return rates;
  }

  /**
   * Generate mapping summary
   * @private
   */
  _generateMappingSummary(interactions, chains, dependencies) {
    const contractsWithInteractions = new Set();
    interactions.forEach(i => {
      contractsWithInteractions.add(i.fromContract);
      contractsWithInteractions.add(i.toContract);
    });
    
    const avgChainLength = chains.length > 0 ? 
      chains.reduce((sum, chain) => sum + chain.length, 0) / chains.length : 0;
    
    const strongDependencies = dependencies.filter(dep => 
      dep.dependsOn.length > 0 && dep.dependsOn.some(d => d.strength > 0.1)
    );
    
    return {
      contractsWithInteractions: contractsWithInteractions.size,
      interactionDensity: this.contracts.size > 0 ? 
        (contractsWithInteractions.size / this.contracts.size) * 100 : 0,
      averageChainLength: Math.round(avgChainLength * 100) / 100,
      strongDependencies: strongDependencies.length,
      networkComplexity: this._calculateNetworkComplexity(interactions, dependencies),
      interactionHealth: this._assessInteractionHealth(interactions)
    };
  }

  // Helper methods
  _isContractAddress(address) {
    // Simple heuristic - in production, would check if address has code
    return address && address.length === 42 && address.startsWith('0x');
  }

  _updateContractConnections(fromContract, toContract, chain) {
    const fromKey = `${chain}:${fromContract}`;
    const toKey = `${chain}:${toContract}`;
    
    if (this.contracts.has(fromKey)) {
      this.contracts.get(fromKey).connectedContracts.add(toContract);
      this.contracts.get(fromKey).interactionCount++;
    }
    
    if (this.contracts.has(toKey)) {
      this.contracts.get(toKey).connectedContracts.add(fromContract);
    }
  }

  _groupTransactionsByBlock(transactions) {
    const groups = {};
    
    transactions.forEach(tx => {
      const blockNumber = tx.block_number || 0;
      if (!groups[blockNumber]) {
        groups[blockNumber] = [];
      }
      groups[blockNumber].push(tx);
    });
    
    return groups;
  }

  _findContractChainsInBlock(transactions) {
    const chains = [];
    
    // Sort transactions by transaction index within block
    const sortedTxs = transactions.sort((a, b) => 
      (a.transaction_index || 0) - (b.transaction_index || 0)
    );
    
    // Look for sequential contract interactions
    for (let i = 0; i < sortedTxs.length - 1; i++) {
      const currentTx = sortedTxs[i];
      const nextTx = sortedTxs[i + 1];
      
      // Check if current transaction's 'to' matches next transaction's 'from'
      if (currentTx.to_address === nextTx.from_address && 
          this._isContractAddress(currentTx.to_address)) {
        
        const chain = [
          {
            contract: currentTx.from_address,
            function: currentTx.functionName || 'unknown',
            step: 0
          },
          {
            contract: currentTx.to_address,
            function: currentTx.functionName || 'unknown',
            step: 1
          },
          {
            contract: nextTx.to_address,
            function: nextTx.functionName || 'unknown',
            step: 2
          }
        ];
        
        chains.push(chain);
      }
    }
    
    return chains;
  }

  _calculateDependencyStrength(interactionCount, totalInteractions) {
    return totalInteractions > 0 ? interactionCount / totalInteractions : 0;
  }

  _calculateInteractionFrequency(interactions) {
    if (interactions.length === 0) return { daily: 0, hourly: 0 };
    
    const timestamps = interactions.map(i => new Date(i.timestamp).getTime());
    const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
    
    const days = timeSpan / (1000 * 60 * 60 * 24);
    const hours = timeSpan / (1000 * 60 * 60);
    
    return {
      daily: days > 0 ? interactions.length / days : 0,
      hourly: hours > 0 ? interactions.length / hours : 0
    };
  }

  _calculateNetworkComplexity(interactions, dependencies) {
    const uniqueContracts = new Set();
    interactions.forEach(i => {
      uniqueContracts.add(i.fromContract);
      uniqueContracts.add(i.toContract);
    });
    
    const nodes = uniqueContracts.size;
    const edges = interactions.length;
    
    // Simple complexity metric based on graph density
    if (nodes <= 1) return 0;
    
    const maxPossibleEdges = nodes * (nodes - 1);
    const density = edges / maxPossibleEdges;
    
    return Math.min(100, density * 100);
  }

  _assessInteractionHealth(interactions) {
    if (interactions.length === 0) return 'unknown';
    
    const successfulInteractions = interactions.filter(i => i.success).length;
    const successRate = successfulInteractions / interactions.length;
    
    if (successRate >= 0.95) return 'excellent';
    if (successRate >= 0.85) return 'good';
    if (successRate >= 0.70) return 'fair';
    return 'poor';
  }

  /**
   * Get contract interaction summary
   * @returns {Object} Interaction summary
   */
  getInteractionSummary() {
    const totalInteractions = Array.from(this.interactions.values())
      .reduce((sum, interactions) => sum + interactions.length, 0);
    
    return {
      totalContracts: this.contracts.size,
      totalInteractions,
      averageConnectionsPerContract: this.contracts.size > 0 ? 
        Array.from(this.contracts.values())
          .reduce((sum, contract) => sum + contract.connectedContracts.size, 0) / this.contracts.size : 0,
      mostConnectedContract: this._findMostConnectedContract(),
      interactionDensity: this._calculateOverallInteractionDensity()
    };
  }

  _findMostConnectedContract() {
    let mostConnected = null;
    let maxConnections = 0;
    
    this.contracts.forEach((contract, key) => {
      if (contract.connectedContracts.size > maxConnections) {
        maxConnections = contract.connectedContracts.size;
        mostConnected = {
          address: contract.address,
          connections: maxConnections,
          chain: contract.chain
        };
      }
    });
    
    return mostConnected;
  }

  _calculateOverallInteractionDensity() {
    if (this.contracts.size <= 1) return 0;
    
    const totalPossibleConnections = this.contracts.size * (this.contracts.size - 1);
    const actualConnections = Array.from(this.contracts.values())
      .reduce((sum, contract) => sum + contract.connectedContracts.size, 0);
    
    return (actualConnections / totalPossibleConnections) * 100;
  }

  /**
   * Export interaction data
   * @returns {Object} Complete interaction data
   */
  exportInteractionData() {
    return {
      contracts: Array.from(this.contracts.entries()).map(([key, contract]) => ({
        key,
        ...contract,
        functions: Array.from(contract.functions),
        connectedContracts: Array.from(contract.connectedContracts)
      })),
      interactions: Array.from(this.interactions.values()).flat(),
      functionChains: Array.from(this.functionChains.values()),
      dependencies: Array.from(this.dependencies.values()),
      summary: this.getInteractionSummary()
    };
  }
}
