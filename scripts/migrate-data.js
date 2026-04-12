#!/usr/bin/env node
/**
 * Complete Data Migration — JSON files → PostgreSQL
 * Reads all per-user data from data/ and inserts into PG.
 * Safe to re-run — uses ON CONFLICT DO NOTHING everywhere.
 */

import fs from 'fs/promises';
import path from 'path';
import { query, transaction, testConnection, closePool } from '../src/api/database/postgres.js';

const DATA_DIR = './data';
const stats = {};
const count = (key, type) => { stats[key] = stats[key] || { ok:0, skip:0, err:0 }; stats[key][type]++; };

// Safe ISO date — handles unix ms, ISO strings, and undefined
function toISO(val) {
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') return new Date(val > 9999999999 ? val : val * 1000).toISOString();
  try { return new Date(val).toISOString(); } catch { return new Date().toISOString(); }
}

async function readJSON(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

// ── 1. Users ─────────────────────────────────────────────────────────────────
async function migrateUsers() {
  const users = await readJSON(path.join(DATA_DIR, 'users.json'), []);
  console.log(`\n👥 Users: ${users.length}`);
  for (const u of users) {
    try {
      await query(`
        INSERT INTO users(id,email,password,name,role,tier,api_key,is_active,email_verified,
          analysis_count,monthly_analysis_count,last_analysis,monthly_reset_date,
          competitor_analysis_count,reset_token,reset_token_expiry,subscription,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT(id) DO NOTHING`,
        [u.id, u.email, u.password, u.name, u.role||'admin', u.tier||'free',
         u.apiKey, u.isActive!==false, u.emailVerified||false,
         u.usage?.analysisCount||0, u.usage?.monthlyAnalysisCount||0,
         u.usage?.lastAnalysis ? toISO(u.usage.lastAnalysis) : null,
         u.usage?.monthlyResetDate ? toISO(u.usage.monthlyResetDate) : null,
         u.competitorAnalysisCount||0, u.resetToken||null,
         u.resetTokenExpiry ? toISO(u.resetTokenExpiry) : null,
         JSON.stringify(u.subscription||{}),
         toISO(u.createdAt), toISO(u.updatedAt)])
        .catch(e => { throw new Error(e.message.replace(/\n.*/s,'')); });

      // onboarding
      const ob = u.onboarding || {};
      const dc = ob.defaultContract || {};
      await query(`
        INSERT INTO user_onboarding(user_id,completed,website,twitter,discord,telegram,logo,
          contract_address,contract_chain,contract_abi,contract_name,contract_purpose,
          contract_category,contract_start_date,is_indexed,indexing_progress,last_analysis_id,
          continuous_sync,continuous_sync_started,continuous_sync_stopped,deployment_block)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        ON CONFLICT(user_id) DO NOTHING`,
        [u.id, ob.completed||false,
         ob.socialLinks?.website||null, ob.socialLinks?.twitter||null,
         ob.socialLinks?.discord||null, ob.socialLinks?.telegram||null, ob.logo||null,
         dc.address||null, dc.chain||null, dc.abi||null, dc.name||null,
         dc.purpose||null, dc.category||null, dc.startDate||null,
         dc.isIndexed||false, dc.indexingProgress||0, dc.lastAnalysisId||null,
         dc.continuousSync||false, dc.continuousSyncStarted||null,
         dc.continuousSyncStopped||null, dc.deploymentBlock||null]);

      // preferences
      const pr = u.preferences || {};
      await query(`
        INSERT INTO user_preferences(user_id,email_notifications,analysis_notifications,default_chain)
        VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO NOTHING`,
        [u.id, pr.notifications?.email!==false, pr.notifications?.analysis!==false, pr.defaultChain||'ethereum']);

      count('users','ok'); console.log(`  ✅ ${u.email}`);
    } catch(e) { count('users','err'); console.log(`  ❌ ${u.email}: ${e.message}`); }
  }
}

// ── 2. Per-user data ──────────────────────────────────────────────────────────
async function migratePerUser() {
  const userDirs = await fs.readdir(path.join(DATA_DIR, 'users')).catch(() => []);
  for (const userId of userDirs) {
    if (userId === 'anonymous') continue;
    const dir = path.join(DATA_DIR, 'users', userId);

    // contracts
    const contracts = await readJSON(path.join(dir, 'contracts.json'), []);
    for (const c of contracts) {
      try {
        await query(`
          INSERT INTO contracts(id,user_id,name,description,target_address,target_chain,
            target_name,target_abi,tags,is_active,is_default,last_analyzed,analysis_count,created_at,updated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT(id) DO NOTHING`,
          [c.id, userId, c.name||'Contract', c.description||null,
           c.targetContract?.address||c.address||null, c.targetContract?.chain||c.chain||null,
           c.targetContract?.name||null, c.targetContract?.abi||null,
           c.tags||[], c.isActive!==false, c.isDefault||false,
           c.lastAnalyzed||null, c.analysisCount||0,
           toISO(c.createdAt), toISO(c.updatedAt)]);
        count('contracts','ok');
      } catch(e) { count('contracts','err'); }
    }

    // analyses
    const analyses = await readJSON(path.join(dir, 'analyses.json'), []);
    for (const a of analyses) {
      try {
        await query(`
          INSERT INTO analyses(id,user_id,config_id,contract_address,chain,analysis_type,
            status,progress,results,metadata,error_message,has_errors,logs,current_step,completed_at,created_at,updated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT(id) DO NOTHING`,
          [a.id, userId, a.configId||null,
           a.contractAddress||a.results?.target?.contract?.address||null,
           a.chain||a.results?.target?.contract?.chain||null,
           a.analysisType||'single', a.status||'pending', a.progress||0,
           a.results ? JSON.stringify(a.results) : null,
           JSON.stringify(a.metadata||{}),
           a.errorMessage||null, a.hasErrors||false,
           JSON.stringify(a.logs||[]), a.currentStep||null,
           a.completedAt||null, toISO(a.createdAt), toISO(a.updatedAt)]);
        count('analyses','ok');
      } catch(e) { count('analyses','err'); }
    }

    // chat sessions
    const sessions = await readJSON(path.join(dir, 'chat_sessions.json'), []);
    for (const s of sessions) {
      try {
        await query(`
          INSERT INTO chat_sessions(id,user_id,title,contract_address,contract_chain,contract_name,
            is_active,message_count,last_message_at,metadata,created_at,updated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT(id) DO NOTHING`,
          [s.id, userId, s.title||'Chat', s.contractAddress||null, s.contractChain||null,
           s.contractName||null, s.isActive!==false, s.messageCount||0,
           s.lastMessageAt||null, JSON.stringify(s.metadata||{}),
           toISO(s.createdAt), toISO(s.updatedAt)]);
        count('chat_sessions','ok');
      } catch(e) { count('chat_sessions','err'); }
    }

    // chat messages
    const messages = await readJSON(path.join(dir, 'chat_messages.json'), []);
    for (const m of messages) {
      try {
        await query(`
          INSERT INTO chat_messages(id,session_id,user_id,role,content,components,metadata,is_streaming,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT(id) DO NOTHING`,
          [m.id, m.sessionId, userId, m.role||'user', m.content||'',
           JSON.stringify(m.components||[]), JSON.stringify(m.metadata||{}),
           m.isStreaming||false, m.createdAt||new Date().toISOString()]);
        count('chat_messages','ok');
      } catch(e) { count('chat_messages','err'); }
    }

    // metrics
    const metrics = await readJSON(path.join(dir, 'metrics.json'), null);
    if (metrics) {
      try {
        await query(`INSERT INTO metrics(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,
          [userId, JSON.stringify(metrics)]);
        count('metrics','ok');
      } catch(e) { count('metrics','err'); }
    }

    // metrics history
    const history = await readJSON(path.join(dir, 'metrics_history.json'), []);
    for (const h of history) {
      try {
        await query(`INSERT INTO metrics_history(user_id,date,snapshot) VALUES($1,$2,$3) ON CONFLICT(user_id,date) DO NOTHING`,
          [userId, h.date, JSON.stringify(h)]);
        count('metrics_history','ok');
      } catch(e) { count('metrics_history','err'); }
    }

    // live poll
    const poll = await readJSON(path.join(dir, 'live_poll.json'), null);
    if (poll && poll.contractAddress) {
      try {
        await query(`INSERT INTO live_poll(user_id,contract_address,contract_chain,last_block,active,data)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO NOTHING`,
          [userId, poll.contractAddress||null, poll.contractChain||null,
           poll.lastBlock||null, poll.active||false, JSON.stringify(poll)]);
        count('live_poll','ok');
      } catch(e) { count('live_poll','err'); }
    }

    // traction
    const traction = await readJSON(path.join(dir, 'traction.json'), null);
    if (traction) {
      try {
        await query(`INSERT INTO traction(user_id,productivity_score,tasks,last_checked)
          VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO NOTHING`,
          [userId, traction.productivityScore||0, JSON.stringify(traction.tasks||[]), traction.lastChecked||null]);
        count('traction','ok');
      } catch(e) { count('traction','err'); }
    }

    // agent memory
    const mem = await readJSON(path.join(dir, 'agent-memory.json'), null);
    if (mem) {
      try {
        await query(`INSERT INTO agent_memory(user_id,insights,resolved_issues,preferences,contract_summary)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO NOTHING`,
          [userId, JSON.stringify(Array.isArray(mem.insights)?mem.insights:[]),
           JSON.stringify(Array.isArray(mem.resolvedIssues)?mem.resolvedIssues:[]),
           JSON.stringify(Array.isArray(mem.preferences)?mem.preferences:[]),
           mem.contractSummary||null]);
        count('agent_memory','ok');
      } catch(e) { count('agent_memory','err'); }
    }

    // competitors
    const compDir = path.join(dir, 'competitors');
    const compFiles = await fs.readdir(compDir).catch(() => []);
    for (const f of compFiles.filter(f => f.endsWith('.json') && !f.endsWith('.backup'))) {
      const c = await readJSON(path.join(compDir, f), null);
      if (!c) continue;
      try {
        const addr = (c.address||'').toLowerCase();
        const chain = c.chain||'ethereum';
        await query(`INSERT INTO competitor_data(user_id,address,chain,name,transactions,metrics)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,address,chain) DO NOTHING`,
          [userId, addr, chain, c.name||null,
           JSON.stringify(c.transactions||[]), JSON.stringify(c.metrics||{})]);
        count('competitor_data','ok');
      } catch(e) { count('competitor_data','err'); }
    }

    // competitor metrics
    const cm = await readJSON(path.join(dir, 'competitor_metrics.json'), null);
    if (cm) {
      try {
        await query(`INSERT INTO competitor_metrics(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,
          [userId, JSON.stringify(cm)]);
        count('competitor_metrics','ok');
      } catch(e) { count('competitor_metrics','err'); }
    }
  }
}

// ── 3. Global files ───────────────────────────────────────────────────────────
async function migrateGlobal() {
  console.log('\n🌐 Global data...');

  // alert configs
  const alertDir = path.join(DATA_DIR, 'alert-configs');
  const alertFiles = await fs.readdir(alertDir).catch(() => []);
  for (const f of alertFiles.filter(f => f.endsWith('.json'))) {
    const cfg = await readJSON(path.join(alertDir, f), null);
    if (!cfg?.userId) continue;
    try {
      await query(`INSERT INTO alert_configs(id,user_id,contract_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
        [cfg.id, cfg.userId, cfg.contractId||null, JSON.stringify(cfg)]);
      count('alert_configs','ok');
    } catch(e) { count('alert_configs','err'); }
  }

  // triggered alerts
  const alerts = await readJSON(path.join(DATA_DIR, 'alerts.json'), []);
  for (const a of alerts) {
    if (!a.userId) continue;
    try {
      await query(`INSERT INTO alerts(id,user_id,type,message,is_read,acknowledged_at,data,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
        [a.id||crypto.randomUUID(), a.userId, a.type||null, a.message||null,
         a.is_read||false, a.acknowledged_at||null, JSON.stringify(a),
         a.created_at||new Date().toISOString()]);
      count('alerts','ok');
    } catch(e) { count('alerts','err'); }
  }

  // agent configs
  const agentCfgs = await readJSON(path.join(DATA_DIR, 'agent-configs.json'), []);
  for (const c of agentCfgs) {
    if (!c.userId) continue;
    try {
      await query(`INSERT INTO agent_configs(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,
        [c.userId, JSON.stringify(c)]);
      count('agent_configs','ok');
    } catch(e) { count('agent_configs','err'); }
  }

  // ai tasks
  const tasks = await readJSON(path.join(DATA_DIR, 'ai-tasks.json'), []);
  for (const t of tasks) {
    if (!t.id) continue;
    try {
      await query(`INSERT INTO ai_tasks(id,user_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING`,
        [t.id, t.userId||null, JSON.stringify(t)]);
      count('ai_tasks','ok');
    } catch(e) { count('ai_tasks','err'); }
  }

  // briefings
  const briefings = await readJSON(path.join(DATA_DIR, 'briefings.json'), []);
  for (const b of briefings) {
    if (!b.id) continue;
    try {
      await query(`INSERT INTO briefings(id,user_id,type,title,content,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
        [b.id, b.userId||null, b.type||null, b.title||null, b.content||null, JSON.stringify(b)]);
      count('briefings','ok');
    } catch(e) { count('briefings','err'); }
  }

  // ai advice
  const advice = await readJSON(path.join(DATA_DIR, 'ai_advice.json'), []);
  for (const a of advice) {
    try {
      await query(`INSERT INTO ai_advice(user_id,data) VALUES($1,$2)`, [a.userId||null, JSON.stringify(a)]);
      count('ai_advice','ok');
    } catch(e) { count('ai_advice','err'); }
  }

  // ai insights
  const insightsRaw = await readJSON(path.join(DATA_DIR, 'ai_insights.json'), []);
  const insights = Array.isArray(insightsRaw) ? insightsRaw : [];
  for (const i of insights) {
    try {
      await query(`INSERT INTO ai_insights(user_id,data) VALUES($1,$2)`, [i.userId||null, JSON.stringify(i)]);
      count('ai_insights','ok');
    } catch(e) { count('ai_insights','err'); }
  }

  // share tokens
  const tokens = await readJSON(path.join(DATA_DIR, 'share_tokens.json'), []);
  for (const t of tokens) {
    if (!t.token) continue;
    try {
      await query(`INSERT INTO share_tokens(token,contract_id,user_id,expires_at,revoked) VALUES($1,$2,$3,$4,$5) ON CONFLICT(token) DO NOTHING`,
        [t.token, t.contractId||null, t.userId||null, t.expiresAt||null, t.revoked||false]);
      count('share_tokens','ok');
    } catch(e) { count('share_tokens','err'); }
  }

  // feedback
  const feedback = await readJSON(path.join(DATA_DIR, 'ai-knowledge', 'feedback.json'), []);
  for (const f of feedback) {
    try {
      await query(`INSERT INTO feedback(user_id,message_id,session_id,rating,note,component_type,saved_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [f.userId||null, f.messageId||null, f.sessionId||null, f.rating||null, f.note||null, f.componentType||null, f.savedAt||new Date().toISOString()]);
      count('feedback','ok');
    } catch(e) { count('feedback','err'); }
  }

  // abuse fingerprints
  const abuse = await readJSON(path.join(DATA_DIR, 'abuse-fingerprints.json'), null);
  if (abuse) {
    try {
      await query(`INSERT INTO abuse_fingerprints(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(abuse)]);
      count('abuse_fingerprints','ok');
    } catch(e) { count('abuse_fingerprints','err'); }
  }

  // ai learnings
  const learnings = await readJSON(path.join(DATA_DIR, 'ai-knowledge', 'task-resolutions.json'), []);
  for (const l of learnings) {
    try {
      await query(`INSERT INTO ai_learnings(task_id,feedback,metric_before,metric_after,chain,contract_type,saved_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [l.taskId||null, l.feedback||null,
         l.metricBefore ? JSON.stringify(l.metricBefore) : null,
         l.metricAfter  ? JSON.stringify(l.metricAfter)  : null,
         l.chain||'ethereum', l.contractType||'unknown', l.savedAt||new Date().toISOString()]);
      count('ai_learnings','ok');
    } catch(e) { count('ai_learnings','err'); }
  }

  // social posts
  const socialDir = path.join(DATA_DIR, 'social-posts');
  const socialFiles = await fs.readdir(socialDir).catch(() => []);
  for (const f of socialFiles.filter(f => f.endsWith('.json'))) {
    const userId = f.replace('.json','');
    const posts = await readJSON(path.join(socialDir, f), []);
    for (const p of posts) {
      try {
        await query(`INSERT INTO social_posts(user_id,platform,content,status,data) VALUES($1,$2,$3,$4,$5)`,
          [userId, p.platform||null, p.postText||p.content||null, p.status||null, JSON.stringify(p)]);
        count('social_posts','ok');
      } catch(e) { count('social_posts','err'); }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('🚀 Starting migration...\n');
  await testConnection();
  await migrateUsers();
  await migratePerUser();
  await migrateGlobal();

  console.log('\n═══════════════════════════════');
  console.log('📊 Migration Results:');
  for (const [key, s] of Object.entries(stats)) {
    if (s.ok || s.err) console.log(`  ${key.padEnd(22)} ✅ ${s.ok}  ❌ ${s.err}`);
  }
  console.log('═══════════════════════════════');
  await closePool();
}

migrate().catch(e => { console.error('❌ Migration failed:', e.message); console.error(e.stack); process.exit(1); });
