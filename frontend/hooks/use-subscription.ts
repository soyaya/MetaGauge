'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export interface SubscriptionState {
  state: 'free' | 'paid'
  canContinue: boolean
  balance: number
  freeQuota: { analyses: number; aiQueries: number; contracts: number; alerts: number }
  freeRemaining: { analyses: number; aiQueries: number }
  resetsOn: string
  usage: {
    monthlyAnalysisCount: number
    monthlyAiQueryCount: number
    analysisCount: number
    aiQueryCount: number
    lastAnalysis: string | null
  }
  pricing: Record<string, number>
  isLoading: boolean
}

const DEFAULT: SubscriptionState = {
  state: 'free',
  canContinue: true,
  balance: 0,
  freeQuota: { analyses: 3, aiQueries: 3, contracts: 1, alerts: 3 },
  freeRemaining: { analyses: 3, aiQueries: 3 },
  resetsOn: '',
  usage: { monthlyAnalysisCount: 0, monthlyAiQueryCount: 0, analysisCount: 0, aiQueryCount: 0, lastAnalysis: null },
  pricing: {},
  isLoading: true,
}

export function useSubscription(): SubscriptionState {
  const [data, setData] = useState<SubscriptionState>(DEFAULT)

  useEffect(() => {
    api.subscription.getStatus()
      .then((s: any) => setData({ ...s, isLoading: false }))
      .catch(() => setData(prev => ({ ...prev, isLoading: false })))
  }, [])

  return data
}
