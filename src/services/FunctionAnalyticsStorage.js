/**
 * File-based storage layer for Function Analytics
 * Requirements: 2.1, 3.1, 4.3
 */

import fs from 'fs/promises';
import path from 'path';

export class FunctionAnalyticsStorage {
  constructor(baseDir = './data/function-analytics') {
    this.baseDir = baseDir;
  }

  getContractDir(contractAddress, chain) {
    return path.join(this.baseDir, `${contractAddress}_${chain}`);
  }

  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async readJSON(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async writeJSON(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // Function Signatures
  async getSignatures(contractAddress, chain) {
    const contractDir = this.getContractDir(contractAddress, chain);
    const filePath = path.join(contractDir, 'signatures.json');
    return await this.readJSON(filePath) || [];
  }

  async saveSignatures(contractAddress, chain, signatures) {
    const contractDir = this.getContractDir(contractAddress, chain);
    await this.ensureDir(contractDir);
    const filePath = path.join(contractDir, 'signatures.json');
    await this.writeJSON(filePath, signatures);
  }

  // Wallet Interactions
  async getInteractions(contractAddress, chain) {
    const contractDir = this.getContractDir(contractAddress, chain);
    const filePath = path.join(contractDir, 'interactions.json');
    return await this.readJSON(filePath) || [];
  }

  async saveInteractions(contractAddress, chain, interactions) {
    const contractDir = this.getContractDir(contractAddress, chain);
    await this.ensureDir(contractDir);
    const filePath = path.join(contractDir, 'interactions.json');
    await this.writeJSON(filePath, interactions);
  }

  async appendInteraction(contractAddress, chain, interaction) {
    const interactions = await this.getInteractions(contractAddress, chain);
    interactions.push(interaction);
    await this.saveInteractions(contractAddress, chain, interactions);
  }

  // User Journeys
  async getJourneys(contractAddress, chain) {
    const contractDir = this.getContractDir(contractAddress, chain);
    const filePath = path.join(contractDir, 'journeys.json');
    return await this.readJSON(filePath) || [];
  }

  async saveJourneys(contractAddress, chain, journeys) {
    const contractDir = this.getContractDir(contractAddress, chain);
    await this.ensureDir(contractDir);
    const filePath = path.join(contractDir, 'journeys.json');
    await this.writeJSON(filePath, journeys);
  }

  // Cohort Metrics
  async getCohorts(contractAddress, chain) {
    const contractDir = this.getContractDir(contractAddress, chain);
    const filePath = path.join(contractDir, 'cohorts.json');
    return await this.readJSON(filePath) || [];
  }

  async saveCohorts(contractAddress, chain, cohorts) {
    const contractDir = this.getContractDir(contractAddress, chain);
    await this.ensureDir(contractDir);
    const filePath = path.join(contractDir, 'cohorts.json');
    await this.writeJSON(filePath, cohorts);
  }

  // Cleanup
  async deleteContractData(contractAddress, chain) {
    const contractDir = this.getContractDir(contractAddress, chain);
    try {
      await fs.rm(contractDir, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
