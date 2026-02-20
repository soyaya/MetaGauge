/**
 * RPC Error Context Tracker
 * Tracks error patterns and provides insights
 */
export class RpcErrorTracker {
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
  }

  track(error, context = {}) {
    this.errors.push({
      message: error.message,
      code: error.code,
      rpcUrl: context.rpcUrl,
      method: context.method,
      params: context.params,
      timestamp: Date.now(),
      attempt: context.attempt,
      stack: error.stack
    });
    
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
  }

  getStats() {
    const now = Date.now();
    const last5min = this.errors.filter(e => now - e.timestamp < 300000);
    
    const byUrl = {};
    const byMethod = {};
    
    last5min.forEach(e => {
      byUrl[e.rpcUrl] = (byUrl[e.rpcUrl] || 0) + 1;
      byMethod[e.method] = (byMethod[e.method] || 0) + 1;
    });
    
    return {
      total: this.errors.length,
      last5min: last5min.length,
      byUrl,
      byMethod,
      recentErrors: this.errors.slice(-10)
    };
  }

  clear() {
    this.errors = [];
  }
}
