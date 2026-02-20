/**
 * API Diagnostic Utility
 * Helps identify and debug API connectivity issues
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface DiagnosticResult {
  timestamp: string;
  apiUrl: string;
  healthCheck: {
    status: 'online' | 'offline' | 'error';
    statusCode?: number;
    message: string;
    responseTime: number;
  };
  corsCheck: {
    status: 'ok' | 'failed';
    message: string;
  };
  networkInfo: {
    online: boolean;
    userAgent: string;
  };
}

export async function diagnoseAPIHealth(): Promise<DiagnosticResult> {
  const startTime = Date.now();
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    apiUrl: API_URL,
    healthCheck: {
      status: 'offline',
      message: 'Not tested',
      responseTime: 0
    },
    corsCheck: {
      status: 'ok',
      message: 'Not tested'
    },
    networkInfo: {
      online: typeof navigator !== 'undefined' ? navigator.onLine : false,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
    }
  };

  try {
    // Test health endpoint
    const healthStart = Date.now();
    const healthResponse = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const healthTime = Date.now() - healthStart;

    result.healthCheck.responseTime = healthTime;

    if (healthResponse.ok) {
      result.healthCheck.status = 'online';
      result.healthCheck.statusCode = healthResponse.status;
      result.healthCheck.message = `API is online (${healthTime}ms)`;
    } else {
      result.healthCheck.status = 'error';
      result.healthCheck.statusCode = healthResponse.status;
      result.healthCheck.message = `API returned ${healthResponse.status} ${healthResponse.statusText}`;
    }
  } catch (error) {
    result.healthCheck.status = 'offline';
    result.healthCheck.message = error instanceof Error ? error.message : 'Unknown error';
    
    if (result.healthCheck.message.includes('Failed to fetch')) {
      result.corsCheck.status = 'failed';
      result.corsCheck.message = 'Likely CORS or network connectivity issue. Check: 1) API server is running, 2) Port matches (5000), 3) CORS is configured in backend';
    }
  }

  return result;
}

export function logDiagnostics(result: DiagnosticResult): void {
  console.group('🔍 API Diagnostics');
  console.log('Timestamp:', result.timestamp);
  console.log('API URL:', result.apiUrl);
  console.log('Network Online:', result.networkInfo.online);
  
  console.group('Health Check');
  console.log('Status:', result.healthCheck.status);
  if (result.healthCheck.statusCode) {
    console.log('HTTP Status:', result.healthCheck.statusCode);
  }
  console.log('Message:', result.healthCheck.message);
  console.log('Response Time:', result.healthCheck.responseTime, 'ms');
  console.groupEnd();
  
  console.group('CORS Check');
  console.log('Status:', result.corsCheck.status);
  console.log('Message:', result.corsCheck.message);
  console.groupEnd();
  
  console.groupEnd();
}

export async function runFullDiagnostics(): Promise<void> {
  console.log('🚀 Starting API diagnostics...');
  const result = await diagnoseAPIHealth();
  logDiagnostics(result);
  
  if (result.healthCheck.status !== 'online') {
    console.error('❌ API is not responding. Troubleshooting steps:');
    console.error('1. Verify backend is running: npm run dev (in src/ or backend folder)');
    console.error('2. Check API URL is correct:', result.apiUrl);
    console.error('3. Ensure port 5000 is not blocked by firewall');
    console.error('4. Check backend CORS configuration allows your frontend origin');
  } else {
    console.log('✅ API is healthy and responding');
  }
}
