/**
 * File-based data storage system
 * Uses JSON files for persistence instead of MongoDB
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use absolute path relative to project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTRACTS_FILE = path.join(DATA_DIR, 'contracts.json');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Generic file operations
async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    if (!data || data.trim() === '') {
      console.warn(`⚠️  Empty file ${filePath}, using default value`);
      await writeJsonFile(filePath, defaultValue);
      return defaultValue;
    }
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeJsonFile(filePath, defaultValue);
      return defaultValue;
    }
    if (error instanceof SyntaxError) {
      console.error(`❌ JSON parse error in ${filePath}:`, error.message);
      // Try to recover from backup
      const backupPath = `${filePath}.backup`;
      try {
        const backupData = await fs.readFile(backupPath, 'utf8');
        console.log(`✅ Recovered from backup: ${backupPath}`);
        return JSON.parse(backupData);
      } catch (backupError) {
        console.error(`❌ Backup recovery failed, using default value`);
        return defaultValue;
      }
    }
    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await ensureDataDir();
  
  // Create backup before writing
  try {
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      const backupPath = `${filePath}.backup`;
      await fs.copyFile(filePath, backupPath);
    }
  } catch (backupError) {
    console.warn(`⚠️  Backup failed for ${filePath}:`, backupError.message);
  }
  
  // Write directly (simpler approach for WSL compatibility)
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Failed to write ${filePath}:`, error.message);
    throw error;
  }
}

// User operations
export class UserStorage {
  static async findAll() {
    return await readJsonFile(USERS_FILE, []);
  }

  static async findById(id) {
    const users = await this.findAll();
    return users.find(user => user.id === id);
  }

  static async findByEmail(email) {
    const users = await this.findAll();
    return users.find(user => user.email === email);
  }

  static async findByApiKey(apiKey) {
    const users = await this.findAll();
    return users.find(user => user.apiKey === apiKey);
  }

  static async create(userData) {
    const users = await this.findAll();
    const newUser = {
      id: crypto.randomUUID(),
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    await writeJsonFile(USERS_FILE, users);
    return newUser;
  }

  static async update(id, updates) {
    const users = await this.findAll();
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await writeJsonFile(USERS_FILE, users);
    return users[userIndex];
  }

  static async delete(id) {
    const users = await this.findAll();
    const filteredUsers = users.filter(user => user.id !== id);
    await writeJsonFile(USERS_FILE, filteredUsers);
    return true;
  }
}

// Contract configuration operations
export class ContractStorage {
  static async findAll() {
    return await readJsonFile(CONTRACTS_FILE, []);
  }

  static async findById(id) {
    const contracts = await this.findAll();
    return contracts.find(contract => contract.id === id);
  }

  static async findByUserId(userId, filters = {}) {
    const contracts = await this.findAll();
    let userContracts = contracts.filter(contract => 
      contract.userId === userId && contract.isActive !== false
    );

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      userContracts = userContracts.filter(contract =>
        contract.name.toLowerCase().includes(searchLower) ||
        contract.description?.toLowerCase().includes(searchLower) ||
        contract.targetContract.name.toLowerCase().includes(searchLower)
      );
    }

    if (filters.chain) {
      userContracts = userContracts.filter(contract =>
        contract.targetContract.chain === filters.chain
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      userContracts = userContracts.filter(contract =>
        contract.tags && contract.tags.some(tag => filters.tags.includes(tag))
      );
    }

    return userContracts;
  }

  static async create(contractData) {
    const contracts = await this.findAll();
    const newContract = {
      id: crypto.randomUUID(),
      ...contractData,
      isActive: true,
      lastAnalyzed: null,
      analysisCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    contracts.push(newContract);
    await writeJsonFile(CONTRACTS_FILE, contracts);
    return newContract;
  }

  static async update(id, updates) {
    const contracts = await this.findAll();
    const contractIndex = contracts.findIndex(contract => contract.id === id);
    if (contractIndex === -1) return null;

    contracts[contractIndex] = {
      ...contracts[contractIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await writeJsonFile(CONTRACTS_FILE, contracts);
    return contracts[contractIndex];
  }

  static async delete(id) {
    const contracts = await this.findAll();
    const contractIndex = contracts.findIndex(contract => contract.id === id);
    if (contractIndex === -1) return null;

    contracts[contractIndex].isActive = false;
    contracts[contractIndex].updatedAt = new Date().toISOString();
    await writeJsonFile(CONTRACTS_FILE, contracts);
    return true;
  }

  static async countByUserId(userId) {
    const contracts = await this.findByUserId(userId);
    return contracts.length;
  }
}

// Analysis results operations
export class AnalysisStorage {
  static async findAll() {
    return await readJsonFile(ANALYSES_FILE, []);
  }

  static async findById(id) {
    const analyses = await this.findAll();
    return analyses.find(analysis => analysis.id === id);
  }

  static async findByUserId(userId, filters = {}) {
    const analyses = await this.findAll();
    let userAnalyses = analyses.filter(analysis => analysis.userId === userId);

    // Apply filters
    if (filters.status) {
      userAnalyses = userAnalyses.filter(analysis => analysis.status === filters.status);
    }

    if (filters.analysisType) {
      userAnalyses = userAnalyses.filter(analysis => analysis.analysisType === filters.analysisType);
    }

    // Sort by creation date (newest first)
    userAnalyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return userAnalyses;
  }

  static async create(analysisData) {
    const analyses = await this.findAll();
    const newAnalysis = {
      id: crypto.randomUUID(),
      ...analysisData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    analyses.push(newAnalysis);
    await writeJsonFile(ANALYSES_FILE, analyses);
    return newAnalysis;
  }

  static async update(id, updates) {
    const analyses = await this.findAll();
    const analysisIndex = analyses.findIndex(analysis => analysis.id === id);
    if (analysisIndex === -1) return null;

    analyses[analysisIndex] = {
      ...analyses[analysisIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await writeJsonFile(ANALYSES_FILE, analyses);
    return analyses[analysisIndex];
  }

  static async getStats(userId) {
    const analyses = await this.findByUserId(userId);
    
    const stats = {
      total: analyses.length,
      completed: analyses.filter(a => a.status === 'completed').length,
      failed: analyses.filter(a => a.status === 'failed').length,
      pending: analyses.filter(a => ['pending', 'running'].includes(a.status)).length,
      avgExecutionTime: 0
    };

    // Calculate average execution time
    const completedAnalyses = analyses.filter(a => a.status === 'completed' && a.metadata?.executionTimeMs);
    if (completedAnalyses.length > 0) {
      const totalTime = completedAnalyses.reduce((sum, a) => sum + a.metadata.executionTimeMs, 0);
      stats.avgExecutionTime = totalTime / completedAnalyses.length;
    }

    return stats;
  }

  static async getMonthlyCount(userId, monthStart) {
    const analyses = await this.findByUserId(userId);
    return analyses.filter(analysis => 
      new Date(analysis.createdAt) >= monthStart
    ).length;
  }
}

// Chat Session operations
export class ChatSessionStorage {
  static async findAll() {
    const data = await readJsonFile('./data/chat_sessions.json', []);
    return data.map(item => ({
      id: item.id,
      userId: item.userId,
      contractAddress: item.contractAddress,
      contractChain: item.contractChain,
      contractName: item.contractName || 'Unknown Contract',
      title: item.title || `Chat: ${item.contractName}`,
      isActive: item.isActive !== false,
      lastMessageAt: item.lastMessageAt || null,
      messageCount: item.messageCount || 0,
      metadata: item.metadata || {},
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  static async findById(id) {
    const sessions = await this.findAll();
    return sessions.find(session => session.id === id);
  }

  static async findByUserId(userId, filters = {}) {
    const sessions = await this.findAll();
    let userSessions = sessions.filter(session => 
      session.userId === userId && session.isActive !== false
    );

    // Apply filters
    if (filters.contractAddress) {
      userSessions = userSessions.filter(session =>
        session.contractAddress.toLowerCase() === filters.contractAddress.toLowerCase()
      );
    }

    if (filters.contractChain) {
      userSessions = userSessions.filter(session =>
        session.contractChain === filters.contractChain
      );
    }

    // Sort by last message date (most recent first)
    userSessions.sort((a, b) => {
      const aDate = new Date(a.lastMessageAt || a.createdAt);
      const bDate = new Date(b.lastMessageAt || b.createdAt);
      return bDate - aDate;
    });

    return userSessions;
  }

  static async findByContract(userId, contractAddress, contractChain) {
    const sessions = await this.findByUserId(userId, { contractAddress, contractChain });
    return sessions[0] || null; // Return the most recent session for this contract
  }

  static async create(sessionData) {
    const sessions = await readJsonFile('./data/chat_sessions.json', []);
    const newSession = {
      id: crypto.randomUUID(),
      ...sessionData,
      isActive: true,
      messageCount: 0,
      metadata: sessionData.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    sessions.push(newSession);
    await writeJsonFile('./data/chat_sessions.json', sessions);
    
    // Return the session object directly (no need for toJSON method)
    return newSession;
  }

  static async update(id, updates) {
    const sessions = await readJsonFile('./data/chat_sessions.json', []);
    const sessionIndex = sessions.findIndex(session => session.id === id);
    if (sessionIndex === -1) return null;

    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await writeJsonFile('./data/chat_sessions.json', sessions);
    return sessions[sessionIndex];
  }

  static async delete(id) {
    const sessions = await readJsonFile('./data/chat_sessions.json', []);
    const sessionIndex = sessions.findIndex(session => session.id === id);
    if (sessionIndex === -1) return null;

    sessions[sessionIndex].isActive = false;
    sessions[sessionIndex].updatedAt = new Date().toISOString();
    await writeJsonFile('./data/chat_sessions.json', sessions);
    return true;
  }
}

// Chat Message operations
export class ChatMessageStorage {
  static async findAll() {
    const data = await readJsonFile('./data/chat_messages.json', []);
    return data.map(item => ({
      id: item.id,
      sessionId: item.sessionId,
      role: item.role, // 'user' | 'assistant' | 'system'
      content: item.content,
      components: item.components || [],
      metadata: item.metadata || {},
      isStreaming: item.isStreaming || false,
      createdAt: item.createdAt
    }));
  }

  static async findBySessionId(sessionId, limit = 50, offset = 0) {
    const messages = await this.findAll();
    const sessionMessages = messages
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(offset, offset + limit);
    
    return sessionMessages;
  }

  static async create(messageData) {
    const messages = await readJsonFile('./data/chat_messages.json', []);
    const newMessage = {
      id: crypto.randomUUID(),
      ...messageData,
      components: messageData.components || [],
      metadata: messageData.metadata || {},
      isStreaming: messageData.isStreaming || false,
      createdAt: new Date().toISOString()
    };
    
    messages.push(newMessage);
    await writeJsonFile('./data/chat_messages.json', messages);
    
    // Update session's last message time and count
    await ChatSessionStorage.update(newMessage.sessionId, {
      lastMessageAt: newMessage.createdAt,
      messageCount: messages.filter(m => m.sessionId === newMessage.sessionId).length
    });
    
    return newMessage;
  }

  static async update(id, updates) {
    const messages = await readJsonFile('./data/chat_messages.json', []);
    const messageIndex = messages.findIndex(message => message.id === id);
    if (messageIndex === -1) return null;

    messages[messageIndex] = {
      ...messages[messageIndex],
      ...updates
    };
    
    await writeJsonFile('./data/chat_messages.json', messages);
    return messages[messageIndex];
  }

  static async getRecentContext(sessionId, limit = 10) {
    const messages = await this.findBySessionId(sessionId, limit);
    return messages.slice(-limit); // Get the most recent messages
  }
}

// Initialize storage
export async function initializeStorage() {
  try {
    await ensureDataDir();
    console.log('✅ File storage initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ File storage initialization failed:', error.message);
    throw error;
  }
}

export default {
  UserStorage,
  ContractStorage,
  AnalysisStorage,
  ChatSessionStorage,
  ChatMessageStorage,
  initialize: initializeStorage
};