"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, AlertCircle } from 'lucide-react'
import { FunctionSignatureTable } from './function-signature-table'
import { UserJourneyFlow } from './user-journey-flow'
import { CohortAnalysisTable } from './cohort-analysis-table'
import { WalletAnalyticsTab } from './wallet-analytics-tab'

interface FunctionsTabProps {
  contractAddress: string
  chain: string
}

export function FunctionsTab({ contractAddress, chain }: FunctionsTabProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="signatures">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="journeys">User Journeys</TabsTrigger>
          <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="signatures" className="space-y-4">
          <FunctionSignatureTable contractAddress={contractAddress} chain={chain} />
        </TabsContent>

        <TabsContent value="journeys" className="space-y-4">
          <UserJourneyFlow contractAddress={contractAddress} chain={chain} />
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-4">
          <CohortAnalysisTable contractAddress={contractAddress} chain={chain} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <WalletAnalyticsTab contractAddress={contractAddress} chain={chain} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
