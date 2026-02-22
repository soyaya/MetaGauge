/**
 * Export routes
 * API endpoints for exporting analysis data
 */

import express from 'express';
import ExportService from '../../services/ExportService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../middleware/errors.js';

const router = express.Router();

/**
 * Export analysis to CSV
 */
router.get('/:id/csv', asyncHandler(async (req, res) => {
  const csv = await ExportService.exportToCSV(req.params.id);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="analysis-${req.params.id}.csv"`);
  res.send(csv);
}));

/**
 * Export analysis to JSON
 */
router.get('/:id/json', asyncHandler(async (req, res) => {
  const json = await ExportService.exportToJSON(req.params.id);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="analysis-${req.params.id}.json"`);
  res.send(json);
}));

export default router;
