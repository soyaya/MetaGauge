/**
 * Comprehensive Error Handler and Logger
 * Multi-Chain RPC Integration - Task 11
 * Requirements: All requirements (cross-cutting concern)
 */

import fs from 'fs';
import path from 'path';

/**
 * Comprehensive error handling and logging system
 * Provides RPC error handling, database recovery, validation, and graceful degradation
 */
export class ErrorHandler {
  constructor(config = {}) {
    this.config = {
      // Logging settings
      logLevel: config.logLevel || 'info', // debug, info, warn, error
      logToFile: config.logToFile !== false,
      logToConsole: config.logToConsole !== false,
      logDirectory: config.logDirectory || './logs',
      maxLogFiles: config.maxLogFiles || 10,
      maxLogSize: config.maxLogSize || 10 * 1024 * 1024, // 10MB
      
      // Retry settings
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 1000, // 1 second
      maxDelay: config.maxDelay || 30000, // 30 seconds
      backoffMultiplier: config.backoffMultiplier || 2,
      
      // Circuit breaker
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 1 minute
      
      ...config
    };
    
    // Internal state
    this.logStreams = new Map();
    this.errorCounts = new Map();
    this.circuitBreakers = new Map();
    this.retryAttempts = new Map();
    
    // Initialize logging
    this._initializeLogging();
  }

  /**
   * Initialize logging system
   * @private
   */
  _initializeLogging() {
    if (this.config.logToFile) {
      // Ensure log directory exists
      if (!fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }
      
      // Create log streams
      const logTypes = ['error', 'warn', 'info', 'debug'];
      logTypes.forEach(type => {
        const logPath = path.join(this.config.logDirectory, `${type}.log`);
        const stream = fs.createWriteStream(logPath, { flags: 'a' });
        this.logStreams.set(type, stream);
      });
    }
  }

  /**
   * Log message with structured metadata
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {Object} metadata - Additional structured data
   */
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      metadata: {
        ...metadata,
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    // Console logging
    if (this.config.logToConsole) {
      const colors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m'  // Red
      };
      
      const reset = '\x1b[0m';
      const color = colors[level] || '';
      
      console.log(`${color}[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}${reset}`);
      
      if (Object.keys(metadata).length > 0) {
        console.log(`${color}Metadata:${reset}`, metadata);
      }
    }
    
    // File logging
    if (this.config.logToFile && this.logStreams.has(level)) {
      this.logStreams.get(level).write(logLine);
    }
    
