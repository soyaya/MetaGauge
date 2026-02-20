import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

async function identifyMockData() {
  console.log('🔍 Identifying mock data in database...\n');
  
  const users = await UserStorage.findAll();
  
  for (const user of users) {
    console.log(`\n👤 User: ${user.email}`);
    
    if (!user.onboarding?.defaultContract) {
      console.log('   ⚠️  No contract data');
      continue;
    }
    
    const contract = user.onboarding.defaultContract;
    const analysis = contract.lastAnalysisId 
      ? await AnalysisStorage.findById(contract.lastAnalysisId)
      : null;
    
    // Check for mock/fake data indicators
    const issues = [];
    
    // Check analysis results
    if (analysis?.results) {
      const results = analysis.results.target;
      
      // Check for hardcoded values
      if (results?.transactions === 17 && results?.metrics?.uniqueUsers === 11) {
        issues.push('❌ MOCK: Hardcoded transactions (17) and users (11)');
      }
      
      if (results?.metrics?.tvl === 125000 && results?.metrics?.volume === 450000) {
        issues.push('❌ MOCK: Hardcoded TVL (125000) and volume (450000)');
      }
      
      if (results?.metrics?.gasEfficiency === 85) {
        issues.push('❌ MOCK: Hardcoded gas efficiency (85)');
      }
      
      if (results?.events?.length === 0 && results?.transactions > 0) {
        issues.push('⚠️  SUSPICIOUS: Transactions exist but no events');
      }
    }
    
    // Check block range
    if (analysis?.metadata?.blockRange) {
      const br = analysis.metadata.blockRange;
      
      if (br.start === null || br.end === null) {
        issues.push('❌ NULL: Block range start/end is null');
      }
      
      if (br.total === 7000) {
        issues.push('⚠️  SUSPICIOUS: Exactly 7000 blocks (too round)');
      }
      
      if (typeof br.deployment === 'string') {
        issues.push('❌ INVALID: Deployment block is string, not number');
      }
    }
    
    // Check indexing status
    if (contract.isIndexed && analysis?.status !== 'completed') {
      issues.push('❌ INCONSISTENT: Marked indexed but analysis not completed');
    }
    
    if (contract.indexingProgress === 100 && !analysis?.results) {
      issues.push('❌ MOCK: 100% progress but no results');
    }
    
    // Report findings
    if (issues.length > 0) {
      console.log('   🚨 Issues found:');
      issues.forEach(issue => console.log('      ' + issue));
      
      console.log('\n   📊 Current data:');
      console.log('      Analysis status:', analysis?.status || 'none');
      console.log('      Has results:', !!analysis?.results);
      console.log('      Transactions:', analysis?.results?.target?.transactions || 0);
      console.log('      Events:', analysis?.results?.target?.events?.length || 0);
      console.log('      Block range:', 
        analysis?.metadata?.blockRange?.start || 'null', '→',
        analysis?.metadata?.blockRange?.end || 'null'
      );
    } else {
      console.log('   ✅ No mock data detected');
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Scan complete');
}

identifyMockData();
