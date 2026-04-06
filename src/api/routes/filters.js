/**
 * Filter API Routes
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getPool } from '../database/postgres.js';

const router = express.Router();

// Save filter preset
router.post('/presets', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { name, config } = req.body;

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO filter_presets (user_id, name, config, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, config, created_at`,
      [userId, name, JSON.stringify(config)]
    );

    res.json({ success: true, preset: result.rows[0] });
  } catch (error) {
    console.error('Error saving filter preset:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's filter presets
router.get('/presets', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const pool = getPool();
    
    const result = await pool.query(
      `SELECT id, name, config, created_at 
       FROM filter_presets 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, presets: result.rows });
  } catch (error) {
    console.error('Error fetching filter presets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete filter preset
router.delete('/presets/:id', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const pool = getPool();

    await pool.query(
      'DELETE FROM filter_presets WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting filter preset:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
