'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  ArrowUp, 
  ArrowDown, 
  XCircle,
  ExternalLink 
} from 'lucide-react'
import { getContractAddresses, SubscriptionTier, BillingCycle, getExplorerUrl } from '@/lib/web3-config'
import { api } from '@/lib/api'

const SUBSCRIPTION_ABI = [
  {
    name: 'cancelSubscription',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'changeSubscription',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'newTier', type: 'uint8' },
      { name: 'newCycle', type: 'uint8' }
    ],
    outputs: [],
  },
] as const

interface SubscriptionManagementProps {
  currentTier: number
  currentCycle?: number
  isActive: boolean
  onSuccess?: () => void
}

export function SubscriptionManagement({ 
  currentTier, 
  currentCycle = 0,
  isActive,
  onSuccess 
}: SubscriptionManagementProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [txHash, setTxHash] = useState<string>('')

  const contracts = chainId ? getContractAddresses(chainId) : null

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const tierNames = ['Free', 'Starter', 'Pro', 'Enterprise']

  const handleCancel = async () => {
    if (!address || !contracts) {
      setError('Please connect your wallet')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsProcessing(true)

      writeContract({
        address: contracts.SUBSCRIPTION as `0x${string}`,
        abi: SUBSCRIPTION_ABI,
        functionName: 'cancelSubscription',
      })

      setSuccess('Cancellation transaction submitted. Waiting for confirmation...')
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpgrade = async (newTier: number) => {
    if (!address || !contracts) {
      setError('Please connect your wallet')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsProcessing(true)

      writeContract({
        address: contracts.SUBSCRIPTION as `0x${string}`,
        abi: SUBSCRIPTION_ABI,
        functionName: 'changeSubscription',
        args: [newTier, currentCycle],
      })

      setSuccess('Upgrade transaction submitted. Waiting for confirmation...')
    } catch (err: any) {
      setError(err.message || 'Failed to upgrade subscription')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDowngrade = async (newTier: number) => {
    if (!address || !contracts) {
      setError('Please connect your wallet')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsProcessing(true)

      writeContract({
        address: contracts.SUBSCRIPTION as `0x${string}`,
        abi: SUBSCRIPTION_ABI,
        functionName: 'changeSubscription',
        args: [newTier, currentCycle],
      })

      setSuccess('Downgrade transaction submitted. Waiting for confirmation...')
    } catch (err: any) {
      setError(err.message || 'Failed to downgrade subscription')
    } finally {
      setIsProcessing(false)
    }
  }

  // Sync with backend after transaction confirms
  const syncSubscription = async () => {
    if (!address) return
    
    try {
      await api.users.syncSubscription(address)
      setSuccess('Subscription updated successfully!')
      onSuccess?.()
    } catch (err) {
      console.error('Failed to sync subscription:', err)
    }
  }

  // Watch for transaction confirmation
  if (hash && !isConfirming && !txHash) {
    setTxHash(hash)
    syncSubscription()
  }

  if (!isActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Subscription</CardTitle>
          <CardDescription>No active subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You don't have an active subscription. Please subscribe to a plan first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Subscription</CardTitle>
        <CardDescription>
          Current plan: <Badge>{tierNames[currentTier]}</Badge>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {txHash && (
          <Alert>
            <ExternalLink className="h-4 w-4" />
            <AlertDescription>
              <a 
                href={getExplorerUrl(chainId || 4202, txHash)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                View transaction on explorer
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Upgrade Options */}
        {currentTier < 3 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Upgrade Plan</h3>
            <div className="grid gap-2">
              {currentTier < 1 && (
                <Button 
                  onClick={() => handleUpgrade(SubscriptionTier.Starter)}
                  disabled={isProcessing || isPending || isConfirming}
                  className="w-full"
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUp className="mr-2 h-4 w-4" />}
                  Upgrade to Starter
                </Button>
              )}
              {currentTier < 2 && (
                <Button 
                  onClick={() => handleUpgrade(SubscriptionTier.Pro)}
                  disabled={isProcessing || isPending || isConfirming}
                  className="w-full"
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUp className="mr-2 h-4 w-4" />}
                  Upgrade to Pro
                </Button>
              )}
              {currentTier < 3 && (
                <Button 
                  onClick={() => handleUpgrade(SubscriptionTier.Enterprise)}
                  disabled={isProcessing || isPending || isConfirming}
                  className="w-full"
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUp className="mr-2 h-4 w-4" />}
                  Upgrade to Enterprise
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Downgrade Options */}
        {currentTier > 1 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Downgrade Plan</h3>
            <div className="grid gap-2">
              {currentTier > 1 && (
                <Button 
                  onClick={() => handleDowngrade(SubscriptionTier.Starter)}
                  disabled={isProcessing || isPending || isConfirming}
                  variant="outline"
                  className="w-full"
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDown className="mr-2 h-4 w-4" />}
                  Downgrade to Starter
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Cancel Subscription */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleCancel}
            disabled={isProcessing || isPending || isConfirming}
            variant="destructive"
            className="w-full"
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Cancel Subscription
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            You may receive a prorated refund based on time remaining
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
