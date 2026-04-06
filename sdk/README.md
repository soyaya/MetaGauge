# MetaGauge JavaScript SDK

Official JavaScript SDK for the MetaGauge blockchain analytics platform.

## Installation

```bash
npm install @metagauge/sdk
```

## Quick Start

```javascript
import MetaGaugeSDK from '@metagauge/sdk';

// Initialize with your API key
const metagauge = new MetaGaugeSDK('your-api-key-here');

// Get contract metrics
try {
  const metrics = await metagauge.getMetrics(
    '0x1234567890123456789012345678901234567890',
    'ethereum'
  );
  
  console.log('Active wallets:', metrics.activeWallets);
  console.log('D7 retention:', metrics.d7Retention);
} catch (error) {
  console.error('Error:', error.message);
}
```

## API Methods

### `getMetrics(contractAddress, chain)`
Get comprehensive metrics for a contract.

**Parameters:**
- `contractAddress` (string): Contract address
- `chain` (string): Blockchain network ('ethereum', 'lisk', 'starknet')

**Returns:** Object with metrics including activeWallets, totalTransactions, d7Retention, etc.

### `getWalletSegments(contractAddress, chain)`
Get wallet segmentation data (Bot, Whale, New, Active, Churned).

### `getCohortRetention(contractAddress, chain)`
Get cohort retention analysis data.

### `getAlerts()`
Get active alerts for your account.

## Error Handling

The SDK throws `MetaGaugeError` instances with descriptive messages:

```javascript
try {
  const metrics = await metagauge.getMetrics('invalid-address', 'ethereum');
} catch (error) {
  if (error.name === 'MetaGaugeError') {
    console.log('Error code:', error.code);
    console.log('Message:', error.message);
  }
}
```

## Authentication

Get your API key from the MetaGauge dashboard at https://app.metagauge.io

## Support

- Documentation: https://docs.metagauge.io
- Issues: https://github.com/metagauge/sdk/issues
- Email: support@metagauge.io
