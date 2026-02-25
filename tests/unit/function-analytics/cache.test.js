/**
 * Unit tests for AnalyticsCacheService
 * Requirements: 2.3, 3.3
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnalyticsCacheService } from '../../../src/services/AnalyticsCacheService.js';

describe('AnalyticsCacheService - Unit Tests', () => {
  let cache;

  beforeEach(() => {
    cache = new AnalyticsCacheService(1000); // 1 second TTL for testing
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same parameters', () => {
      const params1 = { contract: '0xabc', chain: 'ethereum', signature: '0x123' };
      const params2 = { signature: '0x123', contract: '0xabc', chain: 'ethereum' };
      
      const key1 = cache.generateKey('signatures', params1);
      const key2 = cache.generateKey('signatures', params2);
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different parameters', () => {
      const params1 = { contract: '0xabc', chain: 'ethereum' };
      const params2 = { contract: '0xdef', chain: 'ethereum' };
      
      const key1 = cache.generateKey('signatures', params1);
      const key2 = cache.generateKey('signatures', params2);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('get and set', () => {
    it('should store and retrieve data', () => {
      const key = 'test:key';
      const data = { value: 123 };
      
      cache.set(key, data);
      const retrieved = cache.get(key);
      
      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent key', () => {
      const retrieved = cache.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired data', async () => {
      const key = 'test:key';
      const data = { value: 123 };
      
      cache.set(key, data, 100); // 100ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const retrieved = cache.get(key);
      expect(retrieved).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      const key = 'test:key';
      const data = { value: 123 };
      
      cache.set(key, data, 2000); // 2 seconds TTL
      
      // Should still be valid after 500ms
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const retrieved = cache.get(key);
      expect(retrieved).toEqual(data);
    });
  });

  describe('invalidate', () => {
    it('should invalidate all keys with matching prefix', () => {
      cache.set('signatures:0xabc', { data: 1 });
      cache.set('signatures:0xdef', { data: 2 });
      cache.set('journeys:0xabc', { data: 3 });
      
      const count = cache.invalidate('signatures');
      
      expect(count).toBe(2);
      expect(cache.get('signatures:0xabc')).toBeNull();
      expect(cache.get('signatures:0xdef')).toBeNull();
      expect(cache.get('journeys:0xabc')).not.toBeNull();
    });

    it('should return 0 when no keys match', () => {
      cache.set('test:key', { data: 1 });
      
      const count = cache.invalidate('nonexistent');
      
      expect(count).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      cache.set('key1', { data: 1 });
      cache.set('key2', { data: 2 });
      cache.set('key3', { data: 3 });
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      cache.set('key1', { data: 1 }, 2000);
      cache.set('key2', { data: 2 }, 100);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const stats = cache.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.expired).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      cache.set('key1', { data: 1 }, 2000);
      cache.set('key2', { data: 2 }, 100);
      cache.set('key3', { data: 3 }, 100);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const removed = cache.cleanup();
      
      expect(removed).toBe(2);
      expect(cache.get('key1')).not.toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });
  });
});
