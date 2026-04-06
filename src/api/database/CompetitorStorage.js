/**
 * Competitor storage (file-based)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILE = './data/competitors.json';

function read() {
  if (!existsSync(FILE)) return [];
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; }
}
function write(data) { writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8'); }

export function findByContractId(contractId) {
  return read().filter(c => c.contractId === contractId);
}

export function create(data) {
  const all = read();
  const entry = { id: `comp-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, ...data, createdAt: new Date().toISOString() };
  all.push(entry);
  write(all);
  return entry;
}

export function remove(id, contractId) {
  const all = read();
  const idx = all.findIndex(c => c.id === id && c.contractId === contractId);
  if (idx === -1) return false;
  all.splice(idx, 1);
  write(all);
  return true;
}

export function findAll() { return read(); }
