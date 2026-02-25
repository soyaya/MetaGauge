"use client"

/**
 * User Journey Flow Component
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

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

export function UserJourneyFlow({ contractAddress, chain }: UserJourneyFlowProps) {
  const [flow, setFlow] = useState<FlowVisualization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFlow()
  }, [contractAddress, chain])

  const loadFlow = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(
        `/api/functions/journeys/flow?contractAddress=${contractAddress}&chain=${chain}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to load flow')
      }
      
      const data = await response.json()
      setFlow(data)
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
          <p className="text-muted-foreground text-center">No journey data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Journey Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Entry Points</h3>
              <div className="flex flex-wrap gap-2">
                {flow.nodes.filter(n => n.isEntryPoint).map(node => (
                  <div key={node.id} className="px-3 py-1 bg-green-100 dark:bg-green-900 rounded-md text-sm">
                    <div className="font-medium">{node.name || 'Unknown'}</div>
                    <div className="text-xs opacity-75">{node.signature}</div>
                    <div className="text-xs">{node.walletCount} wallets</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Drop-off Points</h3>
              <div className="flex flex-wrap gap-2">
                {flow.nodes.filter(n => n.isDropOff).map(node => (
                  <div key={node.id} className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded-md text-sm">
                    <div className="font-medium">{node.name || 'Unknown'}</div>
                    <div className="text-xs opacity-75">{node.signature}</div>
                    <div className="text-xs">{node.walletCount} wallets</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Transitions</h3>
              <div className="space-y-2">
                {flow.edges.slice(0, 10).map((edge, idx) => {
                  const sourceNode = flow.nodes.find(n => n.signature === edge.source);
                  const targetNode = flow.nodes.find(n => n.signature === edge.target);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{sourceNode?.name || edge.source}</span>
                      <span>→</span>
                      <span className="font-medium">{targetNode?.name || edge.target}</span>
                      <span className="text-muted-foreground">
                        ({edge.walletCount} wallets, {(edge.transitionRate * 100).toFixed(1)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
