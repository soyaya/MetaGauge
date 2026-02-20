import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

console.log('🔍 Checking all metrics for mock data...\n');

const users = await UserStorage.findAll();

for (const user of users) {
  if (!user.onboarding?.defaultContract) continue;
  
  console.log(`\n👤 ${user.email}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const contract = user.onboarding.defaultContract;
  const analysis = contract.lastAnalysisId 
    ? await AnalysisStorage.findById(contract.lastAnalysisId)
    : null;
  
  if (!analysis) {
    console.log('   ⚠️  No analysis found');
    continue;
  }
  
  console.log('📊 Analysis Status:', analysis.status);
  console.log('📈 Progress:', analysis.progress + '%');
  
  if (!analysis.results) {
    console.log('   ℹ️  No results yet (analysis not completed)');
    continue;
  }
  
  const results = analysis.results.target;
  const metrics = results?.metrics || {};
  
  console.log('\n📋 Checking Metrics:\n');
  
  // Check for suspicious hardcoded values
  const checks = [
    { name: 'Transactions', value: results?.transactions, suspicious: [17, 150, 100] },
    { name: 'Unique Users', value: metrics?.uniqueUsers, suspicious: [11, 50] },
    { name: 'TVL', value: metrics?.tvl, suspicious: [125000, 1000000] },
    { name: 'Volume', value: metrics?.volume, suspicious: [450000] },
    { name: 'Gas Efficiency', value: metrics?.gasEfficiency, suspicious: [85] },
    { name: 'Avg Gas Used', value: metrics?.avgGasUsed, suspicious: [45000] },
    { name: 'Total Gas Cost', value: metrics?.totalGasCost, suspicious: [0.15] },
  ];
  
  let foundMock = false;
  
  checks.forEach(({ name, value, suspicious }) => {
    if (value === undefined || value === null) {
      console.log(`   ⚪ ${name}: Not set`);
    } else if (suspicious.includes(value)) {
      console.log(`   ❌ ${name}: ${value} (MOCK - suspicious value)`);
      foundMock = true;
    } else {
      console.log(`   ✅ ${name}: ${value}`);
    }
  });
  
  // Check events
  const events = results?.events || [];
  console.log(`\n📦 Events: ${events.length}`);
  if (events.length === 0 && results?.transactions > 0) {
    console.log('   ⚠️  No events but has transactions (suspicious)');
  }
  
  // Check block range
  const br = analysis.metadata?.blockRange || {};
  console.log('\n📊 Block Range:');
  console.log(`   Start: ${br.start || 'null'}`);
  console.log(`   End: ${br.end || 'null'}`);
  console.log(`   Total: ${br.total || 'null'}`);
  
  if (br.total === 7000) {
    console.log('   ⚠️  Exactly 7000 blocks (estimated, not real data)');
  }
  
  if (foundMock) {
    console.log('\n🚨 MOCK DATA DETECTED - Needs real blockchain indexing');
  } else if (results?.transactions === 0) {
    console.log('\n⚠️  No data - Analysis completed but found no transactions');
  } else {
    console.log('\n✅ Metrics look real');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Metrics check complete');
