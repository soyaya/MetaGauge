"use client"

/**
 * User Journey Flow Component
 * Requirements: 6.1, 6.2, 6.3, 6.5
 *
 * Visualises how cohorts of wallets move through contract functions —
 * entry points, step-by-step transitions, and where users drop off —
 * in plain language so product/business decisions can be made directly.
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingDown, TrendingUp, ArrowDown, Users, LogIn, LogOut } from 'lucide-react'

interface FlowNode {
  id: string
  signature: string
  name?: string
  walletCount: number
  isEntryPoint: boolean
  isDropOff: boolean
}

interface FlowEdge {
  source: string
  target: string
  walletCount: number
  transitionRate: number
}

interface FlowVisualization {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

interface UserJourneyFlowProps {
  contractAddress: string
  chain: string
}

/** Build an ordered list of funnel steps from nodes + edges */
function buildFunnelSteps(nodes: FlowNode[], edges: FlowEdge[]) {
  // Start from entry points, walk the graph in order of walletCount desc
  const entryNodes = nodes.filter(n => n.isEntryPoint).sort((a, b) => b.walletCount - a.walletCount)
  const visited = new Set<string>()
  const steps: Array<{
    node: FlowNode
    incomingEdge: FlowEdge | null
    outgoingEdges: FlowEdge[]
    dropOffCount: number
    dropOffRate: number
  }> = []

  const walk = (node: FlowNode, incomingEdge: FlowEdge | null) => {
    if (visited.has(node.signature)) return
    visited.add(node.signature)

    const outgoing = edges
      .filter(e => e.source === node.signature)
      .sort((a, b) => b.walletCount - a.walletCount)

    const walletsContinuing = outgoing.reduce((s, e) => s + e.walletCount, 0)
    const dropOffCount = Math.max(0, node.walletCount - walletsContinuing)
    const dropOffRate = node.walletCount > 0 ? dropOffCount / node.walletCount : 0

    steps.push({ node, incomingEdge, outgoingEdges: outgoing, dropOffCount, dropOffRate })

    // Walk the most-travelled path first
    for (const edge of outgoing) {
      const nextNode = nodes.find(n => n.signature === edge.target)
      if (nextNode) walk(nextNode, edge)
    }
  }

  for (const entry of entryNodes) walk(entry, null)

  // Append any nodes not yet visited (disconnected sub-paths)
  for (const node of nodes) {
    if (!visited.has(node.signature)) {
      const outgoing = edges.filter(e => e.source === node.signature)
      const walletsContinuing = outgoing.reduce((s, e) => s + e.walletCount, 0)
      const dropOffCount = Math.max(0, node.walletCount - walletsContinuing)
      const dropOffRate = node.walletCount > 0 ? dropOffCount / node.walletCount : 0
      steps.push({ node, incomingEdge: null, outgoingEdges: outgoing, dropOffCount, dropOffRate })
    }
  }

  return steps
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`
}

function dropOffLabel(rate: number) {
  if (rate >= 0.5) return { label: 'High drop-off', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' }
  if (rate >= 0.25) return { label: 'Moderate drop-off', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' }
  return { label: 'Low drop-off', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' }
}

export function UserJourneyFlow({ contractAddress, chain }: UserJourneyFlowProps) {
  const [flow, setFlow] = useState<FlowVisualization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadFlow() }, [contractAddress, chain])

  const loadFlow = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      const res = await fetch(
        `${API_BASE}/api/functions/journeys/flow?contractAddress=${encodeURIComponent(contractAddress)}&chain=${encodeURIComponent(chain)}`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
      )
      if (!res.ok) throw new Error(`Failed to load flow (${res.status})`)
      setFlow(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!flow || flow.nodes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No journey data available yet</p>
        </CardContent>
      </Card>
    )
  }

  const steps = buildFunnelSteps(flow.nodes, flow.edges)
  const totalEntryWallets = flow.nodes.filter(n => n.isEntryPoint).reduce((s, n) => s + n.walletCount, 0)
  const totalDropOffNodes = flow.nodes.filter(n => n.isDropOff).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Journey Flow
        </CardTitle>
        <CardDescription>
          How wallets move through your contract — from first interaction to exit.
          Use this to spot where users get stuck or leave.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-500 mb-1">
              <LogIn className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Entered</span>
            </div>
            <div className="text-2xl font-bold">{fmt(totalEntryWallets)}</div>
            <div className="text-xs text-muted-foreground">unique wallets</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
              <ArrowDown className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Steps</span>
            </div>
            <div className="text-2xl font-bold">{steps.length}</div>
            <div className="text-xs text-muted-foreground">function interactions</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
              <LogOut className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Exit Points</span>
            </div>
            <div className="text-2xl font-bold">{totalDropOffNodes}</div>
            <div className="text-xs text-muted-foreground">where users leave</div>
          </div>
        </div>

        {/* Funnel steps */}
        <div className="space-y-1">
          {steps.map((step, idx) => {
            const { node, incomingEdge, outgoingEdges, dropOffCount, dropOffRate } = step
            const barWidth = totalEntryWallets > 0 ? Math.max(8, (node.walletCount / totalEntryWallets) * 100) : 100
            const { label: dropLabel, color: dropColor, bg: dropBg } = dropOffLabel(dropOffRate)
            const isEntry = node.isEntryPoint
            const isExit = node.isDropOff

            return (
              <div key={node.id}>
                {/* Connector arrow from previous step */}
                {incomingEdge && (
                  <div className="flex items-center gap-3 py-1 pl-4">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-border" />
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{fmt(incomingEdge.walletCount)} wallets</span>
                      {' '}continued ({pct(incomingEdge.transitionRate)} of previous step)
                    </span>
                  </div>
                )}

                {/* Step card */}
                <div className={`rounded-lg border p-4 ${dropBg}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-muted-foreground font-mono">Step {idx + 1}</span>
                        {isEntry && (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-400 text-xs">
                            Entry Point
                          </Badge>
                        )}
                        {isExit && (
                          <Badge variant="outline" className="text-red-500 border-red-400 text-xs">
                            Exit Point
                          </Badge>
                        )}
                      </div>
                      <div className="font-semibold text-sm">{node.name || 'Unknown Function'}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{node.signature}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold">{fmt(node.walletCount)}</div>
                      <div className="text-xs text-muted-foreground">wallets here</div>
                    </div>
                  </div>

                  {/* Visual funnel bar */}
                  <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Drop-off insight */}
                  {dropOffCount > 0 && (
                    <div className={`flex items-center gap-2 text-xs ${dropColor}`}>
                      <TrendingDown className="h-3 w-3 shrink-0" />
                      <span>
                        <span className="font-semibold">{fmt(dropOffCount)} wallets ({pct(dropOffRate)})</span>
                        {' '}left after this step — {dropLabel.toLowerCase()}
                        {dropOffRate >= 0.5 && '. Consider simplifying this interaction.'}
                        {dropOffRate >= 0.25 && dropOffRate < 0.5 && '. Worth investigating UX friction here.'}
                      </span>
                    </div>
                  )}

                  {/* Onward paths */}
                  {outgoingEdges.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="text-xs text-muted-foreground mb-1 font-medium">Users who continued went to:</div>
                      <div className="space-y-1">
                        {outgoingEdges.slice(0, 3).map((edge, ei) => {
                          const targetNode = flow.nodes.find(n => n.signature === edge.target)
                          return (
                            <div key={ei} className="flex items-center gap-2 text-xs">
                              <TrendingUp className="h-3 w-3 text-blue-400 shrink-0" />
                              <span className="font-medium">{targetNode?.name || edge.target}</span>
                              <span className="text-muted-foreground">
                                — {fmt(edge.walletCount)} wallets ({pct(edge.transitionRate)})
                              </span>
                            </div>
                          )
                        })}
                        {outgoingEdges.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{outgoingEdges.length - 3} more paths</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-950 border border-emerald-300" />
            Low drop-off (&lt;25%)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-950 border border-amber-300" />
            Moderate drop-off (25–50%)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-950 border border-red-300" />
            High drop-off (&gt;50%)
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
