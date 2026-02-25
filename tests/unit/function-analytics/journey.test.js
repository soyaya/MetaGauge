/**
 * Unit tests for JourneyAnalyzerService
 * Requirements: 4.1, 4.2, 4.3, 6.1, 6.5
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { JourneyAnalyzerService } from '../../../src/services/JourneyAnalyzerService.js';

class MockStorage {
  constructor() {
    this.interactions = [];
  }
  
  async getInteractions() {
    return this.interactions;
  }
}

describe('JourneyAnalyzerService - Unit Tests', () => {
  let service;
  let storage;

  beforeEach(() => {
    storage = new MockStorage();
    service = new JourneyAnalyzerService(storage);
  });

  describe('buildWalletJourney', () => {
    it('should return null for wallet with no interactions', async () => {
      const result = await service.buildWalletJourney('0xabc', '0xtest', 'ethereum');
      expect(result).toBeNull();
    });

    it('should build journey with single interaction', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x12345678', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 }
      ];

      const result = await service.buildWalletJourney('0xabc', '0xtest', 'ethereum');
      
      expect(result).not.toBeNull();
      expect(result.walletAddress).toBe('0xabc');
      expect(result.totalInteractions).toBe(1);
      expect(result.entryPoint).toBe('0x12345678');
      expect(result.uniqueSignatures).toBe(1);
    });

    it('should sort interactions chronologically', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x33333333', timestamp: new Date('2024-01-03'), transactionHash: '0xhash3', blockNumber: 102 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x22222222', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const result = await service.buildWalletJourney('0xabc', '0xtest', 'ethereum');
      
      expect(result.interactions[0].signature).toBe('0x11111111');
      expect(result.interactions[1].signature).toBe('0x22222222');
      expect(result.interactions[2].signature).toBe('0x33333333');
    });

    it('should identify entry point correctly', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x22222222', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 }
      ];

      const result = await service.buildWalletJourney('0xabc', '0xtest', 'ethereum');
      
      expect(result.entryPoint).toBe('0x11111111');
    });

    it('should count unique signatures', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xabc', signature: '0x22222222', timestamp: new Date('2024-01-03'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.buildWalletJourney('0xabc', '0xtest', 'ethereum');
      
      expect(result.uniqueSignatures).toBe(2);
    });
  });

  describe('getContractJourneys', () => {
    it('should return empty array for no interactions', async () => {
      const result = await service.getContractJourneys('0xtest', 'ethereum');
      expect(result).toEqual([]);
    });

    it('should build journeys for multiple wallets', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xdef', signature: '0x22222222', timestamp: new Date('2024-01-02'), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const result = await service.getContractJourneys('0xtest', 'ethereum');
      
      expect(result).toHaveLength(2);
      expect(result[0].walletAddress).toBe('0xabc');
      expect(result[1].walletAddress).toBe('0xdef');
    });
  });

  describe('generateFlowVisualization', () => {
    it('should generate nodes and edges', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01T10:00:00'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x22222222', timestamp: new Date('2024-01-01T11:00:00'), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const result = await service.generateFlowVisualization('0xtest', 'ethereum');
      
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('0x11111111');
      expect(result.edges[0].target).toBe('0x22222222');
    });

    it('should mark entry points and drop-offs', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01T10:00:00'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x22222222', timestamp: new Date('2024-01-01T11:00:00'), transactionHash: '0xhash2', blockNumber: 101 }
      ];

      const result = await service.generateFlowVisualization('0xtest', 'ethereum');
      
      const entryNode = result.nodes.find(n => n.signature === '0x11111111');
      const dropOffNode = result.nodes.find(n => n.signature === '0x22222222');
      
      expect(entryNode.isEntryPoint).toBe(true);
      expect(dropOffNode.isDropOff).toBe(true);
    });

    it('should filter by focus signature', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01T10:00:00'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x22222222', timestamp: new Date('2024-01-01T11:00:00'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xdef', signature: '0x33333333', timestamp: new Date('2024-01-01T12:00:00'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.generateFlowVisualization('0xtest', 'ethereum', null, '0x11111111');
      
      // Should only include journey with 0x11111111
      expect(result.nodes.some(n => n.signature === '0x33333333')).toBe(false);
    });
  });

  describe('identifyJourneyPatterns', () => {
    it('should identify entry points and drop-offs', async () => {
      storage.interactions = [
        { walletAddress: '0xabc', signature: '0x11111111', timestamp: new Date('2024-01-01T10:00:00'), transactionHash: '0xhash1', blockNumber: 100 },
        { walletAddress: '0xabc', signature: '0x22222222', timestamp: new Date('2024-01-01T11:00:00'), transactionHash: '0xhash2', blockNumber: 101 },
        { walletAddress: '0xdef', signature: '0x11111111', timestamp: new Date('2024-01-01T12:00:00'), transactionHash: '0xhash3', blockNumber: 102 }
      ];

      const result = await service.identifyJourneyPatterns('0xtest', 'ethereum');
      
      expect(result.entryPoints).toContain('0x11111111');
      expect(result.dropOffs.length).toBeGreaterThan(0);
      expect(result.commonPaths.length).toBeGreaterThan(0);
    });
  });
});
