/**
 * Alert Configuration Model
 * Stores user's alert preferences and thresholds
 */

export class AlertConfiguration {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId;
    this.contractId = data.contractId || null; // null = applies to all contracts
    this.enabled = data.enabled !== false;
    this.categories = data.categories || {
      security: true,
      performance: true,
      liquidity: true,
      anomaly: true,
      growth: true
    };
    this.severityLevels = data.severityLevels || {
      critical: true,
      high: true,
      medium: true,
      low: false
    };
    this.thresholds = data.thresholds || {
      gasPrice: { enabled: false, value: 100, unit: 'gwei' },
      failureRate: { enabled: false, value: 5, unit: '%' },
      tvlChange: { enabled: false, value: 20, unit: '%' },
      volumeChange: { enabled: false, value: 30, unit: '%' },
      userDropoff: { enabled: false, value: 25, unit: '%' },
      whaleActivity: { enabled: false, value: 100000, unit: 'USD' }
    };
    this.notifications = data.notifications || {
      inApp: true,
      email: false,
      webhook: false,
      webhookUrl: null
    };
    this.schedule = data.schedule || {
      realTime: true,
      daily: false,
      weekly: false,
      dailyTime: '09:00',
      weeklyDay: 'monday'
    };
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      contractId: this.contractId,
      enabled: this.enabled,
      categories: this.categories,
      severityLevels: this.severityLevels,
      thresholds: this.thresholds,
      notifications: this.notifications,
      schedule: this.schedule,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
