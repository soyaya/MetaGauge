/**
 * Global Test Teardown
 * 
 * This file runs after all tests complete to clean up resources.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up test environment...');
  
  try {
    // Clean up test data directory
    const testDataDir = path.join(__dirname, '../../data/test');
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
      console.log('✅ Test data cleaned up');
    }
    
    // Clean up test logs
    const testLogsDir = path.join(__dirname, '../../logs/test');
    if (fs.existsSync(testLogsDir)) {
      fs.rmSync(testLogsDir, { recursive: true, force: true });
      console.log('✅ Test logs cleaned up');
    }
    
    console.log('✅ Test environment teardown complete');
  } catch (error) {
    console.error('❌ Error during teardown:', error.message);
  }
}
