import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
const contract = user.onboarding.defaultContract;
const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);

console.log('📊 DASHBOARD DATA VERIFICATION\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('✅ CORRECT DATA:');
console.log('   Name:', contract.name);
console.log('   Category:', contract.category.toUpperCase(), '•', contract.chain);
console.log('   Address:', contract.address.slice(0, 10) + '...');
console.log('   Onboarded:', new Date(contract.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
console.log('   Deployment Block:', contract.deploymentBlock?.toLocaleString());

console.log('\n📦 SUBSCRIPTION & BLOCK DATA:');
if (analysis?.metadata?.subscription) {
  console.log('   Subscription:', analysis.metadata.subscription.tier);
  console.log('   Historical Data:', analysis.metadata.subscription.historicalDays, 'days');
}

if (analysis?.metadata?.blockRange) {
  const br = analysis.metadata.blockRange;
  console.log('   Blocks Indexed:', br.total?.toLocaleString() || 'null');
  console.log('   Block Range:', br.start?.toLocaleString() || 'null', '→', br.end?.toLocaleString() || 'null');
}

console.log('\n⚠️  ISSUES FOUND:');

// Check purpose
if (contract.purpose && contract.purpose.length > 50 && !contract.purpose.includes(' ')) {
  console.log('   ❌ Purpose: Random characters, not real description');
  console.log('      Current:', contract.purpose.slice(0, 80) + '...');
  console.log('      Should be: Meaningful contract description');
}

// Check indexing status
console.log('\n📈 INDEXING STATUS:');
console.log('   Is Indexed:', contract.isIndexed);
console.log('   Progress:', contract.indexingProgress + '%');
console.log('   Analysis Status:', analysis.status);

if (contract.indexingProgress === 0 && analysis.status === 'failed') {
  console.log('\n   ❌ PROBLEM: Analysis failed, indexing stuck at 0%');
  console.log('   Error:', analysis.errorMessage);
}

// Check block range consistency
if (analysis?.metadata?.blockRange) {
  const br = analysis.metadata.blockRange;
  const calculatedTotal = br.end && br.start ? br.end - br.start : null;
  
  if (br.total !== calculatedTotal && calculatedTotal !== null) {
    console.log('\n   ⚠️  Block range mismatch:');
    console.log('      Stored total:', br.total);
    console.log('      Calculated (end - start):', calculatedTotal);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n💡 RECOMMENDATIONS:\n');

if (contract.purpose && !contract.purpose.includes(' ')) {
  console.log('1. Update purpose with real description');
  console.log('   Example: "USDT stablecoin on Lisk network"');
}

if (analysis.status === 'failed') {
  console.log('2. Fix failed analysis to enable indexing');
  console.log('   - Check RPC connection');
  console.log('   - Verify contract address');
  console.log('   - Review error logs');
}

if (contract.indexingProgress === 0) {
  console.log('3. Trigger new analysis to populate metrics');
}
