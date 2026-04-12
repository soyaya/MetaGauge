/**
 * Simple AI API Routes — all powered by BusinessAIEngine (RAG)
 */
import express from 'express';
import businessAI from '../../services/BusinessAIEngine.js';
import { AITaskManager } from '../../services/AITaskManager.js';
import { findById as findContractById } from '../database/ContractStorage.js';
import { AnalysisStorage } from '../database/index.js';

const router = express.Router();

async function getContractAndMetrics(contractId, userId) {
  const contract = await findContractById(contractId);
  if (!contract) return null;
  const analyses = await AnalysisStorage.findByUserId(userId);
  const latest = analyses.find(a => a.configId === contractId && a.status === 'completed');
  return {
    contractId,
    address: contract.targetContract?.address,
    chain: contract.targetContract?.chain || 'ethereum',
    name: contract.name,
    metrics: latest?.results?.target?.metrics || {},
  };
}

// GET /api/ai/insights — get stored AI insights for user
router.get('/insights', async (req, res) => {
  try {
    const tasks = await AITaskManager.getAllTasks(req.user.id);
    res.json({ tasks, total: tasks.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/insights/:contractId — generate RAG insights
router.post('/insights/:contractId', async (req, res) => {
  try {
    const ctx = await getContractAndMetrics(req.params.contractId, req.user.id);
    if (!ctx) return res.status(404).json({ error: 'Contract not found' });

    const result = await businessAI.analyze({
      userId: req.user.id,
      contractId: ctx.contractId,
      contractAddress: ctx.address,
      chain: ctx.chain,
      metrics: ctx.metrics,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/chat/:contractId — RAG chat
router.post('/chat/:contractId', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const ctx = await getContractAndMetrics(req.params.contractId, req.user.id);
    if (!ctx) return res.status(404).json({ error: 'Contract not found' });

    const response = await businessAI.chat({
      userId: req.user.id,
      message,
      contractAddress: ctx.address,
      chain: ctx.chain,
      metrics: ctx.metrics,
    });
    res.json({ response });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/health-check/:contractId — RAG health check
router.post('/health-check/:contractId', async (req, res) => {
  try {
    const ctx = await getContractAndMetrics(req.params.contractId, req.user.id);
    if (!ctx) return res.status(404).json({ error: 'Contract not found' });

    const result = await businessAI.analyze({
      userId: req.user.id,
      contractId: ctx.contractId,
      contractAddress: ctx.address,
      chain: ctx.chain,
      metrics: ctx.metrics,
    });
    res.json({ health: { summary: result.summary, risks: result.risks, strengths: result.strengths }, tasks: result.createdTasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/check-anomalies/:contractId — RAG anomaly detection
router.post('/check-anomalies/:contractId', async (req, res) => {
  try {
    const ctx = await getContractAndMetrics(req.params.contractId, req.user.id);
    if (!ctx) return res.status(404).json({ error: 'Contract not found' });

    const result = await businessAI.analyze({
      userId: req.user.id,
      contractId: ctx.contractId,
      contractAddress: ctx.address,
      chain: ctx.chain,
      metrics: ctx.metrics,
    });
    const anomalies = result.insights?.filter(i => i.status === 'BAD') || [];
    res.json({ anomalies, count: anomalies.length, tasks: result.createdTasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ai/assignments/:contractId — get active tasks for contract
router.get('/assignments/:contractId', async (req, res) => {
  try {
    const tasks = await AITaskManager.getActiveTasks(req.user.id, req.params.contractId);
    res.json({ assignments: tasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/assignments/:assignmentId/complete — dismiss/complete a task
router.post('/assignments/:assignmentId/complete', async (req, res) => {
  try {
    const task = await AITaskManager.dismissTask(req.params.assignmentId, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
