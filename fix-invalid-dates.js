/**
 * Fix invalid dates in user onboarding data
 */

import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

async function fixInvalidDates() {
  console.log('🔧 Fixing invalid dates...\n');
  
  try {
    const users = await UserStorage.findAll();
    
    for (const user of users) {
      if (!user.onboarding?.defaultContract) continue;
      
      const contract = user.onboarding.defaultContract;
      let needsUpdate = false;
      const updates = { ...contract };
      
      // Fix invalid startDate
      if (contract.startDate) {
        const date = new Date(contract.startDate);
        if (isNaN(date.getTime()) || date.getFullYear() < 2000 || date.getFullYear() > 2100) {
          console.log(`⚠️  ${user.email}: Invalid startDate ${contract.startDate}`);
          
          // Try to get date from analysis
          if (contract.lastAnalysisId) {
            const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
            if (analysis?.createdAt) {
              updates.startDate = analysis.createdAt;
              console.log(`   → Using analysis date: ${updates.startDate}`);
              needsUpdate = true;
            }
          }
          
          // Fallback to user creation date
          if (!needsUpdate && user.createdAt) {
            updates.startDate = user.createdAt;
            console.log(`   → Using user creation date: ${updates.startDate}`);
            needsUpdate = true;
          }
        }
      }
      
      // Add deploymentBlock if missing
      if (!contract.deploymentBlock && contract.lastAnalysisId) {
        const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
        if (analysis?.metadata?.blockRange?.deployment) {
          updates.deploymentBlock = analysis.metadata.blockRange.deployment;
          console.log(`✅ ${user.email}: Adding deployment block ${updates.deploymentBlock}`);
          needsUpdate = true;
        }
      }
      
      // Apply updates
      if (needsUpdate) {
        await UserStorage.update(user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: updates
          }
        });
        console.log(`✅ Updated ${user.email}\n`);
      }
    }
    
    console.log('✅ All dates fixed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixInvalidDates();
