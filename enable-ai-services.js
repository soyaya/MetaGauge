#!/usr/bin/env node

/**
 * Re-enable AI services after testing
 * Renames .disabled files back to .js
 */

import fs from 'fs';
import { glob } from 'glob';

console.log('🔧 Re-enabling AI services...');

// Find all .disabled files
const disabledFiles = glob.sync('src/**/*.js.disabled');

for (const file of disabledFiles) {
  try {
    const originalName = file.replace('.disabled', '');
    fs.renameSync(file, originalName);
    console.log(`✅ Enabled: ${originalName}`);
  } catch (err) {
    console.warn(`⚠️ Could not enable ${file}: ${err.message}`);
  }
}

console.log('\n🚀 AI services re-enabled. Restart the server.');
