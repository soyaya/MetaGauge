/**
 * Faucet Service
 * Backend service for minting MGT tokens using private key
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Contract addresses
const CONTRACTS = {
  MGT_TOKEN: process.env.MGT_TOKEN_ADDRESS || '0xB51623F59fF9f2AA7d3bC1Afa99AE0fA8049ed3D'
};

// Lisk Sepolia configuration
const LISK_SEPOLIA_RPC = process.env.LISK_SEPOLIA_RPC || 'https://rpc.sepolia-api.lisk.com';
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;

// Token contract ABI (minimal for minting)
const TOKEN_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function owner() view returns (address)'
];

// Faucet configuration
const FAUCET_CONFIG = {
  AMOUNT_PER_CLAIM: ethers.parseEther('1000'), // 1000 MGT per claim
  COOLDOWN_PERIOD: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  MAX_CLAIMS_PER_ADDRESS: 5, // Maximum claims per address
  RATE_LIMIT_WINDOW: 60 * 60 * 1000, // 1 hour window for rate limiting
  MAX_CLAIMS_PER_WINDOW: 10 // Max claims across all users per hour
};

class FaucetService {
  constructor() {
    if (!FAUCET_PRIVATE_KEY) {
      console.warn('⚠️  FAUCET_PRIVATE_KEY not set - faucet service will be disabled');
      this.enabled = false;
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(LISK_SEPOLIA_RPC);
      this.wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, this.provider);
      this.tokenContract = new ethers.Contract(
        CONTRACTS.MGT_TOKEN,
        TOKEN_ABI,
        this.wallet
      );

      // Retry configuration
      this.retryConfig = {
        maxRetries: 4,
        baseDelay: 1500,
        maxDelay: 20000
      };

      // In-memory storage for rate limiting (use Redis in production)
      this.claimHistory = new Map(); // address -> { claims: number, lastClaim: timestamp }
      this.globalClaims = []; // Array of timestamps for global rate limiting

      this.enabled = true;
      console.log('🚰 Faucet Service initialized');
      console.log('📍 Faucet wallet address:', this.wallet.address);
      console.log('🪙 Token contract:', CONTRACTS.MGT_TOKEN);
    } catch (error) {
      console.error('❌ Failed to initialize faucet service:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Execute contract call with timeout and retry logic
   * @private
   */
  async _callWithRetry(operation, operationName, timeout = 30000) {
    let lastError;
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await this._withTimeout(operation(), timeout);
      } catch (error) {
        lastError = error;
        
        // Skip retry for non-retryable errors
        if (error.message.includes('Invalid') || error.message.includes('missing')) {
          throw error;
        }
        
        if (attempt < this.retryConfig.maxRetries - 1) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );
          console.warn(`[FaucetService] ${operationName} failed (attempt ${attempt + 1}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`[FaucetService] ${operationName} failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Execute with timeout
   * @private
   */
  async _withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Initialize faucet service and verify setup
   */
  async initialize() {
    try {
      // Verify contract connection with timeout protection
      const tokenBalance = await this._callWithRetry(
        () => this.tokenContract.balanceOf(this.wallet.address),
        'balanceOf',
        25000
      );
      const totalSupply = await this._callWithRetry(
        () => this.tokenContract.totalSupply(),
        'totalSupply',
        25000
      );
      const maxSupply = await this._callWithRetry(
        () => this.tokenContract.maxSupply(),
        'maxSupply',
        25000
      );
      const owner = await this._callWithRetry(
        () => this.tokenContract.owner(),
        'owner',
        25000
      );

      console.log('🔍 Faucet setup verification:');
      console.log('  - Faucet wallet balance:', ethers.formatEther(tokenBalance), 'MGT');
      console.log('  - Total supply:', ethers.formatEther(totalSupply), 'MGT');
      console.log('  - Max supply:', ethers.formatEther(maxSupply), 'MGT');
      console.log('  - Contract owner:', owner);
      console.log('  - Faucet wallet:', this.wallet.address);
      console.log('  - Is owner?', owner.toLowerCase() === this.wallet.address.toLowerCase());

      // Verify we can mint (owner check)
      if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
        throw new Error('Faucet wallet is not the token contract owner');
      }

      return {
        success: true,
        faucetAddress: this.wallet.address,
        tokenContract: CONTRACTS.MGT_TOKEN,
        faucetBalance: ethers.formatEther(tokenBalance),
        totalSupply: ethers.formatEther(totalSupply),
        maxSupply: ethers.formatEther(maxSupply),
        isOwner: true
      };
    } catch (error) {
      console.error('❌ Faucet initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if an address can claim tokens
   */
  canClaim(address) {
    if (!this.enabled) {
      return {
        canClaim: false,
        reason: 'SERVICE_DISABLED',
        message: 'Faucet service is not configured'
      };
    }

    const now = Date.now();
    const userHistory = this.claimHistory.get(address.toLowerCase());

    // Check if user exists and cooldown
    if (userHistory) {
      const timeSinceLastClaim = now - userHistory.lastClaim;
      if (timeSinceLastClaim < FAUCET_CONFIG.COOLDOWN_PERIOD) {
        const remainingTime = FAUCET_CONFIG.COOLDOWN_PERIOD - timeSinceLastClaim;
        return {
          canClaim: false,
          reason: 'COOLDOWN_ACTIVE',
          remainingTime: Math.ceil(remainingTime / 1000), // seconds
          nextClaimTime: new Date(userHistory.lastClaim + FAUCET_CONFIG.COOLDOWN_PERIOD)
        };
      }

      // Check max claims per address
      if (userHistory.claims >= FAUCET_CONFIG.MAX_CLAIMS_PER_ADDRESS) {
        return {
          canClaim: false,
          reason: 'MAX_CLAIMS_REACHED',
          totalClaims: userHistory.claims,
          maxClaims: FAUCET_CONFIG.MAX_CLAIMS_PER_ADDRESS
        };
      }
    }

    // Check global rate limiting
    const recentClaims = this.globalClaims.filter(
      timestamp => now - timestamp < FAUCET_CONFIG.RATE_LIMIT_WINDOW
    );

    if (recentClaims.length >= FAUCET_CONFIG.MAX_CLAIMS_PER_WINDOW) {
      return {
        canClaim: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        recentClaims: recentClaims.length,
        maxClaimsPerWindow: FAUCET_CONFIG.MAX_CLAIMS_PER_WINDOW
      };
    }

    return {
      canClaim: true,
      amount: ethers.formatEther(FAUCET_CONFIG.AMOUNT_PER_CLAIM),
      cooldownPeriod: FAUCET_CONFIG.COOLDOWN_PERIOD / 1000 / 60 / 60 // hours
    };
  }

  /**
   * Claim tokens for an address
   */
  async claimTokens(recipientAddress, requestInfo = {}) {
    try {
      // Validate address
      if (!recipientAddress || typeof recipientAddress !== 'string') {
        throw new Error('Invalid recipient address');
      }

      // Clean and validate address format
      const cleanAddress = recipientAddress.trim();
      if (!cleanAddress.startsWith('0x') || cleanAddress.length !== 42) {
        throw new Error('Invalid recipient address format');
      }

      // Additional validation using ethers
      try {
        ethers.getAddress(cleanAddress); // This will throw if invalid
      } catch (error) {
        throw new Error('Invalid recipient address checksum');
      }

      const address = cleanAddress.toLowerCase();

      // Check if can claim
      const claimCheck = this.canClaim(address);
      if (!claimCheck.canClaim) {
        return {
          success: false,
          error: claimCheck.reason,
          details: claimCheck
        };
      }

      console.log(`🚰 Processing faucet claim for ${recipientAddress}`);

      // Check current balance before minting
      const balanceBefore = await this.tokenContract.balanceOf(recipientAddress);

      // Mint tokens
      const tx = await this.tokenContract.mint(
        recipientAddress,
        FAUCET_CONFIG.AMOUNT_PER_CLAIM,
        {
          gasLimit: 100000 // Set reasonable gas limit
        }
      );

      console.log('📝 Mint transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new Error('Transaction failed');
      }

      // Verify balance increased
      const balanceAfter = await this.tokenContract.balanceOf(recipientAddress);
      const actualAmount = balanceAfter - balanceBefore;

      // Update claim history
      const now = Date.now();
      const userHistory = this.claimHistory.get(address) || { claims: 0, lastClaim: 0 };
      
      this.claimHistory.set(address, {
        claims: userHistory.claims + 1,
        lastClaim: now,
        totalClaimed: (userHistory.totalClaimed || 0n) + actualAmount
      });

      // Update global rate limiting
      this.globalClaims.push(now);
      
      // Clean old global claims
      this.globalClaims = this.globalClaims.filter(
        timestamp => now - timestamp < FAUCET_CONFIG.RATE_LIMIT_WINDOW
      );

      const result = {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        recipient: recipientAddress,
        amount: ethers.formatEther(actualAmount),
        balanceBefore: ethers.formatEther(balanceBefore),
        balanceAfter: ethers.formatEther(balanceAfter),
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString(),
        claimNumber: userHistory.claims + 1,
        remainingClaims: FAUCET_CONFIG.MAX_CLAIMS_PER_ADDRESS - (userHistory.claims + 1)
      };

      console.log('✅ Faucet claim successful:', result);

      // Log claim for analytics
      this.logClaim({
        ...result,
        requestInfo
      });

      return result;

    } catch (error) {
      console.error('❌ Faucet claim failed:', error);
      
      return {
        success: false,
        error: error.message,
        code: this.getErrorCode(error),
        recipient: recipientAddress,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get claim status for an address
   */
  getClaimStatus(address) {
    const userHistory = this.claimHistory.get(address.toLowerCase());
    const claimCheck = this.canClaim(address);

    return {
      address,
      canClaim: claimCheck.canClaim,
      claimCheck,
      history: userHistory ? {
        totalClaims: userHistory.claims,
        lastClaimTime: new Date(userHistory.lastClaim),
        totalClaimed: userHistory.totalClaimed ? ethers.formatEther(userHistory.totalClaimed) : '0'
      } : null,
      config: {
        amountPerClaim: ethers.formatEther(FAUCET_CONFIG.AMOUNT_PER_CLAIM),
        cooldownHours: FAUCET_CONFIG.COOLDOWN_PERIOD / 1000 / 60 / 60,
        maxClaimsPerAddress: FAUCET_CONFIG.MAX_CLAIMS_PER_ADDRESS
      }
    };
  }

  /**
   * Get faucet statistics
   */
  async getFaucetStats() {
    try {
      const now = Date.now();
      
      // Calculate stats from claim history
      let totalClaims = 0;
      let totalUsers = 0;
      let totalDistributed = 0n;

      for (const [address, history] of this.claimHistory.entries()) {
        totalClaims += history.claims;
        totalUsers += 1;
        totalDistributed += history.totalClaimed || 0n;
      }

      // Recent activity (last 24 hours)
      const recentClaims = this.globalClaims.filter(
        timestamp => now - timestamp < 24 * 60 * 60 * 1000
      );

      // Get contract stats
      const faucetBalance = await this.tokenContract.balanceOf(this.wallet.address);
      const totalSupply = await this.tokenContract.totalSupply();

      return {
        totalClaims,
        totalUsers,
        totalDistributed: ethers.formatEther(totalDistributed),
        recentClaims24h: recentClaims.length,
        faucetBalance: ethers.formatEther(faucetBalance),
        totalSupply: ethers.formatEther(totalSupply),
        config: {
          amountPerClaim: ethers.formatEther(FAUCET_CONFIG.AMOUNT_PER_CLAIM),
          cooldownHours: FAUCET_CONFIG.COOLDOWN_PERIOD / 1000 / 60 / 60,
          maxClaimsPerAddress: FAUCET_CONFIG.MAX_CLAIMS_PER_ADDRESS,
          rateLimit: {
            windowHours: FAUCET_CONFIG.RATE_LIMIT_WINDOW / 1000 / 60 / 60,
            maxClaimsPerWindow: FAUCET_CONFIG.MAX_CLAIMS_PER_WINDOW
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting faucet stats:', error);
      throw error;
    }
  }

  /**
   * Get error code for different error types
   */
  getErrorCode(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('insufficient funds')) return 'INSUFFICIENT_FUNDS';
    if (message.includes('gas')) return 'GAS_ERROR';
    if (message.includes('nonce')) return 'NONCE_ERROR';
    if (message.includes('revert')) return 'CONTRACT_REVERT';
    if (message.includes('network')) return 'NETWORK_ERROR';
    if (message.includes('timeout')) return 'TIMEOUT';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Log claim for analytics
   */
  logClaim(claimData) {
    // In production, you might want to:
    // - Save to database
    // - Send to analytics service
    // - Log to file
    // - Send webhook notifications
    
    console.log('📊 Claim logged:', {
      recipient: claimData.recipient,
      amount: claimData.amount,
      transactionHash: claimData.transactionHash,
      claimNumber: claimData.claimNumber,
      timestamp: claimData.timestamp
    });
  }

  /**
   * Clean up old claim history (call periodically)
   */
  cleanupHistory() {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Clean global claims
    this.globalClaims = this.globalClaims.filter(
      timestamp => now - timestamp < FAUCET_CONFIG.RATE_LIMIT_WINDOW
    );

    // Clean old user history (optional - you might want to keep this)
    for (const [address, history] of this.claimHistory.entries()) {
      if (now - history.lastClaim > maxAge) {
        // Optionally remove very old entries
        // this.claimHistory.delete(address);
      }
    }

    console.log('🧹 Faucet history cleanup completed');
  }
}

// Export lazy-initialized singleton instance
let faucetServiceInstance = null;

function getFaucetService() {
  if (!faucetServiceInstance) {
    faucetServiceInstance = new FaucetService();
  }
  return faucetServiceInstance;
}

// Export the getter function, not the instance
export default getFaucetService;