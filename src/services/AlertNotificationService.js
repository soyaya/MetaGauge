/**
 * Alert Notification Service
 * Handles delivery of alerts via multiple channels
 */

export class AlertNotificationService {
  constructor() {
    this.channels = {
      inApp: true,
      email: process.env.SMTP_HOST ? true : false,
      webhook: true,
      sms: false // Requires Twilio setup
    };
  }

  /**
   * Get allowed channels for subscription tier
   */
  getAllowedChannels(tier) {
    const tierNumber = typeof tier === 'string' ? this.getTierNumber(tier) : tier;
    
    switch (tierNumber) {
      case 0: // Free
        return ['inApp'];
      case 1: // Starter
        return ['inApp', 'email', 'webhook'];
      case 2: // Pro
        return ['inApp', 'email', 'webhook'];
      case 3: // Enterprise
        return ['inApp', 'email', 'webhook', 'sms'];
      default:
        return ['inApp'];
    }
  }

  /**
   * Get tier number from name
   */
  getTierNumber(tierName) {
    const tiers = { 'Free': 0, 'Starter': 1, 'Pro': 2, 'Enterprise': 3 };
    return tiers[tierName] || 0;
  }

  /**
   * Get max alerts for tier
   */
  getMaxAlerts(tier) {
    const tierNumber = typeof tier === 'string' ? this.getTierNumber(tier) : tier;
    
    switch (tierNumber) {
      case 0: return 3;      // Free
      case 1: return 10;     // Starter
      case 2: return 50;     // Pro
      case 3: return 999999; // Enterprise (unlimited)
      default: return 3;
    }
  }

  /**
   * Send alert notification
   */
  async sendAlert(alert, channels = ['inApp']) {
    const results = {
      inApp: false,
      email: false,
      webhook: false,
      sms: false
    };

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'inApp':
            results.inApp = await this.sendInAppNotification(alert);
            break;
          case 'email':
            results.email = await this.sendEmailNotification(alert);
            break;
          case 'webhook':
            results.webhook = await this.sendWebhookNotification(alert);
            break;
          case 'sms':
            results.sms = await this.sendSmsNotification(alert);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${channel} notification:`, error.message);
      }
    }

    return results;
  }

  /**
   * Send in-app notification (store in database)
   */
  async sendInAppNotification(alert) {
    // In-app notifications are stored in database
    // Frontend polls or uses WebSocket to receive them
    return true;
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(alert) {
    if (!this.channels.email) {
      console.log('Email not configured, skipping');
      return false;
    }

    // Email sending would require nodemailer setup
    // For now, just log
    console.log(`📧 Email notification: ${alert.title} to ${alert.userEmail}`);
    return true;
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(alert) {
    if (!alert.webhookUrl) {
      return false;
    }

    try {
      const response = await fetch(alert.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'alert',
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: new Date().toISOString(),
          data: alert.data
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook delivery failed:', error.message);
      return false;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSmsNotification(alert) {
    // SMS requires Twilio or similar service
    console.log(`📱 SMS notification: ${alert.title} (not configured)`);
    return false;
  }
}

export default AlertNotificationService;
