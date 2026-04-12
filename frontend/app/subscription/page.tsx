'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/ui/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { Loader2, Zap, CreditCard, History, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/auth/auth-provider'

function BillingPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [usage, setUsage]       = useState<any>(null)
  const [txs, setTxs]           = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [topupAmt, setTopupAmt] = useState('10')
  const [topping, setTopping]   = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/subscription')
    }
  }, [authLoading, isAuthenticated, router])

  const load = async () => {
    try {
      const [u, t] = await Promise.all([
        api.get('/api/billing/usage'),
        api.get('/api/billing/transactions'),
      ])
      setUsage(u)
      setTxs(t.transactions || [])
    } catch (e: any) {
      toast({ title: 'Failed to load billing', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (searchParams.get('success') === '1') {
      toast({ title: '✅ Payment successful! Credits added to your account.' })
    }
    if (searchParams.get('cancelled') === '1') {
      toast({ title: 'Payment cancelled', variant: 'destructive' })
    }
  }, [])

  const handleTopup = async () => {
    const amt = parseFloat(topupAmt)
    if (!amt || amt < 1) {
      toast({ title: 'Minimum top-up is $1', variant: 'destructive' })
      return
    }
    setTopping(true)
    try {
      const result = await api.post('/api/billing/checkout', { amount: amt })
      if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url
      } else {
        toast({ title: 'Stripe not configured', description: 'Set STRIPE_SECRET_KEY in .env', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setTopping(false)
    }
  }

  if (loading) return (
    <div className="page-shell">
      <Header />
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )

  const p = usage?.pricing || {}

  return (
    <div className="page-shell">
      <Header />
      <div className="page-container max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Billing</h1>
          <p className="text-muted-foreground mt-1">Pay-as-you-go — only pay for what you use</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Balance */}
          <Card className="md:col-span-1">
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Current Balance</CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">${(usage?.balance || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Est. bill this month: <strong>${usage?.estimatedBill || 0}</strong></p>
              <Separator className="my-4" />
              <div className="flex gap-2">
                <Input
                  type="number" min="1" step="5"
                  value={topupAmt}
                  onChange={e => setTopupAmt(e.target.value)}
                  className="w-24"
                />
                <Button onClick={handleTopup} disabled={topping} size="sm" className="flex-1">
                  {topping ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Top Up'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Powered by Stripe — secure card payment</p>
            </CardContent>
          </Card>

          {/* Usage this month */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Zap className="h-4 w-4" /> Usage This Month</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Analyses</span>
                  <span>{usage?.analysesThisMonth || 0} <span className="text-muted-foreground">({usage?.freeRemaining?.analyses || 0} free left)</span></span>
                </div>
                <Progress value={Math.min(100, ((usage?.analysesThisMonth || 0) / (p.freeAnalyses || 10)) * 100)} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>AI Queries</span>
                  <span>{usage?.aiQueriesThisMonth || 0} <span className="text-muted-foreground">({usage?.freeRemaining?.aiQueries || 0} free left)</span></span>
                </div>
                <Progress value={Math.min(100, ((usage?.aiQueriesThisMonth || 0) / (p.freeAiQueries || 3)) * 100)} className="h-2" />
              </div>
              <div className="text-xs text-muted-foreground">
                Billable: {usage?.billableAnalyses || 0} analyses × ${p.perAnalysis} + {usage?.billableAiQueries || 0} AI queries × ${p.perAiQuery}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing table */}
        <Card className="mb-8">
          <CardHeader><CardTitle className="text-sm flex items-center gap-1"><Info className="h-4 w-4" /> Current Rates</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Per Analysis',         value: `$${p.perAnalysis}`,      sub: `First ${p.freeAnalyses}/mo free` },
                { label: 'Per AI Query',          value: `$${p.perAiQuery}`,       sub: `First ${p.freeAiQueries}/mo free` },
                { label: 'Contract Monitoring',   value: `$${p.perContractMonth}/mo`, sub: `First ${p.freeContracts} free` },
                { label: 'Alert Email',           value: `$${p.perAlertEmail}`,    sub: 'Per delivery' },
              ].map(r => (
                <div key={r.label} className="p-3 bg-muted/40 rounded-lg">
                  <p className="font-semibold">{r.value}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{r.label}</p>
                  <p className="text-muted-foreground text-xs">{r.sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction history */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-1"><History className="h-4 w-4" /> Transaction History</CardTitle></CardHeader>
          <CardContent>
            {txs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {txs.slice(0, 20).map((tx, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <div>
                      <span className="font-medium capitalize">{tx.action.replace(/_/g, ' ')}</span>
                      {tx.quantity > 1 && <span className="text-muted-foreground ml-1">×{tx.quantity}</span>}
                      <span className="text-muted-foreground ml-2 text-xs">{new Date(tx.at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={tx.action === 'topup' ? 'default' : 'secondary'}>
                        {tx.action === 'topup' ? `+$${Math.abs(tx.cost)}` : tx.cost === 0 ? 'Free' : `-$${tx.cost}`}
                      </Badge>
                      <span className="text-muted-foreground text-xs">${tx.balance} bal</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function BillingPageWrapper() {
  return (
    <Suspense fallback={<div className="page-shell"><Header /></div>}>
      <BillingPage />
    </Suspense>
  )
}
