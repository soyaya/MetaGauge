import { SentimentAnalyzer } from '../../SentimentAnalyzer.js';

export const schema = {
  name: 'get_sentiment',
  description: 'Get social sentiment analysis for a token: sentiment score, community size, price momentum, narrative velocity, bot likelihood. Uses CoinGecko + Twitter. Call this when asked about community sentiment, social activity, hype, or market perception.',
  parameters: {
    type: 'object',
    properties: {
      contractAddress: { type: 'string', description: 'Token contract address' },
      chain:           { type: 'string', description: 'Chain: ethereum | base | bnb | arbitrum' },
      twitterHandle:   { type: 'string', description: 'Twitter/X handle without @ e.g. uniswap' },
    },
    required: [],
  },
};

export async function execute(userId, args = {}, context = {}) {
  const address = args.contractAddress || context.contractAddress;
  const chain   = args.chain || context.chain || 'ethereum';
  if (!address) return { error: 'contractAddress is required' };
  return SentimentAnalyzer.analyze(address, chain, args.twitterHandle || null);
}
