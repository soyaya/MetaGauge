/**
 * File-based data storage system
 * Per-user isolated storage: data/users/{userId}/ for all analytics data
 * Global: data/users.json for auth only
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function userDir(userId) {
  return path.join(DATA_DIR, 'users', userId);
}
function userFile(userId, name) {
  return path.join(userDir(userId), name);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// ── Atomic read/write ────────────────────────────────────────────────────────

export async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    if (!data || data.trim() === '') {
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
      const backupPath = `${filePath}.backup`;
      try {
        const backupData = await fs.readFile(backupPath, 'utf8');
        console.log(`✅ Recovered from backup: ${backupPath}`);
        return JSON.parse(backupData);
      } catch {
        console.error(`❌ Backup recovery failed, using default value`);
        return defaultValue;
      }
    }
    throw error;
  }
}

export async function writeJsonFile(filePath, data) {
  await ensureDir(path.dirname(filePath));
  const json = JSON.stringify(data, null, 2);
  try {
    try { await fs.copyFile(filePath, `${filePath}.backup`); } catch { /* new file */ }
    await fs.writeFile(filePath, json, 'utf8');
  } catch (error) {
    console.error(`❌ Failed to write ${filePath}:`, error.message);
    throw error;
  }
}

// ── UserStorage (global — auth only) ────────────────────────────────────────

export class UserStorage {
  static async findAll() {
    return readJsonFile(USERS_FILE, []);
  }

  static async findById(id) {
    const users = await this.findAll();
    return users.find(u => u.id === id) || null;
  }

  static async findByEmail(email) {
    const users = await this.findAll();
    return users.find(u => u.email === email) || null;
  }

  static async findByApiKey(apiKey) {
    const users = await this.findAll();
    return users.find(u => u.apiKey === apiKey) || null;
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
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    await writeJsonFile(USERS_FILE, users);
    return users[idx];
  }

  static async delete(id) {
    const users = await this.findAll();
    await writeJsonFile(USERS_FILE, users.filter(u => u.id !== id));
    return true;
  }
}

// ── ContractStorage (per-user) ───────────────────────────────────────────────

export class ContractStorage {
  static _file(userId) { return userFile(userId, 'contracts.json'); }

  static async findAll() {
    // Aggregate across all users for admin use
    const users = await UserStorage.findAll();
    const all = [];
    for (const u of users) {
      const contracts = await readJsonFile(this._file(u.id), []);
      all.push(...contracts);
    }
    return all;
  }

  static async findById(id) {
    const all = await this.findAll();
    return all.find(c => c.id === id) || null;
  }

  static async findByUserId(userId, filters = {}) {
    let contracts = await readJsonFile(this._file(userId), []);
    if (filters.isActive !== undefined) contracts = contracts.filter(c => c.isActive === filters.isActive);
    return contracts;
  }

  static async create(contractData) {
    const { userId } = contractData;
    const contracts = await readJsonFile(this._file(userId), []);
    const newContract = {
      id: crypto.randomUUID(),
      ...contractData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    contracts.push(newContract);
    await writeJsonFile(this._file(userId), contracts);
    return newContract;
  }

  static async update(id, updates) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const contracts = await readJsonFile(this._file(u.id), []);
      const idx = contracts.findIndex(c => c.id === id);
      if (idx !== -1) {
        contracts[idx] = { ...contracts[idx], ...updates, updatedAt: new Date().toISOString() };
        await writeJsonFile(this._file(u.id), contracts);
        return contracts[idx];
      }
    }
    return null;
  }

  static async delete(id) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const contracts = await readJsonFile(this._file(u.id), []);
      const filtered = contracts.filter(c => c.id !== id);
      if (filtered.length !== contracts.length) {
        await writeJsonFile(this._file(u.id), filtered);
        return true;
      }
    }
    return false;
  }

  static async countByUserId(userId) {
    const contracts = await readJsonFile(this._file(userId), []);
    return contracts.filter(c => c.isActive !== false).length;
  }
}

// ── AnalysisStorage (per-user) ───────────────────────────────────────────────

export class AnalysisStorage {
  static _file(userId) { return userFile(userId, 'analyses.json'); }

  static async findAll() {
    const users = await UserStorage.findAll();
    const all = [];
    for (const u of users) {
      const analyses = await readJsonFile(this._file(u.id), []);
      all.push(...analyses);
    }
    return all;
  }

