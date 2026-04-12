/**
 * Competitor storage — delegates to database/index.js (postgres or file)
 */
import { ContractStorage } from './index.js';

export async function findByContractId(contractId) {
  const all = await ContractStorage.findAll();
  const contract = all.find(c => c.id === contractId);
  return contract?.competitors || [];
}

export async function create(data) {
  const contract = await ContractStorage.findById(data.contractId);
  if (!contract) throw new Error('Contract not found');
  const competitors = contract.competitors || [];
  const entry = { id: `comp-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, ...data, createdAt: new Date().toISOString() };
  competitors.push(entry);
  await ContractStorage.update(data.contractId, { competitors });
  return entry;
}

export async function remove(id, contractId) {
  const contract = await ContractStorage.findById(contractId);
  if (!contract) return false;
  const competitors = (contract.competitors || []).filter(c => c.id !== id);
  await ContractStorage.update(contractId, { competitors });
  return true;
}

export async function findAll() {
  const all = await ContractStorage.findAll();
  return all.flatMap(c => c.competitors || []);
}
