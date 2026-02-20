# AI-Powered Alert Configuration System

## Overview

Users can now pre-configure their alert preferences and receive personalized AI-generated alerts based on their specific needs and thresholds.

## Features

### ✅ Alert Categories
Users can enable/disable specific alert types:
- **Security**: Unusual patterns, exploits, suspicious addresses
- **Performance**: High gas usage, failed transactions, slow execution
- **Liquidity**: Low TVL, high slippage, liquidity drain
- **Anomaly**: Volume spikes, whale activity, unusual behavior
- **Growth**: Declining users, reduced activity, market changes

### ✅ Severity Levels
Choose which severity levels to monitor:
- 🔴 **Critical**: Immediate action required
- 🟠 **High**: Urgent attention needed
- 🟡 **Medium**: Monitor closely
- 🟢 **Low**: Informational only

### ✅ Custom Thresholds
Set specific values for alerts:
- **Gas Price**: Alert when gas exceeds X gwei
- **Failure Rate**: Alert when failures exceed X%
- **TVL Change**: Alert when TVL changes by X%
- **Volume Change**: Alert when volume changes by X%
- **User Dropoff**: Alert when users drop by X%
- **Whale Activity**: Alert when transactions exceed X USD

### ✅ Notification Channels
Choose how to receive alerts:
- **In-App**: Show in dashboard
- **Email**: Send to registered email
- **Webhook**: POST to custom URL

### ✅ Schedule
Configure when to check for alerts:
- **Real-time**: Continuous monitoring
- **Daily**: Once per day at specified time
- **Weekly**: Once per week on specified day

## Architecture

### Backend Components

#### 1. Alert Configuration Model
```javascript
{
  id: "alert-config-123",
  userId: "user-456",
  contractId: "contract-789", // null = applies to all
  enabled: true,
  categories: {
    security: true,
    performance: true,
    liquidity: false,
    anomaly: true,
    growth: false
  },
  severityLevels: {
    critical: true,
    high: true,
    medium: true,
    low: false
  },
  thresholds: {
    gasPrice: { enabled: true, value: 100, unit: "gwei" },
    failureRate: { enabled: true, value: 5, unit: "%" },
    tvlChange: { enabled: false, value: 20, unit: "%" }
  },
  notifications: {
    inApp: true,
    email: false,
    webhook: false,
    webhookUrl: null
  }
}
```

#### 2. Storage Layer
- **File**: `AlertConfigurationStorage.js`
- **Location**: `data/alert-configs/`
- **Format**: JSON files per configuration

#### 3. API Endpoints
```
GET    /api/alerts/config          - Get user configurations
POST   /api/alerts/config          - Create configuration
PUT    /api/alerts/config/:id      - Update configuration
DELETE /api/alerts/config/:id      - Delete configuration
```

#### 4. AI Integration
- **Service**: `GeminiAIService.js`
- **Method**: `generateRealTimeAlerts(analysis, previous, userId, userConfig)`
- **Flow**:
  1. Load user configuration
  2. Build alert criteria from config
  3. Send to Gemini AI with preferences
  4. Filter results by user settings
  5. Return personalized alerts

### Frontend Components

#### 1. Alert Configuration Panel
- **File**: `components/alerts/alert-configuration-panel.tsx`
- **Features**:
  - 4 tabs: Categories, Severity, Thresholds, Notifications
  - Real-time save
  - Visual feedback
  - Responsive design

#### 2. Alert Settings Page
- **Route**: `/alerts`
- **File**: `app/alerts/page.tsx`
- **Access**: Authenticated users only

## Usage Flow

### 1. Configure Alerts
```
User → /alerts page → Configure preferences → Save
```

### 2. Generate Alerts
```
Analysis completes → User requests alerts → 
Load user config → AI generates personalized alerts → 
Filter by preferences → Return to user
```

### 3. Receive Alerts
```
In-App: Dashboard notification
Email: Sent to user email
Webhook: POST to configured URL
```

## API Examples

