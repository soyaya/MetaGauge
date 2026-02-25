/**
 * Populate Function Analytics Test Data
 * Creates sample data to verify the data structure
 */

import { FunctionAnalyticsStorage } from './src/services/FunctionAnalyticsStorage.js';

const storage = new FunctionAnalyticsStorage();

// Sample contract
const contractAddress = '0x1234567890123456789012345678901234567890';
const chain = 'ethereum';

// Generate sample interactions
const generateSampleData = () => {
  const signatures = [
    '0xa9059cbb', // transfer
    '0x23b872dd', // transferFrom
    '0x095ea7b3', // approve
    '0x70a08231', // balanceOf
    '0x18160ddd'  // totalSupply
  ];

  const wallets = [
    '0xaaa1111111111111111111111111111111111111',
    '0xbbb2222222222222222222222222222222222222',
    '0xccc3333333333333333333333333333333333333',
    '0xddd4444444444444444444444444444444444444',
    '0xeee5555555555555555555555555555555555555'
  ];

  const interactions = [];
  let blockNumber = 1000000;
  let txCounter = 0;

  // Generate interactions over 90 days
  const startDate = new Date('2024-01-01');
  
  for (let day = 0; day < 90; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);

    // Random number of interactions per day (5-20)
    const dailyInteractions = 5 + Math.floor(Math.random() * 15);

    for (let i = 0; i < dailyInteractions; i++) {
      const wallet = wallets[Math.floor(Math.random() * wallets.length)];
      const signature = signatures[Math.floor(Math.random() * signatures.length)];
      
      // Add some hours/minutes to spread throughout the day
      const timestamp = new Date(date);
      timestamp.setHours(Math.floor(Math.random() * 24));
      timestamp.setMinutes(Math.floor(Math.random() * 60));

      interactions.push({
        walletAddress: wallet,
        signature: signature,
        timestamp: timestamp.toISOString(),
        transactionHash: `0x${txCounter.toString(16).padStart(64, '0')}`,
        blockNumber: blockNumber++,
        gasUsed: 21000 + Math.floor(Math.random() * 50000),
        value: '0'
      });

      txCounter++;
    }
  }

  return interactions;
};

async function populateData() {
  try {
    console.log('Generating sample function signature data...');
    
    const interactions = generateSampleData();
    
    console.log(`Generated ${interactions.length} interactions`);
    console.log(`Date range: ${interactions[0].timestamp} to ${interactions[interactions.length - 1].timestamp}`);
    
    // Save interactions
    await storage.saveInteractions(contractAddress, chain, interactions);
    
    console.log('✅ Data saved successfully!');
    
    // Verify data
    const saved = await storage.getInteractions(contractAddress, chain);
    console.log(`✅ Verified: ${saved.length} interactions stored`);
    
    // Show summary
    const uniqueWallets = new Set(saved.map(i => i.walletAddress)).size;
    const uniqueSignatures = new Set(saved.map(i => i.signature)).size;
    
    console.log('\nSummary:');
    console.log(`- Total Interactions: ${saved.length}`);
    console.log(`- Unique Wallets: ${uniqueWallets}`);
    console.log(`- Unique Signatures: ${uniqueSignatures}`);
    console.log(`- Contract: ${contractAddress}`);
    console.log(`- Chain: ${chain}`);
    
    console.log('\nYou can now test the API with:');
    console.log(`GET /api/functions/signatures?contractAddress=${contractAddress}&chain=${chain}`);
    
  } catch (error) {
    console.error('Error populating data:', error);
    process.exit(1);
  }
}

populateData();