  static async findById(id) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const analyses = await readJsonFile(this._file(u.id), []);
      const found = analyses.find(a => a.id === id);
      if (found) return found;
    }
    return null;
  }

  static async findByUserId(userId, filters = {}) {
    let analyses = await readJsonFile(this._file(userId), []);
    if (filters.status) analyses = analyses.filter(a => a.status === filters.status);
    return analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async create(analysisData) {
    const { userId } = analysisData;
    const analyses = await readJsonFile(this._file(userId), []);
    const newAnalysis = {
      id: crypto.randomUUID(),
      ...analysisData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    analyses.push(newAnalysis);
    await writeJsonFile(this._file(userId), analyses);
    return newAnalysis;
  }

  static async update(id, updates) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const analyses = await readJsonFile(this._file(u.id), []);
      const idx = analyses.findIndex(a => a.id === id);
      if (idx !== -1) {
        analyses[idx] = { ...analyses[idx], ...updates, updatedAt: new Date().toISOString() };
        await writeJsonFile(this._file(u.id), analyses);
        return analyses[idx];
      }
    }
    return null;
  }

  static async getStats(userId) {
    const analyses = await this.findByUserId(userId);
    return {
      total: analyses.length,
      completed: analyses.filter(a => a.status === 'completed').length,
      failed: analyses.filter(a => a.status === 'failed').length,
      pending: analyses.filter(a => ['pending', 'running'].includes(a.status)).length,
      avgExecutionTime: 0
    };
  }

  static async getMonthlyCount(userId, monthStart) {
    const analyses = await this.findByUserId(userId);
    return analyses.filter(a => new Date(a.createdAt) >= monthStart).length;
  }
}

// ── MetricsStorage (per-user) ────────────────────────────────────────────────

export class MetricsStorage {
  static _file(userId) { return userFile(userId, 'metrics.json'); }

  static async get(userId) {
    return readJsonFile(this._file(userId), {});
  }

  static async save(userId, metrics) {
    await writeJsonFile(this._file(userId), { ...metrics, updatedAt: new Date().toISOString() });
  }
}

// ── MetricsHistoryStorage — daily snapshots per user ─────────────────────────
export class MetricsHistoryStorage {
  static _file(userId) { return userFile(userId, 'metrics_history.json'); }

  static async append(userId, snapshot) {
    const history = await readJsonFile(this._file(userId), []);
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // One snapshot per day — overwrite if same date
    const idx = history.findIndex(h => h.date === date);
    if (idx >= 0) history[idx] = { date, ...snapshot };
    else history.push({ date, ...snapshot });
    // Keep last 90 days
    const trimmed = history.sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
    await writeJsonFile(this._file(userId), trimmed);
  }

  static async get(userId) {
    return readJsonFile(this._file(userId), []);
  }
}

// ── LivePollStorage (per-user) ───────────────────────────────────────────────

export class LivePollStorage {
  static _file(userId) { return userFile(userId, 'live_poll.json'); }

  static async get(userId) {
    return readJsonFile(this._file(userId), { lastBlock: null, updatedAt: null });
  }

  static async save(userId, data) {
    await writeJsonFile(this._file(userId), { ...data, updatedAt: new Date().toISOString() });
  }

  static async getAllActive() {
    try {
      const { readdir } = await import("fs/promises");
      const { join } = await import("path");
      const usersDir = join(process.cwd(), "data", "users");
      const userDirs = await readdir(usersDir).catch(() => []);
      const results = [];
      for (const userId of userDirs) {
        const poll = await this.get(userId);
        if (poll && poll.active && poll.contractAddress) {
          results.push({ userId, ...poll });
        }
      }
      return results;
    } catch { return []; }
  }
}

// ── ChatSessionStorage (per-user) ────────────────────────────────────────────

export class ChatSessionStorage {
  static _file(userId) { return userFile(userId, 'chat_sessions.json'); }

  static async findAll() {
    const users = await UserStorage.findAll();
    const all = [];
    for (const u of users) {
      const sessions = await readJsonFile(this._file(u.id), []);
      all.push(...sessions);
    }
    return all;
  }

  static async findById(id) {
    const all = await this.findAll();
    return all.find(s => s.id === id) || null;
  }

