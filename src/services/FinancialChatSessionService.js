/**
 * FinancialChatSessionService
 * Manages persistent chat sessions for the financial AI flow.
 *
 * One session per user per contract.
 * Each session retains:
 *   - financial_mode   (input_collection | monthly_collection | analysis)
 *   - context_summary  (Gemini-maintained rolling summary — refreshed every 10 messages)
 *   - full message history in financial_chat_messages
 *
 * The context_summary ensures Gemini remembers everything discussed
 * across page refreshes, re-opens, and long conversations.
 */

import { query } from '../api/database/postgres.js';

const SUMMARY_REFRESH_EVERY = 10; // refresh context summary every N new messages

// ── Session CRUD ──────────────────────────────────────────────────────────

/**
 * Get or create the financial chat session for a user+contract.
 * Always returns a session object.
 */
export async function getOrCreateSession(userId, contractId) {
  // Try to load existing
  const existing = await query(
    `SELECT * FROM financial_chat_sessions
     WHERE user_id = $1 AND contract_id = $2`,
    [userId, contractId]
  );

  if (existing.rows.length > 0) return existing.rows[0];

  // Create new session
  const created = await query(
    `INSERT INTO financial_chat_sessions (user_id, contract_id, financial_mode)
     VALUES ($1, $2, 'input_collection')
     RETURNING *`,
    [userId, contractId]
  );

  return created.rows[0];
}

/**
 * Update the mode and/or context_summary of a session.
 */
export async function updateSession(sessionId, updates) {
  const { mode, contextSummary } = updates;
  const setClauses = [];
  const values = [];
  let idx = 1;

  if (mode !== undefined) {
    setClauses.push(`financial_mode = $${idx++}`);
    values.push(mode);
  }
  if (contextSummary !== undefined) {
    setClauses.push(`context_summary = $${idx++}`);
    values.push(contextSummary);
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = NOW()`);
  values.push(sessionId);

  await query(
    `UPDATE financial_chat_sessions SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    values
  );
}

// ── Message CRUD ──────────────────────────────────────────────────────────

/**
 * Save a single message to the session.
 * fieldCollected: optional — if this AI turn saved a financial input field, record which one.
 */
