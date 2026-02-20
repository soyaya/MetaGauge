import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
const contract = user.onboarding.defaultContract;

console.log('📊 Contract Data:');
console.log('   isIndexed:', contract.isIndexed);
console.log('   indexingProgress:', contract.indexingProgress);
console.log('   lastAnalysisId:', contract.lastAnalysisId);

if (contract.lastAnalysisId) {
  const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);
  console.log('\n📝 Analysis Data:');
  console.log('   status:', analysis.status);
  console.log('   progress:', analysis.progress);
  console.log('   errorMessage:', analysis.errorMessage);
  console.log('   results:', analysis.results ? 'exists' : 'null');
  
  if (analysis.results) {
    console.log('\n📈 Results:');
    console.log(JSON.stringify(analysis.results, null, 2));
  }
}
