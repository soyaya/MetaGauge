/**
 * AlertConfigurationStorage — delegates to database/index.js (postgres or file)
 */

async function db() {
  const { AlertConfigStorage } = await import('./index.js');
  return AlertConfigStorage;
}

class AlertConfigurationStorage {
  async create(data)                          { return (await db()).create(data); }
  async findById(id)                          { return (await db()).findById(id); }
  async findByUserId(userId)                  { return (await db()).findByUserId(userId); }
  async findByUserAndContract(userId, cId)    { return (await db()).findByUserAndContract(userId, cId); }
  async update(id, updates)                   { return (await db()).update(id, updates); }
  async delete(id)                            { return (await db()).delete(id); }
}

export default new AlertConfigurationStorage();
