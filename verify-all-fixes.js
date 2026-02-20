/**
 * Verify all dashboard fixes
 */

import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

async function verify() {
  console.log('🔍 Verifying all dashboard fixes...\n');
  
  const users = await UserStorage.findAll();
  
  for (const user of users) {
    if (!user.onboarding?.defaultContract?.address) continue;
    
    const contract = user.onboarding.defaultContract;
    console.log(`\n📊 ${user.email}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Address: ${contract.address}`);
    console.log(`   Chain: ${contract.chain}`);
    console.log(`   Name: ${contract.name}`);
    console.log(`   Category: ${contract.category.toUpperCase()}`);
    console.log(`   Purpose: ${(contract.purpose || '').slice(0, 80)}...`);
    
    // Check startDate
    const date = new Date(contract.startDate);
    if (isNaN(date.getTime()) || date.getFullYear() < 2000 || date.getFullYear() > 2100) {
      console.log(`   ❌ Start Date: INVALID - ${contract.startDate}`);
    } else {
      console.log(`   ✅ Start Date: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`);
    }
    
    // Check deploymentBlock
    if (!contract.deploymentBlock) {
      console.log(`   ❌ Deployment Block: NOT SET`);
    } else if (typeof contract.deploymentBlock === 'string') {
      console.log(`   ❌ Deployment Block: INVALID STRING - "${contract.deploymentBlock}"`);
    } else {
      console.log(`   ✅ Deployment Block: ${contract.deploymentBlock.toLocaleString()}`);
    }
    
    console.log(`   Indexed: ${contract.isIndexed ? '✅' : '⏳'} ${contract.indexingProgress}%`);
    
    // Check analysis
    if (contract.lastAnalysisId) {
      const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
      if (analysis) {
        console.log(`   Analysis Status: ${analysis.status}`);
        if (analysis.metadata?.blockRange) {
          const br = analysis.metadata.blockRange;
          console.log(`   Block Range: ${br.start || 'null'} → ${br.end || 'null'}`);
          
          if (!br.deployment) {
            console.log(`   ❌ Analysis deployment: NOT SET`);
          } else if (typeof br.deployment === 'string') {
            console.log(`   ❌ Analysis deployment: INVALID STRING - "${br.deployment}"`);
          } else {
            console.log(`   ✅ Analysis deployment: ${br.deployment.toLocaleString()}`);
          }
        }
      }
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Verification complete!\n');
}

verify();
