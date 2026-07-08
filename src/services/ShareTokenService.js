import { randomBytes } from 'crypto';

async function storage() {
  const { ShareTokensStorage } = await import('../api/database/index.js');
  return ShareTokensStorage;
}

export async function createShareToken(contractId, userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const s = await storage();
  await s.append({ token, contractId, userId, createdAt: new Date().toISOString(), expiresAt, revoked: false });
  return { token, expiresAt };
}

export async function validateShareToken(token) {
  const s = await storage();
  const t = await s.findByToken(token);
  if (!t) return { valid: false, status: 404 };
  if (t.revoked) return { valid: false, status: 410 };
  if (new Date(t.expiresAt) < new Date()) return { valid: false, status: 410 };
  return { valid: true, contractId: t.contractId };
}

export async function revokeShareToken(token) {
  const s = await storage();
  await s.revoke(token);
  return true;
}

/** Returns the userId that owns this token, or null if the token doesn't exist. */
export async function getShareTokenOwner(token) {
  const s = await storage();
  const t = await s.findByToken(token);
  return t?.userId ?? null;
}
