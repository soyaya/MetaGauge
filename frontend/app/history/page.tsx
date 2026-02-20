"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/ui/header"
import { Progress } from "@/components/ui/progress"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Eye, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity, 
  Clock, 
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Globe
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
  }
  metrics: {
    tvl?: number
    volume?: number
    transactions?: number
    uniqueUsers?: number
    gasEfficiency?: number
  } | null
  analysisHistory: {
    total: number
    completed: number
    latest: {
      id: string
      status: string
      createdAt: string
      completedAt: string
    } | null
  }
}

export default function HistoryPage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null)
  const [defaultContract, setDefaultContract] = useState<DefaultContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [filteredAnalyses, setFilteredAnalyses] = useState<any[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingAndLoadData()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (userMetrics) {
      filterAnalyses()
    }
  }, [userMetrics, searchTerm, statusFilter, typeFilter])

  const checkOnboardingAndLoadData = async () => {
    try {
      setLoading(true)
      
      // Check onboarding status
      const onboardingStatus = await api.onboarding.getStatus()
      
      if (!onboardingStatus.completed) {
        router.push('/onboarding')
        return
      }

      // Load user metrics and default contract data
      await Promise.all([
        loadUserMetrics(),
        loadDefaultContractData()
      ])
      
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const loadUserMetrics = async () => {
    try {
      const data = await api.onboarding.getUserMetrics()
      setUserMetrics(data)
    } catch (err) {
      console.error('Failed to load user metrics:', err)
    }
  }

  const loadDefaultContractData = async () => {
    try {
      const data = await api.onboarding.getDefaultContract()
      setDefaultContract(data)
    } catch (err) {
      console.error('Failed to load default contract data:', err)
    }
  }

  const filterAnalyses = () => {
    if (!userMetrics) return

    let filtered = userMetrics.recentAnalyses

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(analysis => 
        analysis.contractAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        analysis.contractName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        analysis.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(analysis => analysis.status === statusFilter)
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(analysis => analysis.analysisType === typeFilter)
    }

    setFilteredAnalyses(filtered)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      running: "secondary", 
      failed: "destructive",
      pending: "outline"
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getUsagePercentage = () => {
    if (!userMetrics || userMetrics.limits.monthly === -1) return 0
    return (userMetrics.usage.monthlyAnalysisCount / userMetrics.limits.monthly) * 100
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              Try Again
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
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Analytics Overview</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive view of your contract analysis metrics and history
          </p>
        </div>

        {/* Overall Statistics */}
        {userMetrics && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Analytics Statistics</h2>
            
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Total Analyses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userMetrics.overview.totalAnalyses}</div>
                  <p className="text-xs text-muted-foreground">
                    {userMetrics.overview.completedAnalyses} completed, {userMetrics.overview.failedAnalyses} failed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Contracts Analyzed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userMetrics.overview.totalContracts}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {userMetrics.overview.chainsAnalyzed.length} blockchain{userMetrics.overview.chainsAnalyzed.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Avg Analysis Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {userMetrics.overview.avgExecutionTimeMs > 0 
                      ? `${Math.round(userMetrics.overview.avgExecutionTimeMs / 1000)}s`
                      : 'N/A'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">per analysis</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userMetrics.overview.monthlyAnalyses}</div>
                  <p className="text-xs text-muted-foreground">
                    {userMetrics.limits.remaining} remaining
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Usage Progress */}
            {/* <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Monthly Usage
                </CardTitle>
                <CardDescription>
                  {user?.tier?.toUpperCase()} Plan - {userMetrics.limits.monthly === -1 ? 'Unlimited' : `${userMetrics.limits.monthly} analyses per month`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{userMetrics.usage.monthlyAnalysisCount} used</span>
                    <span>{userMetrics.limits.monthly === -1 ? 'Unlimited' : `${userMetrics.limits.remaining} remaining`}</span>
                  </div>
                  {userMetrics.limits.monthly !== -1 && (
                    <Progress value={getUsagePercentage()} className="h-2" />
                  )}
                </div>
              </CardContent>
            </Card> */}

            {/* Chains Analyzed */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Blockchain Networks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {userMetrics.overview.chainsAnalyzed.length > 0 ? (
                    userMetrics.overview.chainsAnalyzed.map((chain) => (
                      <Badge key={chain} variant="outline" className="capitalize">
                        {chain}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No chains analyzed yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Default Contract Summary */}
        {defaultContract && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Default Contract</h2>
            
            <Card>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Contract Info</h4>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p><strong>Address:</strong> {defaultContract.contract.address.slice(0, 10)}...</p>
                      <p><strong>Started:</strong> {formatDate(defaultContract.contract.startDate)}</p>
                      <p><strong>Analyses:</strong> {defaultContract.analysisHistory.completed} completed</p>
                    </div>
                  </div>
                  
                  {defaultContract.metrics && (
                    <div className="md:col-span-2">
                      <h4 className="font-medium mb-2">Latest Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {defaultContract.metrics.tvl && (
                          <div>
                            <p className="text-sm text-muted-foreground">TVL</p>
                            <p className="font-semibold">{formatCurrency(defaultContract.metrics.tvl)}</p>
                          </div>
                        )}
                        {defaultContract.metrics.volume && (
                          <div>
                            <p className="text-sm text-muted-foreground">Volume</p>
                            <p className="font-semibold">{formatCurrency(defaultContract.metrics.volume)}</p>
                          </div>
                        )}
                        {defaultContract.metrics.uniqueUsers && (
                          <div>
                            <p className="text-sm text-muted-foreground">Users</p>
                            <p className="font-semibold">{formatNumber(defaultContract.metrics.uniqueUsers)}</p>
                          </div>
                        )}
                        {defaultContract.metrics.transactions && (
                          <div>
                            <p className="text-sm text-muted-foreground">Transactions</p>
                            <p className="font-semibold">{formatNumber(defaultContract.metrics.transactions)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Analyses with Filters */}
        {userMetrics && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Recent Analyses</h2>
            
            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search analyses..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="competitive">Competitive</SelectItem>
                      <SelectItem value="comparative">Comparative</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={() => {
                    setSearchTerm("")
                    setStatusFilter("all")
                    setTypeFilter("all")
                  }}>
                    <Filter className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Analysis List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analysis History</CardTitle>
                    <CardDescription>
                      {filteredAnalyses.length} of {userMetrics.recentAnalyses.length} analyses shown
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/analyzer">
                      <Button>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        New Analysis
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAnalyses.length > 0 ? (
                  <div className="space-y-4">
                    {filteredAnalyses.map((analysis) => (
                      <div key={analysis.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            {getStatusBadge(analysis.status)}
                            <Badge variant="outline">{analysis.analysisType}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {analysis.chain}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Contract:</span>
                              <p className="text-muted-foreground">
                                {analysis.contractName || 
                                 (analysis.contractAddress ? 
                                  `${analysis.contractAddress.slice(0, 10)}...${analysis.contractAddress.slice(-8)}` :
                                  'N/A'
                                 )
                                }
                              </p>
                            </div>
                            
                            <div>
                              <span className="font-medium">Started:</span>
                              <p className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(analysis.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {analysis.status === 'completed' ? (
                            <Link href={`/analysis/${analysis.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                View Results
                              </Button>
                            </Link>
                          ) : analysis.status === 'failed' ? (
                            <Button variant="outline" size="sm" disabled>
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Failed
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              <Activity className="h-4 w-4 mr-2 animate-spin" />
                              {analysis.status}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      {userMetrics.recentAnalyses.length === 0 ? 'No analyses found' : 'No analyses match your filters'}
                    </p>
                    {userMetrics.recentAnalyses.length === 0 && (
                      <Link href="/analyzer">
                        <Button>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Start Your First Analysis
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}