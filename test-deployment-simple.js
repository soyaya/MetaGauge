/**
 * Simple test to find deployment block using block explorer
 */

async function findDeploymentBlock() {
  const contractAddress = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
  
  console.log(`🔍 Finding deployment block for: ${contractAddress}\n`);
  
  try {
    // Try to get contract creation info from Blockscout
    console.log('📡 Querying Lisk Blockscout API...');
    const response = await fetch(
      `https://blockscout.lisk.com/api/v2/addresses/${contractAddress}`
    );
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('\n📋 Contract Info:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.creation_tx_hash) {
      console.log(`\n🔗 Creation TX: ${data.creation_tx_hash}`);
      
      // Get transaction details
      const txResponse = await fetch(
        `https://blockscout.lisk.com/api/v2/transactions/${data.creation_tx_hash}`
      );
      
      if (txResponse.ok) {
        const txData = await txResponse.json();
        console.log(`\n✅ Deployment Block: ${txData.block}`);
        console.log(`📅 Timestamp: ${txData.timestamp}`);
        return parseInt(txData.block);
      }
    }
    
    // If no creation_tx_hash, get first transaction
    console.log('\n📡 Getting first transaction...');
    const txListResponse = await fetch(
      `https://blockscout.lisk.com/api/v2/addresses/${contractAddress}/transactions?limit=1`
    );
    
    if (txListResponse.ok) {
      const txList = await txListResponse.json();
      if (txList.items && txList.items.length > 0) {
        const firstTx = txList.items[0];
        console.log(`\n✅ First Transaction Block: ${firstTx.block}`);
        console.log(`📅 Timestamp: ${firstTx.timestamp}`);
        return parseInt(firstTx.block);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

findDeploymentBlock();
