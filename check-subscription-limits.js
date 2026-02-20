import subscriptionService from './src/services/SubscriptionService.js';

console.log('📊 Checking Subscription Limits from Smart Contract\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  // Get all plan details from smart contract
  const plans = await subscriptionService.getAllPlans();
  
  for (const [tier, plan] of Object.entries(plans)) {
    const tierNames = ['Free', 'Starter', 'Pro', 'Enterprise'];
    console.log(`\n${tierNames[tier]} Tier (${tier}):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n📦 Features:');
    console.log('   API Calls/Month:', plan.features.apiCallsPerMonth.toLocaleString());
    console.log('   Max Projects:', plan.features.maxProjects);
    console.log('   Max Alerts:', plan.features.maxAlerts);
    console.log('   Export Access:', plan.features.exportAccess ? '✓' : '✗');
    console.log('   Comparison Tool:', plan.features.comparisonTool ? '✓' : '✗');
    console.log('   Wallet Intelligence:', plan.features.walletIntelligence ? '✓' : '✗');
    console.log('   API Access:', plan.features.apiAccess ? '✓' : '✗');
    console.log('   Priority Support:', plan.features.prioritySupport ? '✓' : '✗');
    console.log('   Custom Insights:', plan.features.customInsights ? '✓' : '✗');
    
    console.log('\n📊 Limits:');
    console.log('   Historical Data:', plan.limits.historicalData === -1 ? 'All history' : `${plan.limits.historicalData} days`);
    console.log('   Team Members:', plan.limits.teamMembers);
    console.log('   Data Refresh Rate:', plan.limits.dataRefreshRate, 'hours');
    
    console.log('\n💰 Pricing:');
    console.log('   Monthly:', plan.monthlyPrice, 'ETH');
    console.log('   Yearly:', plan.yearlyPrice, 'ETH');
  }
  
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 HOW LIMITS MAP TO USAGE:\n');
  
  console.log('1. Historical Data → Block Range to Index');
  console.log('   Free: 7 days = ~302,400 blocks');
  console.log('   Pro: 90 days = ~3,888,000 blocks');
  console.log('   Enterprise: All history = From deployment');
  
  console.log('\n2. API Calls/Month → Analysis Budget');
  console.log('   Each analysis = ~100-500 RPC calls');
  console.log('   Pro: 5,000 calls = ~10-50 analyses/month');
  
  console.log('\n3. Max Projects → Contracts You Can Track');
  console.log('   Pro: 10 contracts simultaneously');
  
  console.log('\n4. Max Alerts → Alert Configurations');
  console.log('   Pro: 50 custom alert rules');
  
  console.log('\n5. Data Refresh → Re-indexing Frequency');
  console.log('   Pro: Every 6 hours = 4x per day');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
