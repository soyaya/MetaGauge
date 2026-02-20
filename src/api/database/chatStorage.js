/**
 * Chat storage system for AI conversations
 * File-based storage for chat sessions and messages
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = './data';
const CHAT_SESSIONS_FILE = path.join(DATA_DIR, 'chat_sessions.json');
const CHAT_MESSAGES_FILE = path.join(DATA_DIR, 'chat_messages.json');

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
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeJsonFile(filePath, defaultValue);
      return defaultValue;
    }
    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Simple session class
class ChatSession {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    this.contractAddress = data.contractAddress;
    this.contractChain = data.contractChain;
    this.contractName = data.contractName || 'Unknown Contract';
    this.title = data.title || `Chat: ${this.contractName}`;
    this.isActive = data.isActive !== false;
    this.lastMessageAt = data.lastMessageAt || null;
    this.messageCount = data.messageCount || 0;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      contractAddress: this.contractAddress,
      contractChain: this.contractChain,
      contractName: this.contractName,
      title: this.title,
      isActive: this.isActive,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// Simple message class
class ChatMessage {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.sessionId = data.sessionId;
    this.role = data.role; // 'user' | 'assistant' | 'system'
    this.content = data.content; // Text content
    this.components = data.components || []; // Structured components for rendering
    this.metadata = data.metadata || {};
    this.isStreaming = data.isStreaming || false;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      role: this.role,
      content: this.content,
      components: this.components,
      metadata: this.metadata,
      isStreaming: this.isStreaming,
      createdAt: this.createdAt
    };
  }
}

// Chat Session operations
class ChatSessionStorage {
  static async findAll() {
    const data = await readJsonFile(CHAT_SESSIONS_FILE, []);
    return data.map(item => new ChatSession(item));
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
    const sessions = await readJsonFile(CHAT_SESSIONS_FILE, []);
    const newSession = new ChatSession({
      ...sessionData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    sessions.push(newSession.toJSON());
    await writeJsonFile(CHAT_SESSIONS_FILE, sessions);
    return newSession;
  }

  static async update(id, updates) {
    const sessions = await readJsonFile(CHAT_SESSIONS_FILE, []);
    const sessionIndex = sessions.findIndex(session => session.id === id);
    if (sessionIndex === -1) return null;

    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await writeJsonFile(CHAT_SESSIONS_FILE, sessions);
    return new ChatSession(sessions[sessionIndex]);
  }

  static async delete(id) {
    const sessions = await readJsonFile(CHAT_SESSIONS_FILE, []);
    const sessionIndex = sessions.findIndex(session => session.id === id);
    if (sessionIndex === -1) return null;

    sessions[sessionIndex].isActive = false;
    sessions[sessionIndex].updatedAt = new Date().toISOString();
    await writeJsonFile(CHAT_SESSIONS_FILE, sessions);
    return true;
  }
}

// Chat Message operations
class ChatMessageStorage {
  static async findAll() {
    const data = await readJsonFile(CHAT_MESSAGES_FILE, []);
    return data.map(item => new ChatMessage(item));
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
    const messages = await readJsonFile(CHAT_MESSAGES_FILE, []);
    const newMessage = new ChatMessage({
      ...messageData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    });
    
    messages.push(newMessage.toJSON());
    await writeJsonFile(CHAT_MESSAGES_FILE, messages);
    
    // Update session's last message time and count
    await ChatSessionStorage.update(newMessage.sessionId, {
      lastMessageAt: newMessage.createdAt,
      messageCount: messages.filter(m => m.sessionId === newMessage.sessionId).length
    });
    
    return newMessage;
  }

  static async update(id, updates) {
    const messages = await readJsonFile(CHAT_MESSAGES_FILE, []);
    const messageIndex = messages.findIndex(message => message.id === id);
    if (messageIndex === -1) return null;

    messages[messageIndex] = {
      ...messages[messageIndex],
      ...updates
    };
    
    await writeJsonFile(CHAT_MESSAGES_FILE, messages);
    return new ChatMessage(messages[messageIndex]);
  }

  static async getRecentContext(sessionId, limit = 10) {
    const messages = await this.findBySessionId(sessionId, limit);
    return messages.slice(-limit); // Get the most recent messages
  }
}

// Initialize chat storage
async function initializeChatStorage() {
  try {
    await ensureDataDir();
    console.log('✅ Chat storage initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Chat storage initialization failed:', error.message);
    throw error;
  }
}

// Export everything
export { ChatSessionStorage, ChatMessageStorage, initializeChatStorage };

export default {
  ChatSessionStorage,
  ChatMessageStorage,
  initializeChatStorage
};