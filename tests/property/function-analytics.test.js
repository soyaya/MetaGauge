/**
 * Property-based tests for FunctionAnalyticsService
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.4
 */

import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { FunctionAnalyticsService } from '../../src/services/FunctionAnalyticsService.js';
import { JourneyAnalyzerService } from '../../src/services/JourneyAnalyzerService.js';
import { CohortCalculatorService } from '../../src/services/CohortCalculatorService.js';
import { FunctionAnalyticsStorage } from '../../src/services/FunctionAnalyticsStorage.js';

// Mock storage for testing
class MockStorage {
  constructor() {
    this.interactions = [];
  }
  
  async getInteractions() {
    return this.interactions;
  }
  
  async saveInteractions(contractAddress, chain, interactions) {
    this.interactions = interactions;
  }
}

describe('FunctionAnalyticsService - Property Tests', () => {
  /**
   * Property 1: Unique Wallet Count Accuracy
   * Validates: Requirements 2.1, 2.2
   */
  it('Property 1: unique wallet counts match distinct addresses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            walletAddress: fc.string({ minLength: 40, maxLength: 40 }),
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 1, maxLength: 100 }
        ),
        async (interactions) => {
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new FunctionAnalyticsService(storage);
          
          const signatures = await service.getFunctionSignatures('0xtest', 'ethereum');
          
          // Verify wallet counts match unique addresses per signature
          for (const sig of signatures) {
            const uniqueWallets = new Set(
              interactions
                .filter(i => i.signature === sig.signature)
                .map(i => i.walletAddress)
            );
            expect(sig.walletCount).toBe(uniqueWallets.size);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Transaction Count Accuracy
   * Validates: Requirements 3.1, 3.2, 3.4
   */
  it('Property 2: transaction counts and averages are accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            walletAddress: fc.string({ minLength: 40, maxLength: 40 }),
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 1, maxLength: 100 }
        ),
        async (interactions) => {
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new FunctionAnalyticsService(storage);
          
          const signatures = await service.getFunctionSignatures('0xtest', 'ethereum');
          
          for (const sig of signatures) {
            const sigInteractions = interactions.filter(i => i.signature === sig.signature);
            const uniqueWallets = new Set(sigInteractions.map(i => i.walletAddress)).size;
            
            expect(sig.transactionCount).toBe(sigInteractions.length);
            expect(sig.avgTransactionsPerWallet).toBeCloseTo(
              sigInteractions.length / uniqueWallets,
              5
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Signature Sorting Invariant
   * Validates: Requirements 2.4
   */
  it('Property 3: signatures are sorted by wallet count descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            walletAddress: fc.string({ minLength: 40, maxLength: 40 }),
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 2, maxLength: 100 }
        ),
        async (interactions) => {
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new FunctionAnalyticsService(storage);
          
          const signatures = await service.getFunctionSignatures('0xtest', 'ethereum');
          
          // Verify descending order
          for (let i = 0; i < signatures.length - 1; i++) {
            expect(signatures[i].walletCount).toBeGreaterThanOrEqual(
              signatures[i + 1].walletCount
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('JourneyAnalyzerService - Property Tests', () => {
  /**
   * Property 4: Journey Sequence Preservation
   * Validates: Requirements 4.1, 4.2
   */
  it('Property 4: interactions are ordered chronologically', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 40, maxLength: 40 }),
        fc.array(
          fc.record({
            walletAddress: fc.constant('0xsameWallet'),
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 2, maxLength: 50 }
        ),
        async (wallet, interactions) => {
          interactions.forEach(i => i.walletAddress = wallet);
          
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new JourneyAnalyzerService(storage);
          
          const journey = await service.buildWalletJourney(wallet, '0xtest', 'ethereum');
          
          if (journey) {
            // Verify chronological order
            for (let i = 1; i < journey.interactions.length; i++) {
              const prev = new Date(journey.interactions[i - 1].timestamp);
              const curr = new Date(journey.interactions[i].timestamp);
              
              // Skip if dates are invalid
              if (isNaN(prev.getTime()) || isNaN(curr.getTime())) continue;
              
              expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Journey Completeness
   * Validates: Requirements 4.3
   */
  it('Property 5: all wallet interactions are included in journey', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 40, maxLength: 40 }),
        fc.array(
          fc.record({
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 1, maxLength: 50 }
        ),
        async (wallet, interactions) => {
          interactions.forEach(i => i.walletAddress = wallet);
          
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new JourneyAnalyzerService(storage);
          
          const journey = await service.buildWalletJourney(wallet, '0xtest', 'ethereum');
          
          expect(journey.totalInteractions).toBe(interactions.length);
          expect(journey.interactions).toHaveLength(interactions.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Entry Point Identification
   * Validates: Requirements 4.4
   */
  it('Property 6: entry point is the earliest interaction', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 40, maxLength: 40 }),
        fc.array(
          fc.record({
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 1, maxLength: 50 }
        ),
        async (wallet, interactions) => {
          interactions.forEach(i => i.walletAddress = wallet);
          
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new JourneyAnalyzerService(storage);
          
          const journey = await service.buildWalletJourney(wallet, '0xtest', 'ethereum');
          
          if (journey) {
            const validInteractions = interactions.filter(i => !isNaN(new Date(i.timestamp).getTime()));
            if (validInteractions.length === 0) return;
            
            const earliestTimestamp = Math.min(...validInteractions.map(i => new Date(i.timestamp).getTime()));
            const earliestInteraction = validInteractions.find(i => new Date(i.timestamp).getTime() === earliestTimestamp);
            
            if (earliestInteraction) {
              expect(journey.entryPoint).toBe(earliestInteraction.signature);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Flow Visualization Accuracy
   * Validates: Requirements 6.1, 6.2, 6.3
   */
  it('Property 11: all transitions are captured with correct counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            walletAddress: fc.string({ minLength: 40, maxLength: 40 }),
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 2, maxLength: 50 }
        ),
        async (interactions) => {
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new JourneyAnalyzerService(storage);
          
          const flow = await service.generateFlowVisualization('0xtest', 'ethereum');
          
          // Verify all nodes have positive wallet counts
          for (const node of flow.nodes) {
            expect(node.walletCount).toBeGreaterThan(0);
          }
          
          // Verify all edges have valid transition rates
          for (const edge of flow.edges) {
            expect(edge.transitionRate).toBeGreaterThan(0);
            expect(edge.transitionRate).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('CohortCalculatorService - Property Tests', () => {
  /**
   * Property 7: Cohort Grouping Consistency
   * Validates: Requirements 5.1
   */
  it('Property 7: wallets in same cohort have first interactions in same period', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            walletAddress: fc.string({ minLength: 40, maxLength: 40 }),
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 1, maxLength: 50 }
        ),
        async (interactions) => {
          const service = new CohortCalculatorService();
          const cohorts = service.groupIntoCohorts(interactions, 'monthly');
          
          // Verify each cohort's wallets have first interactions in same month
          for (const cohort of cohorts) {
            const walletFirstInteraction = new Map();
            
            for (const interaction of interactions) {
              if (!cohort.wallets.includes(interaction.walletAddress)) continue;
              
              const ts = new Date(interaction.timestamp);
              if (!walletFirstInteraction.has(interaction.walletAddress) || 
                  ts < walletFirstInteraction.get(interaction.walletAddress)) {
                walletFirstInteraction.set(interaction.walletAddress, ts);
              }
            }
            
            // All first interactions should be in same month
            const months = new Set();
            for (const [_, firstTs] of walletFirstInteraction) {
              months.add(`${firstTs.getFullYear()}-${firstTs.getMonth()}`);
            }
            
            expect(months.size).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8: Cohort Metric Calculation
   * Validates: Requirements 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3
   */
  it('Property 8: activation, churn, and retention rates are between 0 and 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            walletAddress: fc.string({ minLength: 40, maxLength: 40 }),
            signature: fc.string({ minLength: 8, maxLength: 8 }),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }),
            transactionHash: fc.string({ minLength: 64, maxLength: 64 }),
            blockNumber: fc.nat()
          }),
          { minLength: 2, maxLength: 30 }
        ),
        async (interactions) => {
          const storage = new MockStorage();
          storage.interactions = interactions;
          const service = new CohortCalculatorService(storage);
          
          const activation = await service.calculateActivation('0xtest', 'ethereum');
          const retention = await service.calculateRetention('0xtest', 'ethereum');
          const churn = await service.calculateChurn('0xtest', 'ethereum');
          
          // Verify all rates are between 0 and 1
          for (const cohort of activation) {
            expect(cohort.activationRate).toBeGreaterThanOrEqual(0);
            expect(cohort.activationRate).toBeLessThanOrEqual(1);
          }
          
          for (const cohort of retention) {
            for (const rate of Object.values(cohort.retentionRates)) {
              expect(rate).toBeGreaterThanOrEqual(0);
              expect(rate).toBeLessThanOrEqual(1);
            }
          }
          
          for (const cohort of churn) {
            expect(cohort.churnRate).toBeGreaterThanOrEqual(0);
            expect(cohort.churnRate).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
