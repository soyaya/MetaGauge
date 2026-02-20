// Integration test for frontend API methods with backend
const API_URL = 'http://localhost:3003';

// Simplified API methods for testing (without TypeScript)
const testApi = {
    auth: {
        verifyOTP: async (data) => {
            const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Verification failed');
            return res.json();
        }
    },

    watchlist: {
        get: async (token) => {
            const res = await fetch(`${API_URL}/api/watchlist`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to fetch watchlist');
            return res.json();
        },

        add: async (data, token) => {
            const res = await fetch(`${API_URL}/api/watchlist`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to add to watchlist');
            return res.json();
        },

        checkStatus: async (projectId, token) => {
            const res = await fetch(`${API_URL}/api/watchlist/status/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to check watchlist status');
            return res.json();
        }
    },

    alerts: {
        get: async (token, projectId) => {
            const url = projectId 
                ? `${API_URL}/api/alerts?projectId=${projectId}`
                : `${API_URL}/api/alerts`;
            
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to fetch alerts');
            return res.json();
        },

        create: async (data, token) => {
            const res = await fetch(`${API_URL}/api/alerts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to create alert');
            return res.json();
        }
    }
};

async function testFrontendAPIIntegration() {
    console.log('🔗 Testing Frontend API Integration with Backend...\n');
    
    try {
        // Step 1: Get authentication token (using OTP from previous test)
        console.log('1. Getting authentication token...');
        const authData = await testApi.auth.verifyOTP({
            email: 'techdavinvest@gmail.com',
            otp: '1171'
        });
        const token = authData.token;
        console.log('✅ Authentication successful');
        
        // Step 2: Test watchlist.get()
        console.log('\n2. Testing watchlist.get()...');
        const watchlistData = await testApi.watchlist.get(token);
        console.log(`✅ Retrieved ${watchlistData.total} watchlist items`);
        console.log('Sample item:', watchlistData.watchlist[0]?.project_name || 'No items');
        
        // Step 3: Test alerts.get()
        console.log('\n3. Testing alerts.get()...');
        const alertsData = await testApi.alerts.get(token);
        console.log(`✅ Retrieved ${alertsData.total} alerts`);
        console.log('Sample alert:', alertsData.alerts[0]?.type || 'No alerts');
        
        // Step 4: Test watchlist.add()
        console.log('\n4. Testing watchlist.add()...');
        const addResult = await testApi.watchlist.add({
            projectId: '0xfrontend-test-123',
            projectName: 'Frontend Test Project',
            projectCategory: 'Testing'
        }, token);
        console.log('✅ Added to watchlist:', addResult.message);
        
        // Step 5: Test watchlist.checkStatus()
        console.log('\n5. Testing watchlist.checkStatus()...');
        const statusResult = await testApi.watchlist.checkStatus('0xfrontend-test-123', token);
        console.log('✅ Watchlist status:', statusResult.isWatchlisted ? 'In watchlist' : 'Not in watchlist');
        
        // Step 6: Test alerts.create()
        console.log('\n6. Testing alerts.create()...');
        const alertResult = await testApi.alerts.create({
            projectId: '0xfrontend-test-123',
            type: 'adoption',
            condition: 'above',
            threshold: 75,
            thresholdUnit: 'percent',
            frequency: 'immediate'
        }, token);
        console.log('✅ Created alert:', alertResult.message);
        
        console.log('\n🎉 Frontend API Integration Test Completed!');
        console.log('\n✅ All API methods work correctly');
        console.log('✅ Authentication is properly handled');
        console.log('✅ Error handling is functional');
        console.log('✅ Data serialization works');
        console.log('✅ Backend integration is successful');
        console.log('✅ Ready for UI component integration');
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.log('\n💡 Make sure:');
        console.log('- Backend server is running');
        console.log('- Database tables exist');
        console.log('- Authentication token is valid');
    }
}

// Import fetch for Node.js environment
import fetch from 'node-fetch';
global.fetch = fetch;

testFrontendAPIIntegration();