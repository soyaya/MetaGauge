/**
 * Alert Configuration Storage
 * File-based storage for user alert preferences
 */

import { FileStorageManager } from '../../indexer/services/FileStorageManager.js';
import { AlertConfiguration } from '../models/AlertConfiguration.js';

class AlertConfigurationStorage {
  constructor() {
    this.storage = new FileStorageManager('./data/alert-configs');
  }

  async create(configData) {
    const config = new AlertConfiguration(configData);
    config.id = `alert-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.storage.writeJSON(`${config.id}.json`, config.toJSON());
    return config;
  }

  async findById(id) {
    const data = await this.storage.readJSON(`${id}.json`);
    return data ? new AlertConfiguration(data) : null;
  }

  async findByUserId(userId) {
    const files = await this.storage.listFiles();
    const configs = [];
    
    for (const file of files) {
      const data = await this.storage.readJSON(file);
      if (data && data.userId === userId) {
        configs.push(new AlertConfiguration(data));
      }
    }
    
    return configs;
  }

  async findByUserAndContract(userId, contractId) {
    const configs = await this.findByUserId(userId);
    return configs.find(c => c.contractId === contractId) || null;
  }

  async update(id, updates) {
    const existing = await this.findById(id);
    if (!existing) return null;
    
    const updated = new AlertConfiguration({
      ...existing.toJSON(),
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    await this.storage.writeJSON(`${id}.json`, updated.toJSON());
    return updated;
  }

  async delete(id) {
    await this.storage.deleteFile(`${id}.json`);
  }
}

export default new AlertConfigurationStorage();
