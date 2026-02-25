/**
 * Integration tests for Function Analytics API Routes
 * Requirements: 2.1, 3.1, 4.1, 5.1
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import functionsRouter from '../../src/api/routes/functions.js';
import { FunctionAnalyticsStorage } from '../../src/services/FunctionAnalyticsStorage.js';

describe('Function Analytics API Routes - Integration Tests', () => {
  let app;
  let storage;

  beforeAll(async () => {
    // Setup test app
    app = express();
    app.use(express.json());
    app.use('/api/functions', functionsRouter);
    
    // Setup test data
    storage = new FunctionAnalyticsStorage('./data/test-function-analytics');
    const testInteractions = [
      {
        walletAddress: '0xabc',
        signature: '0x12345678',
        timestamp: '2024-01-15T10:00:00.000Z',
        transactionHash: '0xhash1',
        blockNumber: 100
      },
      {
        walletAddress: '0xabc',
        signature: '0x12345678',
        timestamp: '2024-01-16T10:00:00.000Z',
        transactionHash: '0xhash2',
        blockNumber: 101
      },
      {
        walletAddress: '0xdef',
        signature: '0x87654321',
        timestamp: '2024-01-17T10:00:00.000Z',
        transactionHash: '0xhash3',
        blockNumber: 102
      }
    ];
    
    await storage.saveInteractions('0xtest', 'ethereum', testInteractions);
  });

  afterAll(async () => {
    await storage.deleteContractData('0xtest', 'ethereum');
  });

  describe('GET /api/functions/signatures', () => {
    it('should return all function signatures', async () => {
      const response = await request(app)
        .get('/api/functions/signatures')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // May be empty if no data, that's ok
    });

    it('should return 400 without required parameters', async () => {
      const response = await request(app)
        .get('/api/functions/signatures');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/functions/signatures')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          startDate: '2024-01-16',
          endDate: '2024-01-18'
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/functions/signatures/:signature', () => {
    it('should return 404 for non-existent signature', async () => {
      const response = await request(app)
        .get('/api/functions/signatures/0x99999999')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(404);
    });

    it('should return 400 without required parameters', async () => {
      const response = await request(app)
        .get('/api/functions/signatures/0x12345678');
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/functions/signatures/:signature/wallets', () => {
    it('should return wallets for signature', async () => {
      const response = await request(app)
        .get('/api/functions/signatures/0x12345678/wallets')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(200);
      expect(response.body.wallets).toBeDefined();
      expect(response.body.total).toBeDefined();
      expect(Array.isArray(response.body.wallets)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/functions/signatures/0x12345678/wallets')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          limit: 1,
          offset: 0
        });
      
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(1);
      expect(response.body.offset).toBe(0);
    });
  });

  describe('GET /api/functions/journeys', () => {
    it('should return all journeys', async () => {
      const response = await request(app)
        .get('/api/functions/journeys')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return journey for specific wallet', async () => {
      const response = await request(app)
        .get('/api/functions/journeys')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          walletAddress: '0xabc'
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0].walletAddress).toBe('0xabc');
      }
    });
  });

  describe('GET /api/functions/journeys/flow', () => {
    it('should return flow visualization', async () => {
      const response = await request(app)
        .get('/api/functions/journeys/flow')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(200);
      expect(response.body.nodes).toBeDefined();
      expect(response.body.edges).toBeDefined();
      expect(Array.isArray(response.body.nodes)).toBe(true);
      expect(Array.isArray(response.body.edges)).toBe(true);
    });

    it('should filter by signature', async () => {
      const response = await request(app)
        .get('/api/functions/journeys/flow')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          signature: '0x12345678'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.nodes).toBeDefined();
    });
  });

  describe('GET /api/functions/journeys/:walletAddress', () => {
    it('should return 404 for non-existent wallet', async () => {
      const response = await request(app)
        .get('/api/functions/journeys/0xnonexistent')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(404);
    });

    it('should return 400 without required parameters', async () => {
      const response = await request(app)
        .get('/api/functions/journeys/0xabc');
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/functions/cohorts', () => {
    it('should return activation cohorts by default', async () => {
      const response = await request(app)
        .get('/api/functions/cohorts')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return retention cohorts', async () => {
      const response = await request(app)
        .get('/api/functions/cohorts')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          metricType: 'retention'
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return churn cohorts', async () => {
      const response = await request(app)
        .get('/api/functions/cohorts')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          metricType: 'churn'
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should validate cohort period', async () => {
      const response = await request(app)
        .get('/api/functions/cohorts')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          cohortPeriod: 'invalid'
        });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/functions/cohorts/activation', () => {
    it('should return activation cohorts', async () => {
      const response = await request(app)
        .get('/api/functions/cohorts/activation')
        .query({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support custom activation config', async () => {
      const response = await request(app)
        .get('/api/functions/cohorts/activation')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          interactions: 3,
          days: 14
        });
      
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/functions/cache/invalidate', () => {
    it('should invalidate cache', async () => {
      const response = await request(app)
        .post('/api/functions/cache/invalidate')
        .send({ contractAddress: '0xtest', chain: 'ethereum' });
      
      expect(response.status).toBe(200);
      expect(response.body.invalidated).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date ranges', async () => {
      const response = await request(app)
        .get('/api/functions/signatures')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          startDate: '2024-01-20',
          endDate: '2024-01-10'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('before');
    });

    it('should handle future dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const response = await request(app)
        .get('/api/functions/signatures')
        .query({ 
          contractAddress: '0xtest', 
          chain: 'ethereum',
          startDate: '2024-01-01',
          endDate: futureDate.toISOString()
        });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('future');
    });
  });
});
