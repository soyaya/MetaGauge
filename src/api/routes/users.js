/**
 * User management routes
 * Handles user profile, preferences, and account management with file storage
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserStorage, ContractStorage, AnalysisStorage } from '../database/index.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get('/profile', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Get real analysis count — exclude auto-onboarding indexing
    const analyses = await AnalysisStorage.findByUserId(req.user.id).catch(() => []);
    const totalAnalyses = Array.isArray(analyses) ? analyses.filter(a => a.analysisType !== 'quick-index').length : 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyAnalysisCount = analyses.filter(a => new Date(a.createdAt) >= monthStart && a.analysisType !== 'quick-index').length;

    const { password, resetToken, resetTokenExpiry, ...userProfile } = user;

    res.json({
      ...userProfile,
      is_verified: user.emailVerified || user.is_verified || false,
      usage: {
        ...user.usage,
        analysisCount: totalAnalyses,
        monthlyAnalysisCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', async (req, res) => {
  try {
    const { name, preferences } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (preferences) {
      const user = await UserStorage.findById(req.user.id);
      updates.preferences = { ...user.preferences, ...preferences };
    }
    // email change is intentionally excluded — locked once verified

    const updatedUser = await UserStorage.update(req.user.id, updates);
    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Remove sensitive data
    const { password, ...userProfile } = updatedUser;

    res.json({
      message: 'Profile updated successfully',
      user: userProfile
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/dashboard:
 *   get:
 *     summary: Get user dashboard data
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user with usage stats
    const user = await UserStorage.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Get contract configurations count
    const allConfigs = await ContractStorage.findByUserId(userId);
    const configsCount = allConfigs.filter(config => config.isActive).length;

    // Get recent analyses
    const allAnalyses = await AnalysisStorage.findByUserId(userId);
    const recentAnalyses = allAnalyses
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(analysis => {
        // Remove detailed results for dashboard
        const { results, logs, ...analysisInfo } = analysis;
        return analysisInfo;
      });

    // Get analysis stats
    const analysisStats = await AnalysisStorage.getStats(userId);

    // Get monthly usage — exclude auto-onboarding indexing
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyAnalyses = allAnalyses.filter(analysis => 
      new Date(analysis.createdAt) >= monthStart && analysis.analysisType !== 'quick-index'
    ).length;

    // Remove sensitive data from user
    const { password, ...userProfile } = user;

    res.json({
      user: userProfile,
      subscription: user.subscription || {
        tier: 0,
        tierName: 'Free',
        isActive: false,
        features: {},
        limits: {}
      },
      stats: {
        contractConfigs: configsCount,
        totalAnalyses: analysisStats.total || 0,
        completedAnalyses: analysisStats.completed || 0,
        monthlyAnalyses,
        avgExecutionTime: analysisStats.avgExecutionTime || 0
      },
      recentAnalyses,
      usage: user.usage || { analysisCount: 0, monthlyAnalysisCount: 0 },
      limits: {
        free: 10,
        pro: 100,
        enterprise: -1
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/api-key:
 *   post:
 *     summary: Generate new API key
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API key generated successfully
 */
router.post('/api-key', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Generate new API key
    const newApiKey = 'ak_' + crypto.randomUUID().replace(/-/g, '');
    
    const updatedUser = await UserStorage.update(req.user.id, {
      apiKey: newApiKey
    });

    res.json({
      message: 'API key generated successfully',
      apiKey: newApiKey
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate API key',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/usage:
 *   get:
 *     summary: Get detailed usage statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await UserStorage.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Get all analyses for monthly breakdown
    const allAnalyses = await AnalysisStorage.findByUserId(userId);

    // Get monthly breakdown
    const now = new Date();
    const monthlyBreakdown = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const count = allAnalyses.filter(analysis => {
        const createdAt = new Date(analysis.createdAt);
        return createdAt >= monthStart && createdAt <= monthEnd;
      }).length;

      monthlyBreakdown.push({
        month: monthStart.toISOString().substring(0, 7),
        count
      });
    }

    // Get analysis type breakdown
    const typeBreakdown = allAnalyses.reduce((acc, analysis) => {
      const type = analysis.analysisType || 'single';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Get chain usage from configs
    const allConfigs = await ContractStorage.findByUserId(userId);
    const chainUsage = allConfigs
      .filter(config => config.isActive)
      .reduce((acc, config) => {
        const chain = config.targetContract?.chain || 'unknown';
        acc[chain] = (acc[chain] || 0) + 1;
        return acc;
      }, {});

    res.json({
      current: user.usage || { analysisCount: 0, monthlyAnalysisCount: 0 },
      limits: {
        free: 10,
        pro: 100,
        enterprise: -1
      },
      monthlyBreakdown,
      typeBreakdown: Object.entries(typeBreakdown).map(([type, count]) => ({ _id: type, count })),
      chainUsage: Object.entries(chainUsage).map(([chain, count]) => ({ _id: chain, count }))
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/delete-account:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 */
router.delete('/delete-account', requireRole('admin'), async (req, res) => {
  try {
    const userId = req.user.id;

    // Soft delete - deactivate account
    await UserStorage.update(userId, {
      isActive: false,
      email: `deleted_${Date.now()}_${req.user.email}` // Prevent email conflicts
    });

    // Deactivate all configurations
    const allConfigs = await ContractStorage.findByUserId(userId);
    for (const config of allConfigs) {
      await ContractStorage.update(config.id, { isActive: false });
    }

    res.json({
      message: 'Account deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete account',
      message: error.message
    });
  }
});

// Change password (authenticated — requires current password)
router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords are required' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 6);
    await UserStorage.update(req.user.id, { password: hashed });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;