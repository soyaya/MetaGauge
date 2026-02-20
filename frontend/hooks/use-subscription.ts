'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useChainId } from 'wagmi'
import { getContractAddresses, SubscriptionTier, validateNetwork, isLiskNetwork } from '@/lib/web3-config'

const SUBSCRIPTION_ABI = [
  {
    name: 'isSubscriberActive',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getSubscriptionInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'userAddress', type: 'address' },
        { name: 'tier', type: 'uint8' },
        { name: 'role', type: 'uint8' },
        { name: 'billingCycle', type: 'uint8' },
        { name: 'startTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'periodStart', type: 'uint256' },
        { name: 'periodEnd', type: 'uint256' },
        { name: 'isActive', type: 'bool' },
        { name: 'cancelAtPeriodEnd', type: 'bool' },
        { name: 'gracePeriodEnd', type: 'uint256' },
        { name: 'amountPaid', type: 'uint256' },
        { name: 'currency', type: 'uint8' }
      ]
    }],
  },
] as const

export interface SubscriptionInfo {
  userAddress: string
  tier: SubscriptionTier
  role: number
  billingCycle: number
  startTime: bigint
  endTime: bigint
  periodStart: bigint
  periodEnd: bigint
  isActive: boolean
  cancelAtPeriodEnd: boolean
  gracePeriodEnd: bigint
  amountPaid: bigint
  currency: number
}

export function useSubscription() {
  const { address } = useAccount()
  const chainId = useChainId()
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)

  // Validate network
  useEffect(() => {
    if (chainId) {
      try {
        if (isLiskNetwork(chainId)) {
          validateNetwork(chainId)
          setNetworkError(null)
        } else {
          setNetworkError('Please switch to Lisk Sepolia Testnet')
        }
      } catch (error) {
        setNetworkError(error instanceof Error ? error.message : 'Invalid network')
      }
    }
  }, [chainId])

  // Get contract addresses for current chain
  const contracts = chainId && isLiskNetwork(chainId) ? getContractAddresses(chainId) : null

  // Check if user has active subscription
  const { data: isActive, isLoading: isActiveLoading } = useReadContract({
    address: contracts?.SUBSCRIPTION as `0x${string}`,
    abi: SUBSCRIPTION_ABI,
    functionName: 'isSubscriberActive',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contracts?.SUBSCRIPTION }
  })

  // Get detailed subscription info
  const { data: subscriptionData, isLoading: subscriptionLoading } = useReadContract({
    address: contracts?.SUBSCRIPTION as `0x${string}`,
    abi: SUBSCRIPTION_ABI,
    functionName: 'getSubscriptionInfo',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contracts?.SUBSCRIPTION && !!isActive }
  })

  useEffect(() => {
    setIsLoading(isActiveLoading || subscriptionLoading)
  }, [isActiveLoading, subscriptionLoading])

  useEffect(() => {
    if (subscriptionData) {
      setSubscriptionInfo(subscriptionData as SubscriptionInfo)
      setError(null)
    } else if (isActive === false) {
      setSubscriptionInfo(null)
      setError(null)
    }
  }, [subscriptionData, isActive])

  const getCurrentTier = (): SubscriptionTier => {
    if (!subscriptionInfo || !isActive) {
      return SubscriptionTier.Free
    }
    return subscriptionInfo.tier
  }

  const isSubscriptionActive = (): boolean => {
    return !!isActive
  }

  const getTimeRemaining = (): number => {
    if (!subscriptionInfo || !isActive) return 0
    
    const now = Math.floor(Date.now() / 1000)
    const endTime = Number(subscriptionInfo.endTime)
    
    return Math.max(0, endTime - now)
  }

  const getDaysRemaining = (): number => {
    const timeRemaining = getTimeRemaining()
    return Math.floor(timeRemaining / (24 * 60 * 60))
  }

  const isInGracePeriod = (): boolean => {
    if (!subscriptionInfo) return false
    
    const now = Math.floor(Date.now() / 1000)
    const endTime = Number(subscriptionInfo.endTime)
    const gracePeriodEnd = Number(subscriptionInfo.gracePeriodEnd)
    
    return now > endTime && now <= gracePeriodEnd
  }

  const canUpgrade = (targetTier: SubscriptionTier): boolean => {
    const currentTier = getCurrentTier()
    return targetTier > currentTier
  }

  const canDowngrade = (targetTier: SubscriptionTier): boolean => {
    const currentTier = getCurrentTier()
    return targetTier < currentTier && currentTier !== SubscriptionTier.Free
  }

  return {
    // State
    subscriptionInfo,
    isLoading,
    error: error || networkError,
    networkError,
    
    // Computed values
    isActive: isSubscriptionActive(),
    currentTier: getCurrentTier(),
    timeRemaining: getTimeRemaining(),
    daysRemaining: getDaysRemaining(),
    isInGracePeriod: isInGracePeriod(),
    
    // Network status
    isValidNetwork: !networkError,
    chainId,
    
    // Helper functions
    canUpgrade,
    canDowngrade,
    
    // Raw data
    rawIsActive: isActive,
    rawSubscriptionData: subscriptionData,
  }
}