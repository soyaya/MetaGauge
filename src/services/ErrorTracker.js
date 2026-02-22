/**
 * Error Tracker
 * Centralized error tracking and reporting
 */

class ErrorTracker {
  constructor() {
    this.errors = [];
    this.maxErrors = 1000;
  }

  track(error, context = {}) {
    const errorEntry = {
      id: Date.now() + Math.random(),
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      severity: this.getSeverity(error)
    };

    this.errors.unshift(errorEntry);
    
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log critical errors
    if (errorEntry.severity === 'critical') {
      console.error('CRITICAL ERROR:', errorEntry);
    }

    return errorEntry.id;
  }

  getSeverity(error) {
    if (error.statusCode >= 500) return 'critical';
    if (error.statusCode >= 400) return 'warning';
    return 'info';
  }

  getErrors(limit = 100) {
    return this.errors.slice(0, limit);
  }

  getErrorById(id) {
    return this.errors.find(e => e.id === id);
  }

  clear() {
    this.errors = [];
  }
}

export default new ErrorTracker();
