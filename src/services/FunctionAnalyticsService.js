/**
 * Function Analytics Service
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.4
 */

import { FunctionAnalyticsStorage } from './FunctionAnalyticsStorage.js';
import { functionDecoder } from './FunctionSignatureDecoder.js';
import { UserStorage } from '../api/database/index.js';

export class FunctionAnalyticsService {
  constructor(storage = null) {
    this.storage = storage || new FunctionAnalyticsStorage();
  }

  /**
   * Load contract ABI from the user's onboarding data and register it with the decoder
   */
  async _loadABIForContract(contractAddress, userId = null) {
    if (functionDecoder.hasABI(contractAddress)) return;
    try {
      if (userId) {
        const user = await UserStorage.findById(userId);
        const dc = user?.onboarding?.defaultContract;
        if (dc?.address?.toLowerCase() === contractAddress.toLowerCase() && dc?.abi) {
          functionDecoder.loadABI(contractAddress, JSON.parse(dc.abi));
          return;
        }
      }
      // Fallback: scan all users for this contract
      const { readdir } = await import('fs/promises');
      const { join } = await import('path');
      const usersDir = join(process.cwd(), 'data', 'users');
      const userDirs = await readdir(usersDir).catch(() => []);
      for (const uid of userDirs) {
        const u = await UserStorage.findById(uid).catch(() => null);
        const dc = u?.onboarding?.defaultContract;
        if (dc?.address?.toLowerCase() === contractAddress.toLowerCase() && dc?.abi) {
          functionDecoder.loadABI(contractAddress, JSON.parse(dc.abi));
          return;
        }
      }
    } catch (e) {
      // silent — decoder will fall back to built-in DB
    }
  }

  /**
   * Get all function signatures with aggregated metrics
   * Requirements: 2.1, 2.2, 2.4
   */
  async getFunctionSignatures(contractAddress, chain, dateRange = null, userId = null) {
    // Ensure ABI is loaded so contract-specific functions are decoded
    await this._loadABIForContract(contractAddress, userId);

    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    const filtered = dateRange
      ? interactions.filter(i => {
          const ts = new Date(i.timestamp);
          return ts >= dateRange.start && ts <= dateRange.end;
        })
      : interactions;

    const signatureMap = new Map();
    
    for (const interaction of filtered) {
      if (!interaction.signature) continue;
      
      if (!signatureMap.has(interaction.signature)) {
        signatureMap.set(interaction.signature, {
          signature: interaction.signature,
          txTo: interaction.txTo || null,
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

    const signatures = Array.from(signatureMap.values()).map(sig => {
      const name = functionDecoder.decodeWithContext
        ? functionDecoder.decodeWithContext(sig.signature, sig.txTo, contractAddress)
        : functionDecoder.decode(sig.signature, contractAddress);
      return {
        signature: sig.signature,
        name,
        walletCount: sig.wallets.size,
        transactionCount: sig.transactionCount,
        avgTransactionsPerWallet: sig.transactionCount / sig.wallets.size,
        firstSeen: sig.firstSeen,
        lastSeen: sig.lastSeen
      };
    });

    signatures.sort((a, b) => b.walletCount - a.walletCount);

    // Resolve remaining unknowns via 4byte.directory
    const unknownSelectors = signatures.filter(s => !s.name).map(s => s.signature);
    if (unknownSelectors.length > 0) {
      await functionDecoder.lookupUnknown(unknownSelectors);
      for (const sig of signatures) {
        if (!sig.name) {
          sig.name = functionDecoder.decode(sig.signature, contractAddress);
        }
      }
    }

    return signatures;
  }

  /**
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
