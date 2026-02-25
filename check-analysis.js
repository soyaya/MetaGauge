#!/usr/bin/env node
import fetch from 'node-fetch';

const API = 'http://localhost:5000';

// Get the latest analysis
const analyses = await (await fetch(`${API}/api/analysis/history`, {
  headers: { Authorization: `Bearer ${process.argv[2]}` }
})).json();

if (!analyses || analyses.length === 0) {
  console.log('❌ No analyses found');
  process.exit(1);
}

const latest = analyses[0];
console.log('\n📊 Latest Analysis Results:\n');
console.log('Analysis ID:', latest.id);
console.log('Status:', latest.status);
console.log('Progress:', latest.progress, '%\n');

if (latest.results?.target) {
  const t = latest.results.target;
  console.log('Contract:', t.contract.name, `(${t.contract.address})`);
  console.log('Chain:', t.contract.chain);
  console.log('Transactions:', t.transactions);
  console.log('\n📈 Metrics:');
  console.log('  TVL:', t.metrics.tvl);
  console.log('  DAU:', t.metrics.dau);
  console.log('  MAU:', t.metrics.mau);
  console.log('  24h Volume:', t.metrics.transactionVolume24h);
  console.log('  Gas Efficiency:', t.metrics.gasEfficiency);
  console.log('  Liquidity Utilization:', t.metrics.liquidityUtilization, '%');
  
  console.log('\n👥 User Behavior:');
  console.log('  Whale Ratio:', t.behavior.whaleRatio, '%');
  console.log('  Retention (7d):', t.behavior.retentionRate7d, '%');
  console.log('  Retention (30d):', t.behavior.retentionRate30d, '%');
  console.log('  User Growth:', t.behavior.userGrowthRate, '%');
  
  console.log('\n🔍 Data Source:');
  if (t.transactions === 0) {
    console.log('  ⚠️  MOCK DATA - No real blockchain transactions fetched');
    console.log('  Reason: Likely using fallback/demo metrics');
  } else {
    console.log('  ✅ REAL DATA -', t.transactions, 'transactions analyzed');
  }
}

console.log('\n📋 Defined Metrics:', Object.keys(latest.results?.target?.metrics || {}).length);
console.log('📋 Behavior Metrics:', Object.keys(latest.results?.target?.behavior || {}).length);
console.log();
