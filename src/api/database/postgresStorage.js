/**
 * PostgreSQL Storage Classes
 * Replaces file-based storage with PostgreSQL database
 */

import { query, transaction } from './postgres.js';

// Helper: Convert snake_case to camelCase
function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value && typeof value === 'object' && !Array.isArray(value) 
      ? toCamelCase(value) 
      : value;
  }
  return result;
}

// Helper: Convert camelCase to snake_case
function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj;
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * PostgreSQL User Storage
 */
export class PostgresUserStorage {
  // Transform PostgreSQL user to file storage format
  static async transformUser(userRow) {
    const user = toCamelCase(userRow);
    
    // Restructure usage fields into nested object
    user.usage = {
      analysisCount: user.analysisCount || 0,
      monthlyAnalysisCount: user.monthlyAnalysisCount || 0,
      lastAnalysis: user.lastAnalysis || null,
      monthlyResetDate: user.monthlyResetDate || new Date().toISOString()
    };
    delete user.analysisCount;
    delete user.monthlyAnalysisCount;
    delete user.lastAnalysis;
    delete user.monthlyResetDate;
    
    // Fetch onboarding data
    const onboarding = await this.getOnboarding(user.id);
    user.onboarding = onboarding || {
      completed: false,
      socialLinks: { website: null, twitter: null, discord: null, telegram: null },
      logo: null,
      defaultContract: {
        address: null, chain: null, abi: null, name: null,
        purpose: null, category: null, startDate: null,
        isIndexed: false, indexingProgress: 0, lastAnalysisId: null
      }
    };
    
    // Fetch preferences data
    const preferences = await this.getPreferences(user.id);
    user.preferences = preferences || {
      notifications: { email: true, analysis: true },
      defaultChain: 'ethereum'
    };
    
    return user;
  }

