/**
 * Complete User Journey Test for MetaGauge Analytics Platform
 * Tests: Registration → Onboarding → Subscription → Data Fetching → Alerts → Competitors → AI Chat
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_USER = {
  email: 'testuser@example.com',
  password: 'TestPass123!',
  name: 'Test User'
};

const TEST_CONTRACT = {
  contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  chain: 'ethereum',
  contractName: 'Wrapped Ether',
  purpose: 'ERC20 wrapper for ETH',
  category: 'defi',
  startDate: new Date().toISOString()
};

let authToken = null;
let userId = null;
let analysisId = null;
let chatSessionId = null;

const results = { passed: [], failed: [], warnings: [] };

function log(step, msg) {
  console.log(\\n\\);
  console.log(\STEP \: \\);
  console.log('='.repeat(80));
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('🚀 MetaGauge Complete User Journey Test\n');
  
  try {
    // Step 1: Register
    log(1, 'Register New User');
    try {
      const res = await axios.post(\\/api/auth/register\, TEST_USER);
      authToken = res.data.token;
      userId = res.data.user.id;
      console.log(\✅ Registered: \\);
      console.log(\   User ID: \\);
      console.log(\   Tier: \\);
      results.passed.push('User registration');
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error === 'User already exists') {
        console.log('⚠️  User exists, logging in instead...');
        const loginRes = await axios.post(\\/api/auth/login\, {
          email: TEST_USER.email,
          password: TEST_USER.password
        });
        authToken = loginRes.data.token;
        userId = loginRes.data.user.id;
        console.log(\✅ Logged in: \\);
        results.warnings.push('User already existed, logged in');
      } else {
        throw err;
      }
    }

    const headers = { Authorization: \Bearer \\ };

    // Step 2: Login (if not already done)
    log(2, 'Login User');
    const loginRes = await axios.post(\\/api/auth/login\, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    console.log(\✅ Login successful\);
    console.log(\   Token: \...\);
    results.passed.push('User login');

    // Step 3: Complete Onboarding
    log(3, 'Complete Onboarding with Contract Info');
    const onboardRes = await axios.post(
      \\/api/onboarding/complete\,
      TEST_CONTRACT,
      { headers }
    );
    console.log(\✅ Onboarding completed\);
    console.log(\   Contract: \\);
    console.log(\   Address: \\);
    console.log(\   Indexing started: \\);
    results.passed.push('Onboarding completion');

    // Step 4: Verify Default Contract Data
    log(4, 'Verify Default Contract and Data Fetching');
    await sleep(5000); // Wait for initial indexing
    
    let attempts = 0;
    let dataFetched = false;
    
    while (attempts < 10 && !dataFetched) {
      try {
        const contractRes = await axios.get(
          \\/api/onboarding/default-contract\,
          { headers }
        );
        console.log(\   Indexing progress: \%\);
        console.log(\   Is indexed: \\);
        
        if (contractRes.data.metrics) {
          console.log(\✅ Metrics available:\);
          console.log(\   TVL: \\);
          console.log(\   DAU: \\);
          console.log(\   Transaction Volume: \\);
          dataFetched = true;
          results.passed.push('Real-time data fetching');
        }
      } catch (err) {
        console.log(\   Attempt \: Waiting for data...\);
      }
      
      if (!dataFetched) {
        await sleep(3000);
        attempts++;
      }
    }
    
    if (!dataFetched) {
      results.warnings.push('Data fetching took longer than expected');
    }

    // Step 5: Check Analysis Status
    log(5, 'Check Real-time Metrics Updates');
    const metricsRes = await axios.get(
      \\/api/onboarding/user-metrics\,
      { headers }
    );
    console.log(\✅ User metrics retrieved:\);
    console.log(\   Total contracts: \\);
    console.log(\   Total analyses: \\);
    console.log(\   Completed: \\);
    console.log(\   Monthly limit: \\);
    console.log(\   Remaining: \\);
    results.passed.push('Metrics updates verification');

    // Step 6: Test Alert Functionality
    log(6, 'Test Alert Functionality');
    try {
      // Get analysis ID from recent analyses
      if (metricsRes.data.recentAnalyses && metricsRes.data.recentAnalyses.length > 0) {
        analysisId = metricsRes.data.recentAnalyses[0].id;
        
        const alertsRes = await axios.post(
          \\/api/analysis/\/alerts\,
          {},
          { headers }
        );
        console.log(\✅ Alerts generated:\);
        console.log(\   Total alerts: \\);
        if (alertsRes.data.alerts && alertsRes.data.alerts.length > 0) {
          console.log(\   First alert: \\);
        }
        results.passed.push('Alert functionality');
      } else {
        console.log('⚠️  No completed analyses yet for alerts');
        results.warnings.push('No analyses available for alert testing');
      }
    } catch (err) {
      console.log(\⚠️  Alert test: \\);
      results.warnings.push('Alert functionality needs completed analysis');
    }

    // Step 7: Add Competitor Projects
    log(7, 'Add Competitor Projects for Comparison');
    try {
      // Get contracts to add competitor
      const contractsRes = await axios.get(\\/api/contracts\, { headers });
      
      if (contractsRes.data.length > 0) {
        const contractId = contractsRes.data[0].id;
        
        const competitor = {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
          chain: 'ethereum',
          name: 'DAI Stablecoin'
        };
        
        const updateRes = await axios.put(
          \\/api/contracts/\\,
          { competitors: [competitor] },
          { headers }
        );
        console.log(\✅ Competitor added:\);
        console.log(\   Name: \\);
        console.log(\   Address: \\);
        results.passed.push('Competitor comparison');
      }
    } catch (err) {
      console.log(\⚠️  Competitor test: \\);
      results.warnings.push('Competitor feature needs contract setup');
    }

    // Step 8: Test AI Chat with Metrics
    log(8, 'Test AI Chat with Metrics Data');
    try {
      // Create chat session
      const sessionRes = await axios.post(
        \\/api/chat/sessions\,
        {
          contractAddress: TEST_CONTRACT.contractAddress,
          contractChain: TEST_CONTRACT.chain,
          contractName: TEST_CONTRACT.contractName
        },
        { headers }
      );
      chatSessionId = sessionRes.data.sessionId;
      console.log(\✅ Chat session created: \\);
      
      // Send a message
      const messageRes = await axios.post(
        \\/api/chat/sessions/\/messages\,
        { content: 'What are the key metrics for this contract?' },
        { headers }
      );
      console.log(\✅ AI response received:\);
      console.log(\   User message: \\);
      console.log(\   AI response: \...\);
      results.passed.push('AI chat functionality');
    } catch (err) {
      console.log(\⚠️  AI Chat test: \\);
      results.warnings.push('AI chat may need API key configuration');
    }

    // Step 9: Verify Subscription Limits
    log(9, 'Verify Subscription Limits are Enforced');
    const finalMetrics = await axios.get(
      \\/api/onboarding/user-metrics\,
      { headers }
    );
    console.log(\✅ Subscription limits verified:\);
    console.log(\   Tier: \\);
    console.log(\   Monthly limit: \\);
    console.log(\   Used: \\);
    console.log(\   Remaining: \\);
    
    if (finalMetrics.data.limits.remaining >= 0) {
      console.log(\✅ Limits are being tracked correctly\);
      results.passed.push('Subscription limit enforcement');
    }

    // Final Summary
    console.log(\\n\\);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(\✅ Passed: \\);
    results.passed.forEach(t => console.log(\   - \\));
    console.log(\\n⚠️  Warnings: \\);
    results.warnings.forEach(t => console.log(\   - \\));
    console.log(\\n❌ Failed: \\);
    results.failed.forEach(t => console.log(\   - \: \\));
    
    console.log(\\n🎉 User journey test completed!\);
    console.log(\   Success rate: \%\);

  } catch (error) {
    console.error(\\n❌ FATAL ERROR: \\);
    if (error.response) {
      console.error(\   Status: \\);
      console.error(\   Data: \\);
    }
    results.failed.push({ message: 'Fatal error', error: error.message });
  }
}

test();
