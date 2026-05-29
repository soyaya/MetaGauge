import 'dotenv/config';

export default {
  port: process.env.PORT || 5001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/metagauge-agent',
  jwtSecret: process.env.JWT_SECRET,           // shared with main app
  mainAppUrl: process.env.MAIN_APP_URL || 'http://localhost:5000',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  githubToken: process.env.GITHUB_TOKEN,
  twitterBearerToken: process.env.TWITTER_BEARER_TOKEN,
  ethereumRpc: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  nodeEnv: process.env.NODE_ENV || 'development',
};
