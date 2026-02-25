/**
 * Add test contract with ABI to database
 */

import fs from 'fs/promises';

const contractAddress = '0x1234567890123456789012345678901234567890';
const chain = 'ethereum';

// Sample ERC-20 ABI
const erc20ABI = [
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {"name": "from", "type": "address"},
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{"name": "account", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  }
];

async function addTestContract() {
  try {
    // Read existing contracts
    let contracts = [];
    try {
      const data = await fs.readFile('./data/contracts.json', 'utf-8');
      contracts = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, start with empty array
    }

    // Check if contract already exists
    const existing = contracts.findIndex(c => 
      c && c.address && c.chain &&
      c.address.toLowerCase() === contractAddress.toLowerCase() && 
      c.chain.toLowerCase() === chain.toLowerCase()
    );

    const contract = {
      address: contractAddress,
      chain: chain,
      name: 'Test ERC-20 Token',
      abi: erc20ABI,
      createdAt: new Date().toISOString()
    };

    if (existing >= 0) {
      contracts[existing] = contract;
      console.log('✅ Updated existing contract');
    } else {
      contracts.push(contract);
      console.log('✅ Added new contract');
    }

    // Save contracts
    await fs.writeFile('./data/contracts.json', JSON.stringify(contracts, null, 2));
    
    console.log(`✅ Contract ${contractAddress} saved with ABI`);
    console.log(`   Functions: ${erc20ABI.map(f => f.name).join(', ')}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addTestContract();
