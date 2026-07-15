# MetaGauge AI - Implementation Roadmap

## Document Purpose

**Goal:** Provide a detailed, actionable roadmap for implementing AI improvements  
**Audience:** Engineering leads, product managers, technical architects  
**Timeline:** 12-week phased rollout  
**Last Updated:** January 2025

---

## Table of Contents

1. [Phased Implementation Strategy](#phased-implementation-strategy)
2. [Week-by-Week Breakdown](#week-by-week-breakdown)
3. [Technical Specifications](#technical-specifications)
4. [Migration Plans](#migration-plans)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Team Resources](#team-resources)

---

## Phased Implementation Strategy

### Phase 1: Stabilization (Week 1-2)
**Goal:** Fix critical issues, establish baseline metrics  
**Risk Level:** 🟢 Low  
**Team Size:** 1 engineer  
**Reversible:** Yes

**Deliverables:**
- ✅ Experimental model removed
- ✅ Telemetry system operational
- ✅ Cost tracking dashboard
- ✅ Error rate baseline established

---

### Phase 2: Quality Pilot (Week 3-6)
**Goal:** Test Claude on CFO feature with 10% traffic  
**Risk Level:** 🟡 Medium  
**Team Size:** 2 engineers  
**Reversible:** Yes (kill switch)

**Deliverables:**
- ✅ BaseAIService abstraction created
- ✅ Claude integrated for CFO
- ✅ A/B test framework implemented
- ✅ Quality metrics comparison (Gemini vs Claude)
- ✅ User satisfaction scores collected

---

### Phase 3: Full Hybrid Rollout (Week 7-12)
**Goal:** Production-ready hybrid AI infrastructure  
**Risk Level:** 🟡 Medium  
**Team Size:** 2-3 engineers  
**Reversible:** Partial (can revert to Gemini-only)

**Deliverables:**
- ✅ All 4 AI personas migrated to BaseAIService
- ✅ Intelligent routing based on complexity
- ✅ Claude CFO rolled out to 100%
- ✅ Cost optimization implemented
- ✅ Comprehensive monitoring dashboard
- ✅ Documentation updated

---

## Week-by-Week Breakdown

### Week 1: Emergency Fixes (40 hours)

**Day 1-2: Model Standardization (8 hours)**
```yaml
Task: Replace experimental model
Assignee: Senior Engineer
Files Changed: 
  - src/services/BusinessAIEngine.js
  - src/services/AgentService.js
  - src/services/FinancialNarrativeService.js
  
Steps:
  1. Search: git grep -n "gemini-2.0-flash-exp"
  2. Replace: sed -i 's/gemini-2.0-flash-exp/gemini-2.5-flash/g'
  3. Test: Run full test suite
  4. Deploy: Push to staging
  5. Monitor: Watch error rates for 24h
  6. Deploy: Production (if staging clean)

Success Criteria:
  - Zero references to experimental model
  - Error rate unchanged or improved
  - Response times unchanged
```

**Day 3-5: Telemetry Implementation (32 hours)**
```yaml
Task: Build comprehensive AI telemetry system
Assignee: Senior + Mid-level Engineer

Subtasks:
  1. Create TelemetryCollector.js (8h)
     - Design schema
     - Implement collectors
     - Add database table
     - Write tests
  
  2. Instrument all AI services (16h)
     - Update ChatAssistant
     - Update FinancialNarrativeService
     - Update AgentService
     - Update BusinessAIEngine
     - Add middleware hooks
  
  3. Build monitoring dashboard (8h)
     - Cost per feature chart
     - Token usage trends
     - Error rate by provider
     - Response time percentiles
     - Real-time alerts

Database Schema:
CREATE TABLE ai_telemetry (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id VARCHAR(255),
  contract_id VARCHAR(255),
  service VARCHAR(50),           -- 'chat', 'cfo', 'agent', 'bi'
  provider VARCHAR(20),           -- 'gemini', 'claude'
  model VARCHAR(50),
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  duration_ms INT,
  success BOOLEAN,
  error_type VARCHAR(100),
  cost_usd DECIMAL(10,6),
  session_id VARCHAR(100),
  metadata JSONB
);

CREATE INDEX idx_telemetry_timestamp ON ai_telemetry(timestamp DESC);
CREATE INDEX idx_telemetry_service ON ai_telemetry(service);
CREATE INDEX idx_telemetry_user ON ai_telemetry(user_id);

Success Criteria:
  - All AI calls logging telemetry
  - Dashboard shows real-time data
  - Cost calculation accurate within 5%
  - Alerts fire correctly
```

---

### Week 2: Baseline & Analysis (40 hours)

**Day 1-3: Data Collection (24 hours)**
```yaml
Task: Collect one week of telemetry data
Assignee: Data Analyst + Engineer

Activities:
  - Monitor telemetry pipeline
  - Validate data quality
  - Run daily cost reports
  - Identify anomalies
  - Document patterns

Metrics to Track:
  - Requests per service per day
  - Average tokens per request
  - Cost per user per day
  - Error rates by service
  - Response time distributions
  - Peak usage hours
```

**Day 4-5: Optimization Opportunities (16 hours)**
```yaml
Task: Analyze telemetry for quick wins
Assignee: Tech Lead + Product Manager

Analysis Areas:
  1. Token Waste
     - Find prompts using >10k tokens
     - Identify redundant context
     - Optimize system prompts
  
  2. Caching Opportunities
     - Find repeated queries
     - Identify cacheable responses
     - Calculate cache hit potential
  
  3. Error Patterns
     - Categorize all errors
     - Find root causes
     - Prioritize fixes
  
  4. Cost Hotspots
     - Identify most expensive features
     - Calculate cost per value
     - Find optimization targets

Deliverable: "Week 2 Optimization Report" with:
  - Top 5 quick wins
  - Expected savings per win
  - Implementation effort estimates
  - Prioritized action list
```

---

### Week 3-4: BaseAIService Foundation (80 hours)

**Week 3: Core Abstraction (40 hours)**
```yaml
Task: Build provider-agnostic AI service
Assignee: 2 Senior Engineers

Architecture:
src/services/ai/
├── BaseAIService.js          # Abstract base class
├── providers/
│   ├── GeminiProvider.js     # Gemini implementation
│   ├── ClaudeProvider.js     # Claude implementation (new)
│   └── ProviderFactory.js    # Provider selection
├── routing/
│   ├── ComplexityDetector.js # Analyze query complexity
│   └── RouterConfig.js       # Routing rules
├── utils/
│   ├── TokenCounter.js       # Estimate costs
│   ├── ErrorHandler.js       # Unified error handling
│   └── RateLimiter.js        # Per-provider rate limits
└── telemetry/
    └── TelemetryCollector.js # Moved from root

File 1: BaseAIService.js (200 lines)
---
export class BaseAIService {
  constructor(config) {
    this.provider = config.provider || 'gemini';
    this.model = config.model || this._getDefaultModel();
    this.provider = ProviderFactory.create(this.provider);
    this.telemetry = new TelemetryCollector();
    this.router = new ComplexityDetector();
  }

  async generate(params) {
    const startTime = Date.now();
    const complexity = this.router.detect(params.prompt);
    
    try {
      // Route to appropriate provider
      const provider = this._selectProvider(complexity);
      const result = await provider.generate(params);
      
      // Log telemetry
      this.telemetry.record({
        provider: provider.name,
        model: this.model,
        tokens: result.usage,
        duration: Date.now() - startTime,
        complexity,
        success: true
      });
      
      return result;
    } catch (error) {
      // Telemetry + error handling
      this.telemetry.record({
        provider: this.provider.name,
        duration: Date.now() - startTime,
        error: error.message,
        success: false
      });
      
      return this._handleError(error, params);
    }
  }

  _selectProvider(complexity) {
    // Routing logic
    const rules = RouterConfig.get(this.service);
    if (rules.forceProvider) return rules.forceProvider;
    if (complexity === 'high' && rules.highComplexity) {
      return ProviderFactory.create(rules.highComplexity);
    }
    return this.provider;
  }

  async _handleError(error, params) {
    if (this._isRetryable(error)) {
      return this._retry(params);
    }
    if (this._hasFallback()) {
      return this._fallback(params);
    }
    throw error;
  }
}
---

Success Criteria:
  - BaseAIService passes all unit tests
  - Can swap providers without code changes
  - Error handling covers all scenarios
  - Performance overhead <50ms
```

**Week 4: Claude Integration (40 hours)**
```yaml
Task: Implement Claude provider with feature parity
Assignee: 2 Senior Engineers

Subtasks:
  1. ClaudeProvider.js (16h)
     - Implement generate() method
     - Add key rotation logic
     - Handle tool calling (different format)
     - Map errors to common format
     - Write comprehensive tests
  
  2. Cost Calculation (8h)
     - Implement token counting
     - Add pricing tiers
     - Calculate cost per request
     - Build cost forecasting
  
  3. Integration Tests (16h)
     - Test against real API
     - Verify tool calling works
     - Test error scenarios
     - Load test with 100 concurrent
     - Compare quality vs Gemini

Quality Tests:
  Test Set: 50 financial questions
  Gemini Baseline: 
    - Accuracy: 87%
    - Avg tokens: 1,200
    - Avg cost: $0.002
  
  Claude Target:
    - Accuracy: >92%
    - Avg tokens: <1,500
    - Avg cost: <$0.015
  
  If Claude doesn't beat Gemini by 5%+ accuracy, reconsider.

Success Criteria:
  - All tests green
  - Performance acceptable (<2x slower than Gemini)
  - Cost within budget
  - Quality measurably better
```

---

### Week 5-6: CFO Pilot (80 hours)

**Week 5: A/B Test Infrastructure (40 hours)**
```yaml
Task: Build A/B testing framework
Assignee: Senior Engineer + Data Engineer

Components:
  1. Feature Flag System (16h)
     - Use existing system or add LaunchDarkly
     - Create flag: cfo_claude_pilot
     - Implement gradual rollout
     - Add override for testing
  
  2. Traffic Splitting (8h)
     - 90% Gemini (control)
     - 10% Claude (experiment)
     - Sticky by user (same user = same provider)
     - Log assignment to telemetry
  
  3. Quality Scoring (16h)
     - Add user feedback widget
     - Track: accuracy, usefulness, clarity
     - Auto-detect calculation errors
     - Compare Gemini vs Claude scores

Database Schema:
CREATE TABLE ab_test_assignments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  experiment_name VARCHAR(100) NOT NULL,
  variant VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, experiment_name)
);

CREATE TABLE cfo_feedback (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  document_id VARCHAR(255),
  provider VARCHAR(20),
  accuracy_score INT CHECK (accuracy_score BETWEEN 1 AND 5),
  usefulness_score INT CHECK (usefulness_score BETWEEN 1 AND 5),
  clarity_score INT CHECK (clarity_score BETWEEN 1 AND 5),
  free_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

Success Criteria:
  - 10% of users get Claude
  - Assignments are sticky
  - All interactions logged
  - Feedback collecting properly
```

**Week 6: Pilot Launch & Monitoring (40 hours)**
```yaml
Task: Launch CFO Claude pilot and analyze results
Assignee: Full team (Eng + Product + Data)

Day 1-2: Launch (16h)
  - Deploy to staging
  - QA test both variants
  - Smoke test in production
  - Enable for 5% (soft launch)
  - Monitor for 24h
  - Ramp to 10%

Day 3-5: Data Collection (24h)
  - Monitor dashboards daily
  - Respond to issues
  - Collect user feedback
  - Run daily reports
  - Compare metrics

Metrics to Track:
  ┌─────────────────┬──────────┬─────────┬──────────┐
  │ Metric          │ Gemini   │ Claude  │ Target   │
  ├─────────────────┼──────────┼─────────┼──────────┤
  │ Accuracy        │ 87%      │ ???     │ >92%     │
  │ User Rating     │ 4.2/5    │ ???     │ >4.5/5   │
  │ Errors          │ 8%       │ ???     │ <5%      │
  │ Avg Cost        │ $0.002   │ ???     │ <$0.020  │
  │ Avg Tokens      │ 1,200    │ ???     │ <2,000   │
  │ Response Time   │ 4.2s     │ ???     │ <8s      │
  └─────────────────┴──────────┴─────────┴──────────┘

Decision Criteria:
  IF Claude_Accuracy > Gemini_Accuracy + 5%
  AND User_Rating_Claude > User_Rating_Gemini + 0.2
  AND Cost_Increase < $100/month
  THEN proceed to Phase 3
  ELSE optimize and re-test

Go/No-Go Meeting: End of Week 6
  - Present findings to stakeholders
  - Review ROI calculation
  - Decide: proceed, iterate, or abort
```

---

### Week 7-8: Migration Planning (80 hours)

**Week 7: Service Migration Strategy (40 hours)**
```yaml
Task: Plan migration of remaining services
Assignee: Tech Lead + 2 Engineers

Services to Migrate:
  1. ChatAssistant (src/services/ChatAssistant.js)
     - Complexity: Low-Medium
     - Current: Gemini-only
     - Future: Gemini (stay as-is)
     - Effort: 8h (refactor to BaseAIService)
  
  2. AgentService (src/services/AgentService.js)
     - Complexity: High
     - Current: Gemini with tools
     - Future: Smart routing (simple=Gemini, complex=Claude)
     - Effort: 24h (routing logic + testing)
  
  3. BusinessAIEngine (src/services/BusinessAIEngine.js)
     - Complexity: Medium
     - Current: Gemini
     - Future: Gemini (cost-sensitive)
     - Effort: 8h (refactor to BaseAIService)

Migration Order (by risk):
  Week 8: ChatAssistant (lowest risk)
  Week 9: BusinessAIEngine (medium risk)
  Week 10: AgentService (highest risk)

Per-Service Checklist:
  ☐ Create migration branch
  ☐ Refactor to use BaseAIService
  ☐ Add provider config
  ☐ Update tests
  ☐ Run regression tests
  ☐ Deploy to staging
  ☐ QA verification
  ☐ Canary deploy (5% traffic)
  ☐ Monitor for 24h
  ☐ Ramp to 50%
  ☐ Monitor for 48h
  ☐ Ramp to 100%
  ☐ Post-deploy verification
```

**Week 8: First Migration (ChatAssistant) (40 hours)**
```yaml
Task: Migrate ChatAssistant to BaseAIService
Assignee: Mid-level Engineer + QA

Steps:
  1. Code Refactor (16h)
     Old:
       this.client = new GoogleGenAI({ apiKey: keys[0] })
       const result = await this.client.generateContent(...)
     
     New:
       this.aiService = new BaseAIService({ 
         provider: 'gemini',
         service: 'chat'
       })
       const result = await this.aiService.generate(...)
  
  2. Testing (16h)
     - Unit tests updated
     - Integration tests pass
     - 100 real chat queries tested
     - Response quality unchanged
     - Performance within 10% of baseline
  
  3. Deployment (8h)
     - Staging deploy
     - Canary (5% for 24h)
     - Gradual rollout
     - 100% by end of week

Validation:
  ✅ Zero errors in staging
  ✅ Response times unchanged
  ✅ Quality scores maintained
  ✅ Cost per chat unchanged
  ✅ All telemetry flowing

Success Criteria:
  - Migration complete
  - No regressions detected
  - Team confident in process
```

---

### Week 9-10: Remaining Migrations (80 hours)

**Week 9: BusinessAIEngine (40h)**
Same process as ChatAssistant

**Week 10: AgentService with Smart Routing (40h)**
```yaml
Additional Complexity: Routing logic

ComplexityDetector Rules:
  function detectComplexity(message, context) {
    let score = 0;
    
    // Keyword analysis
    if (/analyze|compare|evaluate|assess/.test(message)) score += 3;
    if (/forecast|predict|project/.test(message)) score += 3;
    if (/why|how|explain/.test(message)) score += 2;
    
    // Context complexity
    if (context.metrics?.length > 3) score += 2;
    if (context.competitors?.length > 0) score += 2;
    if (context.timeRange === 'multi-period') score += 2;
    
    // Message length (longer = more complex)
    if (message.length > 200) score += 1;
    
    // Classify
    if (score >= 7) return 'high';    // Use Claude
    if (score >= 4) return 'medium';  // Use Gemini
    return 'low';                     // Use Gemini
  }

Testing:
  - Test 200 agent queries
  - Verify routing accuracy
  - Ensure Claude only gets complex ones
  - Monitor cost impact
```

---

### Week 11-12: Production Hardening (80 hours)

**Week 11: Monitoring & Alerts (40 hours)**
```yaml
Task: Production-grade observability
Assignee: DevOps + Senior Engineer

Dashboards to Build:
  1. AI Health Dashboard
     - Request rate per service
     - Error rate by provider
     - P50/P95/P99 response times
     - Provider availability
     - Key rotation status
  
  2. Cost Dashboard
     - Spend per service per day
     - Projected monthly cost
     - Cost per user
     - Budget utilization
     - Anomaly detection
  
  3. Quality Dashboard
     - User satisfaction scores
     - Accuracy metrics
     - Error categories
     - Improvement trends

Alerts to Configure:
  Critical (PagerDuty):
    - Error rate >10% for 5 minutes
    - All API keys failing
    - Response time >30s (p95)
    - Daily cost >$50 (unusual spike)
  
  Warning (Slack):
    - Error rate >5% for 10 minutes
    - Single API key failing
    - Response time >10s (p95)
    - Daily cost >$20 (threshold)
    - User satisfaction <4.0
```

**Week 12: Documentation & Handoff (40 hours)**
```yaml
Task: Complete documentation and team training
Assignee: Tech Lead + Technical Writer

Documentation to Create:
  1. Architecture Guide (8h)
     - System diagrams
     - Provider comparison
     - Routing logic explained
     - Cost model
  
  2. Runbooks (8h)
     - How to add a new provider
     - How to update routing rules
     - How to handle API outages
     - How to optimize costs
  
  3. Troubleshooting Guide (8h)
     - Common errors and fixes
     - Performance debugging
     - Cost spike investigation
     - Quality degradation response
  
  4. API Documentation (8h)
     - BaseAIService API
     - Provider interface
     - Telemetry schema
     - Configuration options

Team Training (8h):
  - 2-hour workshop: Architecture overview
  - 2-hour workshop: Monitoring and alerts
  - 2-hour workshop: Common issues
  - 2-hour workshop: Cost optimization

Success Criteria:
  - All docs complete
  - Team trained
  - Handoff to on-call
  - Project retrospective done
```

---

## Technical Specifications

### BaseAIService API

```javascript
class BaseAIService {
  constructor(config: {
    provider?: 'gemini' | 'claude' | 'openai',
    service?: 'chat' | 'cfo' | 'agent' | 'bi',
    model?: string,
    routing?: RoutingConfig,
    fallback?: FallbackConfig
  })
  
  async generate(params: {
    prompt: string,
    systemPrompt?: string,
    tools?: Tool[],
    temperature?: number,     // 0.0 - 1.0
    maxTokens?: number,       // Max response length
    stream?: boolean,         // Streaming response
    metadata?: object         // For telemetry
  }): Promise<AIResponse>
  
  async generateStream(params): AsyncIterator<AIChunk>
  
  getStats(): ServiceStats
  
  resetStats(): void
}

interface AIResponse {
  text: string,
  usage: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number
  },
  cost: number,             // USD
  provider: string,
  model: string,
  duration: number,         // ms
  metadata?: object
}
```

### Routing Configuration

```javascript
// config/ai-routing.js
export const routingConfig = {
  chat: {
    default: 'gemini',
    model: 'gemini-2.5-flash-lite',
    forceProvider: null,      // Override if needed
    routing: {
      enabled: false           // No routing for chat
    }
  },
  
  cfo: {
    default: 'claude',
    model: 'claude-sonnet-4.5',
    forceProvider: 'claude',   // Always Claude
    routing: {
      enabled: false
    },
    fallback: {
      provider: 'gemini',
      model: 'gemini-2.5-flash'
    }
  },
  
  agent: {
    default: 'gemini',
    model: 'gemini-2.5-flash',
    routing: {
      enabled: true,
      highComplexity: 'claude',
      mediumComplexity: 'gemini',
      lowComplexity: 'gemini'
    }
  },
  
  bi: {
    default: 'gemini',
    model: 'gemini-2.5-flash',
    routing: {
      enabled: false
    }
  }
};
```

### Environment Variables

```bash
# Provider Selection
AI_PROVIDER_CHAT=gemini
AI_PROVIDER_CFO=claude
AI_PROVIDER_AGENT=hybrid
AI_PROVIDER_BI=gemini

# Gemini Configuration
GEMINI_API_KEY=your-key
GEMINI_API_KEY_2=backup-key-1
GEMINI_API_KEY_3=backup-key-2
# ... up to GEMINI_API_KEY_10

# Claude Configuration
ANTHROPIC_API_KEY=sk-ant-your-key
ANTHROPIC_API_KEY_2=sk-ant-backup-1
ANTHROPIC_API_KEY_3=sk-ant-backup-2

# Model Selection
GEMINI_MODEL_CHAT=gemini-2.5-flash-lite
GEMINI_MODEL_DEFAULT=gemini-2.5-flash
CLAUDE_MODEL_CFO=claude-sonnet-4.5

# Routing
AGENT_ROUTING_ENABLED=true
AGENT_COMPLEXITY_THRESHOLD=7

# Telemetry
AI_TELEMETRY_ENABLED=true
AI_TELEMETRY_SAMPLE_RATE=1.0  # Log 100% of requests

# Cost Controls
AI_COST_ALERT_THRESHOLD=50     # USD per day
AI_COST_HARD_LIMIT=100         # USD per day (circuit breaker)

# Caching
AI_CACHE_ENABLED=true
AI_CACHE_TTL=3600              # 1 hour

# Rate Limiting
AI_RATE_LIMIT_PER_USER=100     # Requests per hour
```

---

## Migration Plans

### Service-by-Service Migration

**1. ChatAssistant**
```yaml
Current Implementation:
  File: src/services/ChatAssistant.js
  Lines: ~200
  Dependencies: GoogleGenAI
  Complexity: Low

Migration Strategy:
  1. Create ChatAssistant_v2.js
  2. Extend BaseAIService
  3. Port logic (keep system prompts same)
  4. Test in parallel
  5. Feature flag cutover
  6. Delete old file

Risk: Low (stateless, high volume of tests)
Rollback: Feature flag toggle
Time: 16 hours
```

**2. FinancialNarrativeService (CFO)**
```yaml
Current Implementation:
  File: src/services/FinancialNarrativeService.js
  Lines: ~500
  Dependencies: GoogleGenAI
  Complexity: High (stateful conversation)

Migration Strategy:
  1. Already piloted (Week 5-6)
  2. Extend BaseAIService with Claude default
  3. Keep Gemini fallback
  4. Migrate conversation state handling
  5. Test all document types
  6. Gradual rollout

Risk: Medium (complex state, accuracy critical)
Rollback: Provider switch in config
Time: 24 hours (already mostly done in pilot)
```

**3. AgentService**
```yaml
Current Implementation:
  File: src/services/AgentService.js
  Lines: ~300
  Dependencies: GoogleGenAI + 15 tools
  Complexity: High (tool calling)

Migration Strategy:
  1. Test tool calling with both providers
  2. Implement ComplexityDetector
  3. Extend BaseAIService with routing
  4. Update tool schemas (Claude format differs)
  5. Test all 15 tools
  6. Shadow mode (log routing, don't act)
  7. Enable routing

Risk: High (tool calling, routing logic)
Rollback: Disable routing, fallback to Gemini
Time: 40 hours
```

**4. BusinessAIEngine**
```yaml
Current Implementation:
  File: src/services/BusinessAIEngine.js
  Lines: ~350
  Dependencies: GoogleGenAI
  Complexity: Medium

Migration Strategy:
  1. Extend BaseAIService
  2. Keep Gemini (cost-sensitive)
  3. Test BI query generation
  4. Test narrative generation
  5. Gradual rollout

Risk: Low-Medium (high volume, but simple)
Rollback: Feature flag toggle
Time: 16 hours
```

---

## Testing Strategy

### Test Levels

**1. Unit Tests**
```javascript
// tests/BaseAIService.test.js
describe('BaseAIService', () => {
  describe('generate()', () => {
    it('should route complex queries to Claude', async () => {
      const service = new BaseAIService({
        service: 'agent',
        routing: { enabled: true }
      });
      
      const result = await service.generate({
        prompt: 'Analyze our retention vs 5 competitors'
      });
      
      expect(result.provider).toBe('claude');
    });
    
    it('should fallback on provider failure', async () => {
      // Mock Claude failure
      // Verify Gemini fallback called
    });
    
    it('should respect cost limits', async () => {
      // Mock requests until limit
      // Verify circuit breaker trips
    });
  });
});

Target Coverage: 90%+
```

**2. Integration Tests**
```javascript
// tests/integration/cfo-quality.test.js
describe('CFO Quality Tests', () => {
  const testCases = [
    {
      name: 'Revenue calculation',
      inputs: {
        revenue: 25000,
        costs: 18000,
        month: '2025-01'
      },
      expected: {
        grossProfit: 7000,
        grossMargin: 28  // %
      }
    },
    // ... 49 more test cases
  ];
  
  testCases.forEach(tc => {
    it(`should correctly calculate ${tc.name}`, async () => {
      const result = await cfo.generateIncomeStatement(tc.inputs);
      expect(result.grossProfit).toBe(tc.expected.grossProfit);
      expect(result.grossMargin).toBeCloseTo(tc.expected.grossMargin, 1);
    });
  });
});

Target: 50 financial test cases
Pass Rate: 100% required
```

**3. Load Tests**
```yaml
Tool: Artillery or k6

Scenarios:
  1. Baseline Load
     - 100 users over 5 minutes
     - Mix of all AI features
     - Target: <5s p95 response time
     - Target: <1% error rate
  
  2. Spike Test
     - 0 → 500 users in 30 seconds
     - Hold for 2 minutes
     - Target: System stays up
     - Target: <10% error rate
  
  3. Soak Test
     - 50 constant users
     - Run for 2 hours
     - Target: No memory leaks
     - Target: Performance stable

Pass Criteria:
  - All scenarios pass
  - No crashes or outages
  - Resource usage acceptable
```

**4. Quality Regression Tests**
```yaml
Test Set: Golden dataset (100 queries per service)

Process:
  1. Before migration: Run all queries, save responses
  2. After migration: Run same queries
  3. Compare: 
     - Semantic similarity (cosine >0.9)
     - Factual accuracy (manual spot check 20%)
     - Response time (within 20% of baseline)
  4. Investigate outliers

Pass Criteria:
  - 95% of responses semantically similar
  - Zero factual errors in spot check
  - Average response time within budget
```

---

## Rollback Procedures

### Scenario 1: Provider Outage

```yaml
Symptom: Claude API returning 503 errors

Immediate Action (5 minutes):
  1. Check status: https://status.anthropic.com
  2. If confirmed outage: Enable fallback
     - Set env: AI_PROVIDER_CFO=gemini
     - Restart services
  3. Monitor: Error rate should drop
  4. Notify: Post in #engineering-alerts

Recovery:
  - Wait for Claude restoration
  - Re-enable Claude for 10% traffic
  - Monitor for 1 hour
  - Ramp back to 100%

Automation:
  # Add to monitoring
  if claude_error_rate > 50% for 5min:
    auto_switch_to_fallback()
    alert_team()
```

### Scenario 2: Quality Regression

```yaml
Symptom: User satisfaction drops from 4.5 to 3.8

Investigation (30 minutes):
  1. Check recent deploys
  2. Compare provider mix (before/after)
  3. Sample 20 recent responses
  4. Identify root cause

Common Causes:
  - Prompt change
  - Model update (provider-side)
  - Routing misconfiguration
  - Bad training data

Rollback:
  1. Revert to previous prompt version
  2. Or switch back to previous provider
  3. Monitor satisfaction for 24h
  4. Post-mortem

Prevention:
  - Prompt version control
  - A/B test prompt changes
  - Lock model versions
```

### Scenario 3: Cost Overrun

```yaml
Symptom: Daily cost hits $100 (vs $15 expected)

Investigation (15 minutes):
  1. Check telemetry: Which service spiking?
  2. Check usage: Unusual user behavior?
  3. Check routing: Too many Claude requests?

Immediate Action:
  1. Enable cost circuit breaker
  2. Reduce Claude traffic (100% → 10%)
  3. Investigate root cause
  4. Fix routing rules
  5. Gradually re-enable

Circuit Breaker Logic:
  if daily_cost > HARD_LIMIT:
    switch_all_to_gemini()
    alert_team(priority='critical')
    require_manual_reactivation()
```

---

## Monitoring & Alerting

### Key Metrics

**Availability**
```
Metric: ai_request_success_rate
Target: >99.5%
Alert: <99% for 5 minutes
Formula: successful_requests / total_requests
```

**Performance**
```
Metric: ai_response_time_p95
Target: <5s (chat, agent, bi), <30s (cfo)
Alert: >10s for 5 minutes
Breakdown: By service, provider, complexity
```

**Cost**
```
Metric: ai_cost_per_hour
Target: <$2/hour (<$50/day)
Alert: >$3/hour
Breakdown: By service, provider, user
```

**Quality**
```
Metric: user_satisfaction_score
Target: >4.5/5
Alert: <4.2 for 24 hours
Collection: In-app ratings after AI interaction
```

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  MetaGauge AI - Real-Time Monitoring           │
├─────────────────────────────────────────────────┤
│  Health Status                                  │
│  ● Gemini: Healthy    ● Claude: Healthy        │
│  ● Chat: 99.8%        ● CFO: 99.9%             │
│  ● Agent: 99.5%       ● BI: 99.7%              │
├─────────────────────────────────────────────────┤
│  Request Rate (last hour)                      │
│  📊 [Chart: Requests per minute]               │
│  Total: 1,247  Errors: 3 (0.2%)                │
├─────────────────────────────────────────────────┤
│  Response Times (p95)                          │
│  Chat: 3.2s  CFO: 12.5s  Agent: 4.8s  BI: 3.9s│
│  📊 [Chart: Trend over 24 hours]               │
├─────────────────────────────────────────────────┤
│  Cost Today                                    │
│  $12.45 / $50.00 (25%)                         │
│  📊 [Chart: Cost per service]                  │
│  By Provider: Gemini $8.20, Claude $4.25      │
├─────────────────────────────────────────────────┤
│  Quality Scores (last 7 days)                 │
│  Chat: 4.3/5  CFO: 4.7/5  Agent: 4.4/5        │
│  📊 [Chart: Satisfaction trend]                │
└─────────────────────────────────────────────────┘
```

---

## Team Resources

### Staffing Plan

**Phase 1 (Week 1-2)**
- 1 Senior Engineer (40h)
- 1 Mid-level Engineer (20h)
- Total: 60 hours

**Phase 2 (Week 3-6)**
- 2 Senior Engineers (160h)
- 1 Data Engineer (40h)
- 1 QA Engineer (80h)
- Total: 280 hours

**Phase 3 (Week 7-12)**
- 1 Tech Lead (80h)
- 2 Senior Engineers (160h)
- 1 Mid-level Engineer (120h)
- 1 DevOps Engineer (40h)
- 1 QA Engineer (80h)
- Total: 480 hours

**Grand Total: 820 engineering hours (≈5 months of 1 engineer)**

### Budget

```yaml
Engineering Costs:
  Senior Engineer: $100/hour × 480h = $48,000
  Mid-level Engineer: $75/hour × 140h = $10,500
  Tech Lead: $120/hour × 80h = $9,600
  DevOps: $90/hour × 40h = $3,600
  QA: $70/hour × 160h = $11,200
  Total Labor: $82,900

Infrastructure Costs:
  Claude API (pilot): $45/month × 3 months = $135
  Claude API (production): $45/month × ongoing
  Monitoring tools: $50/month × 3 months = $150
  Total Infra: $285

Total Project Cost: $83,185
Ongoing Monthly Cost: +$95/month
```

### Risk Budget

```yaml
Schedule Risk: 20%
  - Assume 20% longer than estimates
  - 12 weeks → 14-15 weeks actual

Budget Risk: 10%
  - Unexpected complexity
  - $83k → $91k actual

Quality Risk: Low
  - Phased rollout mitigates
  - Reversible decisions

Recommendation:
  - Budget: $95,000 (includes buffer)
  - Timeline: 15 weeks
  - Team: 2-3 engineers + support
```

---

## Success Criteria

### Phase 1 Success
- ✅ Zero experimental model references
- ✅ Telemetry operational
- ✅ Baseline costs known
- ✅ No production incidents

### Phase 2 Success
- ✅ Claude pilot launched
- ✅ CFO quality improved by 5%+
- ✅ User satisfaction up 0.3+ points
- ✅ Go decision made

### Phase 3 Success
- ✅ All services using BaseAIService
- ✅ Smart routing operational
- ✅ Cost within budget (+$50/month)
- ✅ Quality maintained or improved
- ✅ Team trained and confident

### Overall Project Success
- ✅ Hybrid AI infrastructure in production
- ✅ Financial documents measurably more accurate
- ✅ Cost per user <$0.50/month
- ✅ System reliability >99.5%
- ✅ Documentation complete
- ✅ No major incidents during rollout

---

## Appendix: Decision Log

### Decision 1: Why Hybrid vs All-Claude?
**Date:** Week 2  
**Decision:** Hybrid (Claude for CFO, Gemini for rest)  
**Rationale:** 70% cost savings vs all-Claude, quality where it matters  
**Alternatives Considered:** All-Claude (too expensive), All-Gemini (quality ceiling)  
**Reversible:** Yes

### Decision 2: Why BaseAIService Abstraction?
**Date:** Week 3  
**Decision:** Build provider abstraction layer  
**Rationale:** Future-proof, testable, consistent  
**Alternatives Considered:** Direct provider integration (quick but inflexible)  
**Reversible:** No (but worth the investment)

### Decision 3: Why A/B Test CFO?
**Date:** Week 4  
**Decision:** Pilot with 10% before full rollout  
**Rationale:** Validate quality claims, measure user response  
**Alternatives Considered:** Full rollout (too risky), No test (no data)  
**Reversible:** Yes

---

**Document Status:** Complete  
**Next Review:** After Phase 1 completion  
**Owner:** Engineering Lead  
**Stakeholders:** Product, Finance, Engineering

---

**Questions? Contact:**
- Technical: engineering-lead@metagauge.io
- Product: product@metagauge.io
- Budget: finance@metagauge.io
