/**
 * Etherscan Comparison Utility
 * Compares our RPC data with Etherscan API to verify accuracy
 */

import dotenv from 'dotenv';
dotenv.config();

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_API_URL = 'https://api.etherscan.io/v2/api';

export class EtherscanComparator {
  constructor(apiKey = ETHERSCAN_API_KEY, chainId = 1) {
    this.apiKey = apiKey;
    this.chainId = chainId;
  }

  async _call(params) {
    const url = new URL(ETHERSCAN_API_URL);
    url.search = new URLSearchParams({
      chainid: this.chainId,
      ...params,
      apikey: this.apiKey
    }).toString();

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '0' || data.message === 'NOTOK') {
      throw new Error(`Etherscan API error: ${data.result || data.message}`);
    }

    return data.result;
  }

  /**
   * Get transaction count for an address
   */
  async getTransactionCount(address) {
    return await this._call({
      module: 'proxy',
      action: 'eth_getTransactionCount',
      address,
      tag: 'latest'
    });
  }

  /**
   * Get normal transactions for an address
   */
  async getTransactions(address, startBlock = 0, endBlock = 99999999) {
    return await this._call({
      module: 'account',
      action: 'txlist',
      address,
      startblock: startBlock,
      endblock: endBlock,
      sort: 'desc'
    });
  }

  /**
   * Get internal transactions
   */
  async getInternalTransactions(address, startBlock = 0, endBlock = 99999999) {
    return await this._call({
      module: 'account',
      action: 'txlistinternal',
      address,
      startblock: startBlock,
      endblock: endBlock,
      sort: 'desc'
    });
  }

  /**
   * Get ERC20 token transfers
   */
  async getTokenTransfers(address, startBlock = 0, endBlock = 99999999) {
    return await this._call({
      module: 'account',
      action: 'tokentx',
      address,
      startblock: startBlock,
      endblock: endBlock,
      sort: 'desc'
    });
  }

  /**
   * Get contract ABI
   */
  async getContractABI(address) {
    return await this._call({
      module: 'contract',
      action: 'getabi',
      address
    });
  }

  /**
   * Get contract source code
   */
  async getContractSource(address) {
    return await this._call({
      module: 'contract',
      action: 'getsourcecode',
      address
    });
  }

  /**
   * Compare our RPC data with Etherscan
   */
  async compareTransactionData(address, ourData) {
    console.log(`\n🔍 Comparing data for ${address}...\n`);

    try {
      // Get Etherscan data
      const etherscanTxs = await this.getTransactions(address);
      const etherscanTokenTxs = await this.getTokenTransfers(address);

      // Compare counts
      console.log('📊 Transaction Counts:');
      console.log(`   Our RPC:    ${ourData.transactions?.length || 0} transactions`);
      console.log(`   Etherscan:  ${etherscanTxs.length} normal txs + ${etherscanTokenTxs.length} token txs`);
      console.log(`   Total:      ${etherscanTxs.length + etherscanTokenTxs.length}`);

      // Compare unique users
      const ourUsers = new Set(ourData.transactions?.map(tx => tx.from) || []);
      const etherscanUsers = new Set([
        ...etherscanTxs.map(tx => tx.from),
        ...etherscanTokenTxs.map(tx => tx.from)
      ]);

      console.log('\n👥 Unique Users:');
      console.log(`   Our RPC:    ${ourUsers.size} users`);
      console.log(`   Etherscan:  ${etherscanUsers.size} users`);

      // Compare recent transactions
      if (ourData.transactions?.length > 0 && etherscanTxs.length > 0) {
        console.log('\n🔗 Recent Transaction Hashes:');
        console.log('   Our RPC (latest 5):');
        ourData.transactions.slice(0, 5).forEach(tx => {
          console.log(`     ${tx.hash}`);
        });
        
        console.log('   Etherscan (latest 5):');
        etherscanTxs.slice(0, 5).forEach(tx => {
          console.log(`     ${tx.hash}`);
        });
      }

      // Calculate accuracy
      const countDiff = Math.abs(
        (ourData.transactions?.length || 0) - 
        (etherscanTxs.length + etherscanTokenTxs.length)
      );
      const accuracy = countDiff === 0 ? 100 : 
        (1 - (countDiff / (etherscanTxs.length + etherscanTokenTxs.length))) * 100;

      console.log(`\n✅ Accuracy: ${accuracy.toFixed(2)}%`);

      return {
        ourCount: ourData.transactions?.length || 0,
        etherscanCount: etherscanTxs.length + etherscanTokenTxs.length,
        ourUsers: ourUsers.size,
        etherscanUsers: etherscanUsers.size,
        accuracy: accuracy.toFixed(2),
        difference: countDiff
      };

    } catch (error) {
      console.error('❌ Comparison failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify contract deployment
   */
  async verifyContractDeployment(address) {
    try {
      const source = await this.getContractSource(address);
      const contractInfo = source[0];

      console.log(`\n📋 Contract Information:`);
      console.log(`   Name:           ${contractInfo.ContractName}`);
      console.log(`   Compiler:       ${contractInfo.CompilerVersion}`);
      console.log(`   Optimization:   ${contractInfo.OptimizationUsed === '1' ? 'Yes' : 'No'}`);
      console.log(`   Verified:       ${contractInfo.SourceCode ? 'Yes' : 'No'}`);

      return contractInfo;
    } catch (error) {
      console.error('❌ Contract verification failed:', error.message);
      throw error;
    }
  }
}

export default EtherscanComparator;