  static async findAll() {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    return Promise.all(result.rows.map(row => this.transformUser(row)));
  }

  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    return this.transformUser(result.rows[0]);
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows[0]) return null;
    return this.transformUser(result.rows[0]);
  }

  static async findByApiKey(apiKey) {
    const result = await query('SELECT * FROM users WHERE api_key = $1', [apiKey]);
    if (!result.rows[0]) return null;
    return this.transformUser(result.rows[0]);
  }

  static async create(userData) {
    return await transaction(async (client) => {
      // Insert user
      const userResult = await client.query(`
        INSERT INTO users (
          email, password, name, tier, api_key, is_active, email_verified,
          analysis_count, monthly_analysis_count, last_analysis, monthly_reset_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        userData.email,
        userData.password,
        userData.name,
        userData.tier || 'free',
        userData.apiKey,
        userData.isActive !== false,
        userData.emailVerified || false,
        userData.usage?.analysisCount || 0,
        userData.usage?.monthlyAnalysisCount || 0,
        userData.usage?.lastAnalysis || null,
        userData.usage?.monthlyResetDate || new Date().toISOString()
      ]);

      const user = userResult.rows[0];

      // Create onboarding record
      if (userData.onboarding) {
        await client.query(`
          INSERT INTO user_onboarding (user_id, completed)
          VALUES ($1, $2)
        `, [user.id, userData.onboarding.completed || false]);
      } else {
        await client.query(`
          INSERT INTO user_onboarding (user_id, completed)
          VALUES ($1, false)
        `, [user.id]);
      }

      // Create preferences record
      if (userData.preferences) {
        await client.query(`
          INSERT INTO user_preferences (
            user_id, email_notifications, analysis_notifications, default_chain
          ) VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          userData.preferences.notifications?.email !== false,
          userData.preferences.notifications?.analysis !== false,
          userData.preferences.defaultChain || 'ethereum'
        ]);
      } else {
        await client.query(`
          INSERT INTO user_preferences (user_id)
          VALUES ($1)
        `, [user.id]);
      }

      return toCamelCase(user);
    });
  }

  static async update(id, updates) {
    // Handle nested objects separately
    if (updates.onboarding) {
      await this.updateOnboarding(id, updates.onboarding);
      delete updates.onboarding;
    }
    if (updates.preferences) {
      await this.updatePreferences(id, updates.preferences);
      delete updates.preferences;
    }
    
    // Handle nested usage object
    if (updates.usage) {
      updates.analysisCount = updates.usage.analysisCount;
      updates.monthlyAnalysisCount = updates.usage.monthlyAnalysisCount;
      updates.lastAnalysis = updates.usage.lastAnalysis;
      updates.monthlyResetDate = updates.usage.monthlyResetDate;
      delete updates.usage;
    }

    // If no user fields left to update, just return the user
    if (Object.keys(updates).length === 0) {
      return await this.findById(id);
    }

    const snakeUpdates = toSnakeCase(updates);
    
    // Remove fields that shouldn't be updated manually
    delete snakeUpdates.id;
    delete snakeUpdates.created_at;
    delete snakeUpdates.updated_at;
    
    const fields = Object.keys(snakeUpdates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(snakeUpdates);

    await query(`
      UPDATE users 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id, ...values]);

    return await this.findById(id);
  }

  static async delete(id) {
    await query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  }

  // Onboarding methods
  static async getOnboarding(userId) {
    const result = await query(
      'SELECT * FROM user_onboarding WHERE user_id = $1',
      [userId]
    );
    if (!result.rows[0]) return null;
    
    const onboarding = toCamelCase(result.rows[0]);
    
    // Parse JSONB fields
    if (typeof onboarding.socialLinks === 'string') {
      onboarding.socialLinks = JSON.parse(onboarding.socialLinks);
    }
    if (typeof onboarding.defaultContract === 'string') {
      onboarding.defaultContract = JSON.parse(onboarding.defaultContract);
    }
    
    // Remove internal fields
    delete onboarding.id;
    delete onboarding.userId;
    
    return onboarding;
  }

  static async updateOnboarding(userId, data) {
    // Handle JSONB fields separately
    const jsonbFields = ['socialLinks', 'defaultContract'];
    const regularData = {};
    const jsonbData = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (jsonbFields.includes(key)) {
        jsonbData[key] = value;
      } else {
        regularData[key] = value;
      }
    }
    
    // Convert regular fields to snake_case
    const snakeData = toSnakeCase(regularData);
    
    // Add JSONB fields as-is (they'll be stored as JSON)
    if (jsonbData.socialLinks) snakeData.social_links = JSON.stringify(jsonbData.socialLinks);
    if (jsonbData.defaultContract) snakeData.default_contract = JSON.stringify(jsonbData.defaultContract);
    
    // Remove fields that shouldn't be updated manually
    delete snakeData.id;
    delete snakeData.user_id;
    delete snakeData.created_at;
    delete snakeData.updated_at;
    
    const fields = Object.keys(snakeData)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(snakeData);

    const result = await query(`
      UPDATE user_onboarding 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `, [userId, ...values]);

    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }

  // Preferences methods
  static async getPreferences(userId) {
    const result = await query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    if (!result.rows[0]) return null;
    
    const prefs = toCamelCase(result.rows[0]);
    
    // Restructure to match file storage format
    const preferences = {
      notifications: {
        email: prefs.emailNotifications !== false,
        analysis: prefs.analysisNotifications !== false
      },
      defaultChain: prefs.defaultChain || 'ethereum'
    };
    
    return preferences;
  }

  static async updatePreferences(userId, data) {
    // Handle nested notifications object
    const updates = {
      emailNotifications: data.notifications?.email !== false,
      analysisNotifications: data.notifications?.analysis !== false,
      defaultChain: data.defaultChain || 'ethereum'
    };
    
    const snakeData = toSnakeCase(updates);
    
    const fields = Object.keys(snakeData)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(snakeData);

    await query(`
      UPDATE user_preferences 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `, [userId, ...values]);

    return await this.getPreferences(userId);
  }
}

/**
 * PostgreSQL Contract Storage
 */
export class PostgresContractStorage {
  // Transform PostgreSQL contract to file storage format
  static async transformContract(contractRow) {
    const contract = toCamelCase(contractRow);
    
    // Restructure target fields into nested object
    contract.targetContract = {
      address: contract.targetAddress,
      chain: contract.targetChain,
      name: contract.targetName,
      abi: contract.targetAbi
    };
    delete contract.targetAddress;
    delete contract.targetChain;
    delete contract.targetName;
    delete contract.targetAbi;
    
    // Fetch related data
    contract.competitors = await this.getCompetitors(contract.id);
    contract.rpcConfig = await this.getRpcConfig(contract.id);
    contract.analysisParams = await this.getAnalysisParams(contract.id);
    
    return contract;
  }

  static async findAll() {
    const result = await query('SELECT * FROM contracts ORDER BY created_at DESC');
    return Promise.all(result.rows.map(row => this.transformContract(row)));
  }

  static async findById(id) {
    const result = await query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    return this.transformContract(result.rows[0]);
  }

  static async findByUserId(userId, filters = {}) {
    let sql = 'SELECT * FROM contracts WHERE user_id = $1 AND is_active = true';
    const params = [userId];
    let paramIndex = 2;

    if (filters.search) {
      sql += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.chain) {
      sql += ` AND target_chain = $${paramIndex}`;
      params.push(filters.chain);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      sql += ` AND tags && $${paramIndex}`;
      params.push(filters.tags);
      paramIndex++;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return Promise.all(result.rows.map(row => this.transformContract(row)));
  }

  static async create(contractData) {
    return await transaction(async (client) => {
      // Insert contract
      const result = await client.query(`
        INSERT INTO contracts (
          user_id, name, description, target_address, target_chain,
          target_name, target_abi, tags, is_active, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        contractData.userId,
        contractData.name,
        contractData.description || null,
        contractData.targetContract?.address,
        contractData.targetContract?.chain,
        contractData.targetContract?.name,
        contractData.targetContract?.abi,
        contractData.tags || [],
        true,
        contractData.isDefault || false
      ]);

      const contract = result.rows[0];

      // Insert competitors
      if (contractData.competitors && contractData.competitors.length > 0) {
        for (const comp of contractData.competitors) {
          await client.query(`
            INSERT INTO contract_competitors (contract_id, address, chain, name, abi)
            VALUES ($1, $2, $3, $4, $5)
          `, [contract.id, comp.address, comp.chain, comp.name, comp.abi]);
        }
      }

      // Insert RPC config
      if (contractData.rpcConfig) {
        for (const [chain, urls] of Object.entries(contractData.rpcConfig)) {
          if (urls && urls.length > 0) {
            await client.query(`
              INSERT INTO contract_rpc_config (contract_id, chain, rpc_urls)
              VALUES ($1, $2, $3)
            `, [contract.id, chain, urls]);
          }
        }
      }

      // Insert analysis params
      if (contractData.analysisParams) {
        const customParams = {
          searchStrategy: contractData.analysisParams.searchStrategy || 'standard',
          smartSearch: contractData.analysisParams.smartSearch !== false
        };
        
        await client.query(`
          INSERT INTO contract_analysis_params (
            contract_id, whale_threshold, max_concurrent_requests, 
            failover_timeout, max_retries, output_formats, custom_params
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          contract.id,
          contractData.analysisParams.whaleThreshold || 10,
          contractData.analysisParams.maxConcurrentRequests || 10,
          contractData.analysisParams.failoverTimeout || 30000,
          contractData.analysisParams.maxRetries || 2,
          contractData.analysisParams.outputFormats || ['json', 'csv', 'markdown'],
          JSON.stringify(customParams)
        ]);
      }

      return this.transformContract(contract);
    });
  }

  static async update(id, updates) {
    // Handle nested objects separately
    if (updates.targetContract) {
      updates.targetAddress = updates.targetContract.address;
      updates.targetChain = updates.targetContract.chain;
      updates.targetName = updates.targetContract.name;
      updates.targetAbi = updates.targetContract.abi;
      delete updates.targetContract;
    }

    if (updates.competitors !== undefined) {
      await this.updateCompetitors(id, updates.competitors);
      delete updates.competitors;
    }

    if (updates.rpcConfig !== undefined) {
      await this.updateRpcConfig(id, updates.rpcConfig);
      delete updates.rpcConfig;
    }

    if (updates.analysisParams !== undefined) {
      await this.updateAnalysisParams(id, updates.analysisParams);
      delete updates.analysisParams;
    }

    // If no contract fields left to update, just return the contract
    if (Object.keys(updates).length === 0) {
      return await this.findById(id);
    }

    const snakeUpdates = toSnakeCase(updates);
    delete snakeUpdates.id;
    
    const fields = Object.keys(snakeUpdates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(snakeUpdates);

    await query(`
      UPDATE contracts 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id, ...values]);

    return await this.findById(id);
  }

  static async delete(id) {
    const result = await query(`
      UPDATE contracts 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    return result.rows[0] ? true : null;
  }

  static async countByUserId(userId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM contracts WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  // Helper methods for related data
  static async getCompetitors(contractId) {
    const result = await query(
      'SELECT address, chain, name, abi FROM contract_competitors WHERE contract_id = $1',
      [contractId]
    );
    return result.rows.map(toCamelCase);
  }

  static async getRpcConfig(contractId) {
    const result = await query(
      'SELECT chain, rpc_urls FROM contract_rpc_config WHERE contract_id = $1',
      [contractId]
    );
    const config = {};
    for (const row of result.rows) {
      config[row.chain] = row.rpc_urls || [];
    }
    return config;
  }

  static async getAnalysisParams(contractId) {
    const result = await query(
      'SELECT * FROM contract_analysis_params WHERE contract_id = $1',
      [contractId]
    );
    if (!result.rows[0]) {
      return {
        searchStrategy: 'standard',
        smartSearch: true,
        whaleThreshold: 10,
        maxConcurrentRequests: 10,
        failoverTimeout: 30000,
        maxRetries: 2,
        outputFormats: ['json', 'csv', 'markdown']
      };
    }
    const params = toCamelCase(result.rows[0]);
    
    // Extract custom params
    const customParams = params.customParams || {};
    
    // Build final params object
    const analysisParams = {
      searchStrategy: customParams.searchStrategy || 'standard',
      smartSearch: customParams.smartSearch !== false,
      whaleThreshold: params.whaleThreshold || 10,
      maxConcurrentRequests: params.maxConcurrentRequests || 10,
      failoverTimeout: params.failoverTimeout || 30000,
      maxRetries: params.maxRetries || 2,
      outputFormats: params.outputFormats || ['json', 'csv', 'markdown']
    };
    
    return analysisParams;
  }

  static async updateCompetitors(contractId, competitors) {
    await query('DELETE FROM contract_competitors WHERE contract_id = $1', [contractId]);
    if (competitors && competitors.length > 0) {
      for (const comp of competitors) {
        await query(`
          INSERT INTO contract_competitors (contract_id, address, chain, name, abi)
          VALUES ($1, $2, $3, $4, $5)
        `, [contractId, comp.address, comp.chain, comp.name, comp.abi]);
      }
    }
  }

  static async updateRpcConfig(contractId, rpcConfig) {
    await query('DELETE FROM contract_rpc_config WHERE contract_id = $1', [contractId]);
    if (rpcConfig) {
      for (const [chain, urls] of Object.entries(rpcConfig)) {
        if (urls && urls.length > 0) {
          await query(`
            INSERT INTO contract_rpc_config (contract_id, chain, rpc_urls)
            VALUES ($1, $2, $3)
          `, [contractId, chain, urls]);
        }
      }
    }
  }

  static async updateAnalysisParams(contractId, params) {
    const existing = await query(
      'SELECT id FROM contract_analysis_params WHERE contract_id = $1',
      [contractId]
    );
    
    const customParams = {
      searchStrategy: params.searchStrategy || 'standard',
      smartSearch: params.smartSearch !== false
    };
    
    if (existing.rows[0]) {
      await query(`
        UPDATE contract_analysis_params 
        SET whale_threshold = $2, max_concurrent_requests = $3, 
            failover_timeout = $4, max_retries = $5, output_formats = $6,
            custom_params = $7, updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = $1
      `, [
        contractId,
        params.whaleThreshold || 10,
        params.maxConcurrentRequests || 10,
        params.failoverTimeout || 30000,
        params.maxRetries || 2,
        params.outputFormats || ['json', 'csv', 'markdown'],
        JSON.stringify(customParams)
      ]);
    } else {
      await query(`
        INSERT INTO contract_analysis_params (
          contract_id, whale_threshold, max_concurrent_requests, 
          failover_timeout, max_retries, output_formats, custom_params
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        contractId,
        params.whaleThreshold || 10,
        params.maxConcurrentRequests || 10,
        params.failoverTimeout || 30000,
        params.maxRetries || 2,
        params.outputFormats || ['json', 'csv', 'markdown'],
        JSON.stringify(customParams)
      ]);
    }
  }
}

