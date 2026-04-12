import { ExternalDataFetcher } from '../../ExternalDataFetcher.js';

export const schema = {
  name: 'get_market_context',
  description: 'Get external market data: chain TVL, category benchmarks, top protocols, ETH price.',
  parameters: {
    type: 'object',
    properties: {
      contractAddress: { type: 'string' },
      chain: { type: 'string' },
      category: { type: 'string', description: 'e.g. defi, nft, gaming' },
    },
    required: [],
  },
};

export async function execute(userId, args = {}, context = {}) {
  const address = args.contractAddress || context.contractAddress || '';
  const chain = args.chain || context.chain || 'ethereum';
  const category = args.category || 'defi';

  const data = await ExternalDataFetcher.getProtocolContext(address, chain, category).catch(() => ({}));
  return data;
}
