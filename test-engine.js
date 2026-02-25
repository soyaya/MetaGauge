#!/usr/bin/env node
import { EnhancedAnalyticsEngine } from './src/services/EnhancedAnalyticsEngine.js';

console.log('\n🔬 Direct Analytics Engine Test\n');

const engine = new EnhancedAnalyticsEngine();
const CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC

try {
  const result = await engine.analyzeContract(CONTRACT, 'ethereum', 'USDC', 100);
  
  console.log('\n📊 Results:');
  console.log('  Transactions:', result.transactions);
  console.log('  Method:', result.fetchMethod);
  console.log('  Error:', result.error || 'None');
  console.log('  TVL:', result.metrics?.tvl);
  console.log('  DAU:', result.metrics?.dau);
  
} catch (error) {
  console.log('\n❌ Error:', error.message);
  console.log(error.stack);
}