/**
 * PostgreSQL Analysis Storage
 */
export class PostgresAnalysisStorage {
  static async findAll() {
    const result = await query('SELECT * FROM analyses ORDER BY created_at DESC');
    return result.rows.map(row => {
      const analysis = toCamelCase(row);
      // Parse JSONB fields if they're strings
      if (typeof analysis.results === 'string') analysis.results = JSON.parse(analysis.results);
      if (typeof analysis.metadata === 'string') analysis.metadata = JSON.parse(analysis.metadata);
      return analysis;
    });
  }

  static async findById(id) {
    const result = await query('SELECT * FROM analyses WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    const analysis = toCamelCase(result.rows[0]);
    if (typeof analysis.results === 'string') analysis.results = JSON.parse(analysis.results);
    if (typeof analysis.metadata === 'string') analysis.metadata = JSON.parse(analysis.metadata);
    return analysis;
  }

  static async findByUserId(userId, filters = {}) {
    let sql = 'SELECT * FROM analyses WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (filters.status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.analysisType) {
      sql += ` AND analysis_type = $${paramIndex}`;
      params.push(filters.analysisType);
      paramIndex++;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows.map(row => {
      const analysis = toCamelCase(row);
      if (typeof analysis.results === 'string') analysis.results = JSON.parse(analysis.results);
      if (typeof analysis.metadata === 'string') analysis.metadata = JSON.parse(analysis.metadata);
      return analysis;
    });
  }

  static async create(analysisData) {
    const result = await query(`
      INSERT INTO analyses (
        user_id, config_id, analysis_type, status, progress,
        results, metadata, error_message, has_errors, logs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      analysisData.userId,
      analysisData.configId || null,
      analysisData.analysisType || 'single',
      analysisData.status || 'pending',
      analysisData.progress || 0,
      analysisData.results ? JSON.stringify(analysisData.results) : null,
      analysisData.metadata ? JSON.stringify(analysisData.metadata) : '{}',
      analysisData.errorMessage || null,
      analysisData.hasErrors || false,
      analysisData.logs || []
    ]);

    return toCamelCase(result.rows[0]);
  }

  static async update(id, updates) {
    const snakeUpdates = toSnakeCase(updates);
    
    // Handle JSONB fields
    if (updates.results) snakeUpdates.results = JSON.stringify(updates.results);
    if (updates.metadata) snakeUpdates.metadata = JSON.stringify(updates.metadata);
    
    delete snakeUpdates.id;
    
    const fields = Object.keys(snakeUpdates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(snakeUpdates);

    await query(`
      UPDATE analyses 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id, ...values]);

    return await this.findById(id);
  }

