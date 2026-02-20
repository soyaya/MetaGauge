#!/usr/bin/env node

/**
 * Minimal Backend Server - Quick Start
 * No RPC initialization, just API endpoints
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Simple in-memory state
let onboardingCompleted = true; // Start as completed
let quickSyncAnalysis = null;
// Use your actual contract by default
let onboardingContract = {
  name: 'USDT',
  address: '0x05D032ac25d322df992303dCa074EE7392C117b9',
  chain: 'lisk',
  category: 'defi',
  abi: [],
  purpose: 'Tether USD stablecoin on Lisk network',
  startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
};

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Onboarding status
app.get('/api/onboarding/status', (req, res) => {
  res.json({
    completed: onboardingCompleted,
    step: onboardingCompleted ? 'completed' : 'welcome',
    hasDefaultContract: onboardingCompleted
  });
});

// Complete onboarding
app.post('/api/onboarding/complete', (req, res) => {
  onboardingCompleted = true;
  
  // Store contract details from onboarding
  if (req.body.contract) {
    onboardingContract = {
      ...req.body.contract,
      // Ensure all required fields
      purpose: req.body.contract.purpose || 'DeFi contract',
      startDate: req.body.contract.startDate || new Date().toISOString()
    };
    console.log('✅ Stored onboarding contract:', onboardingContract.name, onboardingContract.address);
  }
  
  res.json({
    success: true,
    message: 'Onboarding completed',
    user: {
      onboarding: {
        completed: true,
        completedAt: new Date().toISOString(),
        defaultContract: onboardingContract
      }
    }
  });
});

// Start quick sync
app.post('/api/onboarding/start-quick-sync', (req, res) => {
  const analysisId = 'mock-analysis-' + Date.now();
  
  // Use contract from onboarding or default
  const contract = onboardingContract || {
    name: 'Sample Contract',
    address: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum'
  };
  
  // Create mock analysis with progress
  quickSyncAnalysis = {
    id: analysisId,
    status: 'running',
    progress: 0,
    logs: [`Quick sync started for ${contract.name} on ${contract.chain}`],
    metadata: {
      currentStep: 'init',
      message: 'Initializing...',
      contractAddress: contract.address,
      contractName: contract.name,
      chain: contract.chain
    }
  };
  
  // Simulate progress updates
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 10;
    if (progress <= 100 && quickSyncAnalysis) {
      quickSyncAnalysis.progress = progress;
      quickSyncAnalysis.logs.push(`Progress: ${progress}%`);
      
      if (progress === 20) {
        quickSyncAnalysis.metadata = { currentStep: 'fetching', message: 'Fetching transactions...', transactions: 150, events: 300 };
      } else if (progress === 60) {
        quickSyncAnalysis.metadata = { currentStep: 'processing', message: 'Processing data...', accounts: 50, blocks: 200 };
      } else if (progress === 90) {
        quickSyncAnalysis.metadata = { currentStep: 'deployment', message: 'Detecting deployment...' };
      } else if (progress === 100) {
        quickSyncAnalysis.status = 'completed';
        quickSyncAnalysis.metadata = { currentStep: 'complete', message: 'Quick sync complete!' };
        quickSyncAnalysis.results = {
          summary: {
            transactionsFound: 150,
            eventsFound: 300,
            accountsFound: 50,
            blocksScanned: 200,
            duration: '15.5s'
          }
        };
        clearInterval(progressInterval);
      }
    }
  }, 2000); // Update every 2 seconds
  
  res.json({
    success: true,
    message: 'Quick sync started',
    analysisId: analysisId
  });
});

// Refresh default contract (frontend uses this)
app.post('/api/onboarding/refresh-default-contract', (req, res) => {
  // Same as start-quick-sync
  const analysisId = 'mock-analysis-' + Date.now();
  
  const contract = onboardingContract || {
    name: 'Sample Contract',
    address: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum'
  };
  
  quickSyncAnalysis = {
    id: analysisId,
    status: 'running',
    progress: 0,
    logs: [`Quick sync started for ${contract.name} on ${contract.chain}`],
    metadata: {
      currentStep: 'init',
      message: 'Initializing...',
      contractAddress: contract.address,
      contractName: contract.name,
      chain: contract.chain
    }
  };
  
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 10;
    if (progress <= 100 && quickSyncAnalysis) {
      quickSyncAnalysis.progress = progress;
      quickSyncAnalysis.logs.push(`Progress: ${progress}%`);
      
      if (progress === 20) {
        quickSyncAnalysis.metadata = { currentStep: 'fetching', message: 'Fetching transactions...', transactions: 150, events: 300 };
      } else if (progress === 60) {
        quickSyncAnalysis.metadata = { currentStep: 'processing', message: 'Processing data...', accounts: 50, blocks: 200 };
      } else if (progress === 90) {
        quickSyncAnalysis.metadata = { currentStep: 'deployment', message: 'Detecting deployment...' };
      } else if (progress === 100) {
        quickSyncAnalysis.status = 'completed';
        quickSyncAnalysis.metadata = { currentStep: 'complete', message: 'Quick sync complete!' };
        quickSyncAnalysis.results = {
          summary: {
            transactionsFound: 150,
            eventsFound: 300,
            accountsFound: 50,
            blocksScanned: 200,
            duration: '15.5s'
          }
        };
        clearInterval(progressInterval);
      }
    }
  }, 2000);
  
  res.json({
    success: true,
    message: 'Quick sync started',
    analysisId: analysisId,
    contract: contract
  });
});

// Get analysis status
app.get('/api/analysis/:id/status', (req, res) => {
  if (quickSyncAnalysis && quickSyncAnalysis.id === req.params.id) {
    res.json(quickSyncAnalysis);
  } else {
    res.status(404).json({
      error: 'Analysis not found'
    });
  }
});

// Dashboard endpoint
app.get('/api/users/dashboard', (req, res) => {
  res.json({
    user: {
      name: 'User',
      email: 'user@example.com'
    },
    stats: {
      totalAnalyses: 0,
      totalContracts: 0
    }
  });
});

// Default contract
app.get('/api/onboarding/default-contract', (req, res) => {
  // Return stored contract from onboarding or mock data
  const contract = onboardingContract || {
    name: 'Sample Contract',
    address: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum',
    category: 'defi',
    abi: [],
    purpose: 'Sample DeFi contract for testing and demonstration purposes',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
  };
  
  res.json({
    contract: contract,
    analysis: {
      totalTransactions: 150,
      eventsFound: 300,
      uniqueUsers: 50,
      totalValueLocked: '1000000'
    },
    analysisHistory: {
      latest: quickSyncAnalysis || { status: 'pending' }
    },
    indexingStatus: {
      progress: quickSyncAnalysis?.progress || 0,
      status: quickSyncAnalysis?.status || 'idle'
    },
    lastSync: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Minimal Backend Server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/users/dashboard`);
  console.log(`🚀 Ready for frontend connections!`);
});
