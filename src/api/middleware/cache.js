/**
 * Cache middleware
 * Caches API responses
 */

import CacheManager from '../../services/CacheManager.js';

export const cacheMiddleware = (ttlSeconds = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `api:${req.originalUrl}:${req.user?.id || 'anon'}`;
    const cached = CacheManager.get(key);

    if (cached) {
      return res.json(cached);
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      CacheManager.set(key, data, ttlSeconds);
      return originalJson(data);
    };

    next();
  };
};

export default cacheMiddleware;
