#!/usr/bin/env node

import fs from 'fs';

const file = 'src/api/routes/analysis.js';
let content = fs.readFileSync(file, 'utf8');

// Replace incomplete businessAI calls with placeholders
content = content.replace(
  /const result = \/\/ await businessAI\.analyze\([^)]+\);/g,
  'const result = { message: "AI analysis temporarily disabled" }; // TEMPORARY PLACEHOLDER'
);

// Fix any other broken businessAI references
content = content.replace(
  /\/\/ await businessAI\./g,
  '// await businessAI.'
);

fs.writeFileSync(file, content);
console.log('✅ Fixed analysis.js businessAI references');
