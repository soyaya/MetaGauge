/**
 * Metrics API Routes
 * Provides access to metrics glossary and definitions
 */

import express from 'express';
import MetricsContextService from '../../services/MetricsContextService.js';
import { UserStorage, AnalysisStorage } from '../database/index.js';
import { buildFullReportFromAnalysis } from './onboarding.js';
import { MetricsNormalizer } from '../../services/MetricsNormalizer.js';

const router = express.Router();

/**
 * GET /api/metrics/dashboard
 * Returns the fullReport shape for the authenticated user's latest completed analysis.
 * Used by MetricsTab, UsersTab, UxTab, TransactionsTab as their primary data source.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    const defaultContract = user?.onboarding?.defaultContract;
    if (!defaultContract?.address) {
      return res.status(404).json({ error: 'No default contract found' });
    }

    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest = allAnalyses
      .filter(a => a.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];

    if (!latest) {
      return res.json(buildFullReportFromAnalysis([], {}, {}));
    }

    const rawTarget  = latest.results?.target || {};
    const rawMetrics = rawTarget.metrics || {};
    const rawTxs     = rawTarget.transactions || [];

    const normalizedMetrics  = rawMetrics && !rawMetrics.error
      ? MetricsNormalizer.normalizeDeFiMetrics(rawMetrics)
      : MetricsNormalizer.getDefaultDeFiMetrics();
    const normalizedBehavior = rawTarget.behavior
      ? MetricsNormalizer.normalizeUserBehavior(rawTarget.behavior)
      : MetricsNormalizer.getDefaultUserBehavior();

    const fullReport = buildFullReportFromAnalysis(rawTxs, rawMetrics, {
      ...rawTarget,
      defiMetrics:  normalizedMetrics,
      userBehavior: normalizedBehavior,
    });

    res.json(fullReport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/metrics/analysis/:analysisId
 * Returns fullReport for a specific analysis.
 */
router.get('/analysis/:analysisId', async (req, res) => {
  try {
    const analysis = await AnalysisStorage.findById(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const rawTarget  = analysis.results?.target || {};
    const rawMetrics = rawTarget.metrics || {};
    const rawTxs     = rawTarget.transactions || [];

    const normalizedMetrics  = rawMetrics && !rawMetrics.error
      ? MetricsNormalizer.normalizeDeFiMetrics(rawMetrics)
      : MetricsNormalizer.getDefaultDeFiMetrics();
    const normalizedBehavior = rawTarget.behavior
      ? MetricsNormalizer.normalizeUserBehavior(rawTarget.behavior)
      : MetricsNormalizer.getDefaultUserBehavior();

    res.json(buildFullReportFromAnalysis(rawTxs, rawMetrics, {
      ...rawTarget,
      defiMetrics:  normalizedMetrics,
      userBehavior: normalizedBehavior,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/metrics/recalculate
 * Stub — recalculation happens on next analysis run.
 */
router.post('/recalculate', async (req, res) => {
  res.json({ success: true, message: 'Metrics will be recalculated on next analysis run.' });
});

/**
 * GET /api/metrics/glossary
 * Get all metric definitions
 */
router.get('/glossary', (req, res) => {
  try {
    const glossary = MetricsContextService.getAllDefinitions();
    res.json({ 
      success: true, 
      count: Object.keys(glossary).length,
      glossary 
    });
  } catch (error) {
    console.error('Error fetching glossary:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/metrics/glossary/:metric
 * Get specific metric definition
 */
router.get('/glossary/:metric', (req, res) => {
  try {
    const { metric } = req.params;
    const definition = MetricsContextService.getMetricDefinition(metric);
    
    if (!definition) {
      return res.status(404).json({ 
        success: false, 
        error: 'Metric not found in glossary' 
      });
    }
    
    res.json({ success: true, definition });
  } catch (error) {
    console.error('Error fetching metric definition:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/metrics/search?q=query
 * Search metrics by name or description
 */
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query required' 
      });
    }
    
    const results = MetricsContextService.searchMetrics(q);
    res.json({ 
      success: true, 
      count: results.length,
      results 
    });
  } catch (error) {
    console.error('Error searching metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
