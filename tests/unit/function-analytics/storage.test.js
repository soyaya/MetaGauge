/**
 * Unit tests for FunctionAnalyticsStorage
 * Requirements: 2.1, 3.1, 4.3
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { FunctionAnalyticsStorage } from '../../../src/services/FunctionAnalyticsStorage.js';

describe('FunctionAnalyticsStorage', () => {
  const testDir = './data/test-function-analytics';
  const storage = new FunctionAnalyticsStorage(testDir);
  const testContract = '0x1234567890123456789012345678901234567890';
  const testChain = 'ethereum';

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Directory Creation', () => {
    it('should create directory structure on first write', async () => {
      const signatures = [{ signature: '0x12345678', walletCount: 5 }];
      await storage.saveSignatures(testContract, testChain, signatures);
      
      const contractDir = path.join(testDir, `${testContract}_${testChain}`);
      const stats = await fs.stat(contractDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Signatures', () => {
    it('should save and retrieve signatures', async () => {
      const signatures = [
        { signature: '0x12345678', walletCount: 5, transactionCount: 10 },
        { signature: '0x87654321', walletCount: 3, transactionCount: 7 }
      ];
      
      await storage.saveSignatures(testContract, testChain, signatures);
      const retrieved = await storage.getSignatures(testContract, testChain);
      
      expect(retrieved).toEqual(signatures);
    });

    it('should return empty array for non-existent signatures', async () => {
      const retrieved = await storage.getSignatures(testContract, testChain);
      expect(retrieved).toEqual([]);
    });
  });

  describe('Interactions', () => {
    it('should save and retrieve interactions', async () => {
      const interactions = [
        {
          walletAddress: '0xabc',
          signature: '0x12345678',
          timestamp: '2024-01-01T00:00:00.000Z',
          transactionHash: '0xhash1',
          blockNumber: 100
        }
      ];
      
      await storage.saveInteractions(testContract, testChain, interactions);
      const retrieved = await storage.getInteractions(testContract, testChain);
      
      expect(retrieved).toEqual(interactions);
    });

    it('should append interaction to existing list', async () => {
      const initial = [
        {
          walletAddress: '0xabc',
          signature: '0x12345678',
          timestamp: '2024-01-01T00:00:00.000Z',
          transactionHash: '0xhash1',
          blockNumber: 100
        }
      ];
      
      await storage.saveInteractions(testContract, testChain, initial);
      
      const newInteraction = {
        walletAddress: '0xdef',
        signature: '0x87654321',
        timestamp: '2024-01-02T00:00:00.000Z',
        transactionHash: '0xhash2',
        blockNumber: 101
      };
      
      await storage.appendInteraction(testContract, testChain, newInteraction);
      const retrieved = await storage.getInteractions(testContract, testChain);
      
      expect(retrieved).toHaveLength(2);
      expect(retrieved[1]).toEqual(newInteraction);
    });
  });

  describe('Journeys', () => {
    it('should save and retrieve journeys', async () => {
      const journeys = [
        {
          walletAddress: '0xabc',
          interactions: [],
          entryPoint: '0x12345678',
          totalInteractions: 5,
          hasGaps: false
        }
      ];
      
      await storage.saveJourneys(testContract, testChain, journeys);
      const retrieved = await storage.getJourneys(testContract, testChain);
      
      expect(retrieved).toEqual(journeys);
    });
  });

  describe('Cohorts', () => {
    it('should save and retrieve cohorts', async () => {
      const cohorts = [
        {
          cohortId: '2024-01',
          cohortDate: '2024-01-01T00:00:00.000Z',
          cohortPeriod: 'monthly',
          walletCount: 100,
          activationRate: 0.75
        }
      ];
      
      await storage.saveCohorts(testContract, testChain, cohorts);
      const retrieved = await storage.getCohorts(testContract, testChain);
      
      expect(retrieved).toEqual(cohorts);
    });
  });

  describe('Error Handling', () => {
    it('should handle read errors gracefully', async () => {
      const retrieved = await storage.getSignatures('nonexistent', 'chain');
      expect(retrieved).toEqual([]);
    });

    it('should delete contract data', async () => {
      await storage.saveSignatures(testContract, testChain, [{ signature: '0x12345678' }]);
      await storage.deleteContractData(testContract, testChain);
      
      const retrieved = await storage.getSignatures(testContract, testChain);
      expect(retrieved).toEqual([]);
    });

    it('should not throw when deleting non-existent data', async () => {
      await expect(
        storage.deleteContractData('nonexistent', 'chain')
      ).resolves.not.toThrow();
    });
  });
});
