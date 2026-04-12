/**
 * TractionStorage — thin wrapper used by routes.
 * Lazily imports from database/index.js to avoid circular dependency.
 */

let _db = null;
let _learnings = null;

async function getDB() {
  if (!_db) {
    // Use dynamic import with a slight delay to break circular dependency
    const mod = await import('./index.js');
    _db = mod.TractionStorage;
  }
  return _db;
}

async function getLearningsStorage() {
  if (!_learnings) {
    const mod = await import('./index.js');
    _learnings = mod.AILearningsStorage;
  }
  return _learnings;
}

export async function getTraction(userId) {
  return (await getDB()).get(userId);
}

export async function saveTraction(userId, data) {
  return (await getDB()).save(userId, data);
}

export async function syncTasks(userId, generatedTasks) {
  return (await getDB()).syncTasks(userId, generatedTasks);
}

export async function resolveTask(userId, taskId, opts = {}) {
  return (await getDB()).resolveTask(userId, taskId, opts);
}

export async function reopenTask(userId, taskId) {
  return (await getDB()).reopenTask(userId, taskId);
}

export async function getLearnings() {
  return (await getLearningsStorage()).getAll();
}

export async function saveLearning(entry) {
  return (await getLearningsStorage()).append(entry);
}

export async function getLearningsForTask(taskId) {
  return (await getLearningsStorage()).getForTask(taskId);
}
