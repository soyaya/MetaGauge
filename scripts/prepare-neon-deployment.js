#!/usr/bin/env node

/**
 * Neon + Render Deployment Preparation Script
 * Validates environment and prepares for production deployment
 */

import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

console.log('🚀 MetaGauge - Neon + Render Deployment Checker\n');
console.log('═'.repeat(60));

// Color helpers
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

const checks = {
  critical: [],
  warnings: [],
  info: []
};

function checkCritical(condition, message, fix) {
  if (!condition) {
    checks.critical.push({ message, fix });
    console.log(`${colors.red('✗')} ${message}`);
    if (fix) console.log(`  ${colors.yellow('→')} ${fix}\n`);
  } else {
    console.log(`${colors.green('✓')} ${message}`);
  }
}

function checkWarning(condition, message, fix) {
  if (!condition) {
    checks.warnings.push({ message, fix });
    console.log(`${colors.yellow('⚠')} ${message}`);
    if (fix) console.log(`  ${colors.yellow('→')} ${fix}\n`);
  } else {
    console.log(`${colors.green('✓')} ${message}`);
  }
}

function checkInfo(value, message) {
  checks.info.push({ message, value });
  console.log(`${colors.blue('ℹ')} ${message}: ${colors.bold(value)}`);
}

async function runChecks() {
  // Check 1: Database Configuration
  console.log('\n📊 Database Configuration\n');
  
  const dbType = process.env.DATABASE_TYPE;
  checkCritical(
    dbType === 'postgres',
    'DATABASE_TYPE is set to "postgres"',
    'Add DATABASE_TYPE=postgres to your .env'
  );
  
  const dbUrl = process.env.DATABASE_URL;
  checkCritical(
    dbUrl && dbUrl.startsWith('postgresql://'),
    'DATABASE_URL is configured',
    'Get connection string from Neon dashboard and add to .env'
  );
  
  if (dbUrl) {
    checkCritical(
      dbUrl.includes('sslmode=require'),
      'SSL mode is enabled',
      'Add ?sslmode=require to your DATABASE_URL'
    );
    
    checkInfo(
      dbUrl.includes('neon.tech') ? 'Neon' : 'Other',
      'Database provider'
    );
  }
  
  // Check 2: Server Configuration
  console.log('\n⚙️  Server Configuration\n');
  
  const nodeEnv = process.env.NODE_ENV;
  checkInfo(nodeEnv || 'development', 'NODE_ENV');
  checkWarning(
    nodeEnv === 'production' || nodeEnv === 'development',
    'NODE_ENV is valid',
    'Should be "production" for Render deployment'
  );
  
  const port = process.env.PORT;
  checkInfo(port || '5000', 'PORT');
  
  const frontendUrl = process.env.FRONTEND_URL;
  checkCritical(
    frontendUrl,
    'FRONTEND_URL is configured',
    'Set to your Cloudflare Pages URL: https://your-app.pages.dev'
  );
  
  // Check 3: Authentication
  console.log('\n🔐 Authentication\n');
  
  const jwtSecret = process.env.JWT_SECRET;
  checkCritical(
    jwtSecret && jwtSecret.length >= 32,
    'JWT_SECRET is strong (32+ characters)',
    'Generate: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
  
  if (jwtSecret) {
    checkWarning(
      !jwtSecret.includes('local') && !jwtSecret.includes('dev'),
      'JWT_SECRET is not a default/dev value',
      'Use a unique production secret'
    );
  }
  
  // Check 4: AI Services
  console.log('\n🤖 AI Services\n');
  
  const geminiKey = process.env.GEMINI_API_KEY;
  checkWarning(
    geminiKey,
    'GEMINI_API_KEY is configured',
    'Get from https://makersuite.google.com/app/apikey'
  );
  
  // Count backup keys
  let backupKeys = 0;
  for (let i = 2; i <= 10; i++) {
    if (process.env[`GEMINI_API_KEY_${i}`]) backupKeys++;
  }
  checkInfo(backupKeys, 'Backup Gemini API keys');
  checkWarning(
    backupKeys >= 2,
    'Multiple Gemini API keys for failover',
    'Add GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc. for redundancy'
  );
  
  // Check 5: Blockchain RPC
  console.log('\n⛓️  Blockchain RPC Endpoints\n');
  
  const ethereumRpc = process.env.ETHEREUM_RPC_URL;
  checkWarning(
    ethereumRpc,
    'ETHEREUM_RPC_URL is configured',
    'Get free RPC from https://www.alchemy.com'
  );
  
  const sepoliaRpc = process.env.SEPOLIA_RPC_URL;
  checkWarning(
    sepoliaRpc,
    'SEPOLIA_RPC_URL is configured',
    'For testnet support'
  );
  
  // Check 6: Payment Processing
  console.log('\n💳 Payment Processing\n');
  
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  checkWarning(
    paystackKey,
    'PAYSTACK_SECRET_KEY is configured',
    'Get from https://dashboard.paystack.com'
  );
  
  if (paystackKey) {
    checkWarning(
      paystackKey.startsWith('sk_live_'),
      'Using Paystack LIVE keys',
      'Use sk_test_ for testing, sk_live_ for production'
    );
  }
  
  const paymentAddress = process.env.PAYMENT_ADDRESS;
  checkWarning(
    paymentAddress && paymentAddress.startsWith('0x'),
    'PAYMENT_ADDRESS is configured',
    'Set to your wallet address for on-chain payments'
  );
  
  // Check 7: Files
  console.log('\n📁 Required Files\n');
  
  try {
    await readFile(join(__dirname, '../package.json'), 'utf8');
    console.log(`${colors.green('✓')} package.json exists`);
  } catch {
    checkCritical(false, 'package.json exists', 'File is missing!');
  }
  
  try {
    const pkg = JSON.parse(await readFile(join(__dirname, '../package.json'), 'utf8'));
    checkCritical(
      pkg.scripts && pkg.scripts.start,
      'package.json has "start" script',
      'Add: "start": "NODE_ENV=production node src/api/server.js"'
    );
  } catch (err) {
    console.log(`${colors.red('✗')} Failed to parse package.json: ${err.message}`);
  }
  
  try {
    await readFile(join(__dirname, '../src/api/server.js'), 'utf8');
    console.log(`${colors.green('✓')} src/api/server.js exists`);
  } catch {
    checkCritical(false, 'src/api/server.js exists', 'Main server file is missing!');
  }
  
  try {
    await readFile(join(__dirname, '../render.yaml'), 'utf8');
    console.log(`${colors.green('✓')} render.yaml exists`);
  } catch {
    checkWarning(false, 'render.yaml exists', 'Optional but recommended for Render');
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 Summary\n');
  
  if (checks.critical.length === 0) {
    console.log(colors.green('✅ All critical checks passed!'));
  } else {
    console.log(colors.red(`❌ ${checks.critical.length} critical issue(s) found:`));
    checks.critical.forEach(({ message, fix }) => {
      console.log(`   • ${message}`);
      if (fix) console.log(`     ${colors.yellow('Fix:')} ${fix}`);
    });
  }
  
  if (checks.warnings.length > 0) {
    console.log(colors.yellow(`\n⚠️  ${checks.warnings.length} warning(s):`));
    checks.warnings.forEach(({ message, fix }) => {
      console.log(`   • ${message}`);
      if (fix) console.log(`     ${colors.yellow('Suggestion:')} ${fix}`);
    });
  }
  
  console.log('\n' + colors.blue('Next Steps:'));
  console.log('   1. Fix any critical issues above');
  console.log('   2. Review warnings and optionally address them');
  console.log('   3. Follow: NEON_RENDER_DEPLOYMENT_GUIDE.md');
  console.log('   4. Set environment variables in Render dashboard');
  console.log('   5. Deploy and monitor logs\n');
  
  // Exit code
  process.exit(checks.critical.length > 0 ? 1 : 0);
}

runChecks().catch(err => {
  console.error(colors.red('\n❌ Check failed:'), err);
  process.exit(1);
});
