#!/usr/bin/env node

/**
 * Check failed analysis details
 */

import { AnalysisStorage } from './src/api/database/fileStorage.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkFailedAnalysis() {
  console.log('🔍 Checking failed analysis details...\n');
  
  try {
    // Get the latest failed analysis
    const analysisId = 'f03a6bb4-acbd-46d1-89d7-464b47883d9f'; // From the last test
    
    const analysis = await AnalysisStorage.findById(analysisId);
    
    if (!analysis) {
      console.log('❌ Analysis not found');
      return;
    }
    
    console.log('📊 Analysis Details:');
    console.log(JSON.stringify(analysis, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

checkFailedAnalysis();
