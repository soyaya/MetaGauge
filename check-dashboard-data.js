import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
const contract = user.onboarding.defaultContract;

console.log('📊 What Dashboard Should Show:\n');
console.log('Address:', contract.address);
console.log('Purpose:', contract.purpose);
console.log('Started:', new Date(contract.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
console.log('Deployment Block:', contract.deploymentBlock?.toLocaleString());
console.log('Subscription Tier:', contract.subscriptionTier);
console.log('Is Indexed:', contract.isIndexed);
console.log('Progress:', contract.indexingProgress + '%');

if (contract.lastAnalysisId) {
  const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
  console.log('\n📝 Analysis Status:', analysis.status);
  
  if (analysis.metadata) {
    console.log('\n📦 Subscription Info:');
    console.log('   Tier:', analysis.metadata.subscription?.tier);
    console.log('   Historical Days:', analysis.metadata.subscription?.historicalDays);
    
    console.log('\n📊 Block Range:');
    console.log('   Start:', analysis.metadata.blockRange?.start);
    console.log('   End:', analysis.metadata.blockRange?.end);
    console.log('   Deployment:', analysis.metadata.blockRange?.deployment);
    console.log('   Total:', analysis.metadata.blockRange?.total);
  }
  
  console.log('\n❌ Problem: Analysis status is', analysis.status);
  console.log('   Error:', analysis.errorMessage);
  console.log('   Results:', analysis.results ? 'Has data' : 'NULL - No data!');
}

console.log('\n💡 Issue: Analysis failed, so no metrics to display');
console.log('   Need to re-run analysis successfully');
