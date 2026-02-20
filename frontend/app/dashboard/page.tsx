"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/ui/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Plus, Globe, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"

// Import analyzer components for detailed metrics display
import { OverviewTab } from "@/components/analyzer/overview-tab"
import { MetricsTab } from "@/components/analyzer/metrics-tab"
import { UsersTab } from "@/components/analyzer/users-tab"
import { TransactionsTab } from "@/components/analyzer/transactions-tab"
import { UxTab } from "@/components/analyzer/ux-tab"

// Import subscription components
import { SubscriptionStatus } from "@/components/subscription/subscription-status"

interface DefaultContractData {
  contract: {
    address: string
    chain: string
    name: string
    category: string
    purpose: string
    startDate: string
    isIndexed: boolean
    indexingProgress: number
    continuousSync?: boolean
    continuousSyncStarted?: string
    continuousSyncStopped?: string
    subscriptionTier?: string
    deploymentBlock?: number
  }
  subscription?: {
    tier: string
    tierNumber: number
    historicalDays: number
    continuousSync: boolean
  }
  blockRange?: {
    start: number
    end: number
    deployment: number
    total: number
  }
  metrics: {
    tvl?: number
    volume?: number
    transactions?: number
    uniqueUsers?: number
    gasEfficiency?: number | string
    avgGasUsed?: number
    avgGasPrice?: number
    totalGasCost?: number
    failureRate?: number
    liquidityUtilization?: number
    apy?: number
    fees?: number
    activeUsers?: number
    newUsers?: number
    returningUsers?: number
    topUsers?: any[]
    recentTransactions?: any[]
    syncCyclesCompleted?: number
    dataFreshness?: string
    accumulatedBlockRange?: number
  } | null
  fullResults: any | null // Full analysis results for detailed display
  indexingStatus: {
    isIndexed: boolean
    progress: number
  }
  analysisHistory: {
    total: number
    completed: number
    latest: {
      id: string
      status: string
      createdAt: string
      completedAt: string
      hasError?: boolean
    } | null
  }
  analysisError?: string | null // Error message if analysis failed
}

