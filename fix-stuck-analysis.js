#!/usr/bin/env node

/**
 * Fix stuck Quick Sync analysis
 * Resets stuck analyses to allow new ones to start
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANALYSES_FILE = path.join(__dirname, 'data', 'analyses.json');

console.log('🔧 Fixing stuck Quick Sync analysis...\n');

try {
  // Read analyses
  const data = fs.readFileSync(ANALYSES_FILE, 'utf8');
  const analyses = JSON.parse(data);
  
  console.log(`📊 Found ${analyses.length} total analyses`);
  
  // Find stuck analyses (running for > 5 minutes)
  const now = new Date();
  const STUCK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  
  let fixedCount = 0;
  
  analyses.forEach(analysis => {
    if (analysis.status === 'running') {
      const updatedAt = new Date(analysis.updatedAt);
      const timeSinceUpdate = now - updatedAt;
      
      if (timeSinceUpdate > STUCK_THRESHOLD) {
        console.log(`\n❌ Found stuck analysis:`);
        console.log(`   ID: ${analysis.id}`);
        console.log(`   Progress: ${analysis.progress}%`);
        console.log(`   Last update: ${analysis.updatedAt}`);
        console.log(`   Time stuck: ${Math.floor(timeSinceUpdate / 1000 / 60)} minutes`);
        
        // Mark as failed
        analysis.status = 'failed';
        analysis.errorMessage = 'Analysis timed out - please try again';
        analysis.completedAt = new Date().toISOString();
        analysis.updatedAt = new Date().toISOString();
        
        console.log(`   ✅ Marked as failed`);
        fixedCount++;
      }
    }
  });
  
  if (fixedCount > 0) {
    // Save updated analyses
    fs.writeFileSync(ANALYSES_FILE, JSON.stringify(analyses, null, 2));
    console.log(`\n✅ Fixed ${fixedCount} stuck analysis(es)`);
    console.log(`\n💡 You can now start a new Quick Sync from the dashboard`);
  } else {
    console.log(`\n✅ No stuck analyses found`);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
