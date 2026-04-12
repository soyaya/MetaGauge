#!/usr/bin/env node

/**
 * Disable AI scanning by setting environment flag
 * This prevents AI services from running without breaking imports
 */

import fs from 'fs';

// Add AI_DISABLED flag to .env
const envFile = '.env';
let envContent = '';

try {
  envContent = fs.readFileSync(envFile, 'utf8');
} catch (err) {
  console.log('No .env file found, creating one...');
}

// Remove existing AI_DISABLED line if present
envContent = envContent.replace(/^AI_DISABLED=.*$/gm, '');

// Add AI_DISABLED=true
envContent += '\n# Temporarily disable AI services\nAI_DISABLED=true\n';

fs.writeFileSync(envFile, envContent);

console.log('✅ AI services disabled via environment variable');
console.log('💡 Restart the server - AI services will be skipped');
console.log('🔄 To re-enable: remove AI_DISABLED=true from .env');
