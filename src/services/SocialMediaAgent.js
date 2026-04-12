/**
 * SocialMediaAgent
 * AI-powered daily social media posting for business growth.
 * Generates and posts content to Twitter/X and LinkedIn using real contract metrics.
 * Scheduled daily via ProactiveAgent.
 */

import AgentService from './AgentService.js';
import { UserStorage, AnalysisStorage, SocialPostsStorage } from '../api/database/index.js';

async function readLog(userId) {
  return SocialPostsStorage.readLog(userId);
}
async function writeLog(userId, entry) {
  return SocialPostsStorage.appendLog(userId, entry);
}

// ── Twitter/X poster ─────────────────────────────────────────────────────────
async function postToTwitter(text, creds = {}) {
  const key    = creds.twitterApiKey;
  const secret = creds.twitterApiSecret;
  const token  = creds.twitterAccessToken;
  const tsecret= creds.twitterAccessSecret;
  if (!key || !token) return { ok: false, reason: 'Twitter credentials not configured' };

  try {
    // Use Twitter API v2
    const { default: OAuth } = await import('oauth-1.0a');
    const { default: crypto } = await import('crypto');
    const { default: fetch } = await import('node-fetch');

    const oauth = new OAuth({
      consumer: { key, secret },
      signature_method: 'HMAC-SHA1',
      hash_function: (base, k) => crypto.createHmac('sha1', k).update(base).digest('base64'),
    });

    const url = 'https://api.twitter.com/2/tweets';
    const tokenObj = { key: token, secret: tsecret };
    const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'POST' }, tokenObj));

    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return data.data?.id ? { ok: true, id: data.data.id } : { ok: false, reason: JSON.stringify(data) };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── LinkedIn poster ───────────────────────────────────────────────────────────
async function postToLinkedIn(text, creds = {}) {
  const accessToken = creds.linkedinAccessToken;
  const personUrn   = creds.linkedinPersonUrn;
  if (!accessToken || !personUrn) return { ok: false, reason: 'LinkedIn credentials not configured' };

  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${personUrn}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    const data = await res.json();
    return data.id ? { ok: true, id: data.id } : { ok: false, reason: JSON.stringify(data) };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── Content generator ─────────────────────────────────────────────────────────
const CONTENT_TYPES = [
  'growth_milestone',
  'user_insight',
  'market_position',
  'weekly_recap',
  'call_to_action',
];

async function generatePost(userId, contractAddress, chain, contentType) {
  const prompts = {
    growth_milestone: `You are a Web3 growth marketing expert. Write a compelling Twitter/LinkedIn post (max 280 chars for Twitter) celebrating a growth milestone for this smart contract. Use real metrics from get_metrics. Be specific with numbers. Include relevant hashtags. Format: just the post text.`,

    user_insight: `You are a Web3 marketing expert. Write an insightful post about user behavior patterns on this smart contract. Use real data from get_metrics. Highlight something surprising or impressive. Max 280 chars. Include hashtags.`,

    market_position: `You are a business growth expert. Write a post about this protocol's market position vs competitors. Use get_metrics and get_competitors. Show competitive advantage with real numbers. Max 280 chars. Include hashtags.`,

    weekly_recap: `You are a Web3 growth marketer. Write a weekly recap post for this smart contract. Use get_metrics and get_history to show week-over-week progress. Be data-driven and optimistic. Max 280 chars. Include hashtags.`,

    call_to_action: `You are a growth hacker. Write a compelling call-to-action post to drive more users to interact with this smart contract. Use real metrics to build credibility. Max 280 chars. Include hashtags and a sense of urgency.`,
  };

  const result = await AgentService.run(userId, prompts[contentType], {
    contractAddress,
    chain,
    source: 'marketing',
  });

  return result.content;
}

// ── Main: run daily social posting for a user ─────────────────────────────────
export async function runDailySocialPost(userId) {
  const user = await UserStorage.findById(userId);
  if (!user) return;

  const contract = user.onboarding?.defaultContract;
  if (!contract?.address || !contract?.isIndexed) return;

  // Use per-user credentials only — never fall back to platform env vars for user data
  const creds = user.socialCredentials || {};
  const hasTwitter  = !!(creds.twitterApiKey && creds.twitterAccessToken);
  const hasLinkedIn = !!(creds.linkedinAccessToken && creds.linkedinPersonUrn);
  if (!hasTwitter && !hasLinkedIn) {
    console.log(`[SocialMediaAgent] Skipping user ${userId} — no personal social credentials connected`);
    return;
  }

  // Pick today's content type (rotate through types)
  const log = await readLog(userId);
  const todayStr = new Date().toDateString();
  // In production, skip if already posted today. In dev, allow re-posting.
  if (process.env.NODE_ENV !== 'development' && log.some(e => e.date === todayStr)) return;

  const typeIndex = log.length % CONTENT_TYPES.length;
  const contentType = CONTENT_TYPES[typeIndex];

  console.log(`[SocialMediaAgent] Generating ${contentType} post for user ${userId}`);

  let postText;
  try {
    postText = await generatePost(userId, contract.address, contract.chain, contentType);
    if (!postText || postText.includes('AI unavailable')) return;
  } catch (err) {
    console.warn('[SocialMediaAgent] Content generation failed:', err.message);
    return;
  }

  // Post to configured platforms
  const results = {};

  if (hasTwitter) {
    results.twitter = await postToTwitter(postText, creds);
    console.log(`[SocialMediaAgent] Twitter: ${results.twitter.ok ? 'posted' : results.twitter.reason}`);
  }

  if (hasLinkedIn) {
    results.linkedin = await postToLinkedIn(postText, creds);
    console.log(`[SocialMediaAgent] LinkedIn: ${results.linkedin.ok ? 'posted' : results.linkedin.reason}`);
  }

  const entry = {
    date: todayStr,
    contentType,
    text: postText,
    platforms: results,
    contractAddress: contract.address,
    generatedAt: new Date().toISOString(),
  };
  await writeLog(userId, entry);

  return { postText, results };
}

// ── Get post history for a user ───────────────────────────────────────────────
export async function getSocialPostHistory(userId) {
  return readLog(userId);
}
