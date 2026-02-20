import { AnalysisStorage, UserStorage } from './src/api/database/index.js';

const user = await UserStorage.findByEmail('davidlovedavid1015@gmail.com');
const analysis = await AnalysisStorage.findById(user.onboarding.defaultContract.lastAnalysisId);

console.log('Analysis metadata:', JSON.stringify(analysis.metadata, null, 2));
console.log('\nDeployment block:', analysis.metadata?.blockRange?.deployment);
