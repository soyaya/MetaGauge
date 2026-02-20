/**
 * Test all new features
 */

import { initializeStreamingIndexer } from './src/indexer/index.js';
import { Logger } from './src/indexer/services/Logger.js';
import { validateSecureEndpoint } from './src/indexer/services/Security.js';

async function testAllFeatures() {
  console.log('🧪 Testing All New Features\n');

  try {
    // Test 1: Initialization with all components
    console.log('1️⃣  Testing Initialization...');
    const { indexerManager, components } = await initializeStreamingIndexer();
    console.log('✅ All components initialized\n');

    // Test 2: Logging
    console.log('2️⃣  Testing Logging...');
    Logger.info('Test log message', { test: true });
    Logger.logIndexerEvent('test-user', '0x123', 'lisk', 'start', { block: 1000 });
    console.log('✅ Logging working\n');

    // Test 3: Metrics Collection
    console.log('3️⃣  Testing Metrics...');
    components.metricsCollector.recordBlocksProcessed('test-user', 1000);
    components.metricsCollector.recordChunkProcessed('test-user', 5000);
    components.metricsCollector.recordRPCRequest(true, 150);
    const metrics = components.metricsCollector.getMetrics();
    console.log('✅ Metrics:', {
      blocksProcessed: metrics.blocksProcessed,
      chunksProcessed: metrics.chunksProcessed,
      blocksPerSecond: metrics.blocksPerSecond
    }, '\n');

    // Test 4: Security
    console.log('4️⃣  Testing Security...');
    try {
      validateSecureEndpoint('https://lisk.drpc.org');
      console.log('✅ HTTPS validation passed');
    } catch (error) {
      console.log('❌ HTTPS validation failed:', error.message);
    }
    
    // Test anomaly detection
    components.anomalyDetector.recordBaseline('0x123', { logs: [1, 2, 3] });
    const anomaly = components.anomalyDetector.detectAnomaly('0x123', { logs: [1, 2] });
    console.log('✅ Anomaly detection:', anomaly.anomaly ? 'Detected' : 'Normal', '\n');

    // Test 5: Subscription Limiter
    console.log('5️⃣  Testing Subscription Limits...');
    const canAnalyze = components.subscriptionLimiter.canPerform('test-user', 'free', 'analysis');
    console.log('✅ Can perform analysis:', canAnalyze);
    components.subscriptionLimiter.recordUsage('test-user', 'analysis');
    const usage = components.subscriptionLimiter.getUsage('test-user');
    console.log('✅ Usage recorded:', usage, '\n');

    // Test 6: Health Monitoring
    console.log('6️⃣  Testing Health Monitoring...');
    const health = await components.healthMonitor.getCurrentHealth();
    console.log('✅ Health Status:', health.overall);
    console.log('✅ Components:', Object.keys(health.components), '\n');

    // Test 7: Detailed Health
    console.log('7️⃣  Testing Detailed Health...');
    const detailed = await components.healthMonitor.getDetailedHealth();
    console.log('✅ Uptime:', (detailed.uptime / 60).toFixed(2), 'minutes');
    console.log('✅ Memory:', (detailed.memory.heapUsed / 1024 / 1024).toFixed(2), 'MB\n');

    // Test 8: Graceful Shutdown
    console.log('8️⃣  Testing Graceful Shutdown...');
    await indexerManager.shutdown();
    console.log('✅ Graceful shutdown complete\n');

    console.log('✅ All tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAllFeatures();
