/**
 * Function Analytics Service
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.4
 */

import { FunctionAnalyticsStorage } from './FunctionAnalyticsStorage.js';
import { functionDecoder } from './FunctionSignatureDecoder.js';

export class FunctionAnalyticsService {
  constructor(storage = null) {
    this.storage = storage || new FunctionAnalyticsStorage();
  }

  /**
   * Get all function signatures with aggregated metrics
   * Requirements: 2.1, 2.2, 2.4
   */
  async getFunctionSignatures(contractAddress, chain, dateRange = null) {
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    // Filter by date range if provided
    const filtered = dateRange
      ? interactions.filter(i => {
          const ts = new Date(i.timestamp);
          return ts >= dateRange.start && ts <= dateRange.end;
        })
      : interactions;

    // Group by signature
    const signatureMap = new Map();
    
    for (const interaction of filtered) {
      if (!interaction.signature) continue;
      
      if (!signatureMap.has(interaction.signature)) {
        signatureMap.set(interaction.signature, {
          signature: interaction.signature,
          wallets: new Set(),
          transactionCount: 0,
          firstSeen: new Date(interaction.timestamp),
          lastSeen: new Date(interaction.timestamp)
        });
      }
      
      const sig = signatureMap.get(interaction.signature);
      sig.wallets.add(interaction.walletAddress);
      sig.transactionCount++;
      
      const ts = new Date(interaction.timestamp);
      if (ts < sig.firstSeen) sig.firstSeen = ts;
      if (ts > sig.lastSeen) sig.lastSeen = ts;
    }

    // Convert to array and calculate metrics
    const signatures = Array.from(signatureMap.values()).map(sig => ({
      signature: sig.signature,
      name: functionDecoder.decode(sig.signature, contractAddress),
      walletCount: sig.wallets.size,
      transactionCount: sig.transactionCount,
      avgTransactionsPerWallet: sig.transactionCount / sig.wallets.size,
      firstSeen: sig.firstSeen,
      lastSeen: sig.lastSeen
    }));

    // Sort by wallet count descending (Requirement 2.4)
    signatures.sort((a, b) => b.walletCount - a.walletCount);

    return signatures;
  }

  /**
   * Get detailed metrics for a specific signature
   * Requirements: 2.1, 2.2, 3.1, 3.2
   */
  async getSignatureMetrics(contractAddress, chain, signature, dateRange = null) {
    const signatures = await this.getFunctionSignatures(contractAddress, chain, dateRange);
    return signatures.find(s => s.signature === signature) || null;
  }

  /**
   * Get wallets that interacted with a signature
   * Requirements: 3.1, 3.2, 3.4
   */
  async getSignatureWallets(contractAddress, chain, signature, dateRange = null, pagination = null) {
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    // Filter by signature and date range
    let filtered = interactions.filter(i => i.signature === signature);
    
    if (dateRange) {
      filtered = filtered.filter(i => {
        const ts = new Date(i.timestamp);
        return ts >= dateRange.start && ts <= dateRange.end;
      });
    }

    // Group by wallet
    const walletMap = new Map();
    for (const interaction of filtered) {
      if (!walletMap.has(interaction.walletAddress)) {
        walletMap.set(interaction.walletAddress, {
          walletAddress: interaction.walletAddress,
          transactionCount: 0,
          firstInteraction: new Date(interaction.timestamp),
          lastInteraction: new Date(interaction.timestamp),
          totalGasUsed: 0
        });
      }
      
      const wallet = walletMap.get(interaction.walletAddress);
      wallet.transactionCount++;
      
      const ts = new Date(interaction.timestamp);
      if (ts < wallet.firstInteraction) wallet.firstInteraction = ts;
      if (ts > wallet.lastInteraction) wallet.lastInteraction = ts;
      
      if (interaction.gasUsed) {
        wallet.totalGasUsed += interaction.gasUsed;
      }
    }

    const wallets = Array.from(walletMap.values());
    const total = wallets.length;

    // Apply pagination
    if (pagination) {
      const { limit, offset } = pagination;
      return {
        wallets: wallets.slice(offset, offset + limit),
        total,
        limit,
        offset
      };
    }

    return { wallets, total };
  }
}
