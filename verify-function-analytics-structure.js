/**
 * Verify Function Analytics Data Structure
 */

import { FunctionAnalyticsService } from './src/services/FunctionAnalyticsService.js';
import { JourneyAnalyzerService } from './src/services/JourneyAnalyzerService.js';
import { CohortCalculatorService } from './src/services/CohortCalculatorService.js';

const contractAddress = '0x1234567890123456789012345678901234567890';
const chain = 'ethereum';

async function verifyDataStructure() {
  console.log('🔍 Verifying Function Analytics Data Structure\n');
  
  const analyticsService = new FunctionAnalyticsService();
  const journeyService = new JourneyAnalyzerService();
  const cohortService = new CohortCalculatorService();

  try {
    // Test 1: Get Function Signatures
    console.log('1️⃣  Testing getFunctionSignatures...');
    const signatures = await analyticsService.getFunctionSignatures(contractAddress, chain);
    console.log(`   ✅ Found ${signatures.length} signatures`);
    console.log('   Sample:', JSON.stringify(signatures[0], null, 2));

    // Test 2: Get Signature Metrics
    console.log('\n2️⃣  Testing getSignatureMetrics...');
    const metrics = await analyticsService.getSignatureMetrics(contractAddress, chain, signatures[0].signature);
    console.log('   ✅ Metrics:', JSON.stringify(metrics, null, 2));

    // Test 3: Get Signature Wallets
    console.log('\n3️⃣  Testing getSignatureWallets...');
    const wallets = await analyticsService.getSignatureWallets(contractAddress, chain, signatures[0].signature, null, { limit: 3, offset: 0 });
    console.log(`   ✅ Found ${wallets.total} wallets`);
    console.log('   Sample:', JSON.stringify(wallets.wallets[0], null, 2));

    // Test 4: Get Flow Visualization
    console.log('\n4️⃣  Testing generateFlowVisualization...');
    const flow = await journeyService.generateFlowVisualization(contractAddress, chain);
    console.log(`   ✅ Flow has ${flow.nodes.length} nodes and ${flow.edges.length} edges`);
    console.log('   Sample node:', JSON.stringify(flow.nodes[0], null, 2));
    console.log('   Sample edge:', JSON.stringify(flow.edges[0], null, 2));

    // Test 5: Get Cohort Activation
    console.log('\n5️⃣  Testing calculateActivation...');
    const activation = await cohortService.calculateActivation(contractAddress, chain, null, 'monthly');
    console.log(`   ✅ Found ${activation.length} cohorts`);
    console.log('   Sample:', JSON.stringify(activation[0], null, 2));

    // Test 6: Get Cohort Retention
    console.log('\n6️⃣  Testing calculateRetention...');
    const retention = await cohortService.calculateRetention(contractAddress, chain, null, 'monthly');
    console.log(`   ✅ Found ${retention.length} cohorts`);
    console.log('   Sample:', JSON.stringify(retention[0], null, 2));

    // Test 7: Get Cohort Churn
    console.log('\n7️⃣  Testing calculateChurn...');
    const churn = await cohortService.calculateChurn(contractAddress, chain, null, 'monthly');
    console.log(`   ✅ Found ${churn.length} cohorts`);
    console.log('   Sample:', JSON.stringify(churn[0], null, 2));

    console.log('\n✅ All data structures verified successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Signatures: ${signatures.length}`);
    console.log(`   - Flow Nodes: ${flow.nodes.length}`);
    console.log(`   - Flow Edges: ${flow.edges.length}`);
    console.log(`   - Cohorts: ${activation.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyDataStructure();
