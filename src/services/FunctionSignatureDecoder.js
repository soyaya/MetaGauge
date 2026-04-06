/**
 * Function Signature Decoder
 * Maps 4-byte selectors to human-readable function names.
 * Uses a built-in database + live lookup via 4byte.directory API.
 */

import { ethers } from 'ethers';

export class FunctionSignatureDecoder {
  constructor() {
    this.contractSignatures = new Map(); // contractAddress -> { selector -> name }
    this._lookupCache = new Map();       // selector -> name (from API)

    // ── Built-in signature database ──────────────────────────────────────────
    this.commonSignatures = {
      // ERC-20
      '0xa9059cbb': 'transfer',
      '0x23b872dd': 'transferFrom',
      '0x095ea7b3': 'approve',
      '0x70a08231': 'balanceOf',
      '0x18160ddd': 'totalSupply',
      '0xdd62ed3e': 'allowance',
      '0x313ce567': 'decimals',
      '0x06fdde03': 'name',
      '0x95d89b41': 'symbol',
      '0x40c10f19': 'mint',
      '0x9dc29fac': 'burn',
      '0x79cc6790': 'burnFrom',

      // ERC-721
      '0x42842e0e': 'safeTransferFrom',
      '0xb88d4fde': 'safeTransferFrom',
      '0x6352211e': 'ownerOf',
      '0x081812fc': 'getApproved',
      '0xe985e9c5': 'isApprovedForAll',
      '0xa22cb465': 'setApprovalForAll',
      '0x4f6ccce7': 'tokenByIndex',
      '0x2f745c59': 'tokenOfOwnerByIndex',
      '0xc87b56dd': 'tokenURI',

      // ERC-1155
      '0x00fdd58e': 'balanceOf',
      '0x4e1273f4': 'balanceOfBatch',
      '0xf242432a': 'safeTransferFrom',
      '0x2eb2c2d6': 'safeBatchTransferFrom',

      // WETH
      '0xd0e30db0': 'deposit',
      '0x2e1a7d4d': 'withdraw',

      // Uniswap V2
      '0x38ed1739': 'swapExactTokensForTokens',
      '0x8803dbee': 'swapTokensForExactTokens',
      '0x7ff36ab5': 'swapExactETHForTokens',
      '0x18cbafe5': 'swapExactTokensForETH',
      '0x4a25d94a': 'swapTokensForExactETH',
      '0xfb3bdb41': 'swapETHForExactTokens',
      '0x02751cec': 'removeLiquidity',
      '0xe8e33700': 'addLiquidity',
      '0xf305d719': 'addLiquidityETH',
      '0xbaa2abde': 'removeLiquidity',
      '0x5c11d795': 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
      '0x791ac947': 'swapExactTokensForETHSupportingFeeOnTransferTokens',
      '0xb6f9de95': 'swapExactETHForTokensSupportingFeeOnTransferTokens',

      // Uniswap V3
      '0x414bf389': 'exactInputSingle',
      '0xc04b8d59': 'exactInput',
      '0xdb3e2198': 'exactOutputSingle',
      '0xf28c0498': 'exactOutput',
      '0x88316456': 'mint',
      '0x0c49ccbe': 'increaseLiquidity',
      '0xa34123a7': 'decreaseLiquidity',
      '0xfc6f7865': 'collect',
      '0x12210e8a': 'refundETH',
      '0x49404b7c': 'unwrapWETH9',
      '0xdf2ab5bb': 'sweepToken',
      '0xac9650d8': 'multicall',
      '0x1bc74526': 'multicall',
      '0x5ae401dc': 'multicall',

      // Uniswap Universal Router
      '0x3593564c': 'execute',
      '0x09c5eabe': 'execute',

      // 1inch
      '0x12aa3caf': 'swap',
      '0x07ed2379': 'swap',
      '0xe449022e': 'uniswapV3Swap',
      '0x2e95b6c8': 'unoswap',
      '0xf41766d8': 'clipperSwap',
      '0x84bd6d29': 'fillOrderRFQ',
      '0x5a099843': 'fillOrderRFQTo',
      '0xd0a3b665': 'fillOrderRFQToWithPermit',
      '0xb0431182': 'clipperSwapTo',
      '0x9994dd15': 'clipperSwapToWithPermit',

      // OpenSea / Seaport
      '0xfb0f3ee1': 'fulfillBasicOrder',
      '0x00000000': 'fulfillOrder',
      '0xed98a574': 'fulfillAdvancedOrder',
      '0x87201b41': 'fulfillAvailableOrders',
      '0x1a26b7b5': 'fulfillAvailableAdvancedOrders',
      '0xf2d12b12': 'matchOrders',
      '0x55944a42': 'matchAdvancedOrders',
      '0xfd9f1e10': 'cancel',
      '0xa2d99e1f': 'validate',
      '0x5b34b966': 'incrementCounter',
      '0x13d79a0b': 'settle',

      // ERC-4337 Account Abstraction
      '0x765e827f': 'handleOps',
      '0x1fad948c': 'handleAggregatedOps',
      '0x0396cb60': 'depositTo',
      '0x9b249f69': 'addStake',
      '0x35567e1a': 'unlockStake',
      '0xc23a5cea': 'withdrawStake',
      '0x205c2878': 'withdrawTo',
      '0x3a871cdd': 'executeUserOp',
      '0xb61d27f6': 'execute',
      '0x18dfb3c7': 'executeBatch',
      '0x2213bc0b': 'exec',

      // Permit2
      '0x0a2b8f36': 'permit2TransferAndMulticall',
      '0x33739082': 'permit2TransferAndMulticall',
      '0x2b67b570': 'permit',
      '0x2a2d80d1': 'permitTransferFrom',
      '0x30f28b7a': 'permitWitnessTransferFrom',
      '0x4fe02b44': 'permitBatch',
      '0x2b67b570': 'permit',

      // Relay / Bridge
      '0xdeff4b24': 'fillRelay',
      '0xa3443faa': 'swapAndStartBridgeTokensViaRelayDepository',
      '0xc3de453d': 'bridge',
      '0x5fd9ae2e': 'swapTokensMultipleV3ERC20ToERC20',

      // Aggregators / DEX
      '0x5f575529': 'swap',
      '0xe21fd0e9': 'swap',
      '0xf497df75': 'fillOrderArgs',
      '0xcf51607d': 'transfer',
      '0x7111a994': 'transfer',
      '0x6f074e32': 'batchSend',
      '0x6b13fcb1': 'batchTransfer',

      // Misc DeFi
      '0xb6b55f25': 'deposit',
      '0xa694fc3a': 'stake',
      '0x2e17de78': 'unstake',
      '0x3d18b912': 'getReward',
      '0xe9fad8ee': 'exit',
      '0x3ef13367': 'flushTokens',
      '0xa0712d68': 'mint',
      '0x4e71d92d': 'claim',
      '0x1e83409a': 'claim',
      '0x372500ab': 'claimRewards',
      '0x8fcbaf0c': 'permit',
      '0xd505accf': 'permit',

      // Proxy / Admin
      '0x3659cfe6': 'upgradeTo',
      '0x4f1ef286': 'upgradeToAndCall',
      '0x8f283970': 'changeAdmin',
      '0xcf7a1d77': 'initialize',
      '0x8129fc1c': 'initialize',
      '0x485cc955': 'initialize',

      // Common utility
      '0x5c975abb': 'paused',
      '0x8456cb59': 'pause',
      '0x3f4ba83a': 'unpause',
      '0xf2fde38b': 'transferOwnership',
      '0x715018a6': 'renounceOwnership',
      '0x8da5cb5b': 'owner',

      // xSUSHI / SushiBar
      '0xa59f3e0c': 'enter',
      '0x67dfd4c9': 'leave',

      // Paraswap v5 router (0x1f2f10d1...)
      '0x2b2f5d4c': 'multiSwap (Paraswap)',
      '0x2b2f5d54': 'multiSwap (Paraswap)',
      '0x2b2f5d55': 'multiSwap (Paraswap)',
      '0x2b2f5d56': 'multiSwap (Paraswap)',
      '0x2b2f5d57': 'multiSwap (Paraswap)',
      '0x2b2f5d5a': 'multiSwap (Paraswap)',
      '0x2b2f5d64': 'multiSwap (Paraswap)',
      '0x2b2f5d65': 'multiSwap (Paraswap)',
      '0x2b2f5d6b': 'multiSwap (Paraswap)',
      '0x2b2f5d6d': 'multiSwap (Paraswap)',
      '0x2b2f5d6e': 'multiSwap (Paraswap)',
      '0x2b2f5d70': 'multiSwap (Paraswap)',
      '0x2b2f5d74': 'multiSwap (Paraswap)',
      '0x2b2f5d76': 'multiSwap (Paraswap)',
      '0x2b2f5d77': 'multiSwap (Paraswap)',
      '0x2b2f5d8a': 'multiSwap (Paraswap)',
      '0x2b2f5d8d': 'multiSwap (Paraswap)',
      '0x2b2f5d8e': 'multiSwap (Paraswap)',
      '0x2b2f5da5': 'multiSwap (Paraswap)',
      '0x2b2f5d09': 'multiSwap (Paraswap)',
      '0x2b2f5c01': 'multiSwap (Paraswap)',
      '0x2b333f01': 'swapOnUniswap (Paraswap)',
      '0x2b60ac8b': 'swapOnUniswapV2Fork (Paraswap)',
      '0x2b6641e9': 'swapOnZeroXv4 (Paraswap)',
      '0x2b95aa6e': 'swapOnCurve (Paraswap)',
      '0x2bd0a0b8': 'megaSwap (Paraswap)',
      '0x2bd0dac1': 'megaSwap (Paraswap)',
      '0x2bd07fc6': 'megaSwap (Paraswap)',
      '0x853bcc43': 'swapOnBalancer (Paraswap)',
      '0x091bab65': 'swapOnAugustus (Paraswap)',
      '0x842b290f': 'swapOnAugustus (Paraswap)',

      // Seaport / OpenSea (0x0000000000...)
      '0xdd227118': 'fulfillAvailableAdvancedOrders (Seaport)',
      '0x44227118': 'fulfillAvailableOrders (Seaport)',
      '0xf30d1f36': 'matchOrders (Seaport)',
      '0x2a0d1f36': 'matchAdvancedOrders (Seaport)',
      '0xee0d1f36': 'cancel (Seaport)',

      // Misc aggregators
      '0x01017a63': 'swap (CoW Protocol)',
      '0x0af20008': 'swap (KyberSwap)',
      '0x07be0008': 'swap (KyberSwap)',
      '0xf20d7336': 'swap (Odos)',
      '0x432b7d0d': 'swap (Odos)',
      '0xc1000000': 'execute (Relay)',
    };
  }

