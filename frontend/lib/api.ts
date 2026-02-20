const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelay: 1000,
  maxDelay: 5000,
  timeout: 60000
};

// Auth token management
const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token'); // Changed from 'authToken' to 'token' to match auth provider
  }
  return null;
};

const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token); // Changed from 'authToken' to 'token' to match auth provider
  }
};

const removeAuthToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token'); // Changed from 'authToken' to 'token' to match auth provider
  }
};

/**
 * Execute fetch with timeout and better error handling
 */
const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  console.log(`[FETCH] Starting fetch to ${url} with ${timeoutMs}ms timeout`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[FETCH] Timeout reached (${timeoutMs}ms) - aborting request`);
    controller.abort();
  }, timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal
  })
    .then(response => {
      clearTimeout(timeoutId);
      console.log(`[FETCH] Fetch completed successfully: ${response.status}`);
      return response;
    })
    .catch(error => {
      clearTimeout(timeoutId);
      
      console.error(`[FETCH] Fetch error:`, {
        name: error.name,
        message: error.message,
        url
      });
      
      // Convert AbortError to timeout error
      if (error.name === 'AbortError') {
        const err = new Error(`Backend server not responding`);
        err.name = 'BackendTimeout';
        console.error(`[FETCH] Converted to BackendTimeout error`);
        throw err;
      }
      
      // Network errors
      if (error.message.includes('fetch failed') || error.message.includes('Failed to fetch')) {
        const err = new Error('Cannot connect to backend server');
        err.name = 'NetworkError';
        console.error(`[FETCH] Converted to NetworkError`);
        throw err;
      }
      
      throw error;
    });
};

/**
 * Determine if an error is retryable
 */
const isRetryableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  );
};

// API request helper with auth, timeout, and retry logic
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const fullUrl = `${API_URL}${endpoint}`;
      
      // Debug: Log request details
      console.log(`[API] Attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}: ${options.method || 'GET'} ${fullUrl}`);
      console.log(`[API] Timeout: ${RETRY_CONFIG.timeout}ms`);

      const response = await fetchWithTimeout(fullUrl, {
        ...options,
        headers,
      }, RETRY_CONFIG.timeout);
      
      console.log(`[API] Response received: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage;
        }
        
        // Don't retry auth errors
        if (response.status === 401 || response.status === 403) {
          const authError = new Error(errorMessage);
          authError.name = 'AuthError';
          throw authError;
        }
        
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return {};
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Network request failed');
      
      // Debug: Log error details
      console.error(`[API] Error on attempt ${attempt + 1}:`, {
        name: lastError.name,
        message: lastError.message,
        isRetryable: isRetryableError(lastError)
      });
      
      // Don't retry auth errors
      if (lastError.name === 'AuthError') {
        console.error(`[API] Auth error - not retrying`);
        throw lastError;
      }
      
      // Check if error is retryable
      if (!isRetryableError(lastError)) {
        console.error(`[API] Non-retryable error - throwing`);
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === RETRY_CONFIG.maxRetries - 1) {
        break;
      }

      // Calculate exponential backoff with jitter
      const exponentialDelay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 500;
      const delay = Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelay);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  throw lastError || new Error('Network request failed');
};

