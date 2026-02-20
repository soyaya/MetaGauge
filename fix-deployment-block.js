/**
 * Fix deployment block for existing users
 */

import { UserStorage, AnalysisStorage } from './src/api/database/index.js';
import { DeploymentBlockFinder } from './src/services/DeploymentBlockFinder.js';
import { ethers } from 'ethers';

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
      
      try {
        // Get RPC URL
        const getRpcUrl = (chain) => {
          const urls = {
            ethereum: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
            lisk: process.env.LISK_RPC_URL1 || 'https://rpc.api.lisk.com',
            starknet: process.env.STARKNET_RPC_URL1 || 'https://rpc.starknet.lava.build'
          };
          return urls[chain.toLowerCase()] || urls.lisk;
        };
        
        const provider = new ethers.JsonRpcProvider(getRpcUrl(contract.chain));
        const currentBlock = await provider.getBlockNumber();
        
        const finder = new DeploymentBlockFinder();
        const deploymentBlock = await finder.findDeploymentBlock(
          contract.address,
          currentBlock,
          contract.chain
        );
        
        console.log(`   ✅ Found deployment block: ${deploymentBlock}`);
        
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
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n✅ All deployment blocks fixed!');
}

fixDeploymentBlock();
