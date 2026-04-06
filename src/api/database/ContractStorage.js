/**
 * ContractStorage - thin re-export for direct imports
 */
import { ContractStorage } from './index.js';

export const findAll       = () => ContractStorage.findAll();
export const findById      = (id) => ContractStorage.findById(id);
export const findByUserId  = (userId, filters) => ContractStorage.findByUserId(userId, filters);
export const create        = (data) => ContractStorage.create(data);
export const update        = (id, data) => ContractStorage.update(id, data);
export const deleteById    = (id) => ContractStorage.delete(id);

export default ContractStorage;
