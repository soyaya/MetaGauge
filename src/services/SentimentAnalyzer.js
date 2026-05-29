/**
 * SentimentAnalyzer
 * Fetches social sentiment for a token using:
 * 1. CoinGecko API (free) — sentiment votes, community data, social stats
 * 2. Twitter Bearer Token (optional) — recent tweet sentiment
 *
 * Returns sentimentScore (0–100), direction, botLikelihood, narrativeVelocity
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

async function cgFetch(path) {
  const res = await fetch(`${COINGECKO_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

// Search CoinGecko for a token by contract address or symbol
async function findCoinId(contractAddress, chain) {
  const chainMap = {
    ethereum: 'ethereum',
    base: 'base',
    bnb: 'binance-smart-chain',
    arbitrum: 'arbitrum-one',
  };
  const cgChain = chainMap[chain?.toLowerCase()] || 'ethereum';

  // Try by contract address first
  const byContract = await cgFetch(`/coins/${cgChain}/contract/${contractAddress}`);
  if (byContract?.id) return byContract.id;

  return null;
}

export class SentimentAnalyzer {
  /**
   * @param {string} contractAddress
   * @param {string} chain
   * @param {string} twitterHandle — optional e.g. 'uniswap'
   */
  static async analyze(contractAddress, chain = 'ethereum', twitterHandle = null) {
    const results = { source: [], sentimentScore: 50, direction: 'neutral', botLikelihood: 0 };

    // ── CoinGecko sentiment ───────────────────────────────────────────────────
    try {
      const coinId = await findCoinId(contractAddress, chain);
      if (coinId) {
        const coin = await cgFetch(`/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`);
        if (coin) {
          results.coinId   = coinId;
          results.coinName = coin.name;
          results.symbol   = coin.symbol?.toUpperCase();

          // Sentiment votes
          const upVotes   = coin.sentiment_votes_up_percentage   || 0;
          const downVotes = coin.sentiment_votes_down_percentage || 0;
          results.upVotesPct   = upVotes;
          results.downVotesPct = downVotes;

          // Community stats
          const community = coin.community_data || {};
          results.twitterFollowers  = community.twitter_followers || 0;
          results.redditSubscribers = community.reddit_subscribers || 0;
          results.telegramUsers     = community.telegram_channel_user_count || 0;

          // Price change as momentum signal
          const priceChange24h = coin.market_data?.price_change_percentage_24h || 0;
          const priceChange7d  = coin.market_data?.price_change_percentage_7d  || 0;
          results.priceChange24h = priceChange24h;
          results.priceChange7d  = priceChange7d;

          // Compute sentiment score from votes + price momentum
          const voteScore     = upVotes; // 0–100
          const momentumScore = Math.min(100, Math.max(0, 50 + priceChange7d * 2));
          results.sentimentScore = Math.round(voteScore * 0.6 + momentumScore * 0.4);
          results.direction = results.sentimentScore > 60 ? 'positive'
                            : results.sentimentScore < 40 ? 'negative'
                            : 'neutral';

          // Narrative velocity — how fast community is growing
          results.narrativeVelocity = computeVelocity(community);

          results.source.push('coingecko');
        }
      }
    } catch { /* CoinGecko unavailable — continue */ }

    // ── Twitter Bearer Token (optional) ──────────────────────────────────────
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (bearerToken && twitterHandle) {
      try {
        const query = encodeURIComponent(`from:${twitterHandle} -is:retweet lang:en`);
        const res = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=public_metrics`,
          { headers: { Authorization: `Bearer ${bearerToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const tweets = data.data || [];
          if (tweets.length > 0) {
            const totalEngagement = tweets.reduce((sum, t) => {
              const m = t.public_metrics || {};
              return sum + (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0);
            }, 0);
            results.twitterRecentTweets    = tweets.length;
            results.twitterAvgEngagement   = Math.round(totalEngagement / tweets.length);
            results.source.push('twitter');
          }
        }
      } catch { /* Twitter unavailable */ }
    }

    // Bot likelihood — heuristic: very high follower count + low engagement = bot risk
    if (results.twitterFollowers > 0 && results.twitterAvgEngagement !== undefined) {
      const engagementRate = results.twitterAvgEngagement / results.twitterFollowers * 100;
      results.botLikelihood = engagementRate < 0.01 ? 70
                            : engagementRate < 0.1  ? 40
                            : 10;
    }

    results.analyzedAt = new Date().toISOString();
    return results;
  }
}

function computeVelocity(community) {
  // Simple heuristic — large community = established, small = early
  const total = (community.twitter_followers || 0) +
                (community.reddit_subscribers || 0) * 2 +
                (community.telegram_channel_user_count || 0);
  if (total > 500000) return 'established';
  if (total > 50000)  return 'growing';
  if (total > 5000)   return 'early';
  return 'nascent';
}