  static async findByUserId(userId, filters = {}) {
    let sessions = await readJsonFile(this._file(userId), []);
    if (filters.contractAddress) sessions = sessions.filter(s => s.contractAddress === filters.contractAddress);
    if (filters.contractChain) sessions = sessions.filter(s => s.contractChain === filters.contractChain);
    return sessions.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  static async findByContract(userId, contractAddress, contractChain) {
    const sessions = await this.findByUserId(userId, { contractAddress, contractChain });
    return sessions[0] || null;
  }

  static async create(sessionData) {
    const { userId } = sessionData;
    const sessions = await readJsonFile(this._file(userId), []);
    const newSession = {
      id: crypto.randomUUID(),
      ...sessionData,
      messageCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    sessions.push(newSession);
    await writeJsonFile(this._file(userId), sessions);
    return newSession;
  }

  static async update(id, updates) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const sessions = await readJsonFile(this._file(u.id), []);
      const idx = sessions.findIndex(s => s.id === id);
      if (idx !== -1) {
        sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
        await writeJsonFile(this._file(u.id), sessions);
        return sessions[idx];
      }
    }
    return null;
  }

  static async delete(id) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const sessions = await readJsonFile(this._file(u.id), []);
      const filtered = sessions.filter(s => s.id !== id);
      if (filtered.length !== sessions.length) {
        await writeJsonFile(this._file(u.id), filtered);
        return true;
      }
    }
    return false;
  }
}

// ── ChatMessageStorage (per-user) ────────────────────────────────────────────

export class ChatMessageStorage {
  static _file(userId) { return userFile(userId, 'chat_messages.json'); }

  static async findAll() {
    const users = await UserStorage.findAll();
    const all = [];
    for (const u of users) {
      const msgs = await readJsonFile(this._file(u.id), []);
      all.push(...msgs);
    }
    return all;
  }

  static async findById(id) {
    const all = await this.findAll();
    return all.find(m => m.id === id) || null;
  }

  static async findBySessionId(sessionId, limit = 50, offset = 0) {
    const all = await this.findAll();
    const msgs = all
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return msgs.slice(offset, offset + limit);
  }

  static async getRecentContext(sessionId, limit = 10) {
    const messages = await this.findBySessionId(sessionId, limit);
    return messages.slice(-limit);
  }

  static async create(messageData) {
    // Find which user owns this session
    const session = await ChatSessionStorage.findById(messageData.sessionId);
    const userId = session?.userId || messageData.userId;
    if (!userId) throw new Error('Cannot determine userId for message');

    const msgs = await readJsonFile(this._file(userId), []);
    const newMsg = {
      id: crypto.randomUUID(),
      ...messageData,
      createdAt: new Date().toISOString()
    };
    msgs.push(newMsg);
    await writeJsonFile(this._file(userId), msgs);

    // Update session message count
    if (session) {
      await ChatSessionStorage.update(session.id, {
        messageCount: (session.messageCount || 0) + 1,
        lastMessageAt: newMsg.createdAt
      });
    }

    return newMsg;
  }

  static async update(id, updates) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const msgs = await readJsonFile(this._file(u.id), []);
      const idx = msgs.findIndex(m => m.id === id);
      if (idx !== -1) {
        msgs[idx] = { ...msgs[idx], ...updates };
        await writeJsonFile(this._file(u.id), msgs);
        return msgs[idx];
      }
    }
    return null;
  }

  static async delete(id) {
    const users = await UserStorage.findAll();
    for (const u of users) {
      const msgs = await readJsonFile(this._file(u.id), []);
      const filtered = msgs.filter(m => m.id !== id);
      if (filtered.length !== msgs.length) {
        await writeJsonFile(this._file(u.id), filtered);
        return true;
      }
    }
    return false;
  }
}

// ── Storage initialisation ───────────────────────────────────────────────────

export async function initializeStorage() {
  await ensureDir(DATA_DIR);
  await ensureDir(path.join(DATA_DIR, 'users'));
  // Ensure global users file exists
  await readJsonFile(USERS_FILE, []);
  // Ensure per-user dirs exist for all known users
  const users = await UserStorage.findAll();
  for (const u of users) {
    await ensureDir(userDir(u.id));
  }
  console.log('✅ File storage initialized successfully');
  return true;
}

export default {
  UserStorage,
  ContractStorage,
  AnalysisStorage,
  MetricsStorage,
  LivePollStorage,
  ChatSessionStorage,
  ChatMessageStorage,
  initialize: initializeStorage
};
