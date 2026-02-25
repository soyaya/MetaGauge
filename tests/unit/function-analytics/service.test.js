/**
 * Unit tests for FunctionAnalyticsService
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.2
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FunctionAnalyticsService } from '../../../src/services/FunctionAnalyticsService.js';

class MockStorage {
  constructor() {
    this.interactions = [];
  }
  
  async getInteractions() {
    return this.interactions;
  }
}

describe('FunctionAnalyticsService - Unit Tests', () => {
  let service;
  let storage;

  beforeEach(() => {
    storage = new MockStorage();
    service = new FunctionAnalyticsService(storage);
  });

  describe('getFunctionSignatures', () => {
    it('should return empty array for no interactions', async () => {
      const result = await service.getFunctionSignatures('0xtest', 'ethereum');
      expect(result).toEqual([]);
    });

    it('should aggregate wallet and transaction counts', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xdef', signature: '0x12345678', timestamp: new Date('2024-01-03'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.getFunctionSignatures('0xtest', 'ethereum');
      
      expect(result).toHaveLength(1);
      expect(result[0].signature).toBe('0x12345678');
      expect(result[0].walletCount).toBe(2);
      expect(result[0].transactionCount).toBe(3);
      expect(result[0].avgTransactionsPerWallet).toBe(1.5);
    });

    it('should handle multiple signatures', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date(), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: '0x22222222', timestamp: new Date(), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xghi', signature: '0x22222222', timestamp: new Date(), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.getFunctionSignatures('0xtest', 'ethereum');
      
      expect(result).toHaveLength(2);
      expect(result[0].walletCount).toBe(2); // 0x22222222 sorted first
      expect(result[1].walletCount).toBe(1); // 0x11111111 sorted second
    });

    it('should filter by date range', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: '0x12345678', timestamp: new Date('2024-02-01'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xghi', signature: '0x12345678', timestamp: new Date('2024-03-01'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.getFunctionSignatures('0xtest', 'ethereum', {
        start: new Date('2024-01-15'),
        end: new Date('2024-02-15')
      });
      
      expect(result[0].walletCount).toBe(1);
      expect(result[0].transactionCount).toBe(1);
    });

    it('should exclude interactions without signatures', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date(), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: null, timestamp: new Date(), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const result = await service.getFunctionSignatures('0xtest', 'ethereum');
      
      expect(result).toHaveLength(1);
      expect(result[0].signature).toBe('0x12345678');
    });
  });

  describe('getSignatureMetrics', () => {
    it('should return metrics for specific signature', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date(), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: '0x87654321', timestamp: new Date(), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const result = await service.getSignatureMetrics('0xtest', 'ethereum', '0x12345678');
      
      expect(result).not.toBeNull();
      expect(result.signature).toBe('0x12345678');
      expect(result.walletCount).toBe(1);
    });

    it('should return null for non-existent signature', async () => {
      storage.interactions = [];
      const result = await service.getSignatureMetrics('0xtest', 'ethereum', '0x99999999');
      expect(result).toBeNull();
    });
  });

  describe('getSignatureWallets', () => {
    it('should return wallets for signature', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xdef', signature: '0x12345678', timestamp: new Date('2024-01-03'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.getSignatureWallets('0xtest', 'ethereum', '0x12345678');
      
      expect(result.wallets).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.wallets[0].transactionCount).toBe(2);
      expect(result.wallets[1].transactionCount).toBe(1);
    });

    it('should support pagination', async () => {
      storage.interactions = [
        { walletAddress: '0xaaa', signature: '0x12345678', timestamp: new Date(), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xbbb', signature: '0x12345678', timestamp: new Date(), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xccc', signature: '0x12345678', timestamp: new Date(), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.getSignatureWallets('0xtest', 'ethereum', '0x12345678', null, {
        limit: 2,
        offset: 1
      });
      
      expect(result.wallets).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(1);
    });
  });
});
