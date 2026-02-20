/**
 * RPC Response Cache
 * Caches blockchain data with TTL
 */
export class RpcCache {
  constructor(ttlMs = 60000) {
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  _key(method, params) {
    return `${method}:${JSON.stringify(params)}`;
  }

  get(method, params) {
    const key = this._key(method, params);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(method, params, data) {
    const key = this._key(method, params);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}
