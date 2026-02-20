#!/usr/bin/env node

/**
 * Minimal backend test - no indexer
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  console.log('Health check hit');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', async (req, res) => {
  console.log('Register hit:', req.body);
  res.json({
    message: 'Test registration',
    user: { id: '123', email: req.body.email },
    token: 'test-token'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
});