interface UserMetrics {
  overview: {
    totalContracts: number
    totalAnalyses: number
    completedAnalyses: number
    failedAnalyses: number
    runningAnalyses: number
    monthlyAnalyses: number
    chainsAnalyzed: string[]
    avgExecutionTimeMs: number
  }
  usage: {
    analysisCount: number
    monthlyAnalysisCount: number
    lastAnalysis: string | null
    monthlyResetDate: string
  }
  limits: {
    monthly: number
    remaining: number
  }
  recentAnalyses: Array<{
    id: string
    status: string
    analysisType: string
    contractAddress?: string
    contractName?: string
    chain?: string
    createdAt: string
    completedAt?: string
  }>
}

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [defaultContract, setDefaultContract] = useState<DefaultContractData | null>(null)
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingAndLoadData()
    }
  }, [isAuthenticated])

  // Poll for progress updates while indexing
  useEffect(() => {
    if (!defaultContract || defaultContract.indexingStatus.isIndexed) {
      return // Don't poll if no contract or already indexed
    }

    const pollInterval = setInterval(async () => {
      try {
        await loadDefaultContractData()
      } catch (err) {
        console.error('Failed to poll for updates:', err)
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(pollInterval)
  }, [defaultContract?.indexingStatus.isIndexed])

  const checkOnboardingAndLoadData = async () => {
    try {
      setLoading(true)
      
      // Check onboarding status first
      const onboardingStatus = await api.onboarding.getStatus()
      
      if (!onboardingStatus.completed) {
        router.push('/onboarding')
        return
      }

      // Load dashboard data
      await Promise.all([
        loadDefaultContractData(),
        loadUserMetrics()
      ])
      
    } catch (err: any) {
      // Silently handle backend connection errors
      if (err.name === 'BackendTimeout' || err.name === 'NetworkError') {
        setError('Unable to connect to server. Please check if the backend is running.')
      } else {
        setError('Failed to load dashboard data')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadDefaultContractData = async () => {
    try {
      const data = await api.onboarding.getDefaultContract()
      console.log('📊 Default contract data:', data)
      console.log('   Subscription:', data.subscription)
      console.log('   Block range:', data.blockRange)
      setDefaultContract(data)
    } catch (err) {
      // Silently fail - don't log to console
    }
  }

  const loadUserMetrics = async () => {
    try {
      const data = await api.onboarding.getUserMetrics()
      setUserMetrics(data)
    } catch (err) {
      // console.error('Failed to load user metrics:', err)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Invalid date'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading your dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={checkOnboardingAndLoadData} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {user?.name}!</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Here's an overview of your business contract and analysis activity
          </p>
        </div>

        {/* Default Contract Section */}
        {defaultContract && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold">Dashboard</h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Removed Quick Sync and Marathon Sync buttons - indexing now starts automatically on contract submission */}
                <Link href="/analyzer" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    New Analysis
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Contract Info Card */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    {defaultContract.contract.name}
                  </CardTitle>
                  <CardDescription>
                    {defaultContract.contract.category.toUpperCase()} • {defaultContract.contract.chain}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {/* Basic contract info */}
                    <div className="space-y-2 text-sm break-words">
                      <p className="flex flex-col sm:flex-row sm:gap-1">
                        <strong className="shrink-0">Address:</strong> 
                        <span className="text-muted-foreground break-all">{defaultContract.contract.address ? defaultContract.contract.address.slice(0, 10) + '...' : 'N/A'}</span>
                      </p>
                      <p className="flex flex-col">
                        <strong className="shrink-0">Purpose:</strong> 
                        <span className="text-muted-foreground break-words line-clamp-3">
                          {defaultContract.contract.purpose || 'N/A'}
                        </span>
                      </p>
                      <p className="flex flex-col sm:flex-row sm:gap-1">
                        <strong className="shrink-0">Onboarded:</strong> 
                        <span className="text-muted-foreground">{formatDate(defaultContract.contract.startDate)}</span>
                      </p>
                      {(() => {
                        const deploymentBlock = defaultContract.blockRange?.deployment ?? defaultContract.contract.deploymentBlock;
                        return deploymentBlock ? (
                          <p className="flex flex-col sm:flex-row sm:gap-1">
                            <strong className="shrink-0">Deployment Block:</strong> 
                            <span className="text-muted-foreground">{deploymentBlock.toLocaleString()}</span>
                          </p>
                        ) : null;
                      })()}
                    </div>
                    
                    {/* Block Range Info */}
                    <div className="space-y-2 text-sm break-words">
                      {defaultContract.blockRange && defaultContract.blockRange.total != null && defaultContract.blockRange.start != null && defaultContract.blockRange.end != null && (
                        <>
                          <p className="flex flex-col sm:flex-row sm:gap-1">
                            <strong className="shrink-0">Blocks Indexed:</strong> 
                            <span className="text-muted-foreground">{defaultContract.blockRange.total.toLocaleString()}</span>
                          </p>
                          <p className="flex flex-col sm:flex-row sm:gap-1">
                            <strong className="shrink-0">Block Range:</strong> 
                            <span className="text-muted-foreground break-all">{defaultContract.blockRange.start.toLocaleString()} → {defaultContract.blockRange.end.toLocaleString()}</span>
                          </p>
                        </>
                      )}
                    </div>
                    
                    {/* Status badges and progress */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {defaultContract.indexingStatus.isIndexed ? (
                          defaultContract.analysisError ? (
                            <Badge variant="destructive">Analysis Failed</Badge>
                          ) : (
                            <Badge variant="default">Fully Indexed</Badge>
                          )
                        ) : (
                          <Badge variant="secondary" className="animate-pulse">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Indexing {defaultContract.indexingStatus.progress}%
                          </Badge>
                        )}
                        {defaultContract.subscription?.continuousSync && defaultContract.indexingStatus.isIndexed && (
                          <Badge variant="default" className="bg-green-500">
                            <Activity className="mr-1 h-3 w-3" />
                            Live Monitoring
                          </Badge>
                        )}
                      </div>
                      
                      {/* Progress bar for indexing */}
                      {!defaultContract.indexingStatus.isIndexed && defaultContract.indexingStatus.progress > 0 && (
                        <div className="space-y-1">
                          <Progress value={defaultContract.indexingStatus.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            Fetching {defaultContract.subscription?.tier || 'Free'} tier data...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Show error message if analysis failed */}
            {defaultContract.analysisError && (
              <div className="mb-6">
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Analysis Error
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {defaultContract.analysisError}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Detailed Metrics Tabs - Always Show */}
            <div className="mb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1">
                  <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
                  <TabsTrigger value="metrics" className="text-xs sm:text-sm">Metrics</TabsTrigger>
                  <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
                  <TabsTrigger value="transactions" className="text-xs sm:text-sm">Transactions</TabsTrigger>
                  <TabsTrigger value="ux" className="text-xs sm:text-sm col-span-2 sm:col-span-1">UX Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <OverviewTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults
                      }
                    }}
                    analysisId={defaultContract.analysisHistory.latest?.id}
                  />
                </TabsContent>

                <TabsContent value="metrics">
                  <MetricsTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="users">
                  <UsersTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="transactions">
                  <TransactionsTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="ux">
                  <UxTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults
                      }
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Indexing Progress Indicator */}
            {!defaultContract.indexingStatus.isIndexed && (
              <div className="mb-6">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Indexing Contract Data</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Fetching blockchain data for your contract. Metrics will populate as data arrives.
                    </p>
                    <div className="w-full max-w-md">
                      <Progress value={defaultContract.indexingStatus.progress} className="h-2 mb-2" />
                      <p className="text-xs text-center text-muted-foreground">
                        {defaultContract.indexingStatus.progress}% complete
                      </p>
                    </div>
                    {defaultContract.indexingStatus.progress === 0 && (
                      <Button 
                        onClick={async () => {
                          try {
                            await api.onboarding.triggerIndexing();
                            toast({
                              title: "Indexing started",
                              description: "Your contract data is being fetched. This may take a few minutes.",
                            });
                            // Reload data after a short delay
                            setTimeout(() => loadDefaultContractData(), 2000);
                          } catch (error) {
                            toast({
                              title: "Failed to start indexing",
                              description: error.message,
                              variant: "destructive",
                            });
                          }
                        }}
                        className="mt-4"
                      >
                        Start Indexing Now
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Subscription Status Section */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SubscriptionStatus className="lg:col-span-1" />
            
            {/* User Metrics Summary */}
            {userMetrics && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Usage Overview
                    </div>
                    {userMetrics.subscription && (
                      <Badge variant={userMetrics.subscription.isActive ? "default" : "secondary"}>
                        {userMetrics.subscription.tierName || user?.tier || 'Free'}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Your analytics activity and limits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {userMetrics.overview.totalContracts}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Contracts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {userMetrics.overview.completedAnalyses}
                      </div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {userMetrics.usage?.monthlyAnalysisCount || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">This Month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {userMetrics.limits?.remaining !== undefined && userMetrics.limits.remaining >= 0 
                          ? userMetrics.limits.remaining 
                          : '∞'}
                      </div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                    </div>
                  </div>
                  
                  {/* Subscription Features */}
                  {userMetrics.subscription?.features && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Plan Features:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Historical Data:</span>
                          <span className="font-medium">
                            {userMetrics.subscription.limits?.historicalData 
                              ? Math.floor(userMetrics.subscription.limits.historicalData / 86400) === -1
                                ? 'All history'
                                : `${Math.floor(userMetrics.subscription.limits.historicalData / 86400)} days`
                              : '30 days'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Max Projects:</span>
                          <span className="font-medium">{userMetrics.subscription.features?.maxProjects || 1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Max Alerts:</span>
                          <span className="font-medium">{userMetrics.subscription.features?.maxAlerts || 3}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">API Access:</span>
                          <span className="font-medium">{userMetrics.subscription.features?.apiAccess ? '✓' : '✗'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {userMetrics.limits?.monthly && userMetrics.limits.monthly > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Monthly Usage</span>
                        <span>{userMetrics.usage?.monthlyAnalysisCount || 0} / {userMetrics.limits.monthly}</span>
                      </div>
                      <Progress 
                        value={((userMetrics.usage?.monthlyAnalysisCount || 0) / userMetrics.limits.monthly) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}