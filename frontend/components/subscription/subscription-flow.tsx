'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Loader2, Coins, Zap, ExternalLink } from 'lucide-react'
import { WalletConnect } from '@/components/web3/wallet-connect'
import { PlanSelector } from './plan-selector'
import { CopyButton } from '@/components/ui/copy-button'
import { TransactionSuccessDialog } from '@/components/ui/transaction-success-dialog'
import { faucetAPI } from '@/lib/api-config'
import { 
  SubscriptionTier, 
  BillingCycle, 
  UserRole,
  PaymentCurrency,
  SUBSCRIPTION_PLANS,
  getContractAddresses,
  parseTokenAmount,
  validateNetwork,
  getExplorerUrl
} from '@/lib/web3-config'

// ABI fragments for the contracts - using actual deployed contract ABIs
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const SUBSCRIPTION_ABI = [
  {
    name: 'subscribe',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'role', type: 'uint8' },
      { name: 'billingCycle', type: 'uint8' },
      { name: 'userUUID', type: 'string' },
      { name: 'currency', type: 'uint8' }
    ],
    outputs: [],
  },
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
  {
    name: 'plans',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint8' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'monthlyPrice', type: 'uint256' },
      { name: 'yearlyPrice', type: 'uint256' },
      { name: 'features', type: 'tuple', components: [
        { name: 'apiCallsPerMonth', type: 'uint256' },
        { name: 'maxProjects', type: 'uint256' },
        { name: 'maxAlerts', type: 'uint256' },
        { name: 'exportAccess', type: 'bool' },
        { name: 'comparisonTool', type: 'bool' },
        { name: 'walletIntelligence', type: 'bool' },
        { name: 'apiAccess', type: 'bool' },
        { name: 'prioritySupport', type: 'bool' },
        { name: 'customInsights', type: 'bool' }
      ]},
      { name: 'limits', type: 'tuple', components: [
        { name: 'historicalData', type: 'uint256' },
        { name: 'teamMembers', type: 'uint256' },
        { name: 'dataRefreshRate', type: 'uint256' }
      ]},
      { name: 'active', type: 'bool' }
    ],
  },
] as const

const FAUCET_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

type FlowStep = 
  | 'connect'
  | 'check-balance'
  | 'faucet'
  | 'select-plan'
  | 'approve'
  | 'subscribe'
  | 'success'

interface SubscriptionFlowProps {
  onComplete?: (subscriptionData: any) => void
  userUUID?: string
  defaultRole?: UserRole
  className?: string
}

