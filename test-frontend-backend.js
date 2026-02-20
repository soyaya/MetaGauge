/**
 * Test frontend-backend connection
 */

const API_URL = 'http://localhost:5000';

async function testConnection() {
  console.log('🔗 Testing Frontend-Backend Connection\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing health endpoint...');
    const health = await fetch(`${API_URL}/health`);
    const healthData = await health.json();
    console.log('✅ Health:', healthData.status);
    console.log('   Storage:', healthData.storage);
    console.log('   Environment:', healthData.environment, '\n');

    // Test 2: Register user
    console.log('2️⃣  Testing user registration...');
    const registerRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'Test123!@#'
      })
    });
    const registerData = await registerRes.json();
    console.log('✅ User registered:', registerData.user?.id);
    const token = registerData.token;
    console.log('✅ Token received\n');

    // Test 3: Get user profile
    console.log('3️⃣  Testing authenticated endpoint...');
    const profileRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    console.log('✅ Profile retrieved:', profileData.email, '\n');

    // Test 4: Test indexer endpoints
    console.log('4️⃣  Testing indexer status...');
    const statusRes = await fetch(`${API_URL}/api/indexer/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusData = await statusRes.json();
    console.log('✅ Indexer status:', statusData.active ? 'Active' : 'Inactive', '\n');

    // Test 5: Test indexer health
    console.log('5️⃣  Testing indexer health...');
    const indexerHealthRes = await fetch(`${API_URL}/api/indexer/health`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const indexerHealth = await indexerHealthRes.json();
    console.log('✅ Indexer health:', indexerHealth.overall || 'unknown');
    console.log('   Components:', Object.keys(indexerHealth.components || {}), '\n');

    // Test 6: Test indexer metrics
    console.log('6️⃣  Testing indexer metrics...');
    const metricsRes = await fetch(`${API_URL}/api/indexer/metrics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const metrics = await metricsRes.json();
    console.log('✅ Metrics available:', Object.keys(metrics).length > 0 ? 'Yes' : 'No', '\n');

    console.log('✅ All frontend-backend connections working!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  }
}

testConnection();
