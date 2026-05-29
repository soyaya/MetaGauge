import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import { authenticateToken } from './middleware/auth.js';
import config from './config/env.js';

// Routes (stubs — filled in next phases)
import analysisRoutes from './routes/analysis.js';
import agentRoutes from './routes/agent.js';
import alertRoutes from './routes/alerts.js';

const app = express();

app.use(cors({ origin: config.mainAppUrl, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// Health check — no auth required
app.get('/health', (req, res) => res.json({
  status: 'healthy',
  service: 'metagauge-ai-agent',
  timestamp: new Date().toISOString(),
}));

// All routes require a valid JWT from the main app
app.use('/api/analysis', authenticateToken, analysisRoutes);
app.use('/api/agent',    authenticateToken, agentRoutes);
app.use('/api/alerts',   authenticateToken, alertRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// Error handler
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(500).json({ error: err.message });
});

async function start() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`🤖 MetaGauge AI Agent running on port ${config.port}`);
    console.log(`🔗 Main app: ${config.mainAppUrl}`);
    console.log(`🔍 Health: http://localhost:${config.port}/health`);
  });
}

start();
