/**
 * UserStorage - thin re-export for direct imports
 */
import { UserStorage } from './index.js';

export const findAll      = () => UserStorage.findAll();
export const findById     = (id) => UserStorage.findById(id);
export const findByEmail  = (email) => UserStorage.findByEmail(email);
export const findByApiKey = (key) => UserStorage.findByApiKey(key);
export const create       = (data) => UserStorage.create(data);
export const update       = (id, data) => UserStorage.update(id, data);
export const deleteById   = (id) => UserStorage.delete(id);

export default UserStorage;
