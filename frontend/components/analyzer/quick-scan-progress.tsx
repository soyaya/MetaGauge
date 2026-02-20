"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Clock, Database, Users, Blocks, Calendar } from "lucide-react"
import { api } from "@/lib/api"

interface QuickScanProgress {
  step: string
  progress: number
  message: string
  timestamp: string
  transactions?: number
  events?: number
  accounts?: number
  blocks?: number
  deploymentDate?: string
  deploymentBlock?: number
}

interface QuickScanProps {
  contractAddress: string
  chain: string
  contractName?: string
  onComplete?: (results: any) => void
}

export function QuickScanProgress({ contractAddress, chain, contractName = "Contract", onComplete }: QuickScanProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string>("")
  const [message, setMessage] = useState<string>("")
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle")
  const [results, setResults] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [metrics, setMetrics] = useState<QuickScanProgress | null>(null)

  // Poll for progress updates
  useEffect(() => {
    if (!analysisId || status === "completed" || status === "failed") return

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/analysis/${analysisId}/status`)
        const data = response.data

        setProgress(data.progress || 0)
        setStatus(data.status)
        setLogs(data.logs || [])

        if (data.metadata) {
          setCurrentStep(data.metadata.currentStep || "")
          setMessage(data.metadata.message || "")
          setMetrics(data.metadata)
        }

        if (data.status === "completed") {
          setResults(data.results)
          if (onComplete) {
            onComplete(data.results)
          }
        }

      } catch (error) {
        console.error("Failed to fetch progress:", error)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [analysisId, status, onComplete])

  const startQuickScan = async () => {
    try {
      setIsScanning(true)
      setStatus("running")
      setProgress(0)
      setLogs([])
      setResults(null)

      const response = await api.post("/analysis/quick-scan", {
        contractAddress,
        chain,
        contractName
      })

      setAnalysisId(response.data.analysisId)

    } catch (error: any) {
      console.error("Failed to start quick scan:", error)
      setStatus("failed")
      setMessage(error.message || "Failed to start quick scan")
    }
  }

  const getStepIcon = (step: string) => {
    switch (step) {
      case "init":
        return <Clock className="h-4 w-4" />
      case "fetching":
        return <Database className="h-4 w-4" />
      case "processing":
        return <Users className="h-4 w-4" />
      case "deployment":
        return <Calendar className="h-4 w-4" />
      case "complete":
        return <CheckCircle2 className="h-4 w-4" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case "running":
        return <Badge variant="default" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Scanning</Badge>
      case "completed":
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" /> Complete</Badge>
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>
      default:
        return <Badge variant="outline">Ready</Badge>
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quick Scan Progress</CardTitle>
            <CardDescription>
              Scanning {contractName} on {chain}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Start Button */}
        {status === "idle" && (
          <Button onClick={startQuickScan} className="w-full">
            Start Quick Scan
          </Button>
        )}

        {/* Progress Bar */}
        {status === "running" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {getStepIcon(currentStep)}
                <span className="font-medium">{message || "Processing..."}</span>
              </div>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Real-time Metrics */}
        {metrics && status === "running" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.transactions !== undefined && (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{metrics.transactions}</div>
                <div className="text-xs text-muted-foreground">Transactions</div>
              </div>
            )}
            {metrics.events !== undefined && (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{metrics.events}</div>
                <div className="text-xs text-muted-foreground">Events</div>
              </div>
            )}
            {metrics.accounts !== undefined && (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{metrics.accounts}</div>
                <div className="text-xs text-muted-foreground">Accounts</div>
              </div>
            )}
            {metrics.blocks !== undefined && (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{metrics.blocks}</div>
                <div className="text-xs text-muted-foreground">Blocks</div>
              </div>
            )}
          </div>
        )}

        {/* Deployment Info */}
        {metrics?.deploymentDate && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Deployment Detected
            </div>
            <div className="text-sm text-muted-foreground">
              <div>Date: {new Date(metrics.deploymentDate).toLocaleString()}</div>
              {metrics.deploymentBlock && <div>Block: {metrics.deploymentBlock.toLocaleString()}</div>}
            </div>
          </div>
        )}

        {/* Completion Summary */}
        {status === "completed" && results && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
                <CheckCircle2 className="h-5 w-5" />
                Scan Complete!
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-bold text-lg">{results.summary?.transactionsFound || 0}</div>
                  <div className="text-muted-foreground">Transactions</div>
                </div>
                <div>
                  <div className="font-bold text-lg">{results.summary?.eventsFound || 0}</div>
                  <div className="text-muted-foreground">Events</div>
                </div>
                <div>
                  <div className="font-bold text-lg">{results.summary?.accountsFound || 0}</div>
                  <div className="text-muted-foreground">Accounts</div>
                </div>
                <div>
                  <div className="font-bold text-lg">{results.summary?.duration || "N/A"}</div>
                  <div className="text-muted-foreground">Duration</div>
                </div>
              </div>
            </div>

            {results.contract?.deployment?.found && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium mb-2">Deployment Information</div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>Date: {new Date(results.contract.deployment.date).toLocaleString()}</div>
                  <div>Block: {results.contract.deployment.blockNumber.toLocaleString()}</div>
                  <div className="truncate">Deployer: {results.contract.deployment.deployer}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {status === "failed" && (
          <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium mb-2">
              <XCircle className="h-5 w-5" />
              Scan Failed
            </div>
            <div className="text-sm text-muted-foreground">{message}</div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Activity Log</div>
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-muted-foreground font-mono bg-muted p-3 rounded">
              {logs.slice(-10).map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
