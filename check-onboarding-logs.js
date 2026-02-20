#!/usr/bin/env node

/**
 * Check onboarding logs and diagnose indexing issue
 */

import { UserStorage, AnalysisStorage } from './src/api/database/fileStorage.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkOnboardingLogs() {
  console.log('🔍 Checking onboarding and indexing status...\n');
  
  try {
    // Get all users
    const users = await UserStorage.findAll();
    console.log(`📊 Total users: ${users.length}\n`);
    
    // Find users with onboarding completed
    const onboardedUsers = users.filter(u => u.onboarding?.defaultContract);
    console.log(`✅ Users with onboarding: ${onboardedUsers.length}\n`);
    
    if (onboardedUsers.length === 0) {
      console.log('❌ No users have completed onboarding yet');
      return;
    }
    
    // Check each onboarded user
    for (const user of onboardedUsers.slice(-5)) { // Last 5 users
      console.log('─'.repeat(80));
      console.log(`\n👤 User: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Tier: ${user.tier || 'free'}`);
      
      const contract = user.onboarding.defaultContract;
      console.log(`\n📄 Contract:`);
      console.log(`   Address: ${contract.address}`);
      console.log(`   Chain: ${contract.chain}`);
      console.log(`   Name: ${contract.name}`);
      console.log(`   Is Indexed: ${contract.isIndexed}`);
      console.log(`   Progress: ${contract.indexingProgress || 0}%`);
      console.log(`   Last Analysis ID: ${contract.lastAnalysisId || 'null'}`);
      
      // Check if analysis exists
      if (contract.lastAnalysisId) {
        const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
        if (analysis) {
          console.log(`\n📊 Analysis:`);
          console.log(`   Status: ${analysis.status}`);
          console.log(`   Progress: ${analysis.progress}%`);
          console.log(`   Type: ${analysis.analysisType}`);
          if (analysis.results) {
            console.log(`   Total Transactions: ${analysis.results.totalTransactions || 0}`);
            console.log(`   Total Events Found: ${analysis.results.totalEventsFound || 0}`);
          }
          if (analysis.error) {
            console.log(`   ❌ Error: ${analysis.error}`);
          }
        } else {
          console.log(`\n❌ Analysis record not found!`);
        }
      } else {
        console.log(`\n❌ No analysis record created - indexing never started!`);
      }
      
      // Check all analyses for this user
      const allAnalyses = await AnalysisStorage.findByUserId(user.id);
      console.log(`\n📈 Total analyses for user: ${allAnalyses.length}`);
      if (allAnalyses.length > 0) {
        console.log(`   Latest analysis:`);
        const latest = allAnalyses[allAnalyses.length - 1];
        console.log(`     ID: ${latest.id}`);
        console.log(`     Status: ${latest.status}`);
        console.log(`     Type: ${latest.analysisType}`);
        console.log(`     Created: ${latest.createdAt}`);
      }
    }
    
    console.log('\n' + '─'.repeat(80));
    console.log('\n✅ Diagnostic complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

checkOnboardingLogs();
