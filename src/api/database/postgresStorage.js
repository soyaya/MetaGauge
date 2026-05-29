/**
 * PostgreSQL Storage Classes
 * Replaces file-based storage with PostgreSQL database
 */

import { query, transaction } from './postgres.js';

// Helper: Convert snake_case to camelCase
function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj instanceof Date) return obj;
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
      ? toCamelCase(value) 
      : value;
  }
  return result;
}

// Helper: Convert camelCase to snake_case
function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj;
  if (obj instanceof Date) return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
      ? toSnakeCase(value)
      : value;
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
    // Work on a copy — never mutate the caller's object
    updates = { ...updates };

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
    const result = await query('SELECT * FROM user_onboarding WHERE user_id = $1', [userId]);
    if (!result.rows[0]) return null;
    const row = result.rows[0];

    // Reconstruct the nested shape expected by the app
    return {
      completed: row.completed,
      logo: row.logo,
      socialLinks: {
        website:  row.website  || null,
        twitter:  row.twitter  || null,
        discord:  row.discord  || null,
        telegram: row.telegram || null,
      },
      defaultContract: {
        address:              row.contract_address    || null,
        chain:                row.contract_chain      || null,
        abi:                  row.contract_abi        || null,
        name:                 row.contract_name       || null,
        purpose:              row.contract_purpose    || null,
        category:             row.contract_category   || null,
        startDate:            row.contract_start_date || null,
        isIndexed:            row.is_indexed          || false,
        indexingProgress:     row.indexing_progress   || 0,
        lastAnalysisId:       row.last_analysis_id    || null,
        currentStep:          row.current_step        || null,
        continuousSync:       row.continuous_sync     || false,
        continuousSyncStarted:row.continuous_sync_started || null,
        continuousSyncStopped:row.continuous_sync_stopped || null,
        deploymentBlock:      row.deployment_block    || null,
      },
    };
  }

  static async updateOnboarding(userId, data) {
    // socialLinks is stored as separate columns (website, twitter, discord, telegram)
    // defaultContract fields are stored as separate columns too
    const snakeData = {};

    // Expand socialLinks into individual columns
    if (data.socialLinks) {
      if (data.socialLinks.website  !== undefined) snakeData.website  = data.socialLinks.website;
      if (data.socialLinks.twitter  !== undefined) snakeData.twitter  = data.socialLinks.twitter;
      if (data.socialLinks.discord  !== undefined) snakeData.discord  = data.socialLinks.discord;
      if (data.socialLinks.telegram !== undefined) snakeData.telegram = data.socialLinks.telegram;
    }

    // Expand defaultContract into individual columns
    if (data.defaultContract) {
      const dc = data.defaultContract;
      if (dc.address          !== undefined) snakeData.contract_address    = dc.address;
      if (dc.chain            !== undefined) snakeData.contract_chain      = dc.chain;
      if (dc.abi              !== undefined) snakeData.contract_abi        = dc.abi;
      if (dc.name             !== undefined) snakeData.contract_name       = dc.name;
      if (dc.purpose          !== undefined) snakeData.contract_purpose    = dc.purpose;
      if (dc.category         !== undefined) snakeData.contract_category   = dc.category;
      if (dc.startDate        !== undefined) snakeData.contract_start_date = dc.startDate;
      if (dc.isIndexed        !== undefined) snakeData.is_indexed          = dc.isIndexed;
      if (dc.indexingProgress !== undefined) snakeData.indexing_progress   = dc.indexingProgress;
      if (dc.lastAnalysisId   !== undefined) snakeData.last_analysis_id    = dc.lastAnalysisId;
      if (dc.currentStep      !== undefined) snakeData.current_step        = dc.currentStep;
      if (dc.continuousSync   !== undefined) snakeData.continuous_sync     = dc.continuousSync;
      if (dc.continuousSyncStarted !== undefined) snakeData.continuous_sync_started = dc.continuousSyncStarted;
      if (dc.continuousSyncStopped !== undefined) snakeData.continuous_sync_stopped = dc.continuousSyncStopped;
      if (dc.deploymentBlock  !== undefined) snakeData.deployment_block    = dc.deploymentBlock;
    }

    // All other top-level fields (completed, logo, etc.)
    const skip = new Set(['socialLinks','defaultContract']);
    for (const [key, value] of Object.entries(data)) {
      if (!skip.has(key)) {
        const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
        snakeData[snakeKey] = value;
      }
    }

    // Remove internal fields
    delete snakeData.id;
    delete snakeData.user_id;
    delete snakeData.created_at;
    delete snakeData.updated_at;

    if (Object.keys(snakeData).length === 0) return null;

    const fields = Object.keys(snakeData).map((key, i) => `${key} = $${i + 2}`).join(', ');
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

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresMetricsStorage {
  static async get(userId) {
    const r = await query('SELECT data FROM metrics WHERE user_id = $1', [userId]);
    return r.rows[0]?.data || {};
  }
  static async save(userId, data) {
    await query(`INSERT INTO metrics(user_id, data) VALUES($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET data=$2, updated_at=NOW()`,
      [userId, JSON.stringify(data)]);
  }
}

export class PostgresMetricsHistoryStorage {
  static async get(userId) {
    const r = await query('SELECT date, snapshot FROM metrics_history WHERE user_id=$1 ORDER BY date ASC', [userId]);
    return r.rows.map(row => ({ date: row.date.toISOString().slice(0,10), ...row.snapshot }));
  }
  static async append(userId, snapshot) {
    const date = new Date().toISOString().slice(0,10);
    await query(`INSERT INTO metrics_history(user_id, date, snapshot) VALUES($1,$2,$3)
      ON CONFLICT(user_id, date) DO UPDATE SET snapshot=$3`,
      [userId, date, JSON.stringify(snapshot)]);
    // Keep last 90 days
    await query(`DELETE FROM metrics_history WHERE user_id=$1 AND date < NOW() - INTERVAL '90 days'`, [userId]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Poll
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresLivePollStorage {
  static async get(userId) {
    const r = await query('SELECT data, contract_address, contract_chain, last_block, active FROM live_poll WHERE user_id=$1', [userId]);
    if (!r.rows[0]) return { lastBlock: null, updatedAt: null };
    const row = r.rows[0];
    return { ...row.data, contractAddress: row.contract_address, contractChain: row.contract_chain, lastBlock: row.last_block, active: row.active };
  }
  static async save(userId, data) {
    await query(`INSERT INTO live_poll(user_id, contract_address, contract_chain, last_block, active, data)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(user_id) DO UPDATE SET
        contract_address=$2, contract_chain=$3, last_block=$4, active=$5, data=$6, updated_at=NOW()`,
      [userId, data.contractAddress||null, data.contractChain||null,
       data.lastBlock||null, data.active||false, JSON.stringify(data)]);
  }
  static async getAllActive() {
    const r = await query('SELECT user_id, data, contract_address, contract_chain, last_block FROM live_poll WHERE active=true');
    return r.rows.map(row => ({ userId: row.user_id, ...row.data, contractAddress: row.contract_address, contractChain: row.contract_chain, lastBlock: row.last_block }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Traction
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresTractionStorage {
  static async get(userId) {
    const r = await query('SELECT productivity_score, tasks, last_checked FROM traction WHERE user_id=$1', [userId]);
    if (!r.rows[0]) return { productivityScore: 0, tasks: [], lastChecked: null, updatedAt: null };
    return { productivityScore: r.rows[0].productivity_score, tasks: r.rows[0].tasks || [], lastChecked: r.rows[0].last_checked, updatedAt: null };
  }
  static async save(userId, data) {
    await query(`INSERT INTO traction(user_id, productivity_score, tasks, last_checked)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(user_id) DO UPDATE SET productivity_score=$2, tasks=$3, last_checked=$4, updated_at=NOW()`,
      [userId, data.productivityScore||0, JSON.stringify(data.tasks||[]), data.lastChecked||null]);
    return data;
  }
  static async syncTasks(userId, generatedTasks) {
    const store = await this.get(userId);
    const existingMap = Object.fromEntries((store.tasks||[]).map(t => [t.id, t]));
    const failingIds = new Set(generatedTasks.map(t => t.id));
    const syncedFailing = generatedTasks.map(t => {
      const existing = existingMap[t.id];
      const userResolved = existing?.resolvedBy === 'user';
      return { ...t, status: userResolved ? 'resolved' : 'open', autoGreen: false,
        resolvedAt: existing?.resolvedAt||null, userFeedback: existing?.userFeedback||null,
        resolvedBy: existing?.resolvedBy||null, pendingConfirmation: userResolved };
    });
    const confirmedResolved = (store.tasks||[])
      .filter(t => t.resolvedBy === 'user' && !failingIds.has(t.id))
      .map(t => ({ ...t, pendingConfirmation: false, autoGreen: true }));
    store.tasks = [...syncedFailing, ...confirmedResolved];
    const resolved = store.tasks.filter(t => t.status === 'resolved').length;
    store.productivityScore = store.tasks.length ? Math.round((resolved/store.tasks.length)*100) : 0;
    store.lastChecked = new Date().toISOString();
    return this.save(userId, store);
  }
  static async resolveTask(userId, taskId, { resolvedBy='auto', userFeedback=null } = {}) {
    const store = await this.get(userId);
    const task = (store.tasks||[]).find(t => t.id === taskId);
    if (!task) return null;
    task.status = 'resolved'; task.autoGreen = resolvedBy==='auto';
    task.resolvedAt = new Date().toISOString(); task.resolvedBy = resolvedBy; task.userFeedback = userFeedback;
    const resolved = store.tasks.filter(t => t.status==='resolved').length;
    store.productivityScore = Math.round((resolved/store.tasks.length)*100);
    await this.save(userId, store);
    return task;
  }
  static async reopenTask(userId, taskId) {
    const store = await this.get(userId);
    const task = (store.tasks||[]).find(t => t.id === taskId);
    if (!task) return null;
    task.status = 'open'; task.autoGreen = false; task.resolvedAt = null; task.resolvedBy = null;
    const resolved = store.tasks.filter(t => t.status==='resolved').length;
    store.productivityScore = Math.round((resolved/store.tasks.length)*100);
    await this.save(userId, store);
    return task;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Configs
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAlertConfigStorage {
  static async create(configData) {
    const id = `alert-config-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
    const data = { ...configData, id };
    await query('INSERT INTO alert_configs(id, user_id, contract_id, data) VALUES($1,$2,$3,$4)',
      [id, configData.userId, configData.contractId||null, JSON.stringify(data)]);
    return data;
  }
  static async findById(id) {
    const r = await query('SELECT data FROM alert_configs WHERE id=$1', [id]);
    return r.rows[0]?.data || null;
  }
  static async findByUserId(userId) {
    const r = await query('SELECT data FROM alert_configs WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return r.rows.map(row => row.data);
  }
  static async findByUserAndContract(userId, contractId) {
    const r = await query('SELECT data FROM alert_configs WHERE user_id=$1 AND contract_id=$2 LIMIT 1', [userId, contractId]);
    return r.rows[0]?.data || null;
  }
  static async update(id, updates) {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await query('UPDATE alert_configs SET data=$2, updated_at=NOW() WHERE id=$1', [id, JSON.stringify(updated)]);
    return updated;
  }
  static async delete(id) {
    await query('DELETE FROM alert_configs WHERE id=$1', [id]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alerts (triggered notifications)
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAlertsStorage {
  static async findByUserId(userId) {
    const r = await query('SELECT id, type, message, is_read, acknowledged_at, data, created_at FROM alerts WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return r.rows.map(row => ({ id: row.id, userId, type: row.type, message: row.message, is_read: row.is_read, acknowledged_at: row.acknowledged_at, ...row.data, created_at: row.created_at }));
  }
  static async create(alertData) {
    const r = await query('INSERT INTO alerts(user_id, type, message, data) VALUES($1,$2,$3,$4) RETURNING id, created_at',
      [alertData.userId, alertData.type||null, alertData.message||null, JSON.stringify(alertData)]);
    return { ...alertData, id: r.rows[0].id, created_at: r.rows[0].created_at };
  }
  static async acknowledge(id, userId) {
    await query('UPDATE alerts SET is_read=true, acknowledged_at=NOW() WHERE id=$1 AND user_id=$2', [id, userId]);
  }
  static async readAll(userId) {
    await query('UPDATE alerts SET is_read=true WHERE user_id=$1', [userId]);
  }
  // Compatibility: read/write as array (used by AlertEngine inline code)
  static async readAll_array() {
    const r = await query('SELECT user_id, id, type, message, is_read, acknowledged_at, data, created_at FROM alerts ORDER BY created_at DESC');
    return r.rows.map(row => ({ ...row.data, id: row.id, userId: row.user_id, is_read: row.is_read, acknowledged_at: row.acknowledged_at }));
  }
  static async writeAll_array(alerts) {
    // Used only during migration — not for normal operation
    for (const a of alerts) {
      await query(`INSERT INTO alerts(id, user_id, type, message, is_read, data)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
        [a.id||crypto.randomUUID(), a.userId, a.type||null, a.message||null, a.is_read||false, JSON.stringify(a)]);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Config
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAgentConfigStorage {
  static async get(userId) {
    const r = await query('SELECT data FROM agent_configs WHERE user_id=$1', [userId]);
    return r.rows[0]?.data || null;
  }
  static async save(userId, data) {
    await query(`INSERT INTO agent_configs(user_id, data) VALUES($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET data=$2, updated_at=NOW()`,
      [userId, JSON.stringify(data)]);
    return data;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Memory
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAgentMemoryStorage {
  static async read(userId) {
    const r = await query('SELECT insights, resolved_issues, preferences, contract_summary FROM agent_memory WHERE user_id=$1', [userId]);
    if (!r.rows[0]) return { insights:[], resolvedIssues:[], preferences:[], contractSummary:null, updatedAt:null };
    const row = r.rows[0];
    return { insights: row.insights||[], resolvedIssues: row.resolved_issues||[], preferences: row.preferences||[], contractSummary: row.contract_summary, updatedAt: null };
  }
  static async write(userId, data) {
    await query(`INSERT INTO agent_memory(user_id, insights, resolved_issues, preferences, contract_summary)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(user_id) DO UPDATE SET insights=$2, resolved_issues=$3, preferences=$4, contract_summary=$5, updated_at=NOW()`,
      [userId, JSON.stringify(data.insights||[]), JSON.stringify(data.resolvedIssues||[]),
       JSON.stringify(data.preferences||[]), data.contractSummary||null]);
  }
  static async buildContext(userId) {
    const mem = await this.read(userId);
    const parts = [];
    if (mem.contractSummary) parts.push(`CONTRACT SUMMARY: ${mem.contractSummary}`);
    if (mem.insights?.length) parts.push(`PAST INSIGHTS:\n${mem.insights.slice(-5).map(i=>`- ${i}`).join('\n')}`);
    if (mem.resolvedIssues?.length) parts.push(`RESOLVED ISSUES:\n${mem.resolvedIssues.slice(-5).map(i=>`- ${i}`).join('\n')}`);
    if (mem.preferences?.length) parts.push(`USER PREFERENCES:\n${mem.preferences.slice(-3).map(p=>`- ${p}`).join('\n')}`);
    return parts.length ? `\n=== AGENT MEMORY ===\n${parts.join('\n')}\n` : '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Tasks
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAITasksStorage {
  static async readAll() {
    const r = await query('SELECT data FROM ai_tasks ORDER BY created_at ASC');
    return r.rows.map(row => row.data);
  }
  static async findByUserId(userId) {
    const r = await query('SELECT data FROM ai_tasks WHERE user_id=$1 ORDER BY created_at ASC', [userId]);
    return r.rows.map(row => row.data);
  }
  static async upsert(task) {
    await query(`INSERT INTO ai_tasks(id, user_id, data) VALUES($1,$2,$3)
      ON CONFLICT(id) DO UPDATE SET data=$3, updated_at=NOW()`,
      [task.id, task.userId, JSON.stringify(task)]);
    return task;
  }
  static async writeAll(tasks) {
    for (const t of tasks) await this.upsert(t);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Competitor Data
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresCompetitorDataStorage {
  static async get(userId, address, chain) {
    const r = await query('SELECT name, transactions, metrics, updated_at FROM competitor_data WHERE user_id=$1 AND address=$2 AND chain=$3',
      [userId, address.toLowerCase(), chain]);
    if (!r.rows[0]) return null;
    return { id: `${address.toLowerCase()}_${chain}`, address, chain, name: r.rows[0].name, transactions: r.rows[0].transactions||[], metrics: r.rows[0].metrics||{}, lastUpdated: r.rows[0].updated_at };
  }
  static async save(userId, address, chain, data) {
    await query(`INSERT INTO competitor_data(user_id, address, chain, name, transactions, metrics)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(user_id, address, chain) DO UPDATE SET name=$4, transactions=$5, metrics=$6, updated_at=NOW()`,
      [userId, address.toLowerCase(), chain, data.name||null, JSON.stringify(data.transactions||[]), JSON.stringify(data.metrics||{})]);
  }
  static async findByUserId(userId) {
    const r = await query('SELECT address, chain, name, transactions, metrics, updated_at FROM competitor_data WHERE user_id=$1', [userId]);
    return r.rows.map(row => ({ id: `${row.address}_${row.chain}`, address: row.address, chain: row.chain, name: row.name, transactions: row.transactions||[], metrics: row.metrics||{}, lastUpdated: row.updated_at }));
  }
  static async delete(userId, address, chain) {
    await query('DELETE FROM competitor_data WHERE user_id=$1 AND address=$2 AND chain=$3', [userId, address.toLowerCase(), chain]);
  }
}

export class PostgresCompetitorMetricsStorage {
  static async get(userId) {
    const r = await query('SELECT data FROM competitor_metrics WHERE user_id=$1', [userId]);
    return r.rows[0]?.data || {};
  }
  static async save(userId, data) {
    await query(`INSERT INTO competitor_metrics(user_id, data) VALUES($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET data=$2, updated_at=NOW()`,
      [userId, JSON.stringify(data)]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Social Posts
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresSocialPostsStorage {
  static async readLog(userId) {
    const r = await query('SELECT platform, content, status, data, created_at FROM social_posts WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return r.rows.map(row => ({ ...row.data, platform: row.platform, content: row.content, status: row.status, createdAt: row.created_at }));
  }
  static async appendLog(userId, entry) {
    await query('INSERT INTO social_posts(user_id, platform, content, status, data) VALUES($1,$2,$3,$4,$5)',
      [userId, entry.platform||null, entry.postText||entry.content||null, entry.status||null, JSON.stringify(entry)]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefings
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresBriefingsStorage {
  static async readAll() {
    const r = await query('SELECT user_id, id, type, title, content, data, created_at FROM briefings ORDER BY created_at DESC');
    return r.rows.map(row => ({ ...row.data, id: row.id, userId: row.user_id, type: row.type, title: row.title, content: row.content, createdAt: row.created_at }));
  }
  static async append(entry) {
    await query('INSERT INTO briefings(id, user_id, type, title, content, data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',
      [entry.id||`briefing-${Date.now()}`, entry.userId, entry.type||null, entry.title||null, entry.content||null, JSON.stringify(entry)]);
  }
  static async findByUserId(userId, type) {
    let sql = 'SELECT user_id, id, type, title, content, data, created_at FROM briefings WHERE user_id=$1';
    const params = [userId];
    if (type) { sql += ' AND type=$2'; params.push(type); }
    sql += ' ORDER BY created_at DESC';
    const r = await query(sql, params);
    return r.rows.map(row => ({ ...row.data, id: row.id, userId: row.user_id, type: row.type, title: row.title, content: row.content, createdAt: row.created_at }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Advice
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAIAdviceStorage {
  static async readAll() {
    const r = await query('SELECT user_id, data, created_at FROM ai_advice ORDER BY created_at DESC');
    return r.rows.map(row => ({ ...row.data, userId: row.user_id, createdAt: row.created_at }));
  }
  static async findByUserId(userId) {
    const r = await query('SELECT data, created_at FROM ai_advice WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return r.rows.map(row => ({ ...row.data, createdAt: row.created_at }));
  }
  static async append(entry) {
    await query('INSERT INTO ai_advice(user_id, data) VALUES($1,$2)', [entry.userId, JSON.stringify(entry)]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Insights
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAIInsightsStorage {
  static async readAll() {
    const r = await query('SELECT user_id, data, created_at FROM ai_insights ORDER BY created_at DESC');
    return r.rows.map(row => ({ ...row.data, userId: row.user_id, createdAt: row.created_at }));
  }
  static async findByUserId(userId) {
    const r = await query('SELECT data, created_at FROM ai_insights WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return r.rows.map(row => ({ ...row.data, createdAt: row.created_at }));
  }
  static async append(entry) {
    await query('INSERT INTO ai_insights(user_id, data) VALUES($1,$2)', [entry.userId||null, JSON.stringify(entry)]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Tokens
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresShareTokensStorage {
  static async readAll() {
    const r = await query('SELECT token, contract_id, user_id, expires_at, revoked, created_at FROM share_tokens');
    return r.rows.map(row => ({ token: row.token, contractId: row.contract_id, userId: row.user_id, expiresAt: row.expires_at, revoked: row.revoked, createdAt: row.created_at }));
  }
  static async append(entry) {
    await query('INSERT INTO share_tokens(token, contract_id, user_id, expires_at, revoked) VALUES($1,$2,$3,$4,$5) ON CONFLICT(token) DO NOTHING',
      [entry.token, entry.contractId, entry.userId, entry.expiresAt||null, entry.revoked||false]);
  }
  static async findByToken(token) {
    const r = await query('SELECT token, contract_id, user_id, expires_at, revoked, created_at FROM share_tokens WHERE token=$1', [token]);
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return { token: row.token, contractId: row.contract_id, userId: row.user_id, expiresAt: row.expires_at, revoked: row.revoked, createdAt: row.created_at };
  }
  static async revoke(token) {
    await query('UPDATE share_tokens SET revoked=true WHERE token=$1', [token]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresFeedbackStorage {
  static async readAll() {
    const r = await query('SELECT user_id, message_id, session_id, rating, note, component_type, saved_at FROM feedback ORDER BY saved_at DESC');
    return r.rows.map(row => ({ userId: row.user_id, messageId: row.message_id, sessionId: row.session_id, rating: row.rating, note: row.note, componentType: row.component_type, savedAt: row.saved_at }));
  }
  static async findByUserId(userId) {
    const r = await query('SELECT message_id, session_id, rating, note, component_type, saved_at FROM feedback WHERE user_id=$1 ORDER BY saved_at DESC', [userId]);
    return r.rows.map(row => ({ messageId: row.message_id, sessionId: row.session_id, rating: row.rating, note: row.note, componentType: row.component_type, savedAt: row.saved_at }));
  }
  static async append(entry) {
    await query('INSERT INTO feedback(user_id, message_id, session_id, rating, note, component_type) VALUES($1,$2,$3,$4,$5,$6)',
      [entry.userId||null, entry.messageId||null, entry.sessionId||null, entry.rating||null, entry.note||null, entry.componentType||null]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Abuse Fingerprints
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAbuseFingerprintsStorage {
  static async read() {
    const r = await query('SELECT data FROM abuse_fingerprints WHERE id=1');
    return r.rows[0]?.data || { fingerprints:{}, emailDomains:{}, contractAddresses:{} };
  }
  static async write(data) {
    await query(`INSERT INTO abuse_fingerprints(id, data) VALUES(1,$1)
      ON CONFLICT(id) DO UPDATE SET data=$1, updated_at=NOW()`, [JSON.stringify(data)]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Benchmarks
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresBenchmarksStorage {
  static async read() {
    const r = await query('SELECT data FROM benchmarks WHERE id=1');
    return r.rows[0]?.data || {};
  }
  static async write(data) {
    await query(`INSERT INTO benchmarks(id, data) VALUES(1,$1)
      ON CONFLICT(id) DO UPDATE SET data=$1, updated_at=NOW()`, [JSON.stringify(data)]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Learnings
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresAILearningsStorage {
  static async getAll() {
    const r = await query('SELECT task_id, feedback, metric_before, metric_after, chain, contract_type, saved_at FROM ai_learnings ORDER BY saved_at ASC');
    return r.rows.map(row => ({ taskId: row.task_id, feedback: row.feedback, metricBefore: row.metric_before, metricAfter: row.metric_after, chain: row.chain, contractType: row.contract_type, savedAt: row.saved_at }));
  }
  static async append(entry) {
    await query('INSERT INTO ai_learnings(task_id, feedback, metric_before, metric_after, chain, contract_type) VALUES($1,$2,$3,$4,$5,$6)',
      [entry.taskId||null, entry.feedback||null, entry.metricBefore ? JSON.stringify(entry.metricBefore) : null,
       entry.metricAfter ? JSON.stringify(entry.metricAfter) : null, entry.chain||'ethereum', entry.contractType||'unknown']);
  }
  static async getForTask(taskId) {
    const r = await query('SELECT * FROM ai_learnings WHERE task_id=$1 ORDER BY saved_at ASC', [taskId]);
    return r.rows.map(row => ({ taskId: row.task_id, feedback: row.feedback, metricBefore: row.metric_before, metricAfter: row.metric_after, chain: row.chain, contractType: row.contract_type, savedAt: row.saved_at }));
  }
}

export class PostgresFunctionAnalyticsStorage {
  static async get(contractAddress, chain, type) {
    const r = await query('SELECT data FROM function_analytics WHERE contract_address=$1 AND chain=$2 AND type=$3',
      [contractAddress, chain, type]);
    return r.rows[0]?.data || [];
  }
  static async save(contractAddress, chain, type, data) {
    await query(`INSERT INTO function_analytics(contract_address, chain, type, data)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(contract_address, chain, type) DO UPDATE SET data=$4, updated_at=NOW()`,
      [contractAddress, chain, type, JSON.stringify(data)]);
  }
  static async delete(contractAddress, chain) {
    await query('DELETE FROM function_analytics WHERE contract_address=$1 AND chain=$2', [contractAddress, chain]);
  }
}

export class PostgresFunnelStorage {
  static async getFunnels(contractId) {
    const r = await query('SELECT id, name, steps, created_at FROM funnels WHERE contract_id=$1', [contractId]);
    return r.rows.map(row => ({ id: row.id, contractId, name: row.name, steps: row.steps, createdAt: row.created_at }));
  }
  static async saveFunnel(contractId, name, steps) {
    const id = `${contractId}-${Date.now()}`;
    await query('INSERT INTO funnels(id, contract_id, name, steps) VALUES($1,$2,$3,$4)',
      [id, contractId, name, JSON.stringify(steps)]);
    return { id, contractId, name, steps, createdAt: new Date().toISOString() };
  }
  static async getFunnel(funnelId) {
    const r = await query('SELECT id, contract_id, name, steps, created_at FROM funnels WHERE id=$1', [funnelId]);
    if (!r.rows[0]) return null;
    return { id: r.rows[0].id, contractId: r.rows[0].contract_id, name: r.rows[0].name, steps: r.rows[0].steps, createdAt: r.rows[0].created_at };
  }
  static async getFunctionMappings(contractId) {
    const r = await query('SELECT signature, display_name FROM function_mappings WHERE contract_id=$1', [contractId]);
    return r.rows.map(row => ({ contractId, signature: row.signature, displayName: row.display_name }));
  }
  static async saveFunctionMapping(contractId, signature, displayName) {
    await query(`INSERT INTO function_mappings(contract_id, signature, display_name)
      VALUES($1,$2,$3)
      ON CONFLICT(contract_id, signature) DO UPDATE SET display_name=$3, updated_at=NOW()`,
      [contractId, signature, displayName]);
    return { contractId, signature, displayName };
  }
}

export class PostgresCompetitorAnalysesStorage {
  static async get(competitorId) {
    const r = await query('SELECT data FROM competitor_analyses WHERE id=$1', [competitorId]);
    return r.rows[0]?.data || null;
  }
  static async save(competitorId, data) {
    await query(`INSERT INTO competitor_analyses(id, address, chain, status, data)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(id) DO UPDATE SET status=$4, data=$5, updated_at=NOW()`,
      [competitorId, data.address||'', data.chain||'ethereum', data.status||'pending', JSON.stringify(data)]);
  }
  static async readAll() {
    const r = await query('SELECT id, data FROM competitor_analyses');
    return Object.fromEntries(r.rows.map(row => [row.id, row.data]));
  }
}

export class PostgresWalletEnrichmentStorage {
  static async getCache(contractAddress, chain) {
    const r = await query('SELECT wallet_address, data FROM wallet_enrichment WHERE contract_address=$1 AND chain=$2',
      [contractAddress, chain]);
    return Object.fromEntries(r.rows.map(row => [row.wallet_address, row.data]));
  }
  static async saveWallet(contractAddress, chain, walletAddress, data) {
    await query(`INSERT INTO wallet_enrichment(contract_address, chain, wallet_address, data, enriched_at)
      VALUES($1,$2,$3,$4,NOW())
      ON CONFLICT(contract_address, chain, wallet_address) DO UPDATE SET data=$4, enriched_at=NOW()`,
      [contractAddress, chain, walletAddress.toLowerCase(), JSON.stringify(data)]);
  }
}

export class PostgresWalletPipelineStorage {
  static async readQueue(contractAddress, chain) {
    const r = await query('SELECT queue FROM wallet_pipeline WHERE contract_address=$1 AND chain=$2',
      [contractAddress, chain]);
    return r.rows[0]?.queue || { pending: [], processing: [], dlq: [] };
  }
  static async writeQueue(contractAddress, chain, q) {
    await query(`INSERT INTO wallet_pipeline(contract_address, chain, queue)
      VALUES($1,$2,$3)
      ON CONFLICT(contract_address, chain) DO UPDATE SET queue=$3, updated_at=NOW()`,
      [contractAddress, chain, JSON.stringify(q)]);
  }
}

export class PostgresPatternProfileStorage {
  static async get(userId) {
    const r = await query('SELECT profile FROM pattern_profiles WHERE user_id=$1', [userId]);
    return r.rows[0]?.profile || null;
  }
  static async save(userId, profile) {
    await query(`INSERT INTO pattern_profiles(user_id, profile, updated_at)
      VALUES($1,$2,NOW())
      ON CONFLICT(user_id) DO UPDATE SET profile=$2, updated_at=NOW()`,
      [userId, JSON.stringify(profile)]);
  }
}

export class PostgresMilestoneStorage {
  static async getReached(userId) {
    const r = await query('SELECT milestone FROM milestone_events WHERE user_id=$1', [userId]);
    return r.rows.map(r => r.milestone);
  }
  static async markReached(userId, milestone) {
    await query(
      'INSERT INTO milestone_events(user_id, milestone) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [userId, milestone]
    );
  }
}
