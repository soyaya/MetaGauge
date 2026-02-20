/**
 * RPC Request Queue
 * Manages concurrent requests with rate limiting per subscription tier
 */
export class RpcRequestQueue {
  constructor(tier = 'free') {
    this.tier = tier;
    this.queue = [];
    this.processing = 0;
    this.limits = {
      free: { concurrent: 2, requestsPerMin: 30 },
      pro: { concurrent: 5, requestsPerMin: 100 },
      enterprise: { concurrent: 10, requestsPerMin: 300 }
    };
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  async enqueue(fn) {
    const limit = this.limits[this.tier] || this.limits.free;
    
    // Wait if at concurrent limit
    while (this.processing >= limit.concurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check rate limit window
    const now = Date.now();
    if (now - this.windowStart > 60000) {
      this.requestCount = 0;
      this.windowStart = now;
    }
    
    // Wait if rate limit exceeded
    if (this.requestCount >= limit.requestsPerMin) {
      const waitTime = 60000 - (now - this.windowStart);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }
    
    this.processing++;
    this.requestCount++;
    
    try {
      return await fn();
    } finally {
      this.processing--;
    }
  }

  setTier(tier) {
    this.tier = tier;
  }
}