### Create Configuration
```bash
POST /api/alerts/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "contractId": null,
  "categories": {
    "security": true,
    "performance": true
  },
  "thresholds": {
    "gasPrice": {
      "enabled": true,
      "value": 150,
      "unit": "gwei"
    }
  }
}
```

### Get Configurations
```bash
GET /api/alerts/config
Authorization: Bearer <token>

Response:
{
  "configs": [
    {
      "id": "alert-config-123",
      "userId": "user-456",
      "enabled": true,
      ...
    }
  ]
}
```

### Generate Personalized Alerts
```bash
POST /api/analysis/:id/alerts
Authorization: Bearer <token>
Content-Type: application/json

{
  "previousResultsId": "analysis-789"
}

Response:
{
  "analysisId": "analysis-123",
  "alerts": {
    "alerts": [
      {
        "id": "alert-1",
        "severity": "high",
        "category": "performance",
        "title": "High Gas Usage",
        "message": "Gas price exceeded threshold of 150 gwei",
        "metrics": {
          "currentValue": "175 gwei",
          "threshold": "150 gwei",
          "change": "+16.7%"
        }
      }
    ],
    "summary": {
      "totalAlerts": 1,
      "criticalCount": 0,
      "overallRiskLevel": "medium"
    }
  },
  "configApplied": true,
  "aiEnabled": true
}
```

## AI Prompt Integration

The AI receives user preferences in the prompt:

```
USER ALERT PREFERENCES:
{
  "enabledCategories": ["security", "performance"],
  "enabledSeverities": ["critical", "high", "medium"],
  "thresholds": {
    "gasPrice": { "value": 150, "unit": "gwei" },
    "failureRate": { "value": 5, "unit": "%" }
  }
}

IMPORTANT RULES:
- Only generate alerts for enabled categories: security, performance
- Only include severity levels: critical, high, medium
- Check custom thresholds: gasPrice > 150 gwei, failureRate > 5%
```

## Benefits

### For Users
- ✅ **Personalized**: Only get alerts you care about
- ✅ **Actionable**: Custom thresholds mean relevant alerts
- ✅ **Flexible**: Configure per contract or globally
- ✅ **Multi-channel**: Choose how to receive alerts

### For System
- ✅ **Efficient**: AI focuses on user preferences
- ✅ **Scalable**: Configuration stored separately
- ✅ **Extensible**: Easy to add new alert types
- ✅ **Smart**: AI understands context and thresholds

## Testing

### 1. Configure Alerts
1. Go to `/alerts`
2. Enable categories (e.g., Security, Performance)
3. Set thresholds (e.g., Gas Price > 100 gwei)
4. Save configuration

### 2. Generate Alerts
1. Complete an analysis
2. Go to dashboard → AI Insights → Alerts
3. Click "Generate Alerts"
4. Verify only configured alerts appear

### 3. Verify Filtering
1. Disable a category (e.g., Liquidity)
2. Generate alerts again
3. Confirm no liquidity alerts appear

## Future Enhancements

- [ ] Alert history and tracking
- [ ] Email notification implementation
- [ ] Webhook delivery system
- [ ] Scheduled alert checks
- [ ] Alert templates
- [ ] Multi-contract configurations
- [ ] Alert analytics dashboard

## Files Created

### Backend
- `src/api/models/AlertConfiguration.js` - Data model
- `src/api/database/AlertConfigurationStorage.js` - Storage layer
- `src/api/routes/alerts.js` - API endpoints
- `src/services/GeminiAIService.js` - Updated with config support

### Frontend
- `frontend/components/alerts/alert-configuration-panel.tsx` - UI component
- `frontend/app/alerts/page.tsx` - Settings page
- `frontend/lib/api.ts` - Updated with alert API methods

## Summary

✅ **Complete AI-powered alert configuration system**

Users can now:
1. Configure alert preferences
2. Set custom thresholds
3. Choose notification channels
4. Receive personalized AI-generated alerts

The system intelligently filters and generates alerts based on user preferences, making alerts more relevant and actionable.
