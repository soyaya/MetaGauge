'use client'

import { useAuth } from '@/components/auth/auth-provider'

export function useSubscription() {
  const { user } = useAuth()

  // System is pay-as-you-go — tier is always 'pay-as-you-go'
  // Keep tier field for any legacy UI that reads it
  const tier = 'pay-as-you-go'

  return {
    tier,
    tierName: 'Pay-as-you-go',
    isActive: true,
    limits: {
      monthly: -1,
      maxProjects: -1,
      maxAlerts: -1,
      historicalDays: -1,
    },
    isLoading: false,
    error: null,
  }
}