  static async getStats(userId) {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status IN ('pending', 'running')) as pending
      FROM analyses
      WHERE user_id = $1
    `, [userId]);

    const stats = result.rows[0];
    return {
      total: parseInt(stats.total),
      completed: parseInt(stats.completed),
      failed: parseInt(stats.failed),
      pending: parseInt(stats.pending),
      avgExecutionTime: 0
    };
  }

  static async getMonthlyCount(userId, monthStart) {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM analyses
      WHERE user_id = $1 AND created_at >= $2
    `, [userId, monthStart]);

    return parseInt(result.rows[0].count);
  }
}

/**
 * PostgreSQL Chat Session Storage
 */
export class PostgresChatSessionStorage {
  static async findAll() {
    const result = await query('SELECT * FROM chat_sessions ORDER BY updated_at DESC');
    return result.rows.map(toCamelCase);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM chat_sessions WHERE id = $1', [id]);
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }

  static async findByUserId(userId, filters = {}) {
    let sql = 'SELECT * FROM chat_sessions WHERE user_id = $1 AND is_active = true';
    const params = [userId];
    let paramIndex = 2;

    if (filters.contractAddress) {
      sql += ` AND contract_address = $${paramIndex}`;
      params.push(filters.contractAddress);
      paramIndex++;
    }

    if (filters.contractChain) {
      sql += ` AND contract_chain = $${paramIndex}`;
      params.push(filters.contractChain);
      paramIndex++;
    }

    sql += ' ORDER BY updated_at DESC';

    const result = await query(sql, params);
    return result.rows.map(toCamelCase);
  }

