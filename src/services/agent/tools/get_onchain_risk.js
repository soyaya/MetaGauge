import { OnChainRiskAnalyzer } from '../../OnChainRiskAnalyzer.js';
import { ContractStorage } from '../../../api/database/index.js';

export const schema = {
  name: 'get_onchain_risk',
  description: 'Perform deep on-chain risk analysis: contract ownership, holder concentration, proxy/upgrade risk. Call this when asked about rug pull risk, contract safety, whale concentration, or ownership.',
  parameters: {
    type: 'object',
    properties: {
      contractAddress: { type: 'string', description: 'Contract address to analyze' },
      chain: { type: 'string', description: 'Chain: ethereum | starknet' },
    },
    required: [],
  },
};

export async function execute(userId, args = {}, context = {}) {
  const address = args.contractAddress || context.contractAddress;
  const chain   = args.chain || context.chain || 'ethereum';

  if (!address) {
    // Try to get from user's contracts
    const contracts = await ContractStorage.findByUserId(userId).catch(() => []);
    const contract  = contracts[0];
    if (!contract?.address) return { error: 'No contract address found. Please provide one.' };
    return OnChainRiskAnalyzer.analyze(contract.address, contract.chain || 'ethereum');
  }

  return OnChainRiskAnalyzer.analyze(address, chain);
}
