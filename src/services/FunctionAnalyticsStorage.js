/**
 * FunctionAnalyticsStorage — delegates to database/index.js (postgres or file)
 */
import { FunctionAnalyticsStorage as _Storage } from '../api/database/index.js';

export class FunctionAnalyticsStorage {
  constructor() {}

  async getSignatures(contractAddress, chain) {
    return _Storage.get(contractAddress, chain, 'signatures');
  }
  async saveSignatures(contractAddress, chain, signatures) {
    return _Storage.save(contractAddress, chain, 'signatures', signatures);
  }
  async getInteractions(contractAddress, chain) {
    return _Storage.get(contractAddress, chain, 'interactions');
  }
  async saveInteractions(contractAddress, chain, interactions) {
    return _Storage.save(contractAddress, chain, 'interactions', interactions);
  }
  async appendInteraction(contractAddress, chain, interaction) {
    const interactions = await this.getInteractions(contractAddress, chain);
    interactions.push(interaction);
    return this.saveInteractions(contractAddress, chain, interactions);
  }
  async getJourneys(contractAddress, chain) {
    return _Storage.get(contractAddress, chain, 'journeys');
  }
  async saveJourneys(contractAddress, chain, journeys) {
    return _Storage.save(contractAddress, chain, 'journeys', journeys);
  }
  async getCohorts(contractAddress, chain) {
    return _Storage.get(contractAddress, chain, 'cohorts');
  }
  async saveCohorts(contractAddress, chain, cohorts) {
    return _Storage.save(contractAddress, chain, 'cohorts', cohorts);
  }
  async deleteContractData(contractAddress, chain) {
    return _Storage.delete(contractAddress, chain);
  }
}
