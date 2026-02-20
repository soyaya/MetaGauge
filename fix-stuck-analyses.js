#!/usr/bin/env node

/**
 * Fix stuck analyses - Reset any analyses stuck in "running" or "pending" state
 */

import { AnalysisStorage } from './src/api/database/index.js';

async function fixStuckAnalyses() {
  console.log('🔧 Fixing stuck analyses...\n');
  
  try {
    // Get all analyses
    const allAnalyses = await AnalysisStorage.findAll();
    
    // Find stuck analyses (running/pending for more than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const stuckAnalyses = allAnalyses.filter(analysis => {
      if (analysis.status !== 'running' && analysis.status !== 'pending') {
        return false;
      }
      
      const createdAt = new Date(analysis.createdAt);
      const refreshStarted = analysis.metadata?.refreshStarted ? 
        new Date(analysis.metadata.refreshStarted) : createdAt;
      
      return refreshStarted < fiveMinutesAgo;
    });
    
    console.log(`Found ${stuckAnalyses.length} stuck analyses\n`);
    
    if (stuckAnalyses.length === 0) {
      console.log('✅ No stuck analyses found!');
      return;
    }
    
    // Reset each stuck analysis
    for (const analysis of stuckAnalyses) {
      console.log(`📝 Resetting analysis ${analysis.id}`);
      console.log(`   Status: ${analysis.status}`);
      console.log(`   Progress: ${analysis.progress}%`);
      console.log(`   Started: ${analysis.metadata?.refreshStarted || analysis.createdAt}`);
      
      await AnalysisStorage.update(analysis.id, {
        status: 'failed',
        errorMessage: 'Analysis timed out or got stuck. Please try again.',
        completedAt: new Date().toISOString(),
        metadata: {
          ...analysis.metadata,
          wasStuck: true,
          resetAt: new Date().toISOString()
        }
      });
      
      console.log(`   ✅ Reset to failed\n`);
    }
    
    console.log(`\n✅ Fixed ${stuckAnalyses.length} stuck analyses`);
    console.log('\n💡 You can now start a new Quick Sync');
    
  } catch (error) {
    console.error('❌ Error fixing stuck analyses:', error);
    process.exit(1);
  }
}

fixStuckAnalyses();
