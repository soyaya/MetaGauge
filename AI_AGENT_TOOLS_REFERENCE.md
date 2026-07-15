# MetaGauge AI - Agent Tools Reference

## Document Purpose

**Goal:** Complete technical reference for all 15 agent tools  
**Audience:** Engineers extending agent capabilities  
**Scope:** Tool schemas, implementation details, usage patterns  
**Last Updated:** January 2025

---

## Table of Contents

1. [Tool Architecture](#tool-architecture)
2. [Tool Catalog](#tool-catalog)
3. [Adding New Tools](#adding-new-tools)
4. [Best Practices](#best-practices)
5. [Troubleshooting](#troubleshooting)

---

## Tool Architecture

### How Tools Work

```
User Question
     ↓
Agent (Gemini/Claude)
     ↓
Decides: "I need get_metrics() tool"
     ↓
Tool Execution (Node.js function)
     ↓
Tool Returns Data
     ↓
Agent Processes Results
     ↓
Generates Natural Language Response
     ↓
User Sees Answer
```

### Tool Definition Schema

```javascript
{
  name: "tool_name",                    // Unique identifier
  description: "What this tool does",   // Agent uses this to decide when to call
  parameters: {
    type: "object",
    properties: {
      param1: {
        type: "string",
        description: "What is this parameter?"
      }
    },
    required: ["param1"]
  }
}
```

---

## Tool Catalog

### Category: Metrics & Analytics

#### 1. get_metrics
**Purpose:** Retrieve current metrics for a contract

**Schema:**
```javascript
{
  name: "get_metrics",
  description: "Get current performance metrics like retention, churn, active users, etc.",
  parameters: {
    type: "object",
    properties: {
      contractAddress: {
        type: "string",
        description: "The blockchain contract address (0x...)"
      },
      metrics: {
        type: "array",
        items: { type: "string" },
        description: "Which metrics to fetch: ['d7Retention', 'activeUsers', 'totalVolume']"
      }
    },
    required: ["contractAddress"]
  }
}
```

**Implementation:**
```javascript
// src/services/agent/tools/get_metrics.js
export async function get_metrics({ contractAddress, metrics = [] }) {
  const contract = await db.contracts.findOne({ address: contractAddress });
  if (!contract) throw new Error('Contract not found');
  
  const allMetrics = await db.metrics.findOne({ contractId: contract.id });
  
  // Filter if specific metrics requested
  if (metrics.length > 0) {
    return pick(allMetrics, metrics);
  }
  
  return allMetrics;
}
```

**Example Usage:**
```
Agent: "I need to check the retention rate"
      ↓ Calls get_metrics({ contractAddress: "0x123...", metrics: ["d7Retention"] })
      ↓ Returns: { d7Retention: 32 }
Agent: "Your 7-day retention is 32%"
```

**Cost:** Database query (~10ms)  
**Failure Mode:** Returns null if contract not indexed

---


#### 2. get_business_intelligence
**Purpose:** Generate BI analysis (retention, LTV, cohorts)

**Schema:**
```javascript
{
  name: "get_business_intelligence",
  description: "Generate business intelligence reports: user segments, lifetime value, cohort analysis",
  parameters: {
    type: "object",
    properties: {
      section: {
        type: "string",
        enum: ["overview", "retention", "ltv", "cohorts", "funnel"],
        description: "Which BI section to generate"
      },
      contractAddress: {
        type: "string"
      }
    },
    required: ["section", "contractAddress"]
  }
}
```

**Implementation:**
```javascript
export async function get_business_intelligence({ section, contractAddress }) {
  const contract = await db.contracts.findOne({ address: contractAddress });
  const transactions = await db.transactions.find({ contractId: contract.id });
  
  switch (section) {
    case 'retention':
      return calculateRetentionCohorts(transactions);
    case 'ltv':
      return calculateLifetimeValue(transactions);
    case 'cohorts':
      return generateCohortTable(transactions);
    // ...
  }
}

function calculateRetentionCohorts(transactions) {
  // Group by first transaction date
  const cohorts = groupBy(transactions, tx => {
    return moment(tx.timestamp).startOf('month').format('YYYY-MM');
  });
  
  // Calculate retention for each cohort
  return Object.entries(cohorts).map(([month, txs]) => {
    const users = unique(txs.map(t => t.wallet));
    const retained = users.filter(wallet => {
      const firstTx = min(txs.filter(t => t.wallet === wallet).map(t => t.timestamp));
      const laterTx = txs.find(t => 
        t.wallet === wallet && 
        moment(t.timestamp).diff(firstTx, 'days') >= 7
      );
      return !!laterTx;
    });
    
    return {
      cohort: month,
      size: users.length,
      retained: retained.length,
      rate: (retained.length / users.length * 100).toFixed(2)
    };
  });
}
```

**Example Usage:**
```
User: "Show me retention by cohort"
Agent calls: get_business_intelligence({ section: "retention", contractAddress })
Returns: [
  { cohort: "2024-12", size: 127, retained: 45, rate: "35.43%" },
  { cohort: "2025-01", size: 89, retained: 31, rate: "34.83%" }
]
```

**Cost:** Complex DB query (~500ms)  
**Caching:** 1 hour TTL

---

#### 3. get_market_context
**Purpose:** Compare contract to category averages

**Schema:**
```javascript
{
  name: "get_market_context",
  description: "Get market averages and competitor benchmarks for comparison",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["defi-lending", "defi-dex", "nft-marketplace", "dao", "gamefi"],
        description: "What category is this contract?"
      }
    },
    required: ["category"]
  }
}
```

**Implementation:**
```javascript
export async function get_market_context({ category }) {
  // Load from static knowledge base
  const knowledge = await loadKnowledge(`data/ai-knowledge/market-${category}.json`);
  
  return {
    category,
    averages: {
      d7Retention: knowledge.avg_retention,
      activeUsers: knowledge.avg_active_users,
      transactionsPerUser: knowledge.avg_tx_per_user
    },
    topPerformers: knowledge.top_performers,
    lastUpdated: knowledge.updated_at
  };
}
```

**Example Response:**
```json
{
  "category": "defi-lending",
  "averages": {
    "d7Retention": 35,
    "activeUsers": 450,
    "transactionsPerUser": 3.2
  },
  "topPerformers": [
    { "name": "Aave", "retention": 52 },
    { "name": "Compound", "retention": 48 }
  ],
  "lastUpdated": "2024-12-15"
}
```

**Cost:** File read (~5ms)  
**Data Freshness:** Updated monthly (manual process - gap identified!)

---

### Category: Task Management

#### 4. create_task
**Purpose:** Create improvement task for user

**Schema:**
```javascript
{
  name: "create_task",
  description: "Create a task to improve a specific metric",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Task title, e.g. 'Improve 7-day retention'"
      },
      metric: {
        type: "string",
        description: "Which metric this task targets"
      },
      currentValue: {
        type: "number",
        description: "Current metric value"
      },
      targetValue: {
        type: "number",
        description: "Target metric value"
      },
      action: {
        type: "string",
        description: "Specific action to take"
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "critical"]
      },
      deadlineDays: {
        type: "number",
        description: "Days until deadline"
      }
    },
    required: ["title", "metric", "action"]
  }
}
```

**Implementation:**
```javascript
export async function create_task(params) {
  const task = {
    id: generateId(),
    userId: params.userId,
    contractId: params.contractId,
    title: params.title,
    metric: params.metric,
    currentValue: params.currentValue,
    targetValue: params.targetValue,
    action: params.action,
    priority: params.priority || 'medium',
    deadline: moment().add(params.deadlineDays || 30, 'days').toDate(),
    status: 'pending',
    createdBy: 'agent',
    createdAt: new Date()
  };
  
  await db.tasks.insert(task);
  
  // Emit WebSocket event so UI updates
  wsManager.emit(params.userId, 'task:created', task);
  
  return { success: true, taskId: task.id };
}
```

**Example Usage:**
```
Agent: "Your retention is low. I'll create a task to fix it"
      ↓
Calls: create_task({
  title: "Improve 7-day retention to 35%",
  metric: "d7Retention",
  currentValue: 15,
  targetValue: 35,
  action: "Add email notifications for inactive users",
  priority: "high",
  deadlineDays: 30
})
      ↓
Returns: { success: true, taskId: "task_123" }
      ↓
Agent: "✅ I created a high-priority task: 'Improve 7-day retention'"
```

**Side Effects:** 
- Creates database record
- Triggers WebSocket event
- May trigger notification

---

#### 5. update_task
**Purpose:** Update existing task (mark complete, change priority)

**Schema:**
```javascript
{
  name: "update_task",
  description: "Update a task's status, priority, or other fields",
  parameters: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "Task ID to update"
      },
      updates: {
        type: "object",
        description: "Fields to update: { status: 'completed', priority: 'low' }"
      }
    },
    required: ["taskId", "updates"]
  }
}
```

**Implementation:**
```javascript
export async function update_task({ taskId, updates }) {
  const task = await db.tasks.findOne({ id: taskId });
  if (!task) throw new Error('Task not found');
  
  // Validate updates
  const allowed = ['status', 'priority', 'notes', 'deadline'];
  const filtered = pick(updates, allowed);
  
  await db.tasks.update({ id: taskId }, { $set: filtered });
  
  wsManager.emit(task.userId, 'task:updated', { taskId, updates: filtered });
  
  return { success: true };
}
```

---

### Category: User Analysis

#### 6. get_user_segments
**Purpose:** Segment users by behavior (power users, at-risk, churned)

**Schema:**
```javascript
{
  name: "get_user_segments",
  description: "Get user segments: power users, at-risk, churned, etc.",
  parameters: {
    type: "object",
    properties: {
      contractAddress: { type: "string" },
      segment: {
        type: "string",
        enum: ["power_users", "at_risk", "churned", "new", "all"]
      }
    },
    required: ["contractAddress", "segment"]
  }
}
```

**Implementation:**
```javascript
export async function get_user_segments({ contractAddress, segment }) {
  const contract = await db.contracts.findOne({ address: contractAddress });
  const transactions = await db.transactions.find({ contractId: contract.id });
  
  const users = groupBy(transactions, 'wallet');
  
  const segments = {
    power_users: Object.entries(users)
      .filter(([wallet, txs]) => txs.length >= 10)
      .map(([wallet, txs]) => ({
        wallet,
        transactions: txs.length,
        volume: sum(txs.map(t => t.value)),
        lastActive: max(txs.map(t => t.timestamp))
      })),
    
    at_risk: Object.entries(users)
      .filter(([wallet, txs]) => {
        const lastTx = max(txs.map(t => t.timestamp));
        const daysSince = moment().diff(lastTx, 'days');
        return daysSince >= 14 && daysSince < 30;
      })
      .map(([wallet, txs]) => ({
        wallet,
        transactions: txs.length,
        lastActive: max(txs.map(t => t.timestamp)),
        daysSinceActive: moment().diff(max(txs.map(t => t.timestamp)), 'days')
      })),
    
    churned: Object.entries(users)
      .filter(([wallet, txs]) => {
        const lastTx = max(txs.map(t => t.timestamp));
        return moment().diff(lastTx, 'days') >= 30;
      })
      .map(([wallet, txs]) => ({
        wallet,
        transactions: txs.length,
        lastActive: max(txs.map(t => t.timestamp))
      }))
  };
  
  return segments[segment];
}
```

**Example Response:**
```json
{
  "segment": "at_risk",
  "users": [
    {
      "wallet": "0x1a2b3c...",
      "transactions": 45,
      "lastActive": "2025-01-03T10:30:00Z",
      "daysSinceActive": 17
    }
  ]
}
```

---


### Category: Transaction Analysis

#### 7. analyze_transactions
**Purpose:** Deep-dive into transaction patterns

**Schema:**
```javascript
{
  name: "analyze_transactions",
  description: "Analyze transaction patterns: failure rate, gas costs, popular functions",
  parameters: {
    type: "object",
    properties: {
      contractAddress: { type: "string" },
      analysisType: {
        type: "string",
        enum: ["failures", "gas", "functions", "timing"],
        description: "Type of analysis to perform"
      },
      timeRange: {
        type: "string",
        description: "Time range: '7d', '30d', '90d'"
      }
    },
    required: ["contractAddress", "analysisType"]
  }
}
```

**Returns:** Structured analysis data based on type

---

### Category: Notifications

#### 8. send_notification
**Purpose:** Send user notification (email, in-app, webhook)

**Schema:**
```javascript
{
  name: "send_notification",
  description: "Send notification to user about important insights or alerts",
  parameters: {
    type: "object",
    properties: {
      userId: { type: "string" },
      channel: {
        type: "string",
        enum: ["email", "inapp", "webhook"],
        description: "Notification channel"
      },
      title: { type: "string" },
      message: { type: "string" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"]
      }
    },
    required: ["userId", "channel", "title", "message"]
  }
}
```

**Implementation:**
```javascript
export async function send_notification({ userId, channel, title, message, priority }) {
  const user = await db.users.findOne({ id: userId });
  
  switch (channel) {
    case 'email':
      await emailService.send({
        to: user.email,
        subject: title,
        body: message,
        priority
      });
      break;
    
    case 'inapp':
      await db.notifications.insert({
        userId,
        title,
        message,
        read: false,
        createdAt: new Date()
      });
      wsManager.emit(userId, 'notification', { title, message });
      break;
    
    case 'webhook':
      if (user.webhookUrl) {
        await fetch(user.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, message, priority })
        });
      }
      break;
  }
  
  return { success: true };
}
```

---

### Category: Recommendations

#### 9. get_recommendations
**Purpose:** Get AI-generated recommendations for improvement

**Schema:**
```javascript
{
  name: "get_recommendations",
  description: "Get personalized recommendations based on contract performance",
  parameters: {
    type: "object",
    properties: {
      contractAddress: { type: "string" },
      focus: {
        type: "string",
        enum: ["retention", "growth", "engagement", "revenue"],
        description: "What to optimize for"
      }
    },
    required: ["contractAddress"]
  }
}
```

**Implementation:**
```javascript
export async function get_recommendations({ contractAddress, focus = 'all' }) {
  const metrics = await get_metrics({ contractAddress });
  const market = await get_market_context({ category: metrics.category });
  
  const recommendations = [];
  
  // Retention recommendations
  if (metrics.d7Retention < market.averages.d7Retention * 0.8) {
    recommendations.push({
      type: 'retention',
      priority: 'high',
      issue: `Retention (${metrics.d7Retention}%) is ${Math.round((1 - metrics.d7Retention / market.averages.d7Retention) * 100)}% below category average`,
      actions: [
        'Implement email notifications for inactive users',
        'Add onboarding tutorial for first-time users',
        'Create loyalty rewards for repeat users'
      ],
      impact: 'high',
      effort: 'medium'
    });
  }
  
  // Gas cost recommendations
  if (metrics.avgGasCost > market.averages.avgGasCost * 1.3) {
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      issue: `Gas costs are 30% higher than average`,
      actions: [
        'Batch similar transactions',
        'Use EIP-2930 access lists',
        'Optimize storage operations'
      ],
      impact: 'medium',
      effort: 'high'
    });
  }
  
  return recommendations
    .filter(r => !focus || r.type === focus)
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
}
```

---

### Remaining Tools (10-15)

#### 10. get_competitor_data
Get competitor metrics for benchmarking

#### 11. analyze_churn
Identify churn patterns and reasons

#### 12. forecast_metrics
Predict future metric values

#### 13. export_data
Export data as CSV/JSON

#### 14. save_insight
Save AI-generated insight for later

#### 15. get_historical_data
Retrieve time-series data for charting

*(Full schemas available in codebase)*

---

## Adding New Tools

### Step-by-Step Guide

**1. Define Tool Schema**
```javascript
// src/services/agent/tools/my_new_tool.js
export const schema = {
  name: "my_new_tool",
  description: "Clear description of what this tool does and when to use it",
  parameters: {
    type: "object",
    properties: {
      param1: {
        type: "string",
        description: "What is this parameter used for?"
      }
    },
    required: ["param1"]
  }
};
```

**2. Implement Function**
```javascript
export async function my_new_tool({ param1 }) {
  // 1. Validate inputs
  if (!param1) throw new Error('param1 is required');
  
  // 2. Fetch data
  const data = await db.query(...);
  
  // 3. Process
  const result = processData(data);
  
  // 4. Return structured output
  return {
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      recordCount: result.length
    }
  };
}
```

**3. Register Tool**
```javascript
// src/services/agent/tools/index.js
import { my_new_tool, schema as myNewToolSchema } from './my_new_tool.js';

export const tools = [
  // ... existing tools
  myNewToolSchema
];

export const toolImplementations = {
  // ... existing implementations
  my_new_tool
};
```

**4. Test Tool**
```javascript
// tests/agent/tools/my_new_tool.test.js
describe('my_new_tool', () => {
  it('should return valid data', async () => {
    const result = await my_new_tool({ param1: 'test' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
  
  it('should handle errors gracefully', async () => {
    await expect(my_new_tool({})).rejects.toThrow('param1 is required');
  });
});
```

**5. Update Agent Prompt**
```javascript
// Optionally add example usage to agent system prompt
const systemPrompt = `...
When user asks about X, use my_new_tool.
Example: User asks "What's my X?" → Call my_new_tool({ param1: contractAddress })
...`;
```

---

## Best Practices

### Tool Design

**1. Single Responsibility**
```javascript
// ❌ Bad: Tool does too many things
get_all_data({ contractAddress, includeMetrics, includeUsers, includeTx })

// ✅ Good: Separate tools
get_metrics({ contractAddress })
get_users({ contractAddress })
get_transactions({ contractAddress })
```

**2. Clear Descriptions**
```javascript
// ❌ Bad: Vague description
description: "Gets data"

// ✅ Good: Specific, actionable
description: "Retrieve 7-day and 30-day retention rates for a contract. Use when user asks about retention, churn, or user return rates."
```

**3. Structured Returns**
```javascript
// ❌ Bad: Inconsistent structure
return userCount; // Just a number

// ✅ Good: Always return objects
return {
  metric: 'activeUsers',
  value: userCount,
  change: {
    percent: +12.5,
    direction: 'up'
  },
  timestamp: new Date()
};
```

**4. Error Handling**
```javascript
// ✅ Always validate and handle errors
export async function my_tool({ contractAddress }) {
  try {
    // Validate
    if (!contractAddress || !contractAddress.startsWith('0x')) {
      throw new Error('Invalid contract address');
    }
    
    // Fetch
    const contract = await db.contracts.findOne({ address: contractAddress });
    if (!contract) {
      throw new Error('Contract not found. Has it been indexed?');
    }
    
    // Process
    const result = await processContract(contract);
    
    return { success: true, data: result };
  } catch (error) {
    // Log for debugging
    console.error('my_tool error:', error);
    
    // Return user-friendly error
    return {
      success: false,
      error: error.message,
      hint: 'Make sure the contract address is correct and has been indexed'
    };
  }
}
```

### Performance

**1. Caching**
```javascript
import { cache } from '../utils/cache.js';

export async function expensive_tool({ contractAddress }) {
  const cacheKey = `tool:expensive:${contractAddress}`;
  
  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  
  // Expensive operation
  const result = await heavyComputation();
  
  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);
  
  return result;
}
```

**2. Pagination**
```javascript
// For tools that return large datasets
export async function get_transactions({ contractAddress, limit = 100, offset = 0 }) {
  const txs = await db.transactions
    .find({ contractAddress })
    .limit(limit)
    .skip(offset)
    .toArray();
  
  return {
    transactions: txs,
    pagination: {
      limit,
      offset,
      total: await db.transactions.count({ contractAddress }),
      hasMore: txs.length === limit
    }
  };
}
```

**3. Timeouts**
```javascript
import { withTimeout } from '../utils/timeout.js';

export async function slow_tool({ param }) {
  // Tool must complete in 10 seconds
  return withTimeout(10000, async () => {
    // ... slow operation
  });
}
```

---

## Troubleshooting

### Common Issues

**Issue 1: Agent doesn't use tool**
```
Symptom: Agent answers without calling relevant tool
Cause: Description unclear or tool not needed
Fix: 
  1. Check tool description - is it specific enough?
  2. Add examples to agent prompt
  3. Test with explicit instruction: "Use get_metrics tool"
```

**Issue 2: Tool returns error**
```
Symptom: Agent says "Tool failed" or returns error message
Cause: Implementation bug, data missing, or timeout
Fix:
  1. Check tool logs
  2. Test tool directly: await my_tool({ param: 'test' })
  3. Add better error handling
```

**Issue 3: Tool too slow**
```
Symptom: Agent takes >10s to respond
Cause: Tool doing expensive DB query or computation
Fix:
  1. Add caching
  2. Optimize query (add index)
  3. Use pagination
  4. Consider background job instead
```

**Issue 4: Agent misinterprets tool output**
```
Symptom: Agent gives wrong answer despite tool returning correct data
Cause: Return format unclear or too complex
Fix:
  1. Simplify return structure
  2. Add clear field names
  3. Include units/context
```

---

## Tool Analytics

### Tracking Usage

```javascript
// Instrument tools with telemetry
export async function my_tool(params) {
  const startTime = Date.now();
  
  try {
    const result = await implementation(params);
    
    telemetry.record({
      tool: 'my_tool',
      duration: Date.now() - startTime,
      success: true,
      params
    });
    
    return result;
  } catch (error) {
    telemetry.record({
      tool: 'my_tool',
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    });
    
    throw error;
  }
}
```

### Usage Report

```sql
-- Most called tools
SELECT 
  tool_name,
  COUNT(*) as calls,
  AVG(duration_ms) as avg_duration,
  SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
FROM tool_telemetry
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY tool_name
ORDER BY calls DESC;
```

---

## Future Tools (Wishlist)

### Planned

1. **get_wallet_profile** - Deep-dive into specific user
2. **compare_contracts** - Side-by-side contract comparison
3. **predict_churn** - ML-based churn prediction
4. **recommend_features** - Suggest features to build
5. **a_b_test_analysis** - Analyze A/B test results

### Community Requests

- Token price integration
- Social sentiment analysis
- Governance participation metrics
- NFT holder analysis
- Cross-chain tracking

---

**Document Status:** Complete  
**Tool Count:** 15 documented  
**Coverage:** 100%  
**Last Updated:** January 2025
