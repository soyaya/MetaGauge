/**
 * Alert Configuration API Routes
 */

import express from 'express';
import { UserStorage, AlertConfigStorage, AlertsStorage, AgentConfigStorage } from '../database/index.js';
import AlertNotificationService from '../../services/AlertNotificationService.js';

const router = express.Router();
const alertService = new AlertNotificationService();

const DEFAULT_AGENT_CONFIG = {
  enabled: false,
  permissions: { createTasks:false, autoAnalyze:false, sendDigests:false, postSocial:false, checkCompetitors:false, regressionAlerts:false },
};

router.get('/config', async (req, res) => {
  try {
    const configs = await AlertConfigStorage.findByUserId(req.user.id);
    res.json({ configs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alert configurations', message: error.message });
  }
});

router.post('/config', async (req, res) => {
  try {
    const config = await AlertConfigStorage.create({ userId: req.user.id, ...req.body });
    res.status(201).json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create configuration', message: error.message });
  }
});

router.put('/config/:id', async (req, res) => {
  try {
    const config = await AlertConfigStorage.findById(req.params.id);
    if (!config || config.userId !== req.user.id) return res.status(404).json({ error: 'Configuration not found' });
    const updated = await AlertConfigStorage.update(req.params.id, req.body);
    res.json({ config: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update configuration', message: error.message });
  }
});

router.delete('/config/:id', async (req, res) => {
  try {
    const config = await AlertConfigStorage.findById(req.params.id);
    if (!config || config.userId !== req.user.id) return res.status(404).json({ error: 'Configuration not found' });
    await AlertConfigStorage.delete(req.params.id);
    res.json({ message: 'Configuration deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete configuration', message: error.message });
  }
});

router.get('/limits', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    const tier = user?.tier ? (user.tier.charAt(0).toUpperCase() + user.tier.slice(1)) : 'Free';
    const existingAlerts = await AlertConfigStorage.findByUserId(req.user.id);
    const maxAlerts = alertService.getMaxAlerts(tier);
    const allowedChannels = alertService.getAllowedChannels(tier);
    res.json({ tier, current: existingAlerts.length, max: maxAlerts, remaining: Math.max(0, maxAlerts - existingAlerts.length), allowedChannels, canCreateMore: existingAlerts.length < maxAlerts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get limits', message: error.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { channels = ['inApp'], webhookUrl } = req.body;
    const user = await UserStorage.findById(req.user.id);
    const results = await alertService.sendAlert({ title:'Test Alert', message:'This is a test notification from MetaGauge', severity:'info', contractAddress:null }, channels, user?.email, webhookUrl);
    res.json({ message: 'Test notification sent', results, channels });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test', message: error.message });
  }
});

router.get('/', async (req, res) => {
  const alerts = await AlertsStorage.findByUserId(req.user.id);
  res.json({ alerts });
});

router.patch('/:id/acknowledge', async (req, res) => {
  await AlertsStorage.acknowledge(req.params.id, req.user.id);
  const alerts = await AlertsStorage.findByUserId(req.user.id);
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json({ alert });
});

router.get('/agent-config', async (req, res) => {
  const config = await AgentConfigStorage.get(req.user.id) || { ...DEFAULT_AGENT_CONFIG, userId: req.user.id };
  res.json({ config });
});

router.put('/agent-config', async (req, res) => {
  const updated = await AgentConfigStorage.save(req.user.id, { ...DEFAULT_AGENT_CONFIG, ...req.body, userId: req.user.id });
  res.json({ config: updated });
});

export default router;
