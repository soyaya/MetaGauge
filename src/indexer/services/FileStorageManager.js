/**
 * File Storage Manager with atomic operations
 * Provides thread-safe file operations with backup and validation
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FileStorageManager {
  constructor(dataDir = './data') {
    this.dataDir = path.resolve(dataDir);
    this.locks = new Map();
  }

  /**
   * Initialize storage directory
   */
  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  /**
   * Acquire lock for file
   */
  async acquireLock(filePath) {
    while (this.locks.get(filePath)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.locks.set(filePath, true);
  }

  /**
   * Release lock for file
   */
  releaseLock(filePath) {
    this.locks.delete(filePath);
  }

  /**
   * Read JSON file with validation
   */
  async readJSON(fileName) {
    const filePath = path.join(this.dataDir, fileName);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to read ${fileName}: ${error.message}`);
    }
  }

  /**
   * Write JSON file atomically with backup
   */
  async writeJSON(fileName, data) {
    const filePath = path.join(this.dataDir, fileName);
    const backupPath = `${filePath}.backup`;
    const tempPath = `${filePath}.tmp`;

    await this.acquireLock(filePath);

    try {
      // Backup existing file
      try {
        await fs.copyFile(filePath, backupPath);
      } catch (error) {
        // File doesn't exist yet, skip backup
      }

      // Write to temp file
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, jsonData, 'utf-8');

      // Validate temp file
      const validation = await fs.readFile(tempPath, 'utf-8');
      JSON.parse(validation);

      // Atomic rename
      await fs.rename(tempPath, filePath);

      return true;
    } catch (error) {
      // Restore from backup on failure
      try {
        await fs.copyFile(backupPath, filePath);
      } catch {}
      throw new Error(`Failed to write ${fileName}: ${error.message}`);
    } finally {
      this.releaseLock(filePath);
    }
  }

  /**
   * Read users.json
   */
  async readUsers() {
    const users = await this.readJSON('users.json');
    return users || [];
  }

  /**
   * Write users.json
   */
  async writeUsers(users) {
    return this.writeJSON('users.json', users);
  }

  /**
   * Read analyses.json
   */
  async readAnalyses() {
    const analyses = await this.readJSON('analyses.json');
    return analyses || [];
  }

  /**
   * Write analyses.json
   */
  async writeAnalyses(analyses) {
    return this.writeJSON('analyses.json', analyses);
  }

  /**
   * Update user analysis incrementally
   */
  async updateUserAnalysis(userId, analysisId, updates) {
    await this.acquireLock('analyses.json');

    try {
      const analyses = await this.readAnalyses();
      const index = analyses.findIndex(a => a.id === analysisId && a.userId === userId);
      
      if (index === -1) {
        throw new Error('Analysis not found');
      }

      analyses[index] = { ...analyses[index], ...updates, updatedAt: new Date().toISOString() };
      await this.writeAnalyses(analyses);

      return analyses[index];
    } finally {
      this.releaseLock('analyses.json');
    }
  }

  /**
   * Health check for file storage
   */
  async checkHealth() {
    try {
      // Check directory access
      await fs.access(this.dataDir, fs.constants.R_OK | fs.constants.W_OK);

      // Check disk space
      const stats = await fs.statfs(this.dataDir);
      const freeSpacePercent = (stats.bavail / stats.blocks) * 100;

      return {
        healthy: freeSpacePercent > 10,
        freeSpacePercent: freeSpacePercent.toFixed(2),
        warning: freeSpacePercent < 10 ? 'Low disk space' : null
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}
