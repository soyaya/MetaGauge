# Simple AI Flow for MetaGauge

## ✅ **IMPLEMENTED - Simple AI Features**

### 1. **Personalized Daily Insights** 
- ✅ AI analyzes user's contract data every 24 hours
- ✅ Generates insights specific to their contract metrics
- ✅ Delivered via API: `GET /api/ai/insights`
- ✅ Auto-generated at 9 AM daily

### 2. **Smart Alerts & Anomaly Detection**
- ✅ AI monitors user's contract metrics automatically
- ✅ Detects significant changes (>20% threshold)
- ✅ Sends personalized alerts via API: `POST /api/ai/check-anomalies/:contractId`
- ✅ Severity levels: low, medium, high

### 3. **AI Chat with Contract Context**
- ✅ Users chat with AI about their specific contract
- ✅ AI has full context of contract performance
- ✅ API: `POST /api/ai/chat/:contractId`
- ✅ Fallback responses when AI unavailable

### 4. **Automated Health Checks**
- ✅ AI runs health checks on user's contract
- ✅ Provides health score (0-100) and recommendations
- ✅ API: `POST /api/ai/health-check/:contractId`
- ✅ Scheduled daily via automation

## 🚀 **API Endpoints**

```bash
# Get user's personalized insights
GET /api/ai/insights

# Generate new insights for contract
POST /api/ai/insights/:contractId

# Chat with AI about contract
POST /api/ai/chat/:contractId
Body: { "message": "How is my protocol performing?" }

# Run health check
POST /api/ai/health-check/:contractId

# Check for anomalies
POST /api/ai/check-anomalies/:contractId
```

## 🤖 **Automation Features**

- ✅ **Daily Automation**: Runs at 9 AM for all active users
- ✅ **Auto-Insights**: Generates daily insights for each contract
- ✅ **Auto-Health Checks**: Monitors contract health
- ✅ **Auto-Anomaly Detection**: Detects unusual patterns
- ✅ **Graceful Fallbacks**: Works even without AI API key

## 💡 **Key Benefits**

1. **Personalized**: Uses each user's unique contract data
2. **Automated**: Runs daily checks without user intervention  
3. **Simple**: Easy-to-understand insights and recommendations
4. **Reliable**: Fallback responses when AI services unavailable
5. **Actionable**: Provides specific next steps and recommendations

## 🔧 **Usage Example**

```javascript
// Get daily insights
const insights = await fetch('/api/ai/insights', {
  headers: { 'Authorization': 'Bearer ' + token }
});

// Chat with AI
const chat = await fetch('/api/ai/chat/contract-123', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ message: 'What should I focus on?' })
});
```

The AI flow is now **simple, personalized, and automated** - exactly as requested!
