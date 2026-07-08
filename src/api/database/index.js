/**
 * Database initialization and connection management
 * Supports both PostgreSQL and file-based storage
 * Set DATABASE_TYPE=postgres in .env to use PostgreSQL
 */

import dotenv from 'dotenv';
import path from 'path';
import * as fsp from 'fs/promises';
import crypto from 'crypto';
import { createRequire } from 'module';
dotenv.config();

// Node (22.12+/24) supports synchronously `require()`-ing plain ESM modules
// (ones without their own top-level await). We use this instead of top-level
// `await import(...)` so this file has no top-level await of its own — that
// syntax can't be transformed to CommonJS, which breaks Jest's test runtime
// for every module that transitively imports this storage facade.
const esmRequire = createRequire(import.meta.url);

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'file';

let UserStorage, ContractStorage, AnalysisStorage,
    ChatSessionStorage, ChatMessageStorage,
    MetricsStorage, MetricsHistoryStorage, LivePollStorage,
    TractionStorage, AlertConfigStorage, AlertsStorage,
    AgentConfigStorage, AgentMemoryStorage, AITasksStorage,
    CompetitorDataStorage, CompetitorMetricsStorage,
    SocialPostsStorage, BriefingsStorage, AIAdviceStorage,
    AIInsightsStorage, ShareTokensStorage, FeedbackStorage,
    AbuseFingerprintsStorage, BenchmarksStorage, AILearningsStorage,
    PatternProfileStorage, MilestoneStorage,
    FunctionAnalyticsStorage, FunnelStorage, CompetitorAnalysesStorage,
    WalletEnrichmentStorage, WalletPipelineStorage;