export async function saveMessage(sessionId, role, content, fieldCollected = null) {
  const result = await query(
    `INSERT INTO financial_chat_messages (session_id, role, content, field_collected)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [sessionId, role, content, fieldCollected]
  );
  return result.rows[0];
}

/**
 * Get the last N messages from a session (most recent first, then reversed for chronological order).
 */
export async function getRecentMessages(sessionId, limit = 20) {
  const result = await query(
    `SELECT role, content, field_collected, created_at
     FROM financial_chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  // Return in chronological order (oldest first)
  return result.rows.reverse();
}

/**
 * Count total messages in a session.
 */
export async function getMessageCount(sessionId) {
  const result = await query(
    `SELECT COUNT(*) as count FROM financial_chat_messages WHERE session_id = $1`,
    [sessionId]
  );
  return parseInt(result.rows[0].count);
}

/**
 * Get all fields that have already been collected in this session.
 * Used to avoid re-asking fields the AI has already saved in prior turns.
 */
export async function getCollectedFields(sessionId) {
  const result = await query(
    `SELECT DISTINCT field_collected
     FROM financial_chat_messages
     WHERE session_id = $1 AND field_collected IS NOT NULL`,
    [sessionId]
  );
  return result.rows.map(r => r.field_collected);
}

// ── Context builder ───────────────────────────────────────────────────────

/**
 * Build the full context object to inject into a Gemini prompt.
 * Returns everything Gemini needs to understand the conversation state.
 */
export async function buildGeminiContext(sessionId, session) {
  const [recentMessages, messageCount] = await Promise.all([
    getRecentMessages(sessionId, 20),
    getMessageCount(sessionId),
  ]);

  return {
    session,
    recentMessages,
    messageCount,
    contextSummary: session.context_summary || null,
    shouldRefreshSummary: messageCount > 0 && messageCount % SUMMARY_REFRESH_EVERY === 0,
  };
}

// ── Context summary refresh ───────────────────────────────────────────────

/**
 * Build a prompt that asks Gemini to summarise the conversation so far.
 * The result is saved back as context_summary on the session.
 * Called automatically every SUMMARY_REFRESH_EVERY messages.
 */
export function buildSummaryRefreshPrompt(recentMessages, existingSummary) {
  const history = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  return `You are maintaining a financial advisor AI's memory.

${existingSummary ? `Previous summary:\n${existingSummary}\n\n` : ''}Recent conversation:
${history}

Write a concise summary (maximum 250 words) of the key facts established so far:
- What financial inputs have been collected (project stage, costs, funding etc.)
- What documents have been generated
- What the user has asked about
- Any important context about the project

Be factual and specific. This will be injected into future prompts so the AI never loses context.`;
}

// ── Prompt builder ────────────────────────────────────────────────────────

/**
 * Build the full system + context prompt for the financial AI chat.
 *
 * mode:
 *   input_collection   → AI is collecting one-time profile fields
 *   monthly_collection → AI is collecting monthly cost inputs
 *   analysis           → All inputs present, AI answers questions about documents
 *
 * missingFields: from FinancialProfileService.getMissingFields()
 * documents: generated financial documents (if mode = analysis)
 */
export function buildFinancialSystemPrompt({
  mode,
  missingOneTime = [],
  missingMonthly = [],
  missingFundingRounds = false,
  period,
  profile = {},
  documents = null,
  contextSummary = null,
  recentMessages = [],
  projectName = 'the project',
  chain = 'ethereum',
}) {
  const periodLabel = formatPeriodLabel(period);

  // ── Base identity ──
  let prompt = `You are CFO, MetaGauge's financial AI — a senior CFO-level analyst specialising in blockchain protocols.
If asked your name, you are "CFO". You are working with the project: ${projectName} on ${chain}.
Current period: ${periodLabel}.

Your job depends on the current mode:
`;

  // ── Mode-specific instructions ──
  if (mode === 'input_collection') {
    const nextField = missingOneTime[0];
    const nextFundingRound = missingFundingRounds && missingOneTime.length === 0;

    prompt += `
MODE: ONE-TIME SETUP
You are collecting one-time project details needed to generate financial documents.
These fields are NEVER re-asked once saved.

NEXT FIELD TO COLLECT: ${nextFundingRound ? 'funding_round' : nextField?.key || 'none'}

${nextFundingRound ? `
Ask the user about their first funding round. Collect ALL of the following before saving:
- Round type (pre-seed/seed/series-a/series-b/grant/token-sale)
- Amount raised (USD)
- Date of the round (approximate is fine)
- Lead investor name (optional — may be skipped)
Ask conversationally, one piece at a time. Only once you have round type, amount, and date,
emit the SAVE tag (see below) with all collected fields as JSON.
` : nextField ? `
Ask the user this question exactly:
"${nextField.question}"

Validation rules:
- Type: ${nextField.type}
${nextField.valid ? `- Valid values: ${nextField.valid.join(', ')}` : ''}
- If the user's answer is unclear or invalid, ask for clarification once. Do NOT emit a SAVE tag yet.
- Once you have a valid, unambiguous answer, confirm it back to the user in your reply AND emit a SAVE tag (see below).
- Do NOT ask any other questions in this turn. One field at a time.
` : ''}

REMAINING FIELDS TO COLLECT: ${missingOneTime.length} one-time fields${missingFundingRounds ? ' + funding round details' : ''}
When all fields are collected, say: "Perfect — I have all the project details I need. Now let me ask about this month's costs."

SAVE TAG — REQUIRED whenever you have a confirmed, valid value for the field you just asked about:
Append this exact tag on its own line at the very end of your reply (it will be stripped before the user sees it):
  [[SAVE:${nextFundingRound ? 'funding_round' : (nextField?.key || 'FIELD_KEY')}|VALUE]]
- For plain fields, VALUE is the raw parsed value (e.g. "seed", "12", "true").
- For funding_round, VALUE is a single-line JSON object: {"round":"seed","amount_usd":500000,"date":"2024-03","lead_investor":"Acme Ventures"}
- Never emit the tag speculatively — only when the value is confirmed and ready to persist.
- Never emit more than one SAVE tag per reply.
`;
  } else if (mode === 'monthly_collection') {
    const nextField = missingMonthly[0];
    prompt += `
MODE: MONTHLY COST COLLECTION (${periodLabel})
All one-time project details are saved. Now collecting monthly operating costs.
These are asked once per month. Previously answered months are never re-asked.

NEXT FIELD TO COLLECT: ${nextField?.key || 'none'}

${nextField ? `
Ask the user this question exactly:
"${nextField.question}"

- Type: number (USD)
- Accept "none", "0", "nil", "n/a" as zero
- Confirm the value back before saving
- Do NOT ask multiple fields in one message. One at a time.
- Once confirmed, emit a SAVE tag (see below).
` : ''}

REMAINING MONTHLY FIELDS: ${missingMonthly.length}
When all monthly fields are collected, say: "All done for ${periodLabel}. Generating your financial documents now..." then indicate documents are ready to generate.

SAVE TAG — REQUIRED whenever you have a confirmed, valid numeric value for the field you just asked about:
Append this exact tag on its own line at the very end of your reply (it will be stripped before the user sees it):
  [[SAVE:${nextField?.key || 'FIELD_KEY'}|VALUE]]
VALUE is the numeric amount only (e.g. "0" for none, "1200" for $1,200). Never emit it speculatively.
`;
  } else {
    // analysis mode
    prompt += `
MODE: FINANCIAL ANALYSIS
All inputs are collected. Financial documents are generated and available.
Answer the user's questions about their financial data with the precision of a CFO.

When referencing numbers, cite the specific document and line item.
When making comparisons, note whether you're comparing to sector benchmarks or prior periods.
When asked to generate or export a PDF, confirm you are doing so.
`;

    if (documents) {
      prompt += `
AVAILABLE FINANCIAL DOCUMENTS FOR ${periodLabel}:

INCOME STATEMENT:
${JSON.stringify(documents.income_statement, null, 2)}

CASH FLOW STATEMENT:
${JSON.stringify(documents.cash_flow_statement, null, 2)}

BALANCE SHEET:
${JSON.stringify(documents.balance_sheet, null, 2)}

UNIT ECONOMICS:
${JSON.stringify(documents.unit_economics, null, 2)}

KPI DASHBOARD:
${JSON.stringify(documents.kpi_dashboard, null, 2)}
`;
    }
  }

  // ── Saved profile context (always included) ──
  if (profile && Object.keys(profile).length > 0) {
    prompt += `
KNOWN PROJECT DETAILS:
- Stage: ${profile.project_stage || 'unknown'}
- Has token: ${profile.has_token ? `Yes (${profile.token_symbol || 'unknown symbol'})` : 'No'}
- Revenue model: ${profile.revenue_model || 'unknown'}
- Team size: ${profile.team_size || 'unknown'}
- Raised funding: ${profile.raised_funding ? 'Yes' : 'No'}
`;
  }

  // ── Rolling context summary ──
  if (contextSummary) {
    prompt += `
CONVERSATION HISTORY SUMMARY:
${contextSummary}
`;
  }

  // ── Recent message history ──
  if (recentMessages.length > 0) {
    prompt += `
RECENT CONVERSATION:
${recentMessages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}
`;
  }

  prompt += `
IMPORTANT RULES:
- Never re-ask a field that is already saved
- Never ask more than one question per message
- Be warm but professional — you are a trusted financial advisor
- If the user goes off-topic, gently redirect: "I'll note that. Let me get back to collecting your [field] so I can generate your documents."
- Always confirm a value before saving it in the same message
- Never fabricate financial numbers — only use data from the documents or inputs provided
- The [[SAVE:...]] tag is the ONLY mechanism that persists data — a field is not actually saved
  unless you emit it. Saying "saved" without the tag does nothing.
`;

  return prompt;
}

// ── Utilities ─────────────────────────────────────────────────────────────

function formatPeriodLabel(period) {
  if (!period) return 'current period';
  const [year, month] = period.split('-');
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[parseInt(month) - 1]} ${year}`;
}
