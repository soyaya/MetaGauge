"use client"

/**
 * Function Signature Table Component
 * Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.4, 7.2, 7.3, 8.2, 8.3, 9.2
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface FunctionSignature {
  signature: string
  name?: string
  walletCount: number
  transactionCount: number
  avgTransactionsPerWallet: number
}

interface FunctionSignatureTableProps {
  contractAddress: string
  chain: string
}

export function FunctionSignatureTable({ contractAddress, chain }: FunctionSignatureTableProps) {
  const [signatures, setSignatures] = useState<FunctionSignature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSignatures()
  }, [contractAddress, chain])

  const loadSignatures = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      const response = await fetch(
        `${API_BASE}/api/functions/signatures?contractAddress=${encodeURIComponent(contractAddress)}&chain=${encodeURIComponent(chain)}`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
      )
      
      if (!response.ok) throw new Error(`Failed to load signatures (${response.status})`)
      
      const data = await response.json()
      setSignatures(Array.isArray(data) ? data : [])
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

  if (signatures.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            No function signatures found yet. Data will appear after indexing completes.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Function Signatures</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead className="text-right whitespace-nowrap">Wallets</TableHead>
                <TableHead className="text-right whitespace-nowrap">Txs</TableHead>
                <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">Avg Txs/Wallet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signatures.map((sig) => (
                <TableRow key={sig.signature}>
                  <TableCell>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-sm truncate">{sig.name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px] sm:max-w-none">{sig.signature}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{sig.walletCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{sig.transactionCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">{sig.avgTransactionsPerWallet.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