if (DATABASE_TYPE === 'postgres') {
  console.log('🔄 Loading PostgreSQL storage...');
  const pg = esmRequire('./postgresStorage.js');
  UserStorage              = pg.PostgresUserStorage;
  ContractStorage          = pg.PostgresContractStorage;
  AnalysisStorage          = pg.PostgresAnalysisStorage;
  ChatSessionStorage       = pg.PostgresChatSessionStorage;
  ChatMessageStorage       = pg.PostgresChatMessageStorage;
  MetricsStorage           = pg.PostgresMetricsStorage;
  MetricsHistoryStorage    = pg.PostgresMetricsHistoryStorage;
  LivePollStorage          = pg.PostgresLivePollStorage;
  TractionStorage          = pg.PostgresTractionStorage;
  AlertConfigStorage       = pg.PostgresAlertConfigStorage;
  AlertsStorage            = pg.PostgresAlertsStorage;
  AgentConfigStorage       = pg.PostgresAgentConfigStorage;
  AgentMemoryStorage       = pg.PostgresAgentMemoryStorage;
  AITasksStorage           = pg.PostgresAITasksStorage;
  CompetitorDataStorage    = pg.PostgresCompetitorDataStorage;
  CompetitorMetricsStorage = pg.PostgresCompetitorMetricsStorage;
  SocialPostsStorage       = pg.PostgresSocialPostsStorage;
  BriefingsStorage         = pg.PostgresBriefingsStorage;
  AIAdviceStorage          = pg.PostgresAIAdviceStorage;
  AIInsightsStorage        = pg.PostgresAIInsightsStorage;
  ShareTokensStorage       = pg.PostgresShareTokensStorage;
  FeedbackStorage          = pg.PostgresFeedbackStorage;
  AbuseFingerprintsStorage = pg.PostgresAbuseFingerprintsStorage;
  BenchmarksStorage        = pg.PostgresBenchmarksStorage;
  AILearningsStorage       = pg.PostgresAILearningsStorage;
  PatternProfileStorage    = pg.PostgresPatternProfileStorage;
  MilestoneStorage         = pg.PostgresMilestoneStorage;
  FunctionAnalyticsStorage = pg.PostgresFunctionAnalyticsStorage;
  FunnelStorage            = pg.PostgresFunnelStorage;
  CompetitorAnalysesStorage= pg.PostgresCompetitorAnalysesStorage;
  WalletEnrichmentStorage  = pg.PostgresWalletEnrichmentStorage;
  WalletPipelineStorage    = pg.PostgresWalletPipelineStorage;
  console.log('✅ PostgreSQL storage loaded');
} else {
  const fs = esmRequire('./fileStorage.js');
  UserStorage              = fs.UserStorage;
  ContractStorage          = fs.ContractStorage;
  AnalysisStorage          = fs.AnalysisStorage;
  ChatSessionStorage       = fs.ChatSessionStorage;
  ChatMessageStorage       = fs.ChatMessageStorage;
  MetricsStorage           = fs.MetricsStorage;
  MetricsHistoryStorage    = fs.MetricsHistoryStorage;
  LivePollStorage          = fs.LivePollStorage;

  const { readJsonFile, writeJsonFile } = fs;
  const DATA_DIR = './data';
  const uFile = (userId, name) => path.join(DATA_DIR, 'users', userId, name);

  // TractionStorage — inline file implementation (avoids circular import with TractionStorage.js)
  TractionStorage = {
    get: async (userId) => {
      const data = await readJsonFile(uFile(userId, 'traction.json'), { productivityScore:0, tasks:[], lastChecked:null, updatedAt:null });
      return data;
    },
    save: async (userId, data) => {
      data.updatedAt = new Date().toISOString();
      await writeJsonFile(uFile(userId, 'traction.json'), data);
      return data;
    },
    syncTasks: async (userId, generatedTasks) => {
      const store = await TractionStorage.get(userId);
      const existingMap = Object.fromEntries((store.tasks||[]).map(t => [t.id, t]));
      const failingIds = new Set(generatedTasks.map(t => t.id));
      const syncedFailing = generatedTasks.map(t => {
        const existing = existingMap[t.id];
        const userResolved = existing?.resolvedBy === 'user';
        return { ...t, status: userResolved ? 'resolved' : 'open', autoGreen: false,
          resolvedAt: existing?.resolvedAt||null, userFeedback: existing?.userFeedback||null,
          resolvedBy: existing?.resolvedBy||null, pendingConfirmation: userResolved };
      });
      const confirmedResolved = (store.tasks||[])
        .filter(t => t.resolvedBy === 'user' && !failingIds.has(t.id))
        .map(t => ({ ...t, pendingConfirmation: false, autoGreen: true }));
      store.tasks = [...syncedFailing, ...confirmedResolved];
      const resolved = store.tasks.filter(t => t.status === 'resolved').length;
      store.productivityScore = store.tasks.length ? Math.round((resolved/store.tasks.length)*100) : 0;
      store.lastChecked = new Date().toISOString();
      return TractionStorage.save(userId, store);
    },
    resolveTask: async (userId, taskId, { resolvedBy='auto', userFeedback=null } = {}) => {
      const store = await TractionStorage.get(userId);
      const task = (store.tasks||[]).find(t => t.id === taskId);
      if (!task) return null;
      task.status = 'resolved'; task.autoGreen = resolvedBy==='auto';
      task.resolvedAt = new Date().toISOString(); task.resolvedBy = resolvedBy; task.userFeedback = userFeedback;
      const resolved = store.tasks.filter(t => t.status==='resolved').length;
      store.productivityScore = Math.round((resolved/store.tasks.length)*100);
      await TractionStorage.save(userId, store);
      return task;
    },
    reopenTask: async (userId, taskId) => {
      const store = await TractionStorage.get(userId);
      const task = (store.tasks||[]).find(t => t.id === taskId);
      if (!task) return null;
      task.status = 'open'; task.autoGreen = false; task.resolvedAt = null; task.resolvedBy = null;
      const resolved = store.tasks.filter(t => t.status==='resolved').length;
      store.productivityScore = Math.round((resolved/store.tasks.length)*100);
      await TractionStorage.save(userId, store);
      return task;
    },
  };

  AlertConfigStorage = esmRequire('./AlertConfigurationStorage.js').default;

  AlertsStorage = {
    findByUserId: async (userId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'alerts.json'), []);
      return all.filter(a => a.userId === userId);
    },
    create: async (data) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'alerts.json'), []);
      const entry = { id: crypto.randomUUID(), ...data, created_at: new Date().toISOString() };
      all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'alerts.json'), all);
      return entry;
    },
    acknowledge: async (id, userId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'alerts.json'), []);
      const idx = all.findIndex(a => a.id === id && a.userId === userId);
      if (idx !== -1) { all[idx].is_read = true; all[idx].acknowledged_at = new Date().toISOString(); }
      await writeJsonFile(path.join(DATA_DIR, 'alerts.json'), all);
    },
    readAll_array: async () => readJsonFile(path.join(DATA_DIR, 'alerts.json'), []),
    writeAll_array: async (alerts) => writeJsonFile(path.join(DATA_DIR, 'alerts.json'), alerts),
  };

  AgentConfigStorage = {
    get: async (userId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'agent-configs.json'), []);
      return all.find(c => c.userId === userId) || null;
    },
    save: async (userId, data) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'agent-configs.json'), []);
      const idx = all.findIndex(c => c.userId === userId);
      const entry = { ...data, userId, updatedAt: new Date().toISOString() };
      if (idx >= 0) all[idx] = entry; else all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'agent-configs.json'), all);
      return entry;
    },
  };

  AgentMemoryStorage = esmRequire('../../services/AgentMemory.js').AgentMemory;

  AITasksStorage = {
    readAll: async () => readJsonFile(path.join(DATA_DIR, 'ai-tasks.json'), []),
    findByUserId: async (userId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai-tasks.json'), []);
      return all.filter(t => t.userId === userId);
    },
    upsert: async (task) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai-tasks.json'), []);
      const idx = all.findIndex(t => t.id === task.id);
      if (idx >= 0) all[idx] = task; else all.push(task);
      await writeJsonFile(path.join(DATA_DIR, 'ai-tasks.json'), all);
      return task;
    },
    writeAll: async (tasks) => writeJsonFile(path.join(DATA_DIR, 'ai-tasks.json'), tasks),
  };

  CompetitorDataStorage = {
    get: async (userId, address, chain) => {
      const file = path.join(DATA_DIR, 'users', userId, 'competitors', `${address.toLowerCase()}_${chain}.json`);
      try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return null; }
    },
    save: async (userId, address, chain, data) => {
      const dir = path.join(DATA_DIR, 'users', userId, 'competitors');
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `${address.toLowerCase()}_${chain}.json`), JSON.stringify(data, null, 2));
    },
    findByUserId: async (userId) => {
      const dir = path.join(DATA_DIR, 'users', userId, 'competitors');
      const files = await fsp.readdir(dir).catch(() => []);
      const results = [];
      for (const f of files.filter(f => f.endsWith('.json') && !f.endsWith('.backup'))) {
        try { results.push(JSON.parse(await fsp.readFile(path.join(dir, f), 'utf8'))); } catch {}
      }
      return results;
    },
    delete: async (userId, address, chain) => {
      const file = path.join(DATA_DIR, 'users', userId, 'competitors', `${address.toLowerCase()}_${chain}.json`);
      await fsp.unlink(file).catch(() => {});
    },
  };

  CompetitorMetricsStorage = {
    get: async (userId) => {
      try { return JSON.parse(await fsp.readFile(uFile(userId, 'competitor_metrics.json'), 'utf8')); } catch { return {}; }
    },
    save: async (userId, data) => writeJsonFile(uFile(userId, 'competitor_metrics.json'), data),
  };

  SocialPostsStorage = {
    readLog: async (userId) => {
      try { return JSON.parse(await fsp.readFile(path.join(DATA_DIR, 'social-posts', `${userId}.json`), 'utf8')); } catch { return []; }
    },
    appendLog: async (userId, entry) => {
      const dir = path.join(DATA_DIR, 'social-posts');
      await fsp.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${userId}.json`);
      let log = [];
      try { log = JSON.parse(await fsp.readFile(file, 'utf8')); } catch {}
      log.push(entry);
      await fsp.writeFile(file, JSON.stringify(log, null, 2));
    },
  };

  BriefingsStorage = {
    readAll: async () => readJsonFile(path.join(DATA_DIR, 'briefings.json'), []),
    append: async (entry) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'briefings.json'), []);
      if (!all.find(b => b.id === entry.id)) all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'briefings.json'), all);
    },
    findByUserId: async (userId, type) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'briefings.json'), []);
      return all.filter(b => b.userId === userId && (!type || b.type === type));
    },
  };

  AIAdviceStorage = {
    readAll: async () => readJsonFile(path.join(DATA_DIR, 'ai_advice.json'), []),
    findByUserId: async (userId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai_advice.json'), []);
      return all.filter(a => a.userId === userId);
    },
    append: async (entry) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai_advice.json'), []);
      all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'ai_advice.json'), all);
    },
  };

  AIInsightsStorage = {
    readAll: async () => readJsonFile(path.join(DATA_DIR, 'ai_insights.json'), []),
    findByUserId: async (userId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai_insights.json'), []);
      return all.filter(a => a.userId === userId);
    },
    append: async (entry) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai_insights.json'), []);
      all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'ai_insights.json'), all);
    },
  };

  ShareTokensStorage = {
    readAll: async () => readJsonFile(path.join(DATA_DIR, 'share_tokens.json'), []),
    append: async (entry) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'share_tokens.json'), []);
      if (!all.find(t => t.token === entry.token)) all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'share_tokens.json'), all);
    },
    findByToken: async (token) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'share_tokens.json'), []);
      return all.find(t => t.token === token) || null;
    },
    revoke: async (token) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'share_tokens.json'), []);
      const idx = all.findIndex(t => t.token === token);
      if (idx !== -1) { all[idx].revoked = true; await writeJsonFile(path.join(DATA_DIR, 'share_tokens.json'), all); }
    },
  };

  FeedbackStorage = {
    readAll: async () => readJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'feedback.json'), []),
    findByUserId: async (userId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'feedback.json'), []);
      return all.filter(f => f.userId === userId);
    },
    append: async (entry) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'feedback.json'), []);
      all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'feedback.json'), all);
    },
  };

  AbuseFingerprintsStorage = {
    read: async () => readJsonFile(path.join(DATA_DIR, 'abuse-fingerprints.json'), { fingerprints:{}, emailDomains:{}, contractAddresses:{} }),
    write: async (data) => writeJsonFile(path.join(DATA_DIR, 'abuse-fingerprints.json'), data),
  };

  BenchmarksStorage = {
    read: async () => readJsonFile(path.join(DATA_DIR, 'benchmarks.json'), {}),
    write: async (data) => writeJsonFile(path.join(DATA_DIR, 'benchmarks.json'), data),
  };

  AILearningsStorage = {
    getAll: async () => readJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'task-resolutions.json'), []),
    append: async (entry) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'task-resolutions.json'), []);
      all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'task-resolutions.json'), all);
    },
    getForTask: async (taskId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'ai-knowledge', 'task-resolutions.json'), []);
      return all.filter(l => l.taskId === taskId);
    },
  };

  FunctionAnalyticsStorage = {
    get: async (contractAddress, chain, type) => {
      const file = path.join(DATA_DIR, 'function-analytics', `${contractAddress}_${chain}`, `${type}.json`);
      try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return []; }
    },
    save: async (contractAddress, chain, type, data) => {
      const dir = path.join(DATA_DIR, 'function-analytics', `${contractAddress}_${chain}`);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `${type}.json`), JSON.stringify(data, null, 2));
    },
    delete: async (contractAddress, chain) => {
      const dir = path.join(DATA_DIR, 'function-analytics', `${contractAddress}_${chain}`);
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };

  FunnelStorage = {
    getFunnels: async (contractId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'funnels.json'), []);
      return all.filter(f => f.contractId === contractId);
    },
    saveFunnel: async (contractId, name, steps) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'funnels.json'), []);
      const entry = { id: `${contractId}-${Date.now()}`, contractId, name, steps, createdAt: new Date().toISOString() };
      all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'funnels.json'), all);
      return entry;
    },
    getFunnel: async (funnelId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'funnels.json'), []);
      return all.find(f => f.id === funnelId) || null;
    },
    getFunctionMappings: async (contractId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'function_mappings.json'), []);
      return all.filter(m => m.contractId === contractId);
    },
    saveFunctionMapping: async (contractId, signature, displayName) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'function_mappings.json'), []);
      const idx = all.findIndex(m => m.contractId === contractId && m.signature === signature);
      const entry = { contractId, signature, displayName, updatedAt: new Date().toISOString() };
      if (idx >= 0) all[idx] = entry; else all.push(entry);
      await writeJsonFile(path.join(DATA_DIR, 'function_mappings.json'), all);
      return entry;
    },
  };

  CompetitorAnalysesStorage = {
    get: async (competitorId) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'competitor_analyses.json'), {});
      return all[competitorId] || null;
    },
    save: async (competitorId, data) => {
      const all = await readJsonFile(path.join(DATA_DIR, 'competitor_analyses.json'), {});
      all[competitorId] = data;
      await writeJsonFile(path.join(DATA_DIR, 'competitor_analyses.json'), all);
    },
    readAll: async () => readJsonFile(path.join(DATA_DIR, 'competitor_analyses.json'), {}),
  };

  WalletEnrichmentStorage = {
    getCache: async (contractAddress, chain) => {
      const file = path.join(DATA_DIR, 'wallet-enrichment', `${contractAddress}_${chain}.json`);
      try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return {}; }
    },
    saveWallet: async (contractAddress, chain, walletAddress, data) => {
      const dir = path.join(DATA_DIR, 'wallet-enrichment');
      await fsp.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${contractAddress}_${chain}.json`);
      let cache = {};
      try { cache = JSON.parse(await fsp.readFile(file, 'utf8')); } catch {}
      cache[walletAddress.toLowerCase()] = data;
      await fsp.writeFile(file, JSON.stringify(cache, null, 2));
    },
  };

  WalletPipelineStorage = {
    readQueue: async (contractAddress, chain) => {
      const file = path.join(DATA_DIR, 'wallet-pipeline', `${contractAddress}_${chain}_queue.json`);
      try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return { pending: [], processing: [], dlq: [] }; }
    },
    writeQueue: async (contractAddress, chain, q) => {
      const dir = path.join(DATA_DIR, 'wallet-pipeline');
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `${contractAddress}_${chain}_queue.json`), JSON.stringify(q, null, 2));
    },
  };

  PatternProfileStorage = {
    get: async (userId) => {
      try { return JSON.parse(await fsp.readFile(uFile(userId, 'pattern_profile.json'), 'utf8')); } catch { return null; }
    },
    save: async (userId, data) => {
      await fsp.mkdir(path.join(DATA_DIR, 'users', userId), { recursive: true });
      await fsp.writeFile(uFile(userId, 'pattern_profile.json'), JSON.stringify(data, null, 2));
      return data;
    },
  };

  MilestoneStorage = {
    get: async (userId) => readJsonFile(uFile(userId, 'milestones.json'), []),
    append: async (userId, milestone) => {
      const all = await readJsonFile(uFile(userId, 'milestones.json'), []);
      all.push({ ...milestone, achievedAt: new Date().toISOString() });
      await writeJsonFile(uFile(userId, 'milestones.json'), all);
    },
  };

  console.log('✅ File storage loaded');
}

