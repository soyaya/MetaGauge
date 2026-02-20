/**
 * API Configuration for Frontend
 * Centralized configuration for backend API calls
 */

// Get the API base URL from environment variables
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

// API endpoints
export const API_ENDPOINTS = {
  // Health check
  health: `${API_BASE_URL}/health`,
  
  // Faucet endpoints
  faucet: {
    health: `${API_BASE_URL}/api/faucet/health`,
    status: (address: string) => `${API_BASE_URL}/api/faucet/status/${address}`,
    claim: `${API_BASE_URL}/api/faucet/claim`,
    stats: `${API_BASE_URL}/api/faucet/stats`,
  },
  
  // Subscription endpoints
  subscription: {
    status: (address: string) => `${API_BASE_URL}/api/subscription/status/${address}`,
    plans: `${API_BASE_URL}/api/subscription/plans`,
    subscribe: `${API_BASE_URL}/api/subscription/subscribe`,
  },
  
  // Auth endpoints
  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    register: `${API_BASE_URL}/api/auth/register`,
    verify: `${API_BASE_URL}/api/auth/verify`,
  },
  
  // Analysis endpoints
  analysis: {
    create: `${API_BASE_URL}/api/analysis`,
    status: (id: string) => `${API_BASE_URL}/api/analysis/${id}`,
    results: (id: string) => `${API_BASE_URL}/api/analysis/${id}/results`,
  },
  
  // Chat endpoints
  chat: {
    sessions: `${API_BASE_URL}/api/chat/sessions`,
    messages: (sessionId: string) => `${API_BASE_URL}/api/chat/sessions/${sessionId}/messages`,
    suggestedQuestions: `${API_BASE_URL}/api/chat/suggested-questions`,
  }
} as const

// Helper function for making API calls with proper error handling
export async function apiCall<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    // Check if response is JSON
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response, got ${contentType}. Server may be down or returning HTML error page.`)
    }

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('API call failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// Specific API call helpers
export const faucetAPI = {
  async getHealth() {
    return apiCall(API_ENDPOINTS.faucet.health)
  },

  async getStatus(address: string) {
    return apiCall(API_ENDPOINTS.faucet.status(address))
  },

  async claimTokens(address: string, userAgent?: string) {
    return apiCall(API_ENDPOINTS.faucet.claim, {
      method: 'POST',
      body: JSON.stringify({
        address,
        userAgent: userAgent || navigator?.userAgent || 'Unknown',
      }),
    })
  },

  async getStats() {
    return apiCall(API_ENDPOINTS.faucet.stats)
  },
}

export const subscriptionAPI = {
  async getStatus(address: string) {
    return apiCall(API_ENDPOINTS.subscription.status(address))
  },

  async getPlans() {
    return apiCall(API_ENDPOINTS.subscription.plans)
  },
}

// Export default configuration
export default {
  API_BASE_URL,
  API_ENDPOINTS,
  apiCall,
  faucetAPI,
  subscriptionAPI,
}