export function SubscriptionFlow({ 
  onComplete, 
  userUUID = '',
  defaultRole = UserRole.Startup,
  className = "" 
}: SubscriptionFlowProps) {
  const { address, isConnected, chainId } = useAccount()
  const [currentStep, setCurrentStep] = useState<FlowStep>('connect')
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(SubscriptionTier.Starter)
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(BillingCycle.Monthly)
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [faucetClaimResult, setFaucetClaimResult] = useState<any>(null)
  const [subscriptionResult, setSubscriptionResult] = useState<any>(null)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  const [showFaucetDialog, setShowFaucetDialog] = useState(false)

  // Get contract addresses for current chain
  const contracts = chainId ? getContractAddresses(chainId) : null

  // Contract read hooks
  const { data: tokenBalance } = useReadContract({
    address: contracts?.MGT_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contracts?.MGT_TOKEN }
  })

  const { data: allowance } = useReadContract({
    address: contracts?.MGT_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && contracts ? [address, contracts.SUBSCRIPTION as `0x${string}`] : undefined,
    query: { enabled: !!address && !!contracts?.MGT_TOKEN && !!contracts?.SUBSCRIPTION }
  })

  const { data: isSubscribed } = useReadContract({
    address: contracts?.SUBSCRIPTION as `0x${string}`,
    abi: SUBSCRIPTION_ABI,
    functionName: 'isSubscriberActive',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contracts?.SUBSCRIPTION }
  })

  // Contract write hooks
  const { 
    writeContract: writeApprove, 
    data: approveHash, 
    isPending: approvePending 
  } = useWriteContract()

  const { 
    writeContract: writeSubscribe, 
    data: subscribeHash, 
    isPending: subscribePending 
  } = useWriteContract()

  // Transaction receipt hooks
  const { isLoading: approveLoading } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  const { isLoading: subscribeLoading } = useWaitForTransactionReceipt({
    hash: subscribeHash,
  })

  useEffect(() => {
    if (!isConnected) {
      setCurrentStep('connect')
    } else if (isSubscribed) {
      setCurrentStep('success')
    } else {
      // Validate network before proceeding
      try {
        if (chainId) {
          validateNetwork(chainId)
          setCurrentStep('check-balance')
          setError('')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Please switch to Lisk Sepolia network')
        setCurrentStep('connect')
      }
    }
  }, [isConnected, isSubscribed, chainId])

  // Check if user needs tokens
  useEffect(() => {
    if (currentStep === 'check-balance' && tokenBalance !== undefined) {
      const requiredAmount = parseTokenAmount(
        selectedCycle === BillingCycle.Monthly 
          ? SUBSCRIPTION_PLANS[selectedTier].monthlyPrice 
          : SUBSCRIPTION_PLANS[selectedTier].yearlyPrice
      )
      
      if (selectedTier === SubscriptionTier.Free || BigInt(tokenBalance.toString()) >= BigInt(requiredAmount)) {
        setCurrentStep('select-plan')
      } else {
        setCurrentStep('faucet')
      }
    }
  }, [currentStep, tokenBalance, selectedTier, selectedCycle])

  const handleFaucetClaim = async () => {
    if (!address) {
      setError('Wallet not connected')
      return
    }

    try {
      setError('')
      setIsProcessing(true)
      
      // Call backend faucet API using the centralized API helper
      const result = await faucetAPI.claimTokens(address, navigator.userAgent)

      if (!result.success) {
        // Handle different error types
        if (result.error?.includes('COOLDOWN_ACTIVE')) {
          setError('Please wait 24 hours before claiming again')
        } else if (result.error?.includes('RATE_LIMIT_EXCEEDED')) {
          setError('Faucet is busy. Please try again later.')
        } else if (result.error?.includes('MAX_CLAIMS_REACHED')) {
          setError('Maximum claims reached for this address')
        } else {
          setError(result.error || 'Failed to claim tokens')
        }
        return
      }

      // Success - tokens claimed
      console.log('✅ Tokens claimed successfully:', result.data)
      setFaucetClaimResult(result.data)
      
      // Show faucet transaction dialog
      setShowFaucetDialog(true)

    } catch (err: any) {
      console.error('Faucet claim error:', err)
      setError(err.message || 'Failed to claim tokens')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePlanSelect = (tier: SubscriptionTier, cycle: BillingCycle) => {
    setSelectedTier(tier)
    setSelectedCycle(cycle)
    
    if (tier === SubscriptionTier.Free) {
      // Free tier - skip payment flow
      setCurrentStep('success')
      onComplete?.({
        tier,
        cycle,
        address,
        transactionHash: null
      })
    } else {
      // Check if approval is needed
      const requiredAmount = parseTokenAmount(
        cycle === BillingCycle.Monthly 
          ? SUBSCRIPTION_PLANS[tier].monthlyPrice 
          : SUBSCRIPTION_PLANS[tier].yearlyPrice
      )
      
      if (allowance && BigInt(allowance.toString()) >= BigInt(requiredAmount)) {
        setCurrentStep('subscribe')
      } else {
        setCurrentStep('approve')
      }
    }
  }

  const handleApprove = async () => {
    if (!contracts?.MGT_TOKEN || !contracts?.SUBSCRIPTION) {
      setError('Contract addresses not available')
      return
    }

    try {
      setError('')
      setIsProcessing(true)
      
      const requiredAmount = parseTokenAmount(
        selectedCycle === BillingCycle.Monthly 
          ? SUBSCRIPTION_PLANS[selectedTier].monthlyPrice 
          : SUBSCRIPTION_PLANS[selectedTier].yearlyPrice
      )

      writeApprove({
        address: contracts.MGT_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contracts.SUBSCRIPTION as `0x${string}`, BigInt(requiredAmount)],
      })
    } catch (err: any) {
      setError(err.message || 'Failed to approve tokens')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubscribe = async () => {
    if (!contracts?.SUBSCRIPTION) {
      setError('Subscription contract not available')
      return
    }

    try {
      setError('')
      setIsProcessing(true)

      console.log('🔄 Initiating subscription with parameters:', {
        tier: selectedTier,
        role: defaultRole,
        cycle: selectedCycle,
        userUUID,
        currency: PaymentCurrency.Token
      })

      writeSubscribe({
        address: contracts.SUBSCRIPTION as `0x${string}`,
        abi: SUBSCRIPTION_ABI,
        functionName: 'subscribe',
        args: [
          selectedTier,
          defaultRole,
          selectedCycle,
          userUUID,
          PaymentCurrency.Token
        ],
      })
    } catch (err: any) {
      console.error('Subscription error:', err)
      
      // Handle specific contract errors
      if (err.message?.includes('Invalid currency for token mode')) {
        setError('Invalid payment currency. Please try again.')
      } else if (err.message?.includes('Insufficient allowance')) {
        setError('Token approval required. Please approve tokens first.')
      } else if (err.message?.includes('AlreadySubscribed')) {
        setError('You already have an active subscription.')
      } else if (err.message?.includes('TierNotActive')) {
        setError('Selected subscription tier is not available.')
      } else {
        setError(err.message || 'Failed to subscribe')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Auto-advance after successful transactions
  useEffect(() => {
    if (approveHash && !approveLoading && !approvePending) {
      setCurrentStep('subscribe')
    }
  }, [approveHash, approveLoading, approvePending])

  useEffect(() => {
    if (subscribeHash && !subscribeLoading && !subscribePending) {
      // Capture subscription transaction details
      setSubscriptionResult({
        transactionHash: subscribeHash,
        tier: selectedTier,
        cycle: selectedCycle,
        address: address,
        timestamp: new Date().toISOString()
      })
      
      // Show transaction dialog immediately
      setShowTransactionDialog(true)
    }
  }, [subscribeHash, subscribeLoading, subscribePending, selectedTier, selectedCycle, address, onComplete])

  const handleTransactionDialogClose = () => {
    setShowTransactionDialog(false)
    setCurrentStep('success')
    onComplete?.({
      tier: selectedTier,
      cycle: selectedCycle,
      address,
      transactionHash: subscriptionResult?.transactionHash
    })
  }

  const handleFaucetDialogClose = () => {
    setShowFaucetDialog(false)
    setCurrentStep('select-plan')
  }

  const getStepProgress = () => {
    const steps = ['connect', 'check-balance', 'faucet', 'select-plan', 'approve', 'subscribe', 'success']
    const currentIndex = steps.indexOf(currentStep)
    return ((currentIndex + 1) / steps.length) * 100
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'connect':
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to Lisk Sepolia Testnet to get started with MetaGauge subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <WalletConnect 
                onConnect={(address) => {
                  console.log('Wallet connected:', address)
                  // Network validation will be handled by the useEffect
                }}
                enforceNetwork={true}
                className="w-full"
              />
            </CardContent>
          </Card>
        )

      case 'check-balance':
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Checking Token Balance</CardTitle>
              <CardDescription>
                Verifying your MGT token balance...
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        )

      case 'faucet':
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Coins className="h-5 w-5" />
                Get Test Tokens
              </CardTitle>
              <CardDescription>
                You need MGT tokens to subscribe. Get free test tokens to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Current balance: {tokenBalance ? formatEther(BigInt(tokenBalance.toString())) : '0'} MGT
                </p>
                
                <Button 
                  onClick={handleFaucetClaim}
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming Tokens...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Get Free Test Tokens
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 'select-plan':
        return (
          <PlanSelector
            onSelectPlan={handlePlanSelect}
            loading={isProcessing}
          />
        )

      case 'approve':
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Approve Token Spending</CardTitle>
              <CardDescription>
                Approve MetaGauge to spend your MGT tokens for the subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Plan: {SUBSCRIPTION_PLANS[selectedTier].name} - {
                    selectedCycle === BillingCycle.Monthly 
                      ? SUBSCRIPTION_PLANS[selectedTier].monthlyPrice 
                      : SUBSCRIPTION_PLANS[selectedTier].yearlyPrice
                  } MGT
                </p>
                <Button 
                  onClick={handleApprove}
                  disabled={isProcessing || approvePending || approveLoading}
                  className="w-full"
                >
                  {approvePending || approveLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    'Approve Tokens'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 'subscribe':
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Confirm Subscription</CardTitle>
              <CardDescription>
                Complete your subscription to {SUBSCRIPTION_PLANS[selectedTier].name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Button 
                  onClick={handleSubscribe}
                  disabled={isProcessing || subscribePending || subscribeLoading}
                  className="w-full"
                >
                  {subscribePending || subscribeLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    'Confirm Subscription'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 'success':
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Subscription Active!
              </CardTitle>
              <CardDescription>
                Welcome to MetaGauge {SUBSCRIPTION_PLANS[selectedTier]?.name || 'Free'} plan
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Badge variant="default" className="mb-4">
                {SUBSCRIPTION_PLANS[selectedTier]?.name || 'Free'} Plan Active
              </Badge>
              <p className="text-sm text-muted-foreground">
                You now have access to all {SUBSCRIPTION_PLANS[selectedTier]?.name || 'Free'} plan features
              </p>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className={className}>
      <div className="mb-8">
        <Progress value={getStepProgress()} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Connect Wallet</span>
          <span>Select Plan</span>
          <span>Complete</span>
        </div>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {renderStepContent()}

      {/* Transaction Success Dialog */}
      {subscriptionResult && chainId && (
        <TransactionSuccessDialog
          isOpen={showTransactionDialog}
          onClose={handleTransactionDialogClose}
          transactionHash={subscriptionResult.transactionHash}
          chainId={chainId}
          title="Subscription Created Successfully!"
          description={`Welcome to MetaGauge ${SUBSCRIPTION_PLANS[selectedTier].name} plan`}
          details={[
            {
              label: 'Plan',
              value: SUBSCRIPTION_PLANS[selectedTier].name
            },
            {
              label: 'Billing',
              value: selectedCycle === BillingCycle.Monthly ? 'Monthly' : 'Yearly'
            },
            {
              label: 'Price',
              value: `${selectedCycle === BillingCycle.Monthly 
                ? SUBSCRIPTION_PLANS[selectedTier].monthlyPrice 
                : SUBSCRIPTION_PLANS[selectedTier].yearlyPrice} MGT`
            },
            {
              label: 'Address',
              value: address || 'N/A'
            }
          ]}
        />
      )}
      {/* Faucet Success Dialog */}
      {faucetClaimResult && chainId && (
        <TransactionSuccessDialog
          isOpen={showFaucetDialog}
          onClose={handleFaucetDialogClose}
          transactionHash={faucetClaimResult.transactionHash}
          chainId={chainId}
          title="Tokens Claimed Successfully!"
          description="Free test tokens have been added to your wallet"
          details={[
            {
              label: 'Amount Claimed',
              value: `${faucetClaimResult.amount} MGT`
            },
            {
              label: 'New Balance',
              value: `${faucetClaimResult.balanceAfter} MGT`
            },
            {
              label: 'Gas Used',
              value: faucetClaimResult.gasUsed
            },
            {
              label: 'Block Number',
              value: faucetClaimResult.blockNumber?.toString() || 'N/A'
            }
          ]}
        />
      )}
    </div>
  )
}