"use client"

/**
 * Cohort Analysis Table Component
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface CohortData {
  cohortId: string
  cohortDate: string
  cohortPeriod: string
  walletCount: number
  activationRate?: number
  churnRate?: number
  retentionRates?: {
    day1?: number
    day7?: number
    day30?: number
    day90?: number
  }
}

interface CohortAnalysisTableProps {
  contractAddress: string
  chain: string
}

export function CohortAnalysisTable({ contractAddress, chain }: CohortAnalysisTableProps) {
  const [cohorts, setCohorts] = useState<CohortData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metricType, setMetricType] = useState<'activation' | 'retention' | 'churn'>('activation')
  const [cohortPeriod, setCohortPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')

  useEffect(() => {
    loadCohorts()
  }, [contractAddress, chain, metricType, cohortPeriod])

  const loadCohorts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      const response = await fetch(
        `${API_BASE}/api/functions/cohorts?contractAddress=${encodeURIComponent(contractAddress)}&chain=${encodeURIComponent(chain)}&metricType=${metricType}&cohortPeriod=${cohortPeriod}`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
      )
      
      if (!response.ok) throw new Error(`Failed to load cohorts (${response.status})`)
      
      const data = await response.json()
      setCohorts(Array.isArray(data) ? data : [])
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
          <div className="flex items-center justify-center h-32">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cohort Analysis</CardTitle>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Metric</label>
            <Select value={metricType} onValueChange={(v: any) => setMetricType(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activation">Activation</SelectItem>
                <SelectItem value="retention">Retention</SelectItem>
                <SelectItem value="churn">Churn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Period</label>
            <Select value={cohortPeriod} onValueChange={(v: any) => setCohortPeriod(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {cohorts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 px-4">No cohort data available</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Cohort</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Wallets</TableHead>
                  {metricType === 'activation' && (
                    <TableHead className="text-right whitespace-nowrap">Activation</TableHead>
                  )}
                  {metricType === 'churn' && (
                    <TableHead className="text-right whitespace-nowrap">Churn</TableHead>
                  )}
                  {metricType === 'retention' && (
                    <>
                      <TableHead className="text-right whitespace-nowrap">D1</TableHead>
                      <TableHead className="text-right whitespace-nowrap">D7</TableHead>
                      <TableHead className="text-right whitespace-nowrap">D30</TableHead>
                      <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">D90</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map((cohort) => (
                  <TableRow key={cohort.cohortId}>
                    <TableCell className="whitespace-nowrap text-sm">{cohort.cohortId}</TableCell>
                    <TableCell className="text-right tabular-nums">{cohort.walletCount.toLocaleString()}</TableCell>
                    {metricType === 'activation' && (
                      <TableCell className="text-right tabular-nums">
                        {((cohort.activationRate || 0) * 100).toFixed(1)}%
                      </TableCell>
                    )}
                    {metricType === 'churn' && (
                      <TableCell className="text-right tabular-nums">
                        {((cohort.churnRate || 0) * 100).toFixed(1)}%
                      </TableCell>
                    )}
                    {metricType === 'retention' && cohort.retentionRates && (
                      <>
                        <TableCell className="text-right tabular-nums">{((cohort.retentionRates.day1 || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right tabular-nums">{((cohort.retentionRates.day7 || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right tabular-nums">{((cohort.retentionRates.day30 || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right tabular-nums hidden sm:table-cell">{((cohort.retentionRates.day90 || 0) * 100).toFixed(1)}%</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
