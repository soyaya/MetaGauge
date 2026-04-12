/**
 * ABI Loader Service
 * Loads contract ABIs and initializes function decoder
 */

import fs from 'fs/promises';
import path from 'path';
import { functionDecoder } from './FunctionSignatureDecoder.js';

export class ABILoaderService {
  constructor() {
    this.contractsFile = './data/contracts.json';
  }

  /**
   * Load ABI for a specific contract
   */
  async loadContractABI(contractAddress, chain) {
    try {
      // Read contracts database
      const data = await fs.readFile(this.contractsFile, 'utf-8');
      const contracts = JSON.parse(data);
      
      // Find matching contract
      const contract = contracts.find(c => 
        c.address.toLowerCase() === contractAddress.toLowerCase() && 
        c.chain.toLowerCase() === chain.toLowerCase()
      );
      
      if (!contract) {
        console.warn(`Contract ${contractAddress} on ${chain} not found in database`);
        return false;
      }
      
      if (!contract.abi || !Array.isArray(contract.abi)) {
        console.warn(`No ABI found for contract ${contractAddress}`);
        return false;
      }
      
      // Load ABI into decoder
      functionDecoder.loadABI(contractAddress, contract.abi);
      return true;
      
    } catch (error) {
      console.error(`Error loading ABI for ${contractAddress}:`, error.message);
      return false;
    }
  }

  /**
   * Load all contract ABIs
   */
  async loadAllABIs() {
    try {
      const data = await fs.readFile(this.contractsFile, 'utf-8');
      const contracts = JSON.parse(data);
      
      let loaded = 0;
      for (const contract of contracts) {
        if (contract.abi && Array.isArray(contract.abi)) {
          functionDecoder.loadABI(contract.address, contract.abi);
          loaded++;
        }
      }
      
      console.log(`Loaded ABIs for ${loaded} contracts`);
      return loaded;
      
    } catch (error) {
      console.error('Error loading ABIs:', error.message);
      return 0;
    }
  }

  /**
   * Check if ABI is loaded for contract
   */
  isABILoaded(contractAddress) {
    return functionDecoder.hasABI(contractAddress);
  }
}

// Export singleton instance
export const abiLoader = new ABILoaderService();