  static async findByContract(userId, contractAddress, contractChain) {
    const sessions = await this.findByUserId(userId, { contractAddress, contractChain });
    return sessions[0] || null;
  }

  static async create(sessionData) {
    const result = await query(`
      INSERT INTO chat_sessions (
        user_id, title, contract_address, contract_chain, contract_name, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      sessionData.userId,
      sessionData.title || 'New Chat',
      sessionData.contractAddress || null,
      sessionData.contractChain || null,
      sessionData.contractName || null,
      true
    ]);

    return toCamelCase(result.rows[0]);
  }

  static async update(id, updates) {
    const snakeUpdates = toSnakeCase(updates);
    delete snakeUpdates.id;
    
    const fields = Object.keys(snakeUpdates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(snakeUpdates);

    await query(`
      UPDATE chat_sessions 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id, ...values]);

    return await this.findById(id);
  }

  static async delete(id) {
    await query('DELETE FROM chat_sessions WHERE id = $1', [id]);
    return true;
  }
}

/**
 * PostgreSQL Chat Message Storage
 */
export class PostgresChatMessageStorage {
  static async findAll() {
    const result = await query('SELECT * FROM chat_messages ORDER BY created_at ASC');
    return result.rows.map(row => {
      const msg = toCamelCase(row);
      if (typeof msg.components === 'string') msg.components = JSON.parse(msg.components);
      return msg;
    });
  }

