import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

dotenv.config();

/**
 * Configuration Manager
 * Loads and validates configuration from .env and config.json
 */
export class ConfigurationManager {
  constructor() {
    this.config = null;
  }

  /**
   * Load configuration from environment variables and optional config file
   * @param {string} configPath - Optional path to config.json
   * @returns {Object} Complete configuration object
   */
  async loadConfig(configPath = null) {
    // Load from environment variables
    const envConfig = this._loadFromEnv();

    // Load from config file if provided
    let fileConfig = null;
    if (configPath && existsSync(configPath)) {
      fileConfig = await this._loadFromFile(configPath);
    }

    // Merge configurations (file config overrides env config)
    this.config = fileConfig || envConfig;

    // Validate configuration
    const validation = this.validateConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    return this.config;
  }

  /**
   * Load configuration from environment variables
   * @private
   */
  _loadFromEnv() {
    return {
      targetContract: {
        address: process.env.CONTRACT_ADDRESS,
        chain: process.env.CONTRACT_CHAIN || 'ethereum',
        abiPath: process.env.CONTRACT_ABI_PATH,
        name: process.env.CONTRACT_NAME || 'Target'
      },
      competitors: this._loadCompetitorsFromEnv(),
      rpcEndpoints: {
        ethereum: process.env.ETHEREUM_RPC_URL,
        polygon: process.env.POLYGON_RPC_URL,
        starknet: process.env.STARKNET_RPC_URL,
        base: process.env.BASE_RPC_URL,
        arbitrum: process.env.ARBITRUM_RPC_URL,
        optimism: process.env.OPTIMISM_RPC_URL
      },
      database: {
        type: process.env.DATABASE_TYPE || 'mongodb',
        mongodb: {
          uri: process.env.MONGO_URI,
          database: process.env.MONGO_DB || 'startup_analytics'
        },
        postgresql: {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT) || 5432,
          database: process.env.POSTGRES_DB || 'startup_analytics',
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          url: process.env.POSTGRES_URL
        }
      },
      analysisParameters: {
        cohortPeriodDays: parseInt(process.env.COHORT_PERIOD_DAYS) || 7,
        retentionWindows: (process.env.RETENTION_WINDOWS || '7,14,30,60,90')
          .split(',')
          .map(n => parseInt(n.trim())),
        whaleThresholdEth: parseFloat(process.env.WHALE_THRESHOLD_ETH) || 10,
        churnThresholdDays: parseInt(process.env.CHURN_THRESHOLD_DAYS) || 30,
        uxGradeThresholds: {
          A: {
            completionRate: parseFloat(process.env.UX_GRADE_A_COMPLETION) || 0.9,
            failureRate: parseFloat(process.env.UX_GRADE_A_FAILURE) || 0.05
          },
          B: {
            completionRate: parseFloat(process.env.UX_GRADE_B_COMPLETION) || 0.8,
            failureRate: parseFloat(process.env.UX_GRADE_B_FAILURE) || 0.1
          },
          C: {
            completionRate: parseFloat(process.env.UX_GRADE_C_COMPLETION) || 0.7,
            failureRate: parseFloat(process.env.UX_GRADE_C_FAILURE) || 0.15
          },
          D: {
            completionRate: parseFloat(process.env.UX_GRADE_D_COMPLETION) || 0.6,
            failureRate: parseFloat(process.env.UX_GRADE_D_FAILURE) || 0.2
          }
        }
      },
      output: {
        directory: process.env.OUTPUT_DIR || './reports',
        formats: (process.env.OUTPUT_FORMATS || 'json,csv,markdown')
          .split(',')
          .map(f => f.trim())
      },
      performance: {
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10,
        cacheEnabled: process.env.CACHE_ENABLED === 'true',
        cacheTTLHours: parseInt(process.env.CACHE_TTL_HOURS) || 24,
        cacheDir: process.env.CACHE_DIR || './cache'
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || './logs/analytics.log'
      }
    };
  }

  /**
   * Load competitors from environment variables
   * @private
   */
  _loadCompetitorsFromEnv() {
    const competitors = [];
    
    for (let i = 1; i <= 5; i++) {
      const address = process.env[`COMPETITOR_${i}_ADDRESS`];
      if (address) {
        competitors.push({
          id: `competitor-${i}`,
          address,
          abiPath: process.env[`COMPETITOR_${i}_ABI_PATH`],
          name: process.env[`COMPETITOR_${i}_NAME`] || `Competitor${i}`,
          chain: process.env[`COMPETITOR_${i}_CHAIN`] || 'ethereum'
        });
      }
    }
    
    return competitors;
  }

  /**
   * Load configuration from JSON file
   * @private
   */
  async _loadFromFile(configPath) {
    try {
      const fileContent = await readFile(configPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to load config file: ${error.message}`);
    }
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration object to validate
   * @returns {Object} Validation result with valid flag and errors array
   */
  validateConfig(config) {
    const errors = [];

    // Validate target contract
    if (!config.targetContract) {
      errors.push('Missing targetContract configuration');
    } else {
      if (!this._isValidAddress(config.targetContract.address)) {
        errors.push('Invalid target contract address (must be 0x + 40 hex chars)');
      }
      if (!config.targetContract.abiPath) {
        errors.push('Missing target contract ABI path');
      }
      if (!this._isValidChain(config.targetContract.chain)) {
        errors.push(`Invalid target contract chain: ${config.targetContract.chain}`);
      }
    }

    // Validate competitors
    if (config.competitors && config.competitors.length > 0) {
      config.competitors.forEach((competitor, index) => {
        if (!this._isValidAddress(competitor.address)) {
          errors.push(`Invalid competitor ${index + 1} address`);
        }
        if (!competitor.abiPath) {
          errors.push(`Missing competitor ${index + 1} ABI path`);
        }
        if (!this._isValidChain(competitor.chain)) {
          errors.push(`Invalid competitor ${index + 1} chain: ${competitor.chain}`);
        }
      });
    }

    // Validate RPC endpoints
    if (!config.rpcEndpoints) {
      errors.push('Missing RPC endpoints configuration');
    } else {
      const requiredChains = ['ethereum', 'polygon', 'starknet'];
      requiredChains.forEach(chain => {
        if (!config.rpcEndpoints[chain]) {
          errors.push(`Missing RPC endpoint for ${chain}`);
        }
      });
    }

    // Validate database configuration
    if (!config.database || !config.database.type) {
      errors.push('Missing database type (mongodb or postgresql)');
    } else if (!['mongodb', 'postgresql'].includes(config.database.type)) {
      errors.push('Database type must be "mongodb" or "postgresql"');
    }

    // Validate analysis parameters
    if (config.analysisParameters) {
      if (config.analysisParameters.cohortPeriodDays <= 0) {
        errors.push('Cohort period days must be positive');
      }
      if (!Array.isArray(config.analysisParameters.retentionWindows) || 
          config.analysisParameters.retentionWindows.length === 0) {
        errors.push('Retention windows must be a non-empty array');
      }
      if (config.analysisParameters.whaleThresholdEth <= 0) {
        errors.push('Whale threshold must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Ethereum address format
   * @private
   */
  _isValidAddress(address) {
    if (!address) return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate chain name
   * @private
   */
  _isValidChain(chain) {
    const validChains = ['ethereum', 'polygon', 'starknet', 'base', 'arbitrum', 'optimism'];
    return validChains.includes(chain.toLowerCase());
  }

  /**
   * Get contract configuration by ID
   * @param {string} contractId - Contract ID ('target' or 'competitor-N')
   * @returns {Object} Contract configuration
   */
  getContractConfig(contractId) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    if (contractId === 'target') {
      return this.config.targetContract;
    }

    const competitor = this.config.competitors.find(c => c.id === contractId);
    if (!competitor) {
      throw new Error(`Competitor not found: ${contractId}`);
    }

    return competitor;
  }

  /**
   * Get RPC endpoint for a specific chain
   * @param {string} chain - Chain name
   * @returns {string} RPC endpoint URL
   */
  getRpcEndpoint(chain) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    const endpoint = this.config.rpcEndpoints[chain.toLowerCase()];
    if (!endpoint) {
      throw new Error(`RPC endpoint not configured for chain: ${chain}`);
    }

    return endpoint;
  }

  /**
   * Get all configuration
   * @returns {Object} Complete configuration
   */
  getConfig() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }
}

export default ConfigurationManager;
