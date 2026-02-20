/**
 * Deployment Block Finder
 * Finds the block where a contract was first deployed/active
 */

export class DeploymentBlockFinder {
  constructor(rpcClient) {
    this.rpcClient = rpcClient;
  }

  /**
   * Find the deployment block for a contract
   * Uses binary search for efficiency
   * 
   * @param {string} contractAddress - Contract address to search for
   * @param {number} currentBlock - Current blockchain block number
   * @param {string} chain - Chain name (lisk, ethereum, etc.)
   * @returns {Promise<number>} - Block number where contract was deployed
   */
  async findDeploymentBlock(contractAddress, currentBlock, chain = 'lisk') {
    console.log(`🔍 Finding deployment block for ${contractAddress} on ${chain}`);
    console.log(`📊 Searching from block 0 to ${currentBlock}`);

    // Try block explorer API first (faster)
    try {
      const explorerBlock = await this.findViaBlockExplorer(contractAddress, chain);
      if (explorerBlock) {
        console.log(`✅ Found deployment block via explorer: ${explorerBlock}`);
        return explorerBlock;
      }
    } catch (error) {
      console.log(`⚠️  Block explorer lookup failed: ${error.message}`);
    }

    // For now, use a reasonable default (last 30 days)
    // Binary search would require RPC client which we don't have here
    const blocksPerDay = (24 * 60 * 60) / 12; // Assuming 12 second block time
    const daysBack = 30;
    const estimatedDeploymentBlock = Math.max(0, currentBlock - (blocksPerDay * daysBack));
    
    console.log(`⚠️  Using estimated deployment block (30 days back): ${estimatedDeploymentBlock}`);
    return estimatedDeploymentBlock;
  }

  /**
   * Find deployment block using block explorer API
   * Faster but requires external API
   */
  async findViaBlockExplorer(contractAddress, chain = 'lisk') {
    // For Lisk, use Blockscout API
    if (chain === 'lisk') {
      try {
        const response = await fetch(
          `https://blockscout.lisk.com/api/v2/addresses/${contractAddress}/transactions?filter=to&limit=1`
        );
        
        if (!response.ok) {
          throw new Error(`Explorer API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          // Get the oldest transaction (last in the list when sorted by newest first)
          // We need to fetch all pages or use a different approach
          // For now, we'll use the creation transaction if available
          
          // Try to get contract creation info
          const creationResponse = await fetch(
            `https://blockscout.lisk.com/api/v2/addresses/${contractAddress}`
          );
          
          if (creationResponse.ok) {
            const addressData = await creationResponse.json();
            if (addressData.creation_tx_hash) {
              // Get the transaction details
              const txResponse = await fetch(
                `https://blockscout.lisk.com/api/v2/transactions/${addressData.creation_tx_hash}`
              );
              
              if (txResponse.ok) {
                const txData = await txResponse.json();
                return parseInt(txData.block);
              }
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Block explorer API error:', error.message);
        return null;
      }
    }
    
    // For other chains, add their explorer APIs here
    return null;
  }

  /**
   * Binary search to find first block with contract activity
   * More reliable but slower than explorer API
   */
  async binarySearchDeployment(contractAddress, startBlock, endBlock) {
    let left = startBlock;
    let right = endBlock;
    let deploymentBlock = endBlock; // Default to current if not found

    console.log(`🔎 Binary search: ${left} to ${right}`);

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      console.log(`  Checking block ${mid}...`);
      
      const hasActivity = await this.checkBlockForActivity(contractAddress, mid);
      
      if (hasActivity) {
        // Found activity, search earlier blocks
        deploymentBlock = mid;
        right = mid - 1;
        console.log(`  ✓ Activity found at ${mid}, searching earlier...`);
      } else {
        // No activity, search later blocks
        left = mid + 1;
        console.log(`  ✗ No activity at ${mid}, searching later...`);
      }
    }

    return deploymentBlock;
  }

  /**
   * Check if a contract has any activity at a specific block
   */
  async checkBlockForActivity(contractAddress, blockNumber) {
    try {
      // Get transaction count for the contract at this block
      const txCount = await this.rpcClient.getTransactionCount(
        contractAddress,
        blockNumber
      );
      
      return txCount > 0;
    } catch (error) {
      // If we can't check, assume no activity
      console.error(`Error checking block ${blockNumber}:`, error.message);
      return false;
    }
  }

  /**
   * Get a reasonable start block (limit to last N months)
   * @param {number} currentBlock - Current block number
   * @param {number} monthsBack - How many months to look back (default 1)
   * @returns {number} - Start block for indexing
   */
  getReasonableStartBlock(currentBlock, monthsBack = 1) {
    // Estimate blocks per month (assuming ~12 second block time for Lisk)
    const secondsPerBlock = 12;
    const secondsPerMonth = 30 * 24 * 60 * 60;
    const blocksPerMonth = Math.floor(secondsPerMonth / secondsPerBlock);
    
    const blocksToLookBack = blocksPerMonth * monthsBack;
    const startBlock = Math.max(0, currentBlock - blocksToLookBack);
    
    console.log(`📅 Looking back ${monthsBack} month(s): ${blocksToLookBack} blocks`);
    console.log(`📍 Start block: ${startBlock}`);
    
    return startBlock;
  }

  /**
   * Find deployment block with reasonable limits
   * Won't search beyond N months back
   */
  async findDeploymentBlockWithLimit(contractAddress, currentBlock, monthsBack = 1) {
    const minBlock = this.getReasonableStartBlock(currentBlock, monthsBack);
    
    console.log(`🔍 Finding deployment block (limited to last ${monthsBack} month(s))`);
    
    // Try explorer first
    try {
      const explorerBlock = await this.findViaBlockExplorer(contractAddress);
      if (explorerBlock && explorerBlock >= minBlock) {
        console.log(`✅ Found deployment block via explorer: ${explorerBlock}`);
        return explorerBlock;
      } else if (explorerBlock && explorerBlock < minBlock) {
        console.log(`⚠️  Contract deployed at block ${explorerBlock}, but limiting to ${minBlock}`);
        return minBlock;
      }
    } catch (error) {
      console.log(`⚠️  Block explorer lookup failed, using binary search`);
    }

    // Binary search within the limited range
    const deploymentBlock = await this.binarySearchDeployment(
      contractAddress,
      minBlock,
      currentBlock
    );

    return deploymentBlock;
  }
}
