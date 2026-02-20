/**
 * Check what error occurred in the analysis
 */

import { AnalysisStorage } from './src/api/database/index.js';

async function checkAnalysisError() {
  try {
    const analysis = await AnalysisStorage.findById('a04879fa-c5b3-4d52-b09a-9c0e83913ea3');
    
    console.log('📊 Analysis Details:\n');
    console.log('Status:', analysis.status);
    console.log('Progress:', analysis.progress);
    console.log('Error Message:', analysis.errorMessage);
    console.log('\nMetadata:');
    console.log(JSON.stringify(analysis.metadata, null, 2));
    console.log('\nLogs:');
    console.log(analysis.logs?.join('\n'));
    
  } catch (error) {
    console.error('Failed to check analysis:', error);
  }
}

checkAnalysisError();
