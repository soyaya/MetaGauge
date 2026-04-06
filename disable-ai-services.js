#!/usr/bin/env node

/**
 * Temporarily disable AI services to restore indexer functionality
 * Renames AI service files to .disabled extension
 */

import fs from 'fs';
import path from 'path';

const AI_SERVICES = [
  'src/services/SimpleAIService.js',
  'src/services/ContractInteractionFetcher.js', 
  'src/services/ExternalDataFetcher.js',
  'src/services/BusinessAIEngine.js',
  'src/services/RAGContextBuilder.js',
  'src/services/ChatAIService.js'
];

const AI_ROUTES = [
  'src/api/routes/chat.js',
  'src/api/routes/simple-ai.js'
];

console.log('🔧 Disabling AI services temporarily...');

// Disable services
for (const service of AI_SERVICES) {
  try {
    if (fs.existsSync(service)) {
      fs.renameSync(service, service + '.disabled');
      console.log(`✅ Disabled: ${service}`);
    }
  } catch (err) {
    console.warn(`⚠️ Could not disable ${service}: ${err.message}`);
  }
}

// Disable routes  
for (const route of AI_ROUTES) {
  try {
    if (fs.existsSync(route)) {
      fs.renameSync(route, route + '.disabled');
      console.log(`✅ Disabled: ${route}`);
    }
  } catch (err) {
    console.warn(`⚠️ Could not disable ${route}: ${err.message}`);
  }
}

console.log('\n🚀 AI services disabled. Restart the server to test indexer.');
console.log('💡 To re-enable: node enable-ai-services.js');
