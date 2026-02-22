/**
 * Alert Configuration API Routes
 */

import express from 'express';
import { UserStorage } from '../database/index.js';
import AlertConfigurationStorage from '../database/AlertConfigurationStorage.js';
import AlertNotificationService from '../../services/AlertNotificationService.js';
import SubscriptionService from '../../services/SubscriptionService.js';

const router = express.Router();
const alertService = new AlertNotificationService();
const subscriptionService = new SubscriptionService();

/**
 * @swagger
 * /api/alerts/config:
 *   get:
 *     summary: Get user's alert configurations
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert configurations retrieved
 */
router.get('/config', async (req, res) => {
  try {
    const configs = await AlertConfigurationStorage.findByUserId(req.user.id);
    res.json({ configs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alert configurations', message: error.message });
  }
});

/**
 * @swagger
 * /api/alerts/config:
 *   post:
 *     summary: Create alert configuration
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractId:
 *                 type: string
 *               categories:
 *                 type: object
 *               thresholds:
 *                 type: object
 *     responses:
 *       201:
 *         description: Configuration created
 */
router.post('/config', async (req, res) => {
  try {
    // Get user's subscription tier
    const user = await UserStorage.findById(req.user.id);
    let tier = 'Free';
    
    if (user.walletAddress) {
      try {
        const isActive = await subscriptionService.isSubscriberActive(user.walletAddress);
        if (isActive) {
          const subInfo = await subscriptionService.getSubscriptionInfo(user.walletAddress);
          tier = subscriptionService.getTierName(subInfo.tier);
        }
      } catch (err) {
        console.warn('Could not fetch subscription:', err.message);
      }
    }
    
    // Check alert limit based on tier
    const existingAlerts = await AlertConfigurationStorage.findByUserId(req.user.id);
    const maxAlerts = alertService.getMaxAlerts(tier);
    
    if (existingAlerts.length >= maxAlerts) {
      return res.status(403).json({
        error: 'Alert limit reached',
        message: `You have reached your limit of ${maxAlerts} alerts. Upgrade your plan to add more.`,
        currentCount: existingAlerts.length,
        limit: maxAlerts,
        tier
      });
    }
    
    // Validate notification channels
    const allowedChannels = alertService.getAllowedChannels(tier);
    const requestedChannels = req.body.channels || ['inApp'];
    const invalidChannels = requestedChannels.filter(ch => !allowedChannels.includes(ch));
    
    if (invalidChannels.length > 0) {
      return res.status(403).json({
        error: 'Invalid notification channels',
        message: `Your ${tier} plan does not support: ${invalidChannels.join(', ')}`,
        allowedChannels,
        tier
      });
    }
    
    const config = await AlertConfigurationStorage.create({
      userId: req.user.id,
      channels: requestedChannels,
      tier,
      ...req.body
    });
    
    res.status(201).json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create configuration', message: error.message });
  }
});

/**
 * @swagger
 * /api/alerts/config/{id}:
 *   put:
 *     summary: Update alert configuration
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Configuration updated
 */
router.put('/config/:id', async (req, res) => {
  try {
    const config = await AlertConfigurationStorage.findById(req.params.id);
    
    if (!config || config.userId !== req.user.id) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    const updated = await AlertConfigurationStorage.update(req.params.id, req.body);
    res.json({ config: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update configuration', message: error.message });
  }
});

/**
 * @swagger
 * /api/alerts/config/{id}:
 *   delete:
 *     summary: Delete alert configuration
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration deleted
 */
router.delete('/config/:id', async (req, res) => {
  try {
    const config = await AlertConfigurationStorage.findById(req.params.id);
    
    if (!config || config.userId !== req.user.id) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    await AlertConfigurationStorage.delete(req.params.id);
    res.json({ message: 'Configuration deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete configuration', message: error.message });
  }
});

/**
 * Get alert limits for current user
 */
router.get('/limits', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    let tier = 'Free';
    
    if (user.walletAddress) {
      try {
        const isActive = await subscriptionService.isSubscriberActive(user.walletAddress);
        if (isActive) {
          const subInfo = await subscriptionService.getSubscriptionInfo(user.walletAddress);
          tier = subscriptionService.getTierName(subInfo.tier);
        }
      } catch (err) {
        console.warn('Could not fetch subscription:', err.message);
      }
    }
    
    const existingAlerts = await AlertConfigurationStorage.findByUserId(req.user.id);
    const maxAlerts = alertService.getMaxAlerts(tier);
    const allowedChannels = alertService.getAllowedChannels(tier);
    
    res.json({
      tier,
      current: existingAlerts.length,
      max: maxAlerts,
      remaining: Math.max(0, maxAlerts - existingAlerts.length),
      allowedChannels,
      canCreateMore: existingAlerts.length < maxAlerts
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get limits', message: error.message });
  }
});

/**
 * Send test notification
 */
router.post('/test', async (req, res) => {
  try {
    const { channels = ['inApp'], webhookUrl } = req.body;
    const user = await UserStorage.findById(req.user.id);
    
    const testAlert = {
      title: 'Test Alert',
      message: 'This is a test notification from MetaGauge',
      severity: 'info',
      userEmail: user.email,
      webhookUrl,
      data: { test: true }
    };
    
    const results = await alertService.sendAlert(testAlert, channels);
    
    res.json({
      message: 'Test notification sent',
      results,
      channels
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test', message: error.message });
  }
});

export default router;
