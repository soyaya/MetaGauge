/**
 * Diagnostic server - logs every step to find where it hangs
 */

import express from 'express';
import cors from 'cors';
import http from 'http';

const app = express();
const PORT = 5002;

console.log('🔧 Step 1: Creating server...');

// Create HTTP server
const server = http.createServer(app);

console.log('🔧 Step 2: Adding diagnostic middleware...');

// Diagnostic middleware - logs every request
app.use((req, res, next) => {
  console.log(`📥 REQUEST: ${req.method} ${req.url}`);
  next();
});

console.log('🔧 Step 3: Adding CORS...');

// CORS
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));

console.log('🔧 Step 4: Adding JSON parser...');

// JSON parser
app.use(express.json());

console.log('🔧 Step 5: Adding routes...');

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health endpoint processing...');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  console.log('✅ Health response sent');
});

app.get('/test', (req, res) => {
  console.log('✅ Test endpoint processing...');
  res.json({ message: 'Test successful' });
  console.log('✅ Test response sent');
});

console.log('🔧 Step 6: Starting server...');

server.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`   Try: curl http://localhost:${PORT}/health`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => process.exit(0));
});
