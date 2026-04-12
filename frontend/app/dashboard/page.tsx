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
import { EnhancedAIInsights } from "@/components/analyzer/enhanced-ai-insights"
import { CompetitiveTab } from "@/components/analyzer/competitive-tab"
import { FunctionsTab } from "@/components/analyzer/functions-tab"

// Import subscription components
import { WalletAnalyticsTab } from "@/components/analyzer/wallet-analytics-tab"
import { SubscriptionStatus } from "@/components/subscription/subscription-status"
import { useSubscription } from "@/hooks/use-subscription"

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
  subscription?: {
    isActive?: boolean
    tierName?: string
    features?: {
      maxProjects?: number
      maxAlerts?: number
      apiAccess?: boolean
    }
    limits?: {
      historicalData?: number
    }
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

  // Poll for progress updates while indexing AND for live data updates after indexing
  useEffect(() => {
    if (!defaultContract) return

    // Stop polling only if there's no contract at all
    const isLive = defaultContract.indexingStatus.isIndexed
    const pollMs = isLive ? 15000 : 5000 // 15s for live updates, 5s during indexing

    const pollInterval = setInterval(async () => {
      try {
        // Check auth before polling
        const token = localStorage.getItem('token')
        if (token) {
          await loadDefaultContractData()
        }
      } catch (err) {
        // silent
      }
    }, pollMs)

    return () => clearInterval(pollInterval)
  }, [defaultContract?.indexingStatus.isIndexed, defaultContract?.contract?.address])

  const checkOnboardingAndLoadData = async () => {
    try {
      setLoading(true)
      
      // Check onboarding status first
      let onboardingStatus
      try {
        onboardingStatus = await api.onboarding.getStatus()
      } catch (err: any) {
        // If status check fails (e.g. 500 from server), just load dashboard data anyway
        console.warn('Onboarding status check failed, loading dashboard anyway:', err.message)
        onboardingStatus = { completed: true }
      }
      
      if (!onboardingStatus.completed) {
        router.push('/onboarding')
        return
      }

      // Load dashboard data — failures here are non-fatal
      await Promise.allSettled([
        loadDefaultContractData(),
        loadUserMetrics()
      ])
      
    } catch (err: any) {
      if (err.name === 'BackendTimeout' || err.name === 'NetworkError') {
        setError('Unable to connect to server. Please check if the backend is running.')
      } else {
        // Don't show error for non-critical failures
        console.warn('Dashboard load issue:', err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadDefaultContractData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const data = await api.onboarding.getDefaultContract()
      setDefaultContract(data)
    } catch (err: any) {
      console.error('Failed to load default contract:', err.message)
    }
  }

  const loadUserMetrics = async () => {
    try {
      const data = await api.onboarding.getUserMetrics()
      setUserMetrics(data)
    } catch (err: any) {
      console.error('Failed to load user metrics:', err.message)
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
      <div className="page-shell">
        <Header />
        <div className="page-container">
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
      <div className="page-shell">
        <Header />
        <div className="page-container">
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
    <div className="page-shell">
      <Header />
      
      <div className="page-container">
        {/* Welcome Section */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Welcome back, <span className="gradient-brand-text">{user?.name}</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {defaultContract ? `Monitoring ${defaultContract.contract.name}` : 'Set up your first contract to get started'}
            </p>
          </div>
          {defaultContract?.indexingStatus.isIndexed && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live data
            </div>
          )}
        </div>

        {/* Default Contract Section */}
        {defaultContract && (
          <div className="mb-8">

          {/* Indexing in progress — single prominent banner */}
            {!defaultContract.indexingStatus.isIndexed && (
              <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                <CardContent className="flex items-center gap-4 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Indexing <strong>{defaultContract.contract.name}</strong>…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Metrics will populate automatically — usually 1–5 minutes.</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600 shrink-0">{defaultContract.indexingStatus.progress}%</span>
                </CardContent>
              </Card>
            )}
            <div className="mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold">Dashboard</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Contract Info Card */}
              <Card className="lg:col-span-3">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center shrink-0">
                          <Globe className="h-4 w-4 text-white" />
                        </div>
                        {defaultContract.contract.name}
                      </CardTitle>
                      <CardDescription className="mt-1 ml-10">
                        {defaultContract.contract.category.toUpperCase()} · {defaultContract.contract.chain}
                        {defaultContract.contract.address && (
                          <span className="ml-2 font-mono text-xs">{defaultContract.contract.address.slice(0, 8)}…{defaultContract.contract.address.slice(-6)}</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {defaultContract.indexingStatus.isIndexed ? (
                        defaultContract.analysisError ? (
                          <Badge variant="destructive">Analysis Failed</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-0">Fully Indexed</Badge>
                        )
                      ) : (
                        <Badge variant="secondary" className="animate-pulse gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Indexing {defaultContract.indexingStatus.progress}%
                        </Badge>
                      )}
                      {defaultContract.subscription?.continuousSync && defaultContract.indexingStatus.isIndexed && (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-0 gap-1">
                          <Activity className="h-3 w-3" />Live
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    {[
                      ['Onboarded', formatDate(defaultContract.contract.startDate)],
                      ['Deployment Block', defaultContract.blockRange?.deployment?.toLocaleString() ?? defaultContract.contract.deploymentBlock?.toLocaleString() ?? '—'],
                      ['Blocks Indexed', defaultContract.blockRange?.total?.toLocaleString() ?? '—'],
                      ['Block Range', (defaultContract.blockRange?.start != null && defaultContract.blockRange?.end != null) ? `${defaultContract.blockRange.start.toLocaleString()} → ${defaultContract.blockRange.end.toLocaleString()}` : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-muted/40 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <p className="font-semibold text-sm truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                  {!defaultContract.indexingStatus.isIndexed && defaultContract.indexingStatus.progress > 0 && (
                    <div className="mt-4">
                      <Progress value={defaultContract.indexingStatus.progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">{defaultContract.indexingStatus.progress}% — fetching {defaultContract.subscription?.tier || 'free'} tier data</p>
                    </div>
                  )}
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
                <div className="overflow-x-auto pb-1">
                  <TabsList className="flex w-max min-w-full gap-1 h-auto p-1">
                    {[['overview','Overview'],['metrics','Metrics'],['users','Users'],['transactions','Txns'],['wallets','Wallets'],['functions','Functions'],['ux','UX'],['ai-insights','AI'],['competitive','Competitive']].map(([v,l])=>(
                      <TabsTrigger key={v} value={v} className="text-xs whitespace-nowrap px-3 py-1.5">{l}</TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <TabsContent value="overview">
                  <OverviewTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults?.fullReport ? defaultContract.fullResults : { fullReport: defaultContract.fullResults }
                      }
                    }}
                    analysisId={defaultContract.analysisHistory.latest?.id}
                  />
                </TabsContent>

                <TabsContent value="metrics">
                  <MetricsTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults?.fullReport ? defaultContract.fullResults : { fullReport: defaultContract.fullResults }
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="users">
                  <UsersTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults?.fullReport ? defaultContract.fullResults : { fullReport: defaultContract.fullResults }
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="transactions">
                  <TransactionsTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults?.fullReport ? defaultContract.fullResults : { fullReport: defaultContract.fullResults }
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="functions">
                  <FunctionsTab 
                    contractAddress={defaultContract.contract.address}
                    chain={defaultContract.contract.chain}
                  />
                </TabsContent>

                <TabsContent value="wallets">
                  <WalletAnalyticsTab
                    contractAddress={defaultContract.contract.address}
                    chain={defaultContract.contract.chain}
                  />
                </TabsContent>

                <TabsContent value="ux">
                  <UxTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults?.fullReport ? defaultContract.fullResults : { fullReport: defaultContract.fullResults }
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="ai-insights">
                  <EnhancedAIInsights 
                    analysisId={defaultContract.analysisHistory.latest?.id || ''}
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults?.fullReport ? defaultContract.fullResults : { fullReport: defaultContract.fullResults }
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="competitive">
                  <CompetitiveTab 
                    analysisResults={{
                      results: {
                        target: defaultContract.fullResults?.fullReport ? defaultContract.fullResults : { fullReport: defaultContract.fullResults }
                      }
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Indexing Progress — only show if 0% and no banner above */}
            {!defaultContract.indexingStatus.isIndexed && defaultContract.indexingStatus.progress === 0 && (
              <div className="mb-6">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <h3 className="text-base font-semibold mb-2">Starting indexer…</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
                      The indexer is initializing. If it doesn't start automatically, click below.
                    </p>
                    <Button
                      onClick={async () => {
                        try {
                          await api.onboarding.triggerIndexing();
                          toast({ title: "Indexing started", description: "Your contract data is being fetched." });
                          setTimeout(() => loadDefaultContractData(), 2000);
                        } catch (error: any) {
                          toast({ title: "Failed to start indexing", description: error.message, variant: "destructive" });
                        }
                      }}
                    >
                      Start Indexing Now
                    </Button>
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

            {userMetrics && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Usage This Month
                  </CardTitle>
                  <CardDescription>Your analytics activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      ['Contracts', userMetrics.overview.totalContracts, 'text-primary'],
                      ['Completed', userMetrics.overview.completedAnalyses, 'text-green-600'],
                      ['This Month', userMetrics.overview.monthlyAnalyses ?? userMetrics.usage?.monthlyAnalysisCount ?? 0, 'text-blue-600'],
                    ].map(([label, value, color]) => (
                      <div key={label as string} className="text-center bg-muted/40 rounded-xl p-3">
                        <div className={`text-2xl font-bold ${color}`}>{value}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  <Link href="/subscription">
                    <Button variant="outline" size="sm" className="w-full">View Billing & Usage →</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}