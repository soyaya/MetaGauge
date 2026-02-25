/**
 * Function Signature Processor
 * Extracts function signatures from transactions and populates analytics data
 * Requirements: 2.1, 2.3, 3.1, 3.3, 4.1, 4.2
 */

import { FunctionAnalyticsStorage } from '../../services/FunctionAnalyticsStorage.js';

export class FunctionSignatureProcessor {
  constructor() {
    this.storage = new FunctionAnalyticsStorage();
  }

  /**
   * Extract function signature from transaction input data
   */
  extractSignature(inputData) {
    if (!inputData || inputData === '0x' || inputData.length < 10) {
      return null;
    }
    
    // First 4 bytes (8 hex chars) after 0x is the function signature
    return inputData.slice(0, 10);
  }

  /**
   * Process transactions and extract function signatures
   */
  async processTransactions(contractAddress, chain, transactions) {
    if (!transactions || transactions.length === 0) {
      return;
    }

    const interactions = [];

    for (const tx of transactions) {
      // Extract function signature from input data
      const signature = this.extractSignature(tx.input || tx.data);
      
      if (!signature) {
        continue; // Skip transactions without function signatures
      }

      // Create interaction record
      const interaction = {
        walletAddress: tx.from.toLowerCase(),
        signature: signature.toLowerCase(),
        timestamp: tx.timestamp || new Date(tx.timeStamp * 1000).toISOString(),
        transactionHash: tx.hash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed ? parseInt(tx.gasUsed) : undefined,
        value: tx.value
      };

      interactions.push(interaction);
    }

    if (interactions.length > 0) {
      // Get existing interactions
      const existing = await this.storage.getInteractions(contractAddress, chain);
      
      // Merge with new interactions (avoid duplicates by hash)
      const existingHashes = new Set(existing.map(i => i.transactionHash));
      const newInteractions = interactions.filter(i => !existingHashes.has(i.transactionHash));
      
      if (newInteractions.length > 0) {
        const allInteractions = [...existing, ...newInteractions];
        
        // Sort by timestamp
        allInteractions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Save updated interactions
        await this.storage.saveInteractions(contractAddress, chain, allInteractions);
        
        console.log(`Processed ${newInteractions.length} new function signature interactions for ${contractAddress}`);
      }
    }

    return interactions.length;
  }

  /**
   * Process a single transaction
   */
  async processSingleTransaction(contractAddress, chain, transaction) {
    return await this.processTransactions(contractAddress, chain, [transaction]);
  }

  /**
   * Get analytics summary for contract
   */
  async getAnalyticsSummary(contractAddress, chain) {
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    if (interactions.length === 0) {
      return {
        totalInteractions: 0,
        uniqueWallets: 0,
        uniqueSignatures: 0
      };
    }

    const uniqueWallets = new Set(interactions.map(i => i.walletAddress)).size;
    const uniqueSignatures = new Set(interactions.map(i => i.signature)).size;

    return {
      totalInteractions: interactions.length,
      uniqueWallets,
      uniqueSignatures,
      dateRange: {
        start: interactions[0].timestamp,
        end: interactions[interactions.length - 1].timestamp
      }
    };
  }
}
