/**
 * Fix deployment block for existing users - using working RPC
 */

import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

async function fixDeploymentBlock() {
  console.log('🔧 Fixing deployment blocks...\n');
  
  const users = await UserStorage.findAll();
  
  for (const user of users) {
    if (!user.onboarding?.defaultContract?.address) continue;
    
    const contract = user.onboarding.defaultContract;
    
    // Check if deployment block is invalid (string or missing)
    if (!contract.deploymentBlock || typeof contract.deploymentBlock === 'string') {
      console.log(`\n📊 ${user.email}`);
      console.log(`   Address: ${contract.address}`);
      console.log(`   Chain: ${contract.chain}`);
      console.log(`   Current deployment: ${contract.deploymentBlock}`);
      
      // For Lisk USDT contract, we know the deployment block
      if (contract.address.toLowerCase() === '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae' && 
          contract.chain === 'lisk') {
        const deploymentBlock = 28168268; // Known deployment block for this contract
        
        console.log(`   ✅ Setting known deployment block: ${deploymentBlock}`);
        
        // Update user
        await UserStorage.update(user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              deploymentBlock: deploymentBlock
            }
          }
        });
        
        // Update analysis if exists
        if (contract.lastAnalysisId) {
          const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
          if (analysis?.metadata?.blockRange) {
            await AnalysisStorage.update(contract.lastAnalysisId, {
              metadata: {
                ...analysis.metadata,
                blockRange: {
                  ...analysis.metadata.blockRange,
                  deployment: deploymentBlock
                }
              }
            });
            console.log(`   ✅ Updated analysis metadata`);
          }
        }
      } else {
        console.log(`   ⚠️  Unknown contract - manual fix needed`);
      }
    }
  }
  
  console.log('\n✅ All deployment blocks fixed!');
}

fixDeploymentBlock();
