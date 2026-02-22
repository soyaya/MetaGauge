/**
 * Cache Manager
 * In-memory caching with TTL support
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
  }

  set(key, value, ttlSeconds = 3600) {
    this.cache.set(key, value);
    
    if (ttlSeconds > 0) {
      const expiresAt = Date.now() + (ttlSeconds * 1000);
      this.ttls.set(key, expiresAt);
      
      // Auto-cleanup
      setTimeout(() => this.delete(key), ttlSeconds * 1000);
    }
  }

  get(key) {
    // Check if expired
    if (this.ttls.has(key)) {
      const expiresAt = this.ttls.get(key);
      if (Date.now() > expiresAt) {
        this.delete(key);
        return null;
      }
    }
    
    return this.cache.get(key) || null;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
  }

  clear() {
    this.cache.clear();
    this.ttls.clear();
  }

  size() {
    return this.cache.size;
  }

  // Cache with function execution
  async wrap(key, fn, ttlSeconds = 3600) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    this.set(key, result, ttlSeconds);
    return result;
  }
}

// Singleton instance
export default new CacheManager();
