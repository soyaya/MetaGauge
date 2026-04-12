import fs from 'fs/promises';
import path from 'path';
import { AlertConfiguration } from '../models/AlertConfiguration.js';

const DIR = path.resolve('./data/alert-configs');

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}

async function readConfig(id) {
  try {
    const data = await fs.readFile(path.join(DIR, `${id}.json`), 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeConfig(id, data) {
  await ensureDir();
  await fs.writeFile(path.join(DIR, `${id}.json`), JSON.stringify(data, null, 2), 'utf8');
}

class AlertConfigurationStorage {
  async create(configData) {
    const config = new AlertConfiguration(configData);
    config.id = `alert-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Preserve extra fields not in the base model (type, competitorId, metric, condition, threshold, name)
    const raw = { ...config.toJSON(), ...Object.fromEntries(
      ['type','competitorId','metric','condition','threshold','name']
        .filter(k => configData[k] != null)
        .map(k => [k, configData[k]])
    )};
    await writeConfig(config.id, raw);
    return raw;
  }

  async findById(id) {
    const data = await readConfig(id);
    return data ? new AlertConfiguration(data) : null;
  }

  async findByUserId(userId) {
    await ensureDir();
    const files = await fs.readdir(DIR);
    const configs = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(DIR, file), 'utf8'));
        if (data?.userId === userId) configs.push(data); // return raw to preserve custom fields
      } catch {}
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
      updatedAt: new Date().toISOString(),
    });
    await writeConfig(id, updated.toJSON());
    return updated;
  }

  async delete(id) {
    try {
      await fs.unlink(path.join(DIR, `${id}.json`));
    } catch {}
  }
}

export default new AlertConfigurationStorage();
