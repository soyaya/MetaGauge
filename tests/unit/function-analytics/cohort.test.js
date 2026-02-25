/**
 * Unit tests for CohortCalculatorService
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CohortCalculatorService } from '../../../src/services/CohortCalculatorService.js';

class MockStorage {
  constructor() {
    this.interactions = [];
  }
  
  async getInteractions() {
    return this.interactions;
  }
}

describe('CohortCalculatorService - Unit Tests', () => {
  let service;
  let storage;

  beforeEach(() => {
    storage = new MockStorage();
    service = new CohortCalculatorService(storage);
  });

  describe('groupIntoCohorts', () => {
    it('should group wallets by monthly cohorts', () => {
      const interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-15'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: '0x11111111', timestamp: new Date('2024-01-20'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xghi', signature: '0x11111111', timestamp: new Date('2024-02-10'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const cohorts = service.groupIntoCohorts(interactions, 'monthly');
      
      expect(cohorts).toHaveLength(2);
      expect(cohorts[0].cohortId).toBe('2024-01');
      expect(cohorts[0].wallets).toHaveLength(2);
      expect(cohorts[1].cohortId).toBe('2024-02');
      expect(cohorts[1].wallets).toHaveLength(1);
    });

    it('should group wallets by daily cohorts', () => {
      const interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-15'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: '0x11111111', timestamp: new Date('2024-01-15'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xghi', signature: '0x11111111', timestamp: new Date('2024-01-16'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const cohorts = service.groupIntoCohorts(interactions, 'daily');
      
      expect(cohorts).toHaveLength(2);
      expect(cohorts[0].cohortId).toBe('2024-01-15');
      expect(cohorts[1].cohortId).toBe('2024-01-16');
    });

    it('should use first interaction for cohort assignment', () => {
      const interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-15'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-02-15'), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const cohorts = service.groupIntoCohorts(interactions, 'monthly');
      
      expect(cohorts).toHaveLength(1);
      expect(cohorts[0].cohortId).toBe('2024-01');
    });
  });

  describe('calculateActivation', () => {
    it('should calculate activation rate with default config', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xdef', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const cohorts = await service.calculateActivation('0xtest', 'ethereum');
      
      expect(cohorts).toHaveLength(1);
      expect(cohorts[0].activationRate).toBe(0.5); // 1 out of 2 wallets activated
    });

    it('should use custom activation config', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-03'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const cohorts = await service.calculateActivation('0xtest', 'ethereum', null, 'monthly', null, { interactions: 3, days: 7 });
      
      expect(cohorts[0].activationRate).toBe(1); // Wallet has 3 interactions
    });
  });

  describe('calculateRetention', () => {
    it('should calculate retention rates at different intervals', async () => {
      const now = new Date();
      const day1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const day8 = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: day8, transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: day1, transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const cohorts = await service.calculateRetention('0xtest', 'ethereum');
      
      expect(cohorts).toHaveLength(1);
      expect(cohorts[0].retentionRates.day1).toBe(1);
      expect(cohorts[0].retentionRates.day7).toBe(1);
    });
  });

  describe('calculateChurn', () => {
    it('should calculate churn rate with default config', async () => {
      const now = new Date();
      const day35Ago = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
      const day5Ago = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      
      // Ensure both wallets are in same cohort (same month)
      const baseDate = new Date('2024-01-01');
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: baseDate, transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: '0x11111111', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const cohorts = await service.calculateChurn('0xtest', 'ethereum');
      
      expect(cohorts).toHaveLength(1);
      expect(cohorts[0].churnRate).toBe(1); // Both churned (old data)
    });

    it('should use custom churn config', async () => {
      const now = new Date();
      const day10Ago = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: day10Ago, transactionHash: '0xhash1', blockNumber: 100 }
      ];

      const cohorts = await service.calculateChurn('0xtest', 'ethereum', null, 'monthly', null, { inactiveDays: 5 });
      
      expect(cohorts[0].churnRate).toBe(1); // Churned with 5-day threshold
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cohorts', async () => {
      storage.interactions = [];
      
      const activation = await service.calculateActivation('0xtest', 'ethereum');
      const retention = await service.calculateRetention('0xtest', 'ethereum');
      const churn = await service.calculateChurn('0xtest', 'ethereum');
      
      expect(activation).toEqual([]);
      expect(retention).toEqual([]);
      expect(churn).toEqual([]);
    });

    it('should handle single-wallet cohorts', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 }
      ];

      const cohorts = await service.calculateActivation('0xtest', 'ethereum');
      
      expect(cohorts).toHaveLength(1);
      expect(cohorts[0].walletCount).toBe(1);
    });
  });
});