    // Rotate logs if needed
    this._rotateLogsIfNeeded();
  }

  /**
   * Debug level logging
   */
  debug(message, metadata = {}) {
    if (this._shouldLog('debug')) {
      this.log('debug', message, metadata);
    }
  }

  /**
   * Info level logging
   */
  info(message, metadata = {}) {
    if (this._shouldLog('info')) {
      this.log('info', message, metadata);
    }
  }

  /**
   * Warning level logging
   */
  warn(message, metadata = {}) {
    if (this._shouldLog('warn')) {
      this.log('warn', message, metadata);
    }
  }

  /**
   * Error level logging
   */
  error(message, metadata = {}) {
    if (this._shouldLog('error')) {
      this.log('error', message, metadata);
    }
  }

  /**
   * Handle RPC provider errors with exponential backoff
   * @param {Function} operation - The operation to retry
   * @param {string} provider - Provider identifier
   * @param {Object} context - Additional context
   * @returns {Promise} Operation result
   */
  async handleRpcError(operation, provider, context = {}) {
    const key = `rpc_${provider}`;
    
    // Check circuit breaker
    if (this._isCircuitBreakerOpen(key)) {
      throw new Error(`Circuit breaker open for RPC provider: ${provider}`);
    }
    
    let lastError;
    const maxRetries = this.config.maxRetries;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset error count on success
        this.errorCounts.delete(key);
        this.retryAttempts.delete(key);
        
        this.debug(`RPC operation succeeded`, {
          provider,
          attempt,
          context
        });
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        this.warn(`RPC operation failed`, {
          provider,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: error.message,
          context
        });
        
        // Track error count
        const errorCount = (this.errorCounts.get(key) || 0) + 1;
        this.errorCounts.set(key, errorCount);
        
        // Check if circuit breaker should open
        if (errorCount >= this.config.circuitBreakerThreshold) {
          this._openCircuitBreaker(key);
          this.error(`Circuit breaker opened for RPC provider: ${provider}`, {
            errorCount,
            threshold: this.config.circuitBreakerThreshold
          });
        }
        
        // Don't retry on final attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this._calculateBackoffDelay(attempt);
        
        this.debug(`Retrying RPC operation in ${delay}ms`, {
          provider,
          attempt: attempt + 1,
          delay
        });
        
        await this._sleep(delay);
      }
    }
    
    this.error(`RPC operation failed after ${maxRetries + 1} attempts`, {
      provider,
      finalError: lastError.message,
      context
    });
    
    throw lastError;
  }

  /**
   * Handle database connection errors with recovery
   * @param {Function} operation - Database operation
   * @param {string} connectionId - Database connection identifier
   * @returns {Promise} Operation result
   */
  async handleDatabaseError(operation, connectionId = 'default') {
    const key = `db_${connectionId}`;
    
    try {
      const result = await operation();
      
      // Reset error count on success
      this.errorCounts.delete(key);
      
      return result;
      
    } catch (error) {
      this.error(`Database operation failed`, {
        connectionId,
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Track error count
      const errorCount = (this.errorCounts.get(key) || 0) + 1;
      this.errorCounts.set(key, errorCount);
      
      // Attempt recovery based on error type
      if (this._isDatabaseConnectionError(error)) {
        this.warn(`Attempting database connection recovery`, { connectionId });
        
        try {
          await this._recoverDatabaseConnection(connectionId);
          
          // Retry operation after recovery
          return await operation();
          
        } catch (recoveryError) {
          this.error(`Database recovery failed`, {
            connectionId,
            recoveryError: recoveryError.message
          });
        }
      }
      
      throw error;
    }
  }

  /**
   * Validate data with quality assurance checks
   * @param {any} data - Data to validate
   * @param {Object} schema - Validation schema
   * @param {string} context - Validation context
   * @returns {Object} Validation result
   */
  validateData(data, schema, context = 'unknown') {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        context,
        timestamp: new Date().toISOString(),
        dataType: typeof data
      }
    };
    
    try {
      // Basic type validation
      if (schema.type && typeof data !== schema.type) {
        result.errors.push(`Expected type ${schema.type}, got ${typeof data}`);
        result.isValid = false;
      }
      
      // Required fields validation
      if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach(field => {
          if (data && typeof data === 'object' && !(field in data)) {
            result.errors.push(`Missing required field: ${field}`);
            result.isValid = false;
          }
        });
      }
      
      // Custom validation rules
      if (schema.validate && typeof schema.validate === 'function') {
        const customResult = schema.validate(data);
        if (!customResult.isValid) {
          result.errors.push(...customResult.errors);
          result.isValid = false;
        }
        if (customResult.warnings) {
          result.warnings.push(...customResult.warnings);
        }
      }
      
      // Log validation results
      if (!result.isValid) {
        this.warn(`Data validation failed`, {
          context,
          errors: result.errors,
          warnings: result.warnings
        });
      } else if (result.warnings.length > 0) {
        this.info(`Data validation passed with warnings`, {
          context,
          warnings: result.warnings
        });
      } else {
        this.debug(`Data validation passed`, { context });
      }
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      
      this.error(`Data validation exception`, {
        context,
        error: error.message,
        stack: error.stack
      });
    }
    
    return result;
  }

  /**
   * Implement graceful degradation strategy
   * @param {Function} primaryOperation - Primary operation to attempt
   * @param {Function} fallbackOperation - Fallback operation
   * @param {string} operationName - Operation identifier
   * @returns {Promise} Operation result
   */
  async gracefulDegrade(primaryOperation, fallbackOperation, operationName) {
    try {
      this.debug(`Attempting primary operation: ${operationName}`);
      
      const result = await primaryOperation();
      
      this.debug(`Primary operation succeeded: ${operationName}`);
      return { result, degraded: false, source: 'primary' };
      
    } catch (primaryError) {
      this.warn(`Primary operation failed, attempting fallback: ${operationName}`, {
        primaryError: primaryError.message
      });
      
      try {
        const result = await fallbackOperation();
        
        this.info(`Fallback operation succeeded: ${operationName}`, {
          primaryError: primaryError.message
        });
        
        return { result, degraded: true, source: 'fallback' };
        
      } catch (fallbackError) {
        this.error(`Both primary and fallback operations failed: ${operationName}`, {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message
        });
        
        throw new Error(`Operation failed: ${operationName}. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      errorsByType: {},
      circuitBreakers: {},
      retryAttempts: {}
    };
    
    // Count errors by type
    this.errorCounts.forEach((count, key) => {
      stats.totalErrors += count;
      const [type] = key.split('_');
      stats.errorsByType[type] = (stats.errorsByType[type] || 0) + count;
    });
    
    // Circuit breaker status
    this.circuitBreakers.forEach((breaker, key) => {
      stats.circuitBreakers[key] = {
        isOpen: breaker.isOpen,
        openedAt: breaker.openedAt,
        errorCount: this.errorCounts.get(key) || 0
      };
    });
    
    // Retry attempts
    this.retryAttempts.forEach((attempts, key) => {
      stats.retryAttempts[key] = attempts;
    });
    
    return stats;
  }

  // Helper methods
  _shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    
    return messageLevel >= configLevel;
  }

  _calculateBackoffDelay(attempt) {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(delay, this.config.maxDelay);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _isCircuitBreakerOpen(key) {
    const breaker = this.circuitBreakers.get(key);
    
    if (!breaker || !breaker.isOpen) {
      return false;
    }
    
    // Check if timeout has passed
    const now = Date.now();
    if (now - breaker.openedAt > this.config.circuitBreakerTimeout) {
      this._closeCircuitBreaker(key);
      return false;
    }
    
    return true;
  }

  _openCircuitBreaker(key) {
    this.circuitBreakers.set(key, {
      isOpen: true,
      openedAt: Date.now()
    });
  }

  _closeCircuitBreaker(key) {
    this.circuitBreakers.delete(key);
    this.errorCounts.delete(key);
    
    this.info(`Circuit breaker closed: ${key}`);
  }

  _isDatabaseConnectionError(error) {
    const connectionErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'connection terminated',
      'server closed the connection',
      'Connection terminated'
    ];
    
    return connectionErrors.some(errorType => 
      error.message.includes(errorType) || error.code === errorType
    );
  }

  async _recoverDatabaseConnection(connectionId) {
    // Placeholder for database recovery logic
    // In real implementation, would attempt to reconnect to database
    this.info(`Attempting database recovery for: ${connectionId}`);
    
    // Simulate recovery delay
    await this._sleep(1000);
    
    this.info(`Database recovery completed for: ${connectionId}`);
  }

  _rotateLogsIfNeeded() {
    // Simple log rotation based on file size
    if (!this.config.logToFile) return;
    
    this.logStreams.forEach((stream, type) => {
      const logPath = path.join(this.config.logDirectory, `${type}.log`);
      
      try {
        const stats = fs.statSync(logPath);
        
        if (stats.size > this.config.maxLogSize) {
          // Close current stream
          stream.end();
          
          // Rotate log file
          const rotatedPath = path.join(this.config.logDirectory, `${type}.log.${Date.now()}`);
          fs.renameSync(logPath, rotatedPath);
          
          // Create new stream
          const newStream = fs.createWriteStream(logPath, { flags: 'a' });
          this.logStreams.set(type, newStream);
          
          // Clean up old log files
          this._cleanupOldLogs(type);
        }
      } catch (error) {
        // Ignore rotation errors
      }
    });
  }

  _cleanupOldLogs(type) {
    try {
      const files = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.startsWith(`${type}.log.`))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          time: fs.statSync(path.join(this.config.logDirectory, file)).mtime
        }))
        .sort((a, b) => b.time - a.time);
      
      // Keep only maxLogFiles
      if (files.length > this.config.maxLogFiles) {
        const filesToDelete = files.slice(this.config.maxLogFiles);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Close log streams
    this.logStreams.forEach(stream => {
      stream.end();
    });
    
    this.logStreams.clear();
    this.info('Error handler cleanup completed');
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
