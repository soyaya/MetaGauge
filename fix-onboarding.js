#!/usr/bin/env node

import fs from 'fs';

const file = 'src/api/routes/onboarding.js';
let content = fs.readFileSync(file, 'utf8');

// Find the problematic section and fix it
const lines = content.split('\n');
let inBrokenSection = false;
let braceCount = 0;
const fixedLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Skip the broken error handling section
  if (line.includes('AnalysisStorage.update(analysisId, {') && line.includes('status: \'failed\'')) {
    inBrokenSection = true;
    continue;
  }
  
  if (inBrokenSection) {
    if (line.includes('} else {')) {
      inBrokenSection = false;
      fixedLines.push(line);
    }
    continue;
  }
  
  fixedLines.push(line);
}

fs.writeFileSync(file, fixedLines.join('\n'));
console.log('✅ Fixed onboarding.js syntax errors');
