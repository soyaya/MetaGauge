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
  static async findAll() {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows.map(toCamelCase);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    
    const user = toCamelCase(result.rows[0]);
    
    // Fetch onboarding data
    const onboarding = await this.getOnboarding(id);
    if (onboarding) {
      user.onboarding = onboarding;
    }
    
    // Fetch preferences data
    const preferences = await this.getPreferences(id);
    if (preferences) {
      user.preferences = preferences;
    }
    
    return user;
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows[0]) return null;
    
    const user = toCamelCase(result.rows[0]);
    
    // Fetch onboarding data
    const onboarding = await this.getOnboarding(user.id);
    if (onboarding) {
      user.onboarding = onboarding;
    }
    
    // Fetch preferences data
    const preferences = await this.getPreferences(user.id);
    if (preferences) {
      user.preferences = preferences;
    }
    
    return user;
  }

  static async findByApiKey(apiKey) {
    const result = await query('SELECT * FROM users WHERE api_key = $1', [apiKey]);
    if (!result.rows[0]) return null;
    
    const user = toCamelCase(result.rows[0]);
    
    // Fetch onboarding data
    const onboarding = await this.getOnboarding(user.id);
    if (onboarding) {
      user.onboarding = onboarding;
    }
    
    // Fetch preferences data
    const preferences = await this.getPreferences(user.id);
    if (preferences) {
      user.preferences = preferences;
    }
    
    return user;
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
    // Handle onboarding and preferences separately
    if (updates.onboarding) {
      await this.updateOnboarding(id, updates.onboarding);
      delete updates.onboarding;
    }
    if (updates.preferences) {
      await this.updatePreferences(id, updates.preferences);
      delete updates.preferences;
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

    const result = await query(`
      UPDATE users 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, ...values]);

    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
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
    if (onboarding.socialLinks && typeof onboarding.socialLinks === 'string') {
      onboarding.socialLinks = JSON.parse(onboarding.socialLinks);
    }
    if (onboarding.defaultContract && typeof onboarding.defaultContract === 'string') {
      onboarding.defaultContract = JSON.parse(onboarding.defaultContract);
    }
    
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
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }

  static async updatePreferences(userId, data) {
    const snakeData = toSnakeCase(data);
    
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
      UPDATE user_preferences 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `, [userId, ...values]);

    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }
}

/**
 * PostgreSQL Contract Storage
 */
export class PostgresContractStorage {
  static async findAll() {
    const result = await query('SELECT * FROM contracts ORDER BY created_at DESC');
    return result.rows.map(toCamelCase);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM contracts WHERE id = $1', [id]);
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
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
    return result.rows.map(toCamelCase);
  }

  static async create(contractData) {
    const result = await query(`
      INSERT INTO contracts (
        user_id, name, description, target_address, target_chain,
        target_name, target_abi, tags, is_active, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      contractData.userId,
      contractData.name,
      contractData.description || null,
      contractData.targetContract?.address || contractData.target_address,
      contractData.targetContract?.chain || contractData.target_chain,
      contractData.targetContract?.name || contractData.target_name,
      contractData.targetContract?.abi || contractData.target_abi,
      contractData.tags || [],
      true,
      contractData.isDefault || false
    ]);

    return toCamelCase(result.rows[0]);
  }

  static async update(id, updates) {
    const snakeUpdates = toSnakeCase(updates);
    const fields = Object.keys(snakeUpdates)
      .filter(key => key !== 'id')
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.keys(snakeUpdates)
      .filter(key => key !== 'id')
      .map(key => snakeUpdates[key]);

    const result = await query(`
      UPDATE contracts 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, ...values]);

    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
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
}

/**
 * PostgreSQL Analysis Storage
 */
export class PostgresAnalysisStorage {
  static async findAll() {
    const result = await query('SELECT * FROM analyses ORDER BY created_at DESC');
    return result.rows.map(toCamelCase);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM analyses WHERE id = $1', [id]);
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
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
    return result.rows.map(toCamelCase);
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
    
    const fields = Object.keys(snakeUpdates)
      .filter(key => key !== 'id')
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.keys(snakeUpdates)
      .filter(key => key !== 'id')
      .map(key => snakeUpdates[key]);

    const result = await query(`
      UPDATE analyses 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, ...values]);

    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
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
    let sql = 'SELECT * FROM chat_sessions WHERE user_id = $1';
    const params = [userId];

    if (filters.isActive !== undefined) {
      sql += ' AND is_active = $2';
      params.push(filters.isActive);
    }

    sql += ' ORDER BY updated_at DESC';

    const result = await query(sql, params);
    return result.rows.map(toCamelCase);
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
    const fields = Object.keys(snakeUpdates)
      .filter(key => key !== 'id')
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = Object.keys(snakeUpdates)
      .filter(key => key !== 'id')
      .map(key => snakeUpdates[key]);

    const result = await query(`
      UPDATE chat_sessions 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, ...values]);

    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
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
    return result.rows.map(toCamelCase);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM chat_messages WHERE id = $1', [id]);
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }

  static async findBySessionId(sessionId) {
    const result = await query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );
    return result.rows.map(toCamelCase);
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

    return toCamelCase(result.rows[0]);
  }

  static async delete(id) {
    await query('DELETE FROM chat_messages WHERE id = $1', [id]);
    return true;
  }
}
