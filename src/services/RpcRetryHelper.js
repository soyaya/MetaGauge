/**
 * RPC Retry Helper with Exponential Backoff
 * Provides retry logic for RPC connections with configurable backoff
 */

export class RpcRetryHelper {
  /**
   * Execute a function with retry logic and exponential backoff
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Retry options
   * @returns {Promise} Result of the function
   */
  static async withRetry(fn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      onRetry = null,
      shouldRetry = null
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable) {
          throw error;
        }

        // Log retry attempt (info level, not error)
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, error);
        } else {
          console.info(`ℹ️ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
        }

        // Wait before retrying
        await this.sleep(delay);

        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  static isRetryableError(error) {
    const message = error.message?.toLowerCase() || '';
    const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';

    // Network errors that should be retried
    const retryablePatterns = [
      'econnreset',
      'econnrefused',
      'etimedout',
      'socket hang up',
      'network error',
      'fetch failed',
      'timeout',
      'aborted',
      'connection',
      'rate limit',
      'too many requests',
      '429',
      '502',
      '503',
      '504'
    ];

    return retryablePatterns.some(pattern => 
      message.includes(pattern) || code.includes(pattern)
    );
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Suppress ECONNRESET and similar errors from console
   * Wraps a function to catch and log network errors as info instead of errors
   * @param {Function} fn - Function to wrap
   * @returns {Function} Wrapped function
   */
  static suppressNetworkErrors(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (this.isRetryableError(error)) {
          // Log as info instead of error to avoid alarming users
          console.info(`ℹ️ Network issue (suppressed): ${error.message}`);
          throw error;
        }
        // Re-throw non-network errors normally
        throw error;
      }
    };
  }
}

export default RpcRetryHelper;