export {
  UserStorage, ContractStorage, AnalysisStorage,
  ChatSessionStorage, ChatMessageStorage,
  MetricsStorage, MetricsHistoryStorage, LivePollStorage,
  TractionStorage, AlertConfigStorage, AlertsStorage,
  AgentConfigStorage, AgentMemoryStorage, AITasksStorage,
  CompetitorDataStorage, CompetitorMetricsStorage,
  SocialPostsStorage, BriefingsStorage, AIAdviceStorage,
  AIInsightsStorage, ShareTokensStorage, FeedbackStorage,
  AbuseFingerprintsStorage, BenchmarksStorage, AILearningsStorage,
  PatternProfileStorage, MilestoneStorage,
  FunctionAnalyticsStorage, FunnelStorage, CompetitorAnalysesStorage,
  WalletEnrichmentStorage, WalletPipelineStorage,
};

export async function initializeDatabase() {
  // Debug: log what connection info is available
  console.log('🔍 DB init — DATABASE_TYPE:', process.env.DATABASE_TYPE, '| DATABASE_URL set:', !!process.env.DATABASE_URL, '| POSTGRES_HOST:', process.env.POSTGRES_HOST || 'not set');

  if (DATABASE_TYPE === 'postgres') {
    const { testConnection } = await import('./postgres.js');
    const ok = await testConnection();
    if (!ok) throw new Error('PostgreSQL connection failed');
    return true;
  }
  const { initializeStorage } = await import('./fileStorage.js');
  return initializeStorage();
}

export async function getDatabase() {
  if (DATABASE_TYPE === 'postgres') {
    const { getPool } = await import('./postgres.js');
    return getPool();
  }
  return null;
}

export async function closeDatabase() {
  if (DATABASE_TYPE === 'postgres') {
    const { closePool } = await import('./postgres.js');
    await closePool();
  }
}

export default { initialize: initializeDatabase, getConnection: getDatabase, close: closeDatabase };
