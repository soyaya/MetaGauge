/**
 * AI Tasks API Routes
 */
import express from 'express';
import { AITaskManager } from '../../services/AITaskManager.js';

const router = express.Router();

// GET /api/tasks — all tasks for user
router.get('/', async (req, res) => {
  try {
    const tasks = await AITaskManager.getAllTasks(req.user.id);
    res.json({ tasks });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/tasks/active — active tasks only
router.get('/active', async (req, res) => {
  try {
    const tasks = await AITaskManager.getActiveTasks(req.user.id, req.query.contractId || null);
    res.json({ tasks });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/tasks/:id — dismiss a task
router.delete('/:id', async (req, res) => {
  try {
    const task = await AITaskManager.dismissTask(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ task });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
