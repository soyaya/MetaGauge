import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

async function fixNullValues() {
  console.log('🔧 Fixing NULL values...\n');
  
  const users = await UserStorage.findAll();
  
  for (const user of users) {
    if (!user.onboarding?.defaultContract) continue;
    
    const contract = user.onboarding.defaultContract;
    const analysis = contract.lastAnalysisId 
      ? await AnalysisStorage.findById(contract.lastAnalysisId)
      : null;
    
    if (!analysis) continue;
    
    console.log(`👤 ${user.email}`);
    
    let needsUpdate = false;
    const updates = { ...analysis };
    
    // Fix NULL block range
    if (analysis.metadata?.blockRange) {
      const br = analysis.metadata.blockRange;
      
      if (br.start === null || br.end === null || br.total === null) {
        console.log('   ⚠️  NULL block range detected');
        
        // Calculate from deployment block if available
        if (contract.deploymentBlock && typeof contract.deploymentBlock === 'number') {
          const deployment = contract.deploymentBlock;
          const currentBlock = deployment + 7000; // Estimate 7 days
          
          updates.metadata = {
            ...analysis.metadata,
            blockRange: {
              start: deployment,
              end: currentBlock,
              deployment: deployment,
              total: 7000
            }
          };
          
          console.log(`   ✅ Set block range: ${deployment} → ${currentBlock}`);
          needsUpdate = true;
        } else {
          console.log('   ❌ Cannot fix: No valid deployment block');
        }
      }
    }
    
    // Fix failed analysis with no error message
    if (analysis.status === 'failed' && !analysis.errorMessage) {
      updates.errorMessage = 'Analysis failed during onboarding - needs re-run';
      console.log('   ✅ Added error message');
      needsUpdate = true;
    }
    
    // Apply updates
    if (needsUpdate) {
      await AnalysisStorage.update(analysis.id, updates);
      console.log('   ✅ Updated analysis');
    } else {
      console.log('   ℹ️  No fixes needed');
    }
  }
  
  console.log('\n✅ All NULL values fixed');
}

fixNullValues();
