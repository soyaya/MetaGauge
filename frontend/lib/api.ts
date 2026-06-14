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
        console.error(`[FETCH] Converted to BackendTimeout error`, url);
        throw err;
      }
      
      // Network errors
      if (error.message.includes('fetch failed') || error.message.includes('Failed to fetch')) {
        const err = new Error('Cannot connect to backend server');
        err.name = 'NetworkError';
        // Only log network errors in development
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[FETCH] Network error - backend may be unavailable`);
        }
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
        
        // Token expired/invalid — clear and redirect to login
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (typeof window !== 'undefined') {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          }
          const authError = new Error(errorMessage);
          authError.name = 'AuthError';
          throw authError;
        }

        // Permission denied — throw but don't clear token or redirect
        if (response.status === 403) {
          const authError = new Error(errorMessage || 'Permission denied');
          authError.name = 'ForbiddenError';
          throw authError;
        }

        // Insufficient balance or quota — throw error, let the page handle it
        if (response.status === 402) {
          let errorData: any = {};
          try { errorData = await response.json(); } catch {}
          const billingError = new Error(errorData.message || errorData.error || 'Free quota reached. Please top up to continue.');
          billingError.name = 'InsufficientBalance';
          throw billingError;
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
        stack: lastError.stack?.split('\n')[0],
        isRetryable: isRetryableError(lastError)
      });
      
      // Don't retry auth errors
      if (lastError.name === 'AuthError' || lastError.name === 'ForbiddenError') {
        throw lastError;
      }
      
      // Check if error is retryable
      if (!isRetryableError(lastError)) {
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
  // Generic HTTP methods
  get: async (endpoint: string) => {
    return apiRequest(endpoint, { method: 'GET' });
  },

  post: async (endpoint: string, data?: any) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  put: async (endpoint: string, data?: any) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  delete: async (endpoint: string) => {
    return apiRequest(endpoint, { method: 'DELETE' });
  },

  patch: async (endpoint: string, data?: any) => {
    return apiRequest(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

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
      return apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      });
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

    getAISummary: async (analysisId: string) => {
      // AI calls need longer timeout — use direct fetch, no retry
      const token = getAuthToken();
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const base = API_URL;
      const [insights, interpretation] = await Promise.allSettled([
        fetch(`${base}/api/analysis/${analysisId}/quick-insights`, { headers, signal: AbortSignal.timeout(90000) }).then(r => r.json()),
        fetch(`${base}/api/analysis/${analysisId}/interpret`, { method: 'POST', headers, body: JSON.stringify({}), signal: AbortSignal.timeout(90000) }).then(r => r.json()),
      ]);
      return {
        enabled: true,
        insights:       insights.status === 'fulfilled'       ? insights.value       : null,
        interpretation: interpretation.status === 'fulfilled' ? interpretation.value : null,
        alerts: null, sentiment: null, optimizations: null,
      };
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

    verifyWithGoogle: async (accessToken: string) => {
      return apiRequest('/api/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify({ accessToken }),
      });
    },
  },

  billing: {
    getUsage: async () => {
      return apiRequest('/api/billing/usage');
    },

    getPricing: async () => {
      return apiRequest('/api/billing/pricing');
    },

    getTransactions: async () => {
      return apiRequest('/api/billing/transactions');
    },

    createCheckout: async (amount: number) => {
      return apiRequest('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });
    }
  },

  subscription: {
    getStatus: async () => {
      return apiRequest('/api/subscription/status');
    },

    getUsage: async () => {
      return apiRequest('/api/subscription/usage');
    },

    verify: async (transactionHash: string) => {
      return apiRequest('/api/subscription/verify', {
        method: 'POST',
        body: JSON.stringify({ transactionHash })
      });
    }
  },

  agent: {
    analyze: async (body: { contractAddress: string; chain: string }) =>
      apiRequest('/api/agent/analyze', { method: 'POST', body: JSON.stringify(body) }),

    chat: async (body: { message: string; contractAddress?: string; chain?: string; sessionHistory?: any[] }) =>
      apiRequest('/api/agent/chat', { method: 'POST', body: JSON.stringify(body) }),

    feedback: async (body: { messageId: string; sessionId?: string; rating: number; note?: string; componentType?: string }) =>
      apiRequest('/api/agent/feedback', { method: 'POST', body: JSON.stringify(body) }),

    generateContent: async (body: { type: string; contractAddress: string; chain: string }) =>
      apiRequest('/api/agent/generate-content', { method: 'POST', body: JSON.stringify(body) }),

    getDigest: async (type: string = 'daily') =>
      apiRequest(`/api/agent/digest?type=${type}`),

    getConfig: async () =>
      apiRequest('/api/agent/config'),

    updateConfig: async (body: { enabled?: boolean; permissions?: Record<string, boolean> }) =>
      apiRequest('/api/agent/config', { method: 'PUT', body: JSON.stringify(body) }),

    getPredictions: async () =>
      apiRequest('/api/predictions'),

    refreshPredictions: async () =>
      apiRequest('/api/predictions/refresh', { method: 'POST' }),

    getBusinessIntelligence: async (section: string = 'all') =>
      apiRequest(`/api/agent/business-intelligence?section=${section}`),

    getOnchainRisk: async (contractAddress: string, chain: string = 'ethereum') =>
      apiRequest(`/api/agent/onchain-risk?contractAddress=${contractAddress}&chain=${chain}`),

    getGithubIntelligence: async (url: string) =>
      apiRequest(`/api/agent/github?url=${encodeURIComponent(url)}`),

    getSentiment: async (contractAddress: string, chain: string = 'ethereum', twitterHandle?: string) =>
      apiRequest(`/api/agent/sentiment?contractAddress=${contractAddress}&chain=${chain}${twitterHandle ? `&twitterHandle=${twitterHandle}` : ''}`),

    getIntelligenceScores: async () =>
      apiRequest('/api/agent/intelligence-scores'),

    getBenchmarks: async (category?: string) =>
      apiRequest(`/api/agent/benchmarks${category ? `?category=${category}` : ''}`),

    getPlaybooks: async () =>
      apiRequest('/api/agent/playbooks'),

    getAtRiskWallets: async () =>
      apiRequest('/api/agent/at-risk-wallets'),

    getMarketPosition: async () =>
      apiRequest('/api/agent/market-position'),

    getLifecycleCampaigns: async () =>
      apiRequest('/api/agent/lifecycle-campaigns'),

    createShareToken: async () =>
      apiRequest('/api/share', { method: 'POST' }),

    revokeShareToken: async (token: string) =>
      apiRequest(`/api/share/${token}`, { method: 'DELETE' }),
  },

  indexing: {
    getStatus: async () => {
      return apiRequest('/api/indexing/status');
    },

    trigger: async () => {
      return apiRequest('/api/indexing/trigger', {
        method: 'POST'
      });
    }
  },

  dashboard: {
    getContractInfo: async () => {
      return apiRequest('/api/dashboard/contract-info');
    },

    getIndexingStatus: async () => {
      return apiRequest('/api/dashboard/indexing-status');
    },

    getBlockMetrics: async () => {
      return apiRequest('/api/dashboard/block-metrics');
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
      return apiRequest('/api/onboarding/trigger-indexing', { method: 'POST' });
    },

    backfillTimestamps: async () => {
      return apiRequest('/api/onboarding/backfill-timestamps', { method: 'POST' });
    },

    debugAnalysis: async () => {
      return apiRequest('/api/onboarding/debug-analysis');
    }
  },

  metrics: {
    /** All structured sections for the Metrics tab */
    getDashboard: async () => apiRequest('/api/metrics/dashboard'),
    /** Metrics for a specific analysis */
    getAnalysis: async (analysisId: string) => apiRequest(`/api/metrics/analysis/${analysisId}`),
    /** Recalculate metrics for all analyses */
    recalculate: async () => apiRequest('/api/metrics/recalculate', { method: 'POST' }),
    /** Wallet + feature analytics for the Analytics tab */
    getWalletAnalytics: async (contractAddress: string, chain: string) =>
      apiRequest(`/api/functions/wallet-analytics?contractAddress=${encodeURIComponent(contractAddress)}&chain=${encodeURIComponent(chain)}`),
  },

  traction: {
    getDashboard:      async () => apiRequest('/api/traction/dashboard'),
    getTasks:          async () => apiRequest('/api/traction/tasks'),
    getMetrics:        async () => apiRequest('/api/traction/metrics'),
    getOPS:            async () => apiRequest('/api/traction/ops'),
    getGrowth:         async () => apiRequest('/api/traction/growth'),
    getHistory:        async () => apiRequest('/api/traction/history'),
    getActivity:       async () => apiRequest('/api/traction/activity'),
    getHealth:         async () => apiRequest('/api/traction/health'),
    getProductivity:   async () => apiRequest('/api/traction/productivity'),
    checkTask:         async (taskId: string) => apiRequest(`/api/traction/tasks/${taskId}/check`, { method: 'POST' }),
    resolveTask:       async (taskId: string, feedback: string) =>
      apiRequest(`/api/traction/tasks/${taskId}/resolve`, { method: 'POST', body: JSON.stringify({ feedback }) }),
    getRecommendation: async (taskId: string) => apiRequest(`/api/traction/tasks/${taskId}/recommendation`),
    sendReport:        async (body: { email: string; sections: string[] }) =>
      apiRequest('/api/traction/send-report', { method: 'POST', body: JSON.stringify(body) }),
  },

  competitive: {
    getDashboard:  async () => apiRequest('/api/competitive/dashboard'),
    getList:       async () => apiRequest('/api/competitive/list'),
    addCompetitor: async (data: { address: string; chain: string; name?: string }) =>
      apiRequest('/api/competitive/add-competitor', { method: 'POST', body: JSON.stringify(data) }),
    removeCompetitor: async (competitorId: string) =>
      apiRequest(`/api/competitive/remove-competitor/${competitorId}`, { method: 'DELETE' }),
    getInsight: async (competitorId: string) =>
      apiRequest(`/api/competitive/insight/${competitorId}`),
    createAlert: async (data: { competitorId: string; metric: string; condition: string; threshold: number; name?: string }) =>
      apiRequest('/api/competitive/alert', { method: 'POST', body: JSON.stringify(data) }),
    getAlerts: async () => apiRequest('/api/competitive/alerts'),
    deleteAlert: async (id: string) => apiRequest(`/api/competitive/alerts/${id}`, { method: 'DELETE' }),
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
  pollInterval: number = 5000,
  maxAttempts: number = 120  // 10 minutes max
): Promise<any> => {
  let attempts = 0;
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      attempts++;
      try {
        const status = await api.analysis.getStatus(analysisId);
        onProgress(status);
        if (status.status === 'completed') {
          clearInterval(timer);
          resolve(await api.analysis.getResults(analysisId));
        } else if (status.status === 'failed') {
          clearInterval(timer);
          reject(new Error(status.errorMessage || 'Analysis failed'));
        } else if (attempts >= maxAttempts) {
          clearInterval(timer);
          reject(new Error('Analysis timed out after 10 minutes'));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, pollInterval);
  });
};

// Alert configuration API
export const alertsApi = {
  getAlerts: async () => apiRequest('/api/alerts'),
  acknowledge: async (id: string) => apiRequest(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' }),
  getConfig: async () => apiRequest('/api/alerts/config'),
  createConfig: async (config: any) => apiRequest('/api/alerts/config', { method: 'POST', body: JSON.stringify(config) }),
  updateConfig: async (id: string, config: any) => apiRequest(`/api/alerts/config/${id}`, { method: 'PUT', body: JSON.stringify(config) }),
  deleteConfig: async (id: string) => apiRequest(`/api/alerts/config/${id}`, { method: 'DELETE' }),
};

// Extend api object with alerts
(api as any).alerts = alertsApi;

export { getAuthToken, setAuthToken, removeAuthToken };
