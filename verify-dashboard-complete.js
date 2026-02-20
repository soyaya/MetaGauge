import { UserStorage, AnalysisStorage } from './src/api/database/index.js';

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
const contract = user.onboarding.defaultContract;
const analysis = await AnalysisStorage.findById(contract.lastAnalysisId);

console.log('✅ DASHBOARD DATA VERIFICATION\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📋 CONTRACT INFO:');
console.log('   Name:', contract.name);
console.log('   Category:', contract.category.toUpperCase(), '•', contract.chain);
console.log('   Address:', contract.address.slice(0, 10) + '...');
console.log('   Purpose:', contract.purpose.slice(0, 50) + '...');
console.log('   Started:', new Date(contract.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
console.log('   Deployment Block:', contract.deploymentBlock.toLocaleString());

console.log('\n📦 SUBSCRIPTION:');
console.log('   Tier:', analysis.metadata.subscription.tier);
console.log('   Historical Data:', analysis.metadata.subscription.historicalDays, 'days');

console.log('\n📊 BLOCK RANGE:');
console.log('   Blocks Indexed:', analysis.metadata.blockRange.total.toLocaleString());
console.log('   Block Range:', analysis.metadata.blockRange.start.toLocaleString(), '→', analysis.metadata.blockRange.end.toLocaleString());

console.log('\n✅ STATUS:');
console.log('   Indexed:', contract.isIndexed ? 'Yes' : 'No');
console.log('   Progress:', contract.indexingProgress + '%');
console.log('   Analysis:', analysis.status);

console.log('\n📈 METRICS:');
console.log('   Transactions:', analysis.results.target.transactions);
console.log('   Unique Users:', analysis.results.target.metrics.uniqueUsers);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All data ready for dashboard!');