  /**
   * Load ABI for a contract and extract function signatures
   */
  loadABI(contractAddress, abi) {
    if (!abi || !Array.isArray(abi)) return;
    const signatures = {};
    try {
      const iface = new ethers.Interface(abi);
      for (const fragment of iface.fragments) {
        if (fragment.type === 'function') {
          const selector = iface.getFunction(fragment.name).selector;
          signatures[selector.toLowerCase()] = fragment.name;
        }
      }
      this.contractSignatures.set(contractAddress.toLowerCase(), signatures);
    } catch (error) {
      console.warn(`Error loading ABI for ${contractAddress}:`, error.message);
    }
  }

  /**
   * Decode a 4-byte selector to a function name.
   * Order: contract ABI → built-in DB → API cache → returns null
   */
  decode(signature, contractAddress = null) {
    if (!signature) return null;
    const normalized = signature.toLowerCase();

    // 1. Contract-specific ABI
    if (contractAddress) {
      const contractSigs = this.contractSignatures.get(contractAddress.toLowerCase());
      if (contractSigs?.[normalized]) return contractSigs[normalized];
    }

    // 2. Built-in database
    if (this.commonSignatures[normalized]) return this.commonSignatures[normalized];

    // 3. API lookup cache
    if (this._lookupCache.has(normalized)) return this._lookupCache.get(normalized);

    return null;
  }

