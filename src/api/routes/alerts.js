/**
 * Alert Configuration API Routes
 */

import express from 'express';
import { UserStorage } from '../database/index.js';
import AlertConfigurationStorage from '../database/AlertConfigurationStorage.js';

const router = express.Router();

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
    // Check alert limit
    const user = await UserStorage.findById(req.user.id);
    const existingAlerts = await AlertConfigurationStorage.findByUserId(req.user.id);
    const maxAlerts = user.subscription?.features?.maxAlerts || 3;
    
    if (existingAlerts.length >= maxAlerts) {
      return res.status(403).json({
        error: 'Alert limit reached',
        message: `You have reached your limit of ${maxAlerts} alerts. Upgrade your plan to add more.`,
        currentCount: existingAlerts.length,
        limit: maxAlerts
      });
    }
    
    const config = await AlertConfigurationStorage.create({
      userId: req.user.id,
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

export default router;
