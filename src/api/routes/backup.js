/**
 * Backup management routes
 * Admin endpoints for backup operations
 */

import express from 'express';
import BackupService from '../../services/BackupService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AuthorizationError } from '../middleware/errors.js';

const router = express.Router();

// Middleware to check admin access (tier 3 = Enterprise)
const requireAdmin = (req, res, next) => {
  if (req.user.tier < 3) {
    throw new AuthorizationError('Admin access required');
  }
  next();
};

/**
 * Create manual backup
 */
router.post('/create', requireAdmin, asyncHandler(async (req, res) => {
  const result = await BackupService.createBackup('manual');
  
  if (result.success) {
    res.json({
      message: 'Backup created successfully',
      backup: result.metadata
    });
  } else {
    res.status(500).json({
      error: 'Backup failed',
      message: result.error
    });
  }
}));

/**
 * List all backups
 */
router.get('/list', requireAdmin, asyncHandler(async (req, res) => {
  const backups = await BackupService.listBackups();
  
  const summary = {
    total: Object.values(backups).reduce((sum, arr) => sum + arr.length, 0),
    byType: Object.entries(backups).reduce((acc, [type, arr]) => {
      acc[type] = arr.length;
      return acc;
    }, {}),
    backups
  };
  
  res.json(summary);
}));

/**
 * Restore from backup
 */
router.post('/restore', requireAdmin, asyncHandler(async (req, res) => {
  const { backupPath } = req.body;
  
  if (!backupPath) {
    return res.status(400).json({
      error: 'Backup path required'
    });
  }
  
  const result = await BackupService.restore(backupPath);
  
  if (result.success) {
    res.json({
      message: 'Restore completed successfully'
    });
  } else {
    res.status(500).json({
      error: 'Restore failed',
      message: result.error
    });
  }
}));

/**
 * Cleanup old backups
 */
router.post('/cleanup', requireAdmin, asyncHandler(async (req, res) => {
  await BackupService.cleanupOldBackups();
  
  res.json({
    message: 'Cleanup completed successfully'
  });
}));

export default router;
