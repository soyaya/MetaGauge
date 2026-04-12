/**
 * AbuseDetectionService
 * Tracks fingerprints, disposable emails, and suspicious patterns
 */
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const STORE_FILE = './data/abuse-fingerprints.json';

// Known disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','tempmail.com','guerrillamail.com','10minutemail.com',
  'throwaway.email','yopmail.com','sharklasers.com','guerrillamailblock.com',
  'grr.la','guerrillamail.info','guerrillamail.biz','guerrillamail.de',
  'guerrillamail.net','guerrillamail.org','spam4.me','trashmail.com',
  'trashmail.me','trashmail.net','dispostable.com','mailnull.com',
  'spamgourmet.com','spamgourmet.net','spamgourmet.org','maildrop.cc',
  'discard.email','spamfree24.org','spamfree24.de','spamfree24.eu',
  'spamfree24.info','spamfree24.net','spamfree24.org','fakeinbox.com',
  'mailnesia.com','mailnull.com','spamspot.com','spamthisplease.com',
  'tempr.email','discard.email','spamgourmet.com','trashmail.at',
  'trashmail.io','trashmail.xyz','tempinbox.com','throwam.com',
]);

function readStore() {
  if (!existsSync(STORE_FILE)) return { fingerprints: {}, emailDomains: {}, contractAddresses: {} };
  try { return JSON.parse(readFileSync(STORE_FILE, 'utf8')); } catch { return { fingerprints: {}, emailDomains: {}, contractAddresses: {} }; }
}

function writeStore(data) {
  try { writeFileSync(STORE_FILE, JSON.stringify(data, null, 2)); } catch {}
}

export class AbuseDetectionService {

  /**
   * Check if email domain is disposable
   */
  static isDisposableEmail(email) {
    const domain = email?.split('@')[1]?.toLowerCase();
    return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
  }

  /**
   * Hash a device fingerprint from request headers
   */
  static getDeviceFingerprint(req) {
    const ua = req.headers['user-agent'] || '';
    const lang = req.headers['accept-language'] || '';
    const encoding = req.headers['accept-encoding'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';
    // Combine stable signals into a hash
    const raw = `${ua}|${lang}|${encoding}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }

  /**
   * Record a registration attempt and check for abuse
   * Returns { allowed, reason }
   */
  static checkRegistration(req, email) {
    const store = readStore();
    const now = Date.now();
    const ip = req.ip || '';
    const fingerprint = this.getDeviceFingerprint(req);
    const domain = email?.split('@')[1]?.toLowerCase();

    // 1. Disposable email check
    if (this.isDisposableEmail(email)) {
      return { allowed: false, reason: 'Disposable email addresses are not allowed. Please use a real email.' };
    }

    // 2. Fingerprint check — max 20 accounts per device fingerprint per 24h
    const fpKey = fingerprint;
    if (!store.fingerprints[fpKey]) store.fingerprints[fpKey] = [];
    // Clean old entries (>24h)
    store.fingerprints[fpKey] = store.fingerprints[fpKey].filter(t => now - t < 86400000);
    if (store.fingerprints[fpKey].length >= 20) {
      return { allowed: false, reason: 'Too many accounts created from this device. Please contact support.' };
    }

    // 3. Email domain velocity — max 20 accounts from same domain per hour
    if (domain && domain !== 'gmail.com' && domain !== 'yahoo.com' && domain !== 'outlook.com' && domain !== 'hotmail.com') {
      if (!store.emailDomains[domain]) store.emailDomains[domain] = [];
      store.emailDomains[domain] = store.emailDomains[domain].filter(t => now - t < 3600000);
      if (store.emailDomains[domain].length >= 20) {
        return { allowed: false, reason: 'Too many accounts from this email domain.' };
      }
    }

    // Record this attempt
    store.fingerprints[fpKey].push(now);
    if (domain) {
      if (!store.emailDomains[domain]) store.emailDomains[domain] = [];
      store.emailDomains[domain].push(now);
    }
    writeStore(store);

    return { allowed: true };
  }

  /**
   * Check if a contract address is being abused (same contract across many accounts)
   */
  static checkContractAbuse(contractAddress, userId) {
    const store = readStore();
    const addr = contractAddress?.toLowerCase();
    if (!addr) return { allowed: true };

    if (!store.contractAddresses[addr]) store.contractAddresses[addr] = [];

    // If >5 different users indexed the same contract in 24h, flag it
    const now = Date.now();
    store.contractAddresses[addr] = store.contractAddresses[addr].filter(e => now - e.ts < 86400000);
    const uniqueUsers = new Set(store.contractAddresses[addr].map(e => e.userId));

    if (uniqueUsers.size >= 10 && !uniqueUsers.has(userId)) {
      // Don't block — just flag. Popular contracts are legitimate.
      return { allowed: true, flagged: true, reason: 'High-traffic contract — monitored' };
    }

    store.contractAddresses[addr].push({ userId, ts: now });
    writeStore(store);
    return { allowed: true };
  }
}

export default AbuseDetectionService;
