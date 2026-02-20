import { ethers } from 'ethers';

const address = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
const rpcUrl = 'https://lisk.drpc.org';

console.log('🔍 Finding deployment block for:', address);

try {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const currentBlock = await provider.getBlockNumber();
  console.log('Current block:', currentBlock);
  
  // Binary search for deployment
  let low = 0;
  let high = currentBlock;
  let deploymentBlock = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const code = await provider.getCode(address, mid);
    
    if (code === '0x') {
      low = mid + 1;
    } else {
      deploymentBlock = mid;
      high = mid - 1;
    }
  }
  
  console.log('✅ Deployment block:', deploymentBlock);
} catch (error) {
  console.error('❌ Error:', error.message);
}
