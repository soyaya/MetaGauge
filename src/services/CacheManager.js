import fs from 'fs';
import path from 'path';

/**
 * Cache Manager
 * 
 * Manages caching for performance optimization:
 * - Transaction cache (store fetched transactions locally)
 * - ABI cache (decoded function information)
 * - Competitor data cache with 24-hour TTL
 * - Last processed block number tracking
 * - Cache invalidation and cleanup
 */
export class CacheManager {
  constructor(cacheDir = './cache') {
    this.cacheDir = cacheDir;
    this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
    this._ensureCacheDir();
  }

  /**
   * Get cached transactions for a contract
   */
  getTransactionCache(contractAddress, chain) {
    const cacheKey = this._getCacheKey('transactions', contractAddress, chain);
    return this._readCache(cacheKey);
  }

  /**
   * Set transaction cache
   */
  setTransactionCache(contractAddress, chain, transactions) {
    const cacheKey = this._getCacheKey('transactions', contractAddress, chain);
    return this._writeCache(cacheKey, transactions);
  }

  /**
   * Get cached ABI data
   */
  getAbiCache(contractAddress) {
    const cacheKey = this._getCacheKey('abi', contractAddress);
    return this._readCache(cacheKey);
  }

  /**
   * Set ABI cache
   */
  setAbiCache(contractAddress, abiData) {
    const cacheKey = this._getCacheKey('abi', contractAddress);
    return this._writeCache(cacheKey, abiData);
  }

  /**
   * Get competitor data cache
   */
  getCompetitorCache(contractAddress) {
    const cacheKey = this._getCacheKey('competitor', contractAddress);
    const cached = this._readCache(cacheKey);
    
    if (cached && this._isCacheValid(cached, this.defaultTTL)) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Set competitor data cache
   */
  setCompetitorCache(contractAddress, data) {
    const cacheKey = this._getCacheKey('competitor', contractAddress);
    return this._writeCache(cacheKey, data);
  }

  /**
   * Get last processed block number
   */
  getLastProcessedBlock(contractAddress, chain) {
    const cacheKey = this._getCacheKey('block', contractAddress, chain);
    const cached = this._readCache(cacheKey);
    return cached?.blockNumber || 0;
  }

  /**
   * Set last processed block number
   */
  setLastProcessedBlock(contractAddress, chain, blockNumber) {
    const cacheKey = this._getCacheKey('block', contractAddress, chain);
    return this._writeCache(cacheKey, { blockNumber });
  }

  /**
   * Invalidate cache for a contract
   */
  invalidateCache(contractAddress, chain = null) {
    const pattern = chain 
      ? `${contractAddress}_${chain}`
      : contractAddress;
    
    const files = fs.readdirSync(this.cacheDir);
    let invalidated = 0;
    
    for (const file of files) {
      if (file.includes(pattern)) {
        fs.unlinkSync(path.join(this.cacheDir, file));
        invalidated++;
      }
    }
    
    return invalidated;
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache(ttl = this.defaultTTL) {
    const files = fs.readdirSync(this.cacheDir);
    let cleaned = 0;
    
    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      const cached = this._readCacheFile(filePath);
      
      if (cached && !this._isCacheValid(cached, ttl)) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Generate cache key
   * @private
   */
  _getCacheKey(type, ...parts) {
    return `${type}_${parts.join('_')}.json`;
  }

  /**
   * Read from cache
   * @private
   */
  _readCache(cacheKey) {
    const filePath = path.join(this.cacheDir, cacheKey);
    return this._readCacheFile(filePath);
  }

  /**
   * Read cache file
   * @private
   */
  _readCacheFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Cache read error: ${error.message}`);
    }
    return null;
  }

  /**
   * Write to cache
   * @private
   */
  _writeCache(cacheKey, data) {
    const filePath = path.join(this.cacheDir, cacheKey);
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      
      fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.warn(`Cache write error: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if cache is still valid
   * @private
   */
  _isCacheValid(cached, ttl) {
    if (!cached || !cached.timestamp) return false;
    return (Date.now() - cached.timestamp) < ttl;
  }

  /**
   * Ensure cache directory exists
   * @private
   */
  _ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
}

export default CacheManager;
