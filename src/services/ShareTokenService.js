/**
 * Share token management for read-only dashboard links
 */
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const TOKENS_FILE = './data/share_tokens.json';

function readTokens() {
  if (!existsSync(TOKENS_FILE)) return [];
  try { return JSON.parse(readFileSync(TOKENS_FILE, 'utf8')); } catch { return []; }
}

function writeTokens(tokens) {
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

export function createShareToken(contractId, userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const tokens = readTokens();
  tokens.push({
    token,
    contractId,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    revoked: false
  });
  
  writeTokens(tokens);
  return { token, expiresAt };
}

export function validateShareToken(token) {
  const tokens = readTokens();
  const shareToken = tokens.find(t => t.token === token);
  
  if (!shareToken) return { valid: false, status: 404 };
  if (shareToken.revoked) return { valid: false, status: 410 };
  if (new Date(shareToken.expiresAt) < new Date()) return { valid: false, status: 410 };
  
  return { valid: true, contractId: shareToken.contractId };
}

export function revokeShareToken(token) {
  const tokens = readTokens();
  const index = tokens.findIndex(t => t.token === token);
  
  if (index !== -1) {
    tokens[index].revoked = true;
    writeTokens(tokens);
    return true;
  }
  return false;
}
