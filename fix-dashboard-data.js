/**
 * Fix dashboard display issues for existing users
 * - Ensures deploymentBlock is properly set
 * - Validates startDate format
 */

import { UserStorage } from './src/api/database/index.js';

async function fixDashboardData() {
  console.log('🔧 Fixing dashboard data for existing users...\n');
  
  try {
    const users = await UserStorage.findAll();
    console.log(`📊 Found ${users.length} users\n`);
    
    for (const user of users) {
      if (!user.onboarding?.defaultContract) {
        console.log(`⏭️  Skipping ${user.email} - no default contract`);
        continue;
      }
      
      const contract = user.onboarding.defaultContract;
      let needsUpdate = false;
      const updates = {};
      
      // Check if deploymentBlock is missing but we have it in analysis
      if (!contract.deploymentBlock && contract.lastAnalysisId) {
        const { AnalysisStorage } = await import('./src/api/database/index.js');
        const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
        
        if (analysis?.metadata?.blockRange?.deployment) {
          updates.deploymentBlock = analysis.metadata.blockRange.deployment;
          needsUpdate = true;
          console.log(`✅ ${user.email}: Adding deployment block ${updates.deploymentBlock}`);
        }
      }
      
      // Check if startDate is valid
      if (contract.startDate) {
        const date = new Date(contract.startDate);
        if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
          console.log(`⚠️  ${user.email}: Invalid startDate ${contract.startDate}`);
        }
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        await UserStorage.update(user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              ...updates
            }
          }
        });
        console.log(`✅ Updated ${user.email}`);
      }
    }
    
    console.log('\n✅ Dashboard data fix complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDashboardData();
