/**
 * Enhanced retry policies with exponential backoff
 */

export class RetryPolicy {
  constructor(maxRetries = 3, baseDelay = 1000, maxDelay = 30000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * Execute with retry
   */
  async execute(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateDelay(attempt) {
    const delay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Add jitter
    return Math.min(delay + jitter, this.maxDelay);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;
  }

  /**
   * Execute with circuit breaker
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle success
   */
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  /**
   * Handle failure
   */
  onFailure() {
    this.failures++;
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  /**
   * Get state
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: this.nextAttempt
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.nextAttempt = 0;
  }
}
