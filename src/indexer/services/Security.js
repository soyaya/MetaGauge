/**
 * Security features for streaming indexer
 */

import crypto from 'crypto';

/**
 * Validate RPC endpoint uses HTTPS
 */
export function validateSecureEndpoint(endpoint) {
  const url = new URL(endpoint);
  
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(`Insecure RPC endpoint: ${endpoint}. HTTPS required in production.`);
  }
  
  if (url.protocol !== 'https:') {
    console.warn(`⚠️  Insecure RPC endpoint: ${endpoint}`);
  }
  
  return true;
}

/**
 * Encrypt sensitive data
 */
export function encrypt(text, key) {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText, key) {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Anomaly detection for contract responses
 */
export class AnomalyDetector {
  constructor() {
    this.baseline = new Map(); // contractAddress -> { avgLogs, avgGas, etc }
  }

  /**
   * Record normal behavior
   */
  recordBaseline(contractAddress, data) {
    if (!this.baseline.has(contractAddress)) {
      this.baseline.set(contractAddress, {
        logCounts: [],
        blockRanges: []
      });
    }
    
    const baseline = this.baseline.get(contractAddress);
    baseline.logCounts.push(data.logs?.length || 0);
    baseline.blockRanges.push(data.blockRange);
    
    // Keep only last 100 samples
    if (baseline.logCounts.length > 100) {
      baseline.logCounts.shift();
      baseline.blockRanges.shift();
    }
  }

  /**
   * Detect anomalies
   */
  detectAnomaly(contractAddress, data) {
    const baseline = this.baseline.get(contractAddress);
    if (!baseline || baseline.logCounts.length < 10) {
      return { anomaly: false, reason: 'Insufficient baseline data' };
    }

    const avgLogs = baseline.logCounts.reduce((a, b) => a + b, 0) / baseline.logCounts.length;
    const stdDev = Math.sqrt(
      baseline.logCounts.reduce((sq, n) => sq + Math.pow(n - avgLogs, 2), 0) / baseline.logCounts.length
    );

    const currentLogs = data.logs?.length || 0;
    const deviation = Math.abs(currentLogs - avgLogs) / (stdDev || 1);

    if (deviation > 3) {
      return {
        anomaly: true,
        reason: `Log count deviation: ${deviation.toFixed(2)} standard deviations`,
        expected: avgLogs.toFixed(0),
        actual: currentLogs
      };
    }

    return { anomaly: false };
  }
}

/**
 * Rate limiter for subscription tiers
 */
export class SubscriptionLimiter {
  constructor() {
    this.limits = {
      free: { analyses: 10, contracts: 1 },
      pro: { analyses: 100, contracts: 5 },
      enterprise: { analyses: -1, contracts: -1 }
    };
    this.usage = new Map(); // userId -> { analyses, contracts }
  }

  /**
   * Check if user can perform action
   */
  canPerform(userId, tier, action) {
    const limit = this.limits[tier.toLowerCase()];
    if (!limit) return false;

    const usage = this.getUsage(userId);
    
    if (action === 'analysis' && limit.analyses !== -1) {
      return usage.analyses < limit.analyses;
    }
    
    if (action === 'contract' && limit.contracts !== -1) {
      return usage.contracts < limit.contracts;
    }

    return true;
  }

  /**
   * Record usage
   */
  recordUsage(userId, action) {
    const usage = this.getUsage(userId);
    if (action === 'analysis') usage.analyses++;
    if (action === 'contract') usage.contracts++;
  }

  /**
   * Get usage
   */
  getUsage(userId) {
    if (!this.usage.has(userId)) {
      this.usage.set(userId, { analyses: 0, contracts: 0 });
    }
    return this.usage.get(userId);
  }

  /**
   * Reset usage (monthly)
   */
  resetUsage(userId) {
    this.usage.delete(userId);
  }
}