export const api = {
  auth: {
    register: async (data: { email: string; password: string; name: string }) => {
      const result = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (result.token) {
        setAuthToken(result.token);
      }
      return result;
    },

    login: async (data: { email: string; password: string }) => {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (result.token) {
        setAuthToken(result.token);
      }
      return result;
    },

    logout: () => {
      removeAuthToken();
    },

    getCurrentUser: async () => {
      return apiRequest('/api/auth/me');
    },

    // Legacy methods for compatibility
    signup: async (data: { email?: string; phone?: string; password?: string; role?: string }) => {
      return api.auth.register({
        email: data.email || '',
        password: data.password || '',
        name: data.role || 'user'
      });
    },

    verifyOTP: async (data: { email?: string; phone?: string; otp: string }) => {
      // For now, just return success - OTP not implemented in backend yet
      return { success: true, message: 'Verification successful' };
    }
  },

  contracts: {
    list: async () => {
      return apiRequest('/api/contracts');
    },

    create: async (data?: any) => {
      return apiRequest('/api/contracts', {
        method: 'POST',
        body: JSON.stringify(data || {}), // Empty body uses .env defaults
      });
    },

    get: async (id: string) => {
      return apiRequest(`/api/contracts/${id}`);
    },

    update: async (id: string, data: any) => {
      return apiRequest(`/api/contracts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string) => {
      return apiRequest(`/api/contracts/${id}`, {
        method: 'DELETE',
      });
    }
  },

  analysis: {
    start: async (configId: string, analysisType: 'single' | 'competitive' | 'comparative' = 'competitive') => {
      return apiRequest('/api/analysis/start', {
        method: 'POST',
        body: JSON.stringify({ configId, analysisType }),
      });
    },

    getStatus: async (analysisId: string) => {
      return apiRequest(`/api/analysis/${analysisId}/status`);
    },

    getResults: async (analysisId: string) => {
      return apiRequest(`/api/analysis/${analysisId}/results`);
    },

    getHistory: async () => {
      return apiRequest('/api/analysis/history');
    },

    getStats: async () => {
      return apiRequest('/api/analysis/stats');
    },

    // AI-powered endpoints
    interpretWithAI: async (analysisId: string) => {
      return apiRequest(`/api/analysis/${analysisId}/interpret`, {
        method: 'POST',
      });
    },

    getQuickInsights: async (analysisId: string) => {
      return apiRequest(`/api/analysis/${analysisId}/quick-insights`);
    },

    getRecommendations: async (analysisId: string, contractType: string = 'defi') => {
      return apiRequest(`/api/analysis/${analysisId}/recommendations`, {
        method: 'POST',
        body: JSON.stringify({ contractType }),
      });
    },

    // New enhanced AI endpoints
    generateAlerts: async (analysisId: string, previousResultsId?: string) => {
      return apiRequest(`/api/analysis/${analysisId}/alerts`, {
        method: 'POST',
        body: JSON.stringify({ previousResultsId }),
      });
    },

    generateSentiment: async (analysisId: string, marketData?: any) => {
      return apiRequest(`/api/analysis/${analysisId}/sentiment`, {
        method: 'POST',
        body: JSON.stringify({ marketData }),
      });
    },

    generateOptimizations: async (analysisId: string, contractType: string = 'defi') => {
      return apiRequest(`/api/analysis/${analysisId}/optimizations`, {
        method: 'POST',
        body: JSON.stringify({ contractType }),
      });
    }
  },

  users: {
    getDashboard: async () => {
      return apiRequest('/api/users/dashboard');
    },

    getProfile: async () => {
      return apiRequest('/api/users/profile');
    },

    updateProfile: async (data: any) => {
      return apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    getUsage: async () => {
      return apiRequest('/api/users/usage');
    },

    syncSubscription: async (walletAddress: string) => {
      return apiRequest('/api/users/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ walletAddress }),
      });
    }
  },

  onboarding: {
    getStatus: async () => {
      return apiRequest('/api/onboarding/status');
    },

    complete: async (data: {
      socialLinks: {
        website?: string | null;
        twitter?: string | null;
        discord?: string | null;
        telegram?: string | null;
      };
      logo?: string | null;
      contractAddress: string;
      chain: string;
      contractName: string;
      abi?: string | null;
      purpose: string;
      category: string;
      startDate: string;
    }) => {
      return apiRequest('/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getDefaultContract: async () => {
      // Add cache-busting timestamp to prevent stale data
      const timestamp = Date.now();
      return apiRequest(`/api/onboarding/default-contract?_t=${timestamp}`);
    },

    getUserMetrics: async () => {
      return apiRequest('/api/onboarding/user-metrics');
    },

    refreshDefaultContract: async (continuous: boolean = false) => {
      return apiRequest('/api/onboarding/refresh-default-contract', {
        method: 'POST',
        body: JSON.stringify({ continuous }),
      });
    },

    stopContinuousSync: async () => {
      return apiRequest('/api/onboarding/stop-continuous-sync', {
        method: 'POST',
      });
    },

    triggerIndexing: async () => {
      return apiRequest('/api/onboarding/trigger-indexing', {
        method: 'POST',
      });
    },

    debugAnalysis: async () => {
      return apiRequest('/api/onboarding/debug-analysis');
    }
  },

  chat: {
    getSessions: async (filters?: { contractAddress?: string; contractChain?: string }) => {
      const params = new URLSearchParams();
      if (filters?.contractAddress) params.append('contractAddress', filters.contractAddress);
      if (filters?.contractChain) params.append('contractChain', filters.contractChain);
      
      const query = params.toString();
      return apiRequest(`/api/chat/sessions${query ? `?${query}` : ''}`);
    },

    createSession: async (data: { contractAddress: string; contractChain: string; contractName?: string }) => {
      return apiRequest('/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getSession: async (sessionId: string) => {
      return apiRequest(`/api/chat/sessions/${sessionId}`);
    },

    updateSession: async (sessionId: string, data: { title?: string; contractName?: string }) => {
      return apiRequest(`/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deleteSession: async (sessionId: string) => {
      return apiRequest(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });
    },

    getMessages: async (sessionId: string, limit: number = 50, offset: number = 0) => {
      return apiRequest(`/api/chat/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`);
    },

    sendMessage: async (sessionId: string, content: string) => {
      return apiRequest(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },

    getSuggestedQuestions: async (contractAddress: string, contractChain: string) => {
      return apiRequest(`/api/chat/suggested-questions?contractAddress=${encodeURIComponent(contractAddress)}&contractChain=${encodeURIComponent(contractChain)}`, {
        method: 'GET',
      });
    }
  }
};

// Analysis monitoring helper
export const monitorAnalysis = async (
  analysisId: string, 
  onProgress: (status: any) => void,
  pollInterval: number = 5000
): Promise<any> => {
  const poll = async (): Promise<any> => {
    try {
      const status = await api.analysis.getStatus(analysisId);
      onProgress(status);
      
      if (status.status === 'completed') {
        return api.analysis.getResults(analysisId);
      } else if (status.status === 'failed') {
        throw new Error(status.errorMessage || 'Analysis failed');
      } else {
        // Continue polling
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        return poll();
      }
    } catch (error) {
      console.error('Analysis monitoring error:', error);
      throw error;
    }
  };
  
  return poll();
};

// Alert configuration API
export const alertsApi = {
  getConfig: async () => {
    return apiRequest('/api/alerts/config');
  },

  createConfig: async (config: any) => {
    return apiRequest('/api/alerts/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  updateConfig: async (id: string, config: any) => {
    return apiRequest(`/api/alerts/config/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  deleteConfig: async (id: string) => {
    return apiRequest(`/api/alerts/config/${id}`, {
      method: 'DELETE',
    });
  },
};

// Add to main api object
api.alerts = alertsApi;

export { getAuthToken, setAuthToken, removeAuthToken };

// Export diagnostic utilities for debugging
if (typeof window !== 'undefined') {
  import('./api-diagnostics.ts').then(({ runFullDiagnostics, diagnoseAPIHealth }) => {
    (window as any).__API_DIAGNOSTICS__ = {
      runFullDiagnostics,
      diagnoseAPIHealth,
      getAPIUrl: () => API_URL
    };
  }).catch(err => console.error('Failed to load diagnostics:', err));
}