  static async findById(id) {
    const result = await query('SELECT * FROM chat_messages WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    const msg = toCamelCase(result.rows[0]);
    if (typeof msg.components === 'string') msg.components = JSON.parse(msg.components);
    return msg;
  }

  static async findBySessionId(sessionId, limit = 50, offset = 0) {
    const result = await query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3',
      [sessionId, limit, offset]
    );
    return result.rows.map(row => {
      const msg = toCamelCase(row);
      if (typeof msg.components === 'string') msg.components = JSON.parse(msg.components);
      return msg;
    });
  }

  static async create(messageData) {
    const result = await query(`
      INSERT INTO chat_messages (
        session_id, role, content, components, tokens_used, model, processing_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      messageData.sessionId,
      messageData.role,
      messageData.content,
      messageData.components ? JSON.stringify(messageData.components) : null,
      messageData.tokensUsed || null,
      messageData.model || null,
      messageData.processingTime || null
    ]);

    const message = toCamelCase(result.rows[0]);
    
    // Update session's last message time and count
    await query(`
      UPDATE chat_sessions 
      SET last_message_at = $1, 
          message_count = message_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [message.createdAt, message.sessionId]);
    
    return message;
  }

  static async update(id, updates) {
    const snakeUpdates = toSnakeCase(updates);
    if (updates.components) snakeUpdates.components = JSON.stringify(updates.components);
    delete snakeUpdates.id;
    
    const fields = Object.keys(snakeUpdates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(snakeUpdates);

    await query(`
      UPDATE chat_messages 
      SET ${fields}
      WHERE id = $1
    `, [id, ...values]);

    return await this.findById(id);
  }

  static async delete(id) {
    await query('DELETE FROM chat_messages WHERE id = $1', [id]);
    return true;
  }

  static async getRecentContext(sessionId, limit = 10) {
    const messages = await this.findBySessionId(sessionId, limit);
    return messages.slice(-limit);
  }
}
