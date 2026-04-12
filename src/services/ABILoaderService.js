/**
 * ABI Loader Service
 * Loads contract ABIs and initializes function decoder
 */

import { ContractStorage } from '../api/database/index.js';
import { functionDecoder } from './FunctionSignatureDecoder.js';

export class ABILoaderService {
  async loadContractABI(contractAddress, chain) {
    try {
      const contracts = await ContractStorage.findAll();
      const contract = contracts.find(c =>
        c.targetAddress?.toLowerCase() === contractAddress.toLowerCase() &&
        c.targetChain?.toLowerCase() === chain.toLowerCase()
      );
      if (!contract || !contract.targetAbi) {
        console.warn(`No ABI found for contract ${contractAddress} on ${chain}`);
        return false;
      }
      const abi = typeof contract.targetAbi === 'string' ? JSON.parse(contract.targetAbi) : contract.targetAbi;
      functionDecoder.loadABI(contractAddress, abi);
      return true;
    } catch (error) {
      console.error(`Error loading ABI for ${contractAddress}:`, error.message);
      return false;
    }
  }

  async loadAllABIs() {
    try {
      const contracts = await ContractStorage.findAll();
      let loaded = 0;
      for (const contract of contracts) {
        if (contract.targetAbi) {
          const abi = typeof contract.targetAbi === 'string' ? JSON.parse(contract.targetAbi) : contract.targetAbi;
          if (Array.isArray(abi)) { functionDecoder.loadABI(contract.targetAddress, abi); loaded++; }
        }
      }
      console.log(`Loaded ABIs for ${loaded} contracts`);
      return loaded;
    } catch (error) {
      console.error('Error loading ABIs:', error.message);
      return 0;
    }
  }

  isABILoaded(contractAddress) {
    return functionDecoder.hasABI(contractAddress);
  }
}

export const abiLoader = new ABILoaderService();
