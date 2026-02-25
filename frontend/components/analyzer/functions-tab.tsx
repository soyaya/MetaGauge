"use client"

/**
 * Functions Tab Component
 * Requirements: 1.1, 1.2, 1.3
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, AlertCircle } from 'lucide-react'
import { FunctionSignatureTable } from './function-signature-table'
import { UserJourneyFlow } from './user-journey-flow'
import { CohortAnalysisTable } from './cohort-analysis-table'

interface FunctionsTabProps {
  contractAddress: string
  chain: string
}

export function FunctionsTab({ contractAddress, chain }: FunctionsTabProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('signatures')

  useEffect(() => {
    // Initial load
    setLoading(false)
  }, [contractAddress, chain])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Function Signature Analytics</CardTitle>
          <CardDescription>
            Analyze function signature interactions, user journeys, and cohort metrics
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="journeys">User Journeys</TabsTrigger>
          <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
        </TabsList>

        <TabsContent value="signatures" className="space-y-4">
          <FunctionSignatureTable 
            contractAddress={contractAddress}
            chain={chain}
          />
        </TabsContent>

        <TabsContent value="journeys" className="space-y-4">
          <UserJourneyFlow 
            contractAddress={contractAddress}
            chain={chain}
          />
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-4">
          <CohortAnalysisTable 
            contractAddress={contractAddress}
            chain={chain}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