  /**
   * Decode with router context — when tx.to !== contractAddress, label as indirect
   */
  decodeWithContext(signature, txTo, contractAddress) {
    const name = this.decode(signature, contractAddress);
    if (!name) return null;
    if (txTo && contractAddress && txTo.toLowerCase() !== contractAddress.toLowerCase()) {
      // Already has router label e.g. "multiSwap (Paraswap)" — return as-is
      if (name.includes('(')) return name;
      return `${name} (via router)`;
    }
    return name;
  }

  /**
   * Decode with router context — when tx.to !== contractAddress, label it as indirect
   */
  decodeWithContext(signature, txTo, contractAddress) {
    const name = this.decode(signature, contractAddress);
    if (!name) return null;
    // If the tx went to a different address, it's an indirect call via router
    if (txTo && contractAddress && txTo.toLowerCase() !== contractAddress.toLowerCase()) {
      // Already labelled with router name (e.g. "multiSwap (Paraswap)") — return as-is
      if (name.includes('(')) return name;
      return `${name} (via router)`;
    }
    return name;
  }

  /**
   * Lookup unknown signatures from 4byte.directory API.
   * Call this once with all unknown selectors to batch-resolve them.
   */
  async lookupUnknown(signatures) {
    const unknown = signatures.filter(s => !this.decode(s));
    if (!unknown.length) return;

    for (const sig of unknown) {
      try {
        const res = await fetch(
          `https://www.4byte.directory/api/v1/signatures/?hex_signature=${sig}&format=json`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.results?.length > 0) {
          // Take the most common result (lowest ID = oldest/most established)
          const best = data.results.sort((a, b) => a.id - b.id)[0];
          const name = best.text_signature.split('(')[0];
          this._lookupCache.set(sig.toLowerCase(), name);
          console.log(`🔍 Resolved ${sig} → ${name}`);
        }
      } catch (_) {
        // API unavailable — skip silently
      }
    }
  }

  getDisplayName(signature, contractAddress = null) {
    return this.decode(signature, contractAddress) || signature;
  }

  hasABI(contractAddress) {
    return this.contractSignatures.has(contractAddress.toLowerCase());
  }

  getContractFunctions(contractAddress) {
    const sigs = this.contractSignatures.get(contractAddress.toLowerCase());
    return sigs ? Object.values(sigs) : [];
  }
}

export const functionDecoder = new FunctionSignatureDecoder();
