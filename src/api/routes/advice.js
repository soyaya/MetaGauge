/**
 * AI Advice API Routes
 */
import express from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { AIGrowthAdvisor } from '../../services/AIGrowthAdvisor.js';
import { BriefingScheduler } from '../../services/BriefingScheduler.js';
import { ScenarioModeler } from '../../services/ScenarioModeler.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const router = express.Router();
const advisor = new AIGrowthAdvisor();
const briefingScheduler = new BriefingScheduler();
const scenarioModeler = new ScenarioModeler();

const ADVICE_FILE = './data/ai_advice.json';
const BRIEFINGS_FILE = './data/briefings.json';

function readAdvice() {
  if (!existsSync(ADVICE_FILE)) return [];
  try { return JSON.parse(readFileSync(ADVICE_FILE, 'utf8')); } catch { return []; }
}

function writeAdvice(advice) {
  writeFileSync(ADVICE_FILE, JSON.stringify(advice, null, 2), 'utf8');
}

function readBriefings() {
  if (!existsSync(BRIEFINGS_FILE)) return [];
  try { return JSON.parse(readFileSync(BRIEFINGS_FILE, 'utf8')); } catch { return []; }
}

function writeBriefings(briefings) {
  writeFileSync(BRIEFINGS_FILE, JSON.stringify(briefings, null, 2), 'utf8');
}

// Get all advice for user
router.get('/', requireRole('viewer'), async (req, res) => {
  try {
    const userId = req.user.id;
    const advice = readAdvice().filter(a => a.userId === userId);
    res.json(advice);
  } catch (error) {
    console.error('Get advice error:', error);
    res.status(500).json({ error: 'Failed to fetch advice' });
  }
});

// Get specific advice item
router.get('/:id', requireRole('viewer'), async (req, res) => {
  try {
    const { id } = req.params;
    const advice = readAdvice().find(a => a.id === id);
    
    if (!advice) {
      return res.status(404).json({ error: 'Advice not found' });
    }
    
    res.json(advice);
  } catch (error) {
    console.error('Get advice item error:', error);
    res.status(500).json({ error: 'Failed to fetch advice' });
  }
});

// Provide feedback on advice
router.patch('/:id/feedback', requireRole('viewer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, implemented } = req.body;
    
    const allAdvice = readAdvice();
    const index = allAdvice.findIndex(a => a.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Advice not found' });
    }
    
    allAdvice[index].feedback = rating;
    if (implemented !== undefined) {
      allAdvice[index].implemented = implemented;
      allAdvice[index].implementedAt = new Date().toISOString();
    }
    
    writeAdvice(allAdvice);
    
    // Adjust frequency for thumbs-down
    if (rating === 'thumbs_down') {
      advisor.adjustFrequency(req.user.id, allAdvice[index].trigger, rating);
    }
    
    res.json(allAdvice[index]);
  } catch (error) {
    console.error('Advice feedback error:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// Get briefings
router.get('/briefings', requireRole('viewer'), async (req, res) => {
  try {
    const userId = req.user.id;
    // Return stored briefings
    const briefings = readBriefings().filter(b => b.userId === userId);
    res.json(briefings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch briefings' });
  }
});

// Generate a briefing on demand
router.post('/briefings', requireRole('viewer'), async (req, res) => {
  try {
    const { type = 'daily' } = req.body;
    const userId = req.user.id;

    const { ContractStorage } = await import('../database/index.js');
    // const { default: businessAI } = await import('../../services/BusinessAIEngine.js'); // DISABLED TEMPORARILY
    const contracts = await ContractStorage.findByUserId(userId);

    // const text = await businessAI.brief({ userId, type, contracts }); // DISABLED TEMPORARILY
    const text = "AI advice temporarily disabled"; // TEMPORARY PLACEHOLDER

    const briefing = {
      id: `brief-${Date.now()}`,
      userId,
      type,
      content: text || 'No briefing available — run an analysis first.',
      generatedAt: new Date().toISOString(),
    };

    const all = readBriefings();
    all.unshift(briefing);
    writeBriefings(all.slice(0, 50)); // keep last 50

    res.json(briefing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate briefing', message: error.message });
  }
});

// Create scenario projection
router.post('/scenarios', requireRole('analyst'), async (req, res) => {
  try {
    const { contractId, targetMetric, hypotheticalValue } = req.body;
    
    if (!contractId || !targetMetric || hypotheticalValue === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await scenarioModeler.model(contractId, {
      targetMetric,
      hypotheticalValue
    });
    
    res.json(result);
  } catch (error) {
    console.error('Scenario modeling error:', error);
    if (error.message.includes('timeout')) {
      res.status(504).json({ error: 'Scenario modeling timeout' });
    } else {
      res.status(500).json({ error: 'Scenario modeling failed' });
    }
  }
});

export default router;
