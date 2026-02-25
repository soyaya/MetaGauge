/**
 * Function Signature Decoder
 * Maps function signatures to human-readable names from ABI
 */

import { ethers } from 'ethers';

export class FunctionSignatureDecoder {
  constructor() {
    // Cache for contract ABIs and their function mappings
    this.contractSignatures = new Map(); // contractAddress -> { signature -> name }
    
    // Fallback common signatures (when ABI not available)
    this.commonSignatures = {
      // ERC-20 Standard
      '0xa9059cbb': 'transfer',
      '0x23b872dd': 'transferFrom',
      '0x095ea7b3': 'approve',
      '0x70a08231': 'balanceOf',
      '0x18160ddd': 'totalSupply',
      '0xdd62ed3e': 'allowance',
      
      // ERC-721 NFT
      '0x42842e0e': 'safeTransferFrom',
      '0xb88d4fde': 'safeTransferFrom',
      '0x6352211e': 'ownerOf',
      '0x081812fc': 'getApproved',
      '0xe985e9c5': 'isApprovedForAll',
      '0xa22cb465': 'setApprovalForAll',
      
      // Uniswap V2
      '0x38ed1739': 'swapExactTokensForTokens',
      '0x8803dbee': 'swapTokensForExactTokens',
      '0x7ff36ab5': 'swapExactETHForTokens',
      '0x18cbafe5': 'swapExactTokensForETH',
      '0x02751cec': 'removeLiquidity',
      '0xe8e33700': 'addLiquidity',
      
      // Uniswap V3
      '0xc45a0155': 'exactInputSingle',
      '0x88316456': 'mint',
      '0x0c49ccbe': 'increaseLiquidity',
      
      // Common DeFi
      '0xb6b55f25': 'deposit',
      '0x2e1a7d4d': 'withdraw',
      '0xa694fc3a': 'stake',
      '0x2e17de78': 'unstake',
      '0x3d18b912': 'getReward'
    };
  }

  /**
   * Load ABI for a contract and extract function signatures
   */
  loadABI(contractAddress, abi) {
    if (!abi || !Array.isArray(abi)) {
      console.warn(`Invalid ABI for contract ${contractAddress}`);
      return;
    }

    const signatures = {};
    
    try {
      // Create interface from ABI
      const iface = new ethers.Interface(abi);
      
      // Extract all function signatures
      for (const fragment of iface.fragments) {
        if (fragment.type === 'function') {
          const signature = iface.getFunction(fragment.name).selector;
          signatures[signature.toLowerCase()] = fragment.name;
        }
      }
      
      this.contractSignatures.set(contractAddress.toLowerCase(), signatures);
      console.log(`Loaded ${Object.keys(signatures).length} function signatures for ${contractAddress}`);
      
    } catch (error) {
      console.error(`Error loading ABI for ${contractAddress}:`, error.message);
    }
  }

  /**
   * Decode function signature to name
   * Checks contract-specific ABI first, then falls back to common signatures
   */
  decode(signature, contractAddress = null) {
    if (!signature) return null;
    
    const normalized = signature.toLowerCase();
    
    // Try contract-specific ABI first
    if (contractAddress) {
      const contractSigs = this.contractSignatures.get(contractAddress.toLowerCase());
      if (contractSigs && contractSigs[normalized]) {
        return contractSigs[normalized];
      }
    }
    
    // Fall back to common signatures
    return this.commonSignatures[normalized] || null;
  }

  /**
   * Get display name (name or signature)
   */
  getDisplayName(signature, contractAddress = null) {
    const name = this.decode(signature, contractAddress);
    return name || signature;
  }

  /**
   * Check if contract ABI is loaded
   */
  hasABI(contractAddress) {
    return this.contractSignatures.has(contractAddress.toLowerCase());
  }

  /**
   * Get all function names for a contract
   */
  getContractFunctions(contractAddress) {
    const sigs = this.contractSignatures.get(contractAddress.toLowerCase());
    return sigs ? Object.values(sigs) : [];
  }
}

// Export singleton instance
export const functionDecoder = new FunctionSignatureDecoder();
