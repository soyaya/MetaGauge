/**
 * DataFactory Class
 * 
 * Generates realistic test data for users, contracts, analyses, and subscriptions.
 * Supports property-based testing with random data generation.
 */

export class DataFactory {
  /**
   * Create a test user with realistic defaults
   */
  createUser(overrides = {}) {
    return {
      email: global.testUtils.randomEmail(),
      password: 'TestPassword123!',
      name: `Test User ${global.testUtils.randomString(5)}`,
      tier: 'free',
      apiKey: this.generateApiKey(),
      isActive: true,
      walletAddress: null,
      onboarding: {
        completed: false,
      },
      usage: {
        analysisCount: 0,
        monthlyAnalysisCount: 0,
      },
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create a test contract with chain-specific addresses
   */
  createContract(overrides = {}) {
    const chain = overrides.chain || this.createRandomChain();
    
    return {
      name: `Test Contract ${global.testUtils.randomString(5)}`,
      targetContract: {
        address: this.createRandomAddress(chain),
        chain,
        name: `${chain.charAt(0).toUpperCase() + chain.slice(1)} Contract`,
        abi: null,
      },
      isActive: true,
      isDefault: false,
      tags: ['test', chain],
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create a test analysis
   */
  createAnalysis(overrides = {}) {
    const status = overrides.status || 'pending';
    
    return {
      status,
      progress: status === 'completed' ? 100 : 0,
      results: status === 'completed' ? this.createAnalysisResults() : null,
      errorMessage: status === 'failed' ? 'Test error message' : null,
      createdAt: new Date().toISOString(),
      completedAt: status === 'completed' ? new Date().toISOString() : null,
      ...overrides,
    };
  }

  /**
   * Create analysis results
   */
  createAnalysisResults() {
    return {
      totalTransactions: Math.floor(Math.random() * 1000) + 100,
      uniqueUsers: Math.floor(Math.random() * 500) + 50,
      totalValue: Math.random() * 1000,
      avgTransactionValue: Math.random() * 10,
      successRate: 90 + Math.random() * 10,
      avgGasCost: Math.random() * 0.01,
      metrics: {
        defiRatio: Math.random(),
        tvl: Math.random() * 1000000,
        userActivity: Math.random(),
      },
    };
  }

  /**
   * Create a test subscription
   */
  createSubscription(overrides = {}) {
    const tier = overrides.tier || 0; // 0=Free, 1=Starter, 2=Pro, 3=Enterprise
    
    const tierNames = ['free', 'starter', 'pro', 'enterprise'];
    const historicalDays = [7, 30, 90, -1];
    const apiCallsPerMonth = [1000, 10000, 50000, 250000];
    const continuousSync = [false, true, true, true];
    
    return {
      tier,
      tierName: tierNames[tier],
      historicalDays: historicalDays[tier],
      apiCallsPerMonth: apiCallsPerMonth[tier],
      continuousSync: continuousSync[tier],
      features: {
        multiChain: tier >= 1,
        aiInsights: tier >= 2,
        customAlerts: tier >= 2,
        apiAccess: tier >= 1,
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate random email
   */
  createRandomEmail() {
    return global.testUtils.randomEmail();
  }

  /**
   * Generate random wallet address for specific chain
   */
  createRandomAddress(chain = 'ethereum') {
    return global.testUtils.randomAddress(chain);
  }

  /**
   * Generate random chain
   */
  createRandomChain() {
    const chains = ['ethereum', 'lisk', 'starknet'];
    return chains[Math.floor(Math.random() * chains.length)];
  }

  /**
   * Generate API key
   */
  generateApiKey() {
    return 'test_' + Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Create monitoring configuration
   */
  createMonitoringConfig(overrides = {}) {
    return {
      enabled: true,
      interval: 30000, // 30 seconds
      alertThresholds: {
        transactionCount: 100,
        gasPrice: 100,
        failureRate: 0.1,
      },
      ...overrides,
    };
  }

  /**
   * Create alert configuration
   */
  createAlertConfig(overrides = {}) {
    return {
      type: 'transaction_threshold',
      condition: {
        field: 'transactionCount',
        operator: 'greater_than',
        value: 100,
      },
      enabled: true,
      notificationChannels: ['email'],
      ...overrides,
    };
  }

  /**
   * Create chat message
   */
  createChatMessage(overrides = {}) {
    return {
      role: 'user',
      content: 'What are the key metrics for this contract?',
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create faucet request
   */
  createFaucetRequest(overrides = {}) {
    return {
      walletAddress: this.createRandomAddress(),
      chain: this.createRandomChain(),
      amount: '0.1',
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create batch of users
   */
  createUsers(count, overrides = {}) {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  /**
   * Create batch of contracts
   */
  createContracts(count, overrides = {}) {
    return Array.from({ length: count }, () => this.createContract(overrides));
  }

  /**
   * Create batch of analyses
   */
  createAnalyses(count, overrides = {}) {
    return Array.from({ length: count }, () => this.createAnalysis(overrides));
  }

  /**
   * Create realistic transaction data
   */
  createTransaction(overrides = {}) {
    return {
      hash: '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join(''),
      from: this.createRandomAddress(),
      to: this.createRandomAddress(),
      value: (Math.random() * 10).toFixed(18),
      gasUsed: Math.floor(Math.random() * 100000) + 21000,
      gasPrice: (Math.random() * 100).toFixed(9),
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
      status: Math.random() > 0.1 ? 'success' : 'failed',
      ...overrides,
    };
  }

  /**
   * Create realistic event data
   */
  createEvent(overrides = {}) {
    return {
      address: this.createRandomAddress(),
      topics: [
        '0x' + Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join(''),
      ],
      data: '0x' + Array.from({ length: 128 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join(''),
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      transactionHash: '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join(''),
      ...overrides,
    };
  }
}

// Export singleton instance
let dataFactoryInstance = null;

export function getDataFactory() {
  if (!dataFactoryInstance) {
    dataFactoryInstance = new DataFactory();
  }
  return dataFactoryInstance;
}
