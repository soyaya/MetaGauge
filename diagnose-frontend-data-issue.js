#!/usr/bin/env node

/**
 * Diagnose Frontend Data Fetching Issue
 * Checks why dashboard isn't showing data after onboarding
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('\n🔍 FRONTEND DATA FETCHING DIAGNOSTIC');
console.log('='.repeat(70));

console.log('\n📋 ISSUE: User completed onboarding but dashboard shows no data\n');

console.log('🔎 CHECKING POTENTIAL CAUSES:\n');

console.log('1️⃣  ONBOARDING FLOW:');
console.log('   ✅ User fills onboarding form');
console.log('   ✅ POST /api/onboarding/complete');
console.log('   ✅ Creates contract config');
console.log('   ✅ Calls startDefaultContractIndexing()');
console.log('   ✅ Creates analysis record');
console.log('   ✅ Starts performDefaultContractAnalysis()');
console.log('   ⚠️  Uses EnhancedAnalyticsEngine (NOT OptimizedQuickScan)');

console.log('\n2️⃣  DATA FETCHING FLOW:');
console.log('   ✅ Dashboard loads');
console.log('   ✅ Calls GET /api/onboarding/default-contract');
console.log('   ✅ Returns: contract, metrics, fullResults, indexingStatus');
console.log('   ❓ Metrics come from: latestAnalysis.results.target.metrics');

console.log('\n3️⃣  POTENTIAL ISSUES:');
console.log('   ⚠️  Issue #1: EnhancedAnalyticsEngine might be slow/failing');
console.log('   ⚠️  Issue #2: Analysis might timeout (5 min limit)');
console.log('   ⚠️  Issue #3: Quick-scan route NOT used during onboarding');
console.log('   ⚠️  Issue #4: Frontend polling might stop too early');
console.log('   ⚠️  Issue #5: Analysis might complete but metrics are null');

console.log('\n4️⃣  WHAT SHOULD HAPPEN:');
console.log('   1. Onboarding completes → indexingProgress: 10%');
console.log('   2. Analysis starts → indexingProgress: 30%');
console.log('   3. Contract analyzed → indexingProgress: 80%');
console.log('   4. Results saved → indexingProgress: 100%, isIndexed: true');
console.log('   5. Dashboard fetches → Shows metrics from analysis results');

console.log('\n5️⃣  RECOMMENDED FIXES:\n');

console.log('   FIX #1: Use OptimizedQuickScan instead of EnhancedAnalyticsEngine');
console.log('   ---------------------------------------------------------------');
console.log('   Current: EnhancedAnalyticsEngine (slow, complex)');
console.log('   Better:  OptimizedQuickScan (60-90 seconds, proven)');
console.log('   File:    src/api/routes/onboarding.js');
console.log('   Line:    ~1170 (performDefaultContractAnalysis function)');
console.log('');
console.log('   Change from:');
console.log('   ```javascript');
console.log('   const engine = new EnhancedAnalyticsEngine(config.rpcConfig);');
console.log('   const targetResults = await engine.analyzeContract(...);');
console.log('   ```');
console.log('');
console.log('   Change to:');
console.log('   ```javascript');
console.log('   const fetcher = new SmartContractFetcher({');
console.log('     maxRequestsPerSecond: 10,');
console.log('     failoverTimeout: 60000');
console.log('   });');
console.log('   const quickScan = new OptimizedQuickScan(fetcher, {');
console.log('     onProgress: async (progressData) => {');
console.log('       await progressReporter.updateProgress(');
console.log('         progressData.progress / 12.5, // Scale 0-100 to 0-8 steps');
console.log('         progressData.message');
console.log('       );');
console.log('     }');
console.log('   });');
console.log('   const results = await quickScan.quickScan(');
console.log('     config.targetContract.address,');
console.log('     config.targetContract.chain');
console.log('   );');
console.log('   ```');

console.log('\n   FIX #2: Add better error handling and logging');
console.log('   ----------------------------------------------');
console.log('   - Log analysis start/completion to console');
console.log('   - Catch and display errors in frontend');
console.log('   - Add retry mechanism for failed analyses');

console.log('\n   FIX #3: Improve frontend polling');
console.log('   ---------------------------------');
console.log('   - Poll more frequently (every 2-3 seconds)');
console.log('   - Show actual progress from backend');
console.log('   - Display error messages if analysis fails');
console.log('   - Add manual refresh button');

console.log('\n6️⃣  IMMEDIATE DEBUGGING STEPS:\n');

console.log('   Step 1: Check if analysis completed');
console.log('   ------------------------------------');
console.log('   Look in: ./data/analyses/');
console.log('   Check: Latest analysis file for your user');
console.log('   Verify: status === "completed" and results exist');

console.log('\n   Step 2: Check user onboarding data');
console.log('   -----------------------------------');
console.log('   Look in: ./data/users/');
console.log('   Check: Your user file');
console.log('   Verify: onboarding.defaultContract.isIndexed === true');
console.log('   Verify: onboarding.defaultContract.lastAnalysisId exists');

console.log('\n   Step 3: Check backend logs');
console.log('   --------------------------');
console.log('   Run: npm run dev');
console.log('   Watch for: "Starting default contract indexing"');
console.log('   Watch for: "Analysis completed successfully"');
console.log('   Watch for: Any error messages');

console.log('\n   Step 4: Test quick-scan directly');
console.log('   ---------------------------------');
console.log('   Run: node test-quick-scan-performance.js');
console.log('   This will test if quick-scan works independently');

console.log('\n7️⃣  QUICK FIX TO TEST NOW:\n');

console.log('   Option A: Manually trigger quick-scan from dashboard');
console.log('   -----------------------------------------------------');
console.log('   1. Login to dashboard');
console.log('   2. Click "Refresh Data" or "Quick Sync" button');
console.log('   3. This will use the working quick-scan route');
console.log('   4. Data should appear in 60-90 seconds');

console.log('\n   Option B: Use API directly');
console.log('   --------------------------');
console.log('   curl -X POST http://localhost:5000/api/analysis/quick-scan \\');
console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"contractAddress":"0x...","chain":"lisk","contractName":"USDT"}\'');

console.log('\n' + '='.repeat(70));
console.log('✅ DIAGNOSTIC COMPLETE');
console.log('='.repeat(70));

console.log('\n💡 SUMMARY:');
console.log('   Problem: Onboarding uses EnhancedAnalyticsEngine (slow/complex)');
console.log('   Solution: Switch to OptimizedQuickScan (fast/proven)');
console.log('   Impact:  Data will load in 60-90 seconds instead of timing out');
console.log('');
console.log('   Quick Test: Click "Refresh Data" button in dashboard');
console.log('   Long-term: Update onboarding.js to use OptimizedQuickScan\n');

process.exit(0);
