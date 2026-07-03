'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/ui/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { Loader2, Zap, CreditCard, History, Info, Lock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/auth/auth-provider'

// ── AES-256-GCM encryption (matches Flutterwave v4 spec) ─────────────────
async function encryptAES(data: string, base64Key: string, nonce: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = new TextEncoder().encode(nonce)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
}

function randomNonce(len = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b => chars[b % chars.length]).join('')
}

// ── Card form ─────────────────────────────────────────────────────────────
function CardForm({ onCharge, loading }: { onCharge: (card: any, amount: number) => void; loading: boolean }) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')       // MM/YY
  const [cvv, setCvv] = useState('')
  const [amount, setAmount] = useState('10')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const [month, year] = expiry.split('/')
    onCharge({ cardNumber: cardNumber.replace(/\s/g, ''), expiryMonth: month?.trim(), expiryYear: year?.trim(), cvv }, parseFloat(amount))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="text-xs">Card Number</Label>
        <Input
          placeholder="4111 1111 1111 1111"
          value={cardNumber}
          onChange={e => setCardNumber(e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))}
          disabled={loading} required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Expiry (MM/YY)</Label>
          <Input placeholder="08/26" value={expiry}
            onChange={e => setExpiry(e.target.value.replace(/[^\d/]/g, '').slice(0, 5))}
            disabled={loading} required />
        </div>
        <div>
          <Label className="text-xs">CVV</Label>
          <Input placeholder="123" type="password" value={cvv}
            onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={loading} required />
        </div>
      </div>
      <div>
        <Label className="text-xs">Amount (USD)</Label>
        <Input type="number" min="1" step="5" value={amount}
          onChange={e => setAmount(e.target.value)} disabled={loading} required />
      </div>
      <Button type="submit" className="w-full gradient-brand text-white" disabled={loading}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : <><Lock className="h-4 w-4 mr-2" />Pay ${amount}</>}
      </Button>
      <p className="text-xs text-center text-muted-foreground">Card data encrypted before leaving your browser</p>
    </form>
  )
}

// ── PIN form (shown when bank requires PIN) ───────────────────────────────
function PinForm({ onSubmit, loading }: { onSubmit: (pin: string) => void; loading: boolean }) {
  const [pin, setPin] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(pin) }} className="space-y-3">
      <p className="text-sm text-muted-foreground">Your bank requires a PIN to complete this payment.</p>
      <Input type="password" placeholder="Enter PIN" maxLength={6}
        value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Submit PIN
      </Button>
    </form>
  )
}

// ── Main billing page ─────────────────────────────────────────────────────
function BillingPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [usage, setUsage]         = useState<any>(null)
  const [status, setStatus]       = useState<any>(null)
  const [txs, setTxs]             = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [charging, setCharging]   = useState(false)
  const [provider, setProvider]   = useState<'flutterwave' | 'paystack'>('flutterwave')
  // Flutterwave v4 state
  const [flwToken, setFlwToken]   = useState<string | null>(null)
  const [flwEncKey, setFlwEncKey] = useState<string | null>(null)
  const [pendingCharge, setPendingCharge] = useState<{ chargeId: string; amountUSD: number } | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/subscription')
  }, [authLoading, isAuthenticated, router])

  const load = async () => {
    try {
      const [u, t, s] = await Promise.all([
        api.billing.getUsage(),
        api.billing.getTransactions(),
        api.subscription.getStatus(),
      ])
      setUsage(u)
      setTxs(t.transactions || [])
      setStatus(s)
    } catch {
      toast({ title: 'Failed to load billing', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    load()
    if (searchParams.get('success') === '1') {
      toast({ title: 'Payment successful! Credits added.' })
      setTimeout(load, 2000)
    }
    if (searchParams.get('cancelled') === '1') {
      toast({ title: 'Payment cancelled', variant: 'destructive' })
    }
  }, [authLoading, isAuthenticated])

  // Pre-fetch FLW token when Flutterwave tab is selected
  useEffect(() => {
    if (provider !== 'flutterwave') return
    api.post('/api/billing/flw-token', {})
      .then((r: any) => { setFlwToken(r.token); setFlwEncKey(r.encryptionKey) })
      .catch(() => {}) // silently fall back — user will see error on submit
  }, [provider])

  const handleFlwCharge = async (card: any, amountUSD: number) => {
    if (!flwToken || !flwEncKey) {
      toast({ title: 'Flutterwave not ready. Try again.', variant: 'destructive' }); return
    }
    setCharging(true)
    try {
      const nonce = randomNonce(12)
      const [enc_number, enc_month, enc_year, enc_cvv] = await Promise.all([
        encryptAES(card.cardNumber,   flwEncKey, nonce),
        encryptAES(card.expiryMonth,  flwEncKey, nonce),
        encryptAES(card.expiryYear,   flwEncKey, nonce),
        encryptAES(card.cvv,          flwEncKey, nonce),
      ])

      const result: any = await api.post('/api/billing/flw-charge', {
        amount: amountUSD,
        currency: 'USD',
        encryptedCard: {
          encrypted_card_number:   enc_number,
          encrypted_expiry_month:  enc_month,
          encrypted_expiry_year:   enc_year,
          encrypted_cvv:           enc_cvv,
          nonce,
        },
      })

      if (result.status === 'success') {
        toast({ title: `$${amountUSD} added to your account!` })
        await load()
      } else if (result.status === 'redirect') {
        window.location.href = result.redirectUrl
      } else if (result.status === 'pin_required') {
        setPendingCharge({ chargeId: result.chargeId, amountUSD })
      } else {
        toast({ title: result.message || 'Charge failed', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setCharging(false)
    }
  }

  const handlePinSubmit = async (pin: string) => {
    if (!pendingCharge || !flwEncKey) return
    setCharging(true)
    try {
      const nonce = randomNonce(12)
      const encryptedPin = await encryptAES(pin, flwEncKey, nonce)
      const result: any = await api.post('/api/billing/flw-pin', {
        chargeId:     pendingCharge.chargeId,
        encryptedPin,
        nonce,
        amountUSD:    pendingCharge.amountUSD,
      })
      if (result.status === 'success') {
        toast({ title: `$${pendingCharge.amountUSD} added!` })
        setPendingCharge(null)
        await load()
      } else if (result.status === 'redirect') {
        window.location.href = result.redirectUrl
      } else {
        toast({ title: result.message || 'PIN failed', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setCharging(false)
    }
  }

  const handlePaystackTopup = async (amount: number) => {
    setCharging(true)
    try {
      const result: any = await api.post('/api/billing/checkout', { amount })
      if (result.url) window.location.href = result.url
      else toast({ title: 'Paystack not configured', variant: 'destructive' })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setCharging(false)
    }
  }

  if (loading) return (
    <div className="page-shell"><Header />
      <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    </div>
  )

  const p = usage?.pricing || {}
  const freeAnalyses  = p.freeAnalyses  ?? 3
  const freeAiQueries = p.freeAiQueries ?? 3

  return (
    <div className="page-shell">
      <Header />
      <div className="page-container max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Billing</h1>
            <div className="flex items-center gap-2">
              {status?.state === 'paid' ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-0 px-3 py-1">
                  Paid — credits active
                </Badge>
              ) : status?.canContinue === false ? (
                <Badge variant="destructive" className="px-3 py-1">
                  Quota exhausted — top up to continue
                </Badge>
              ) : (
                <Badge variant="secondary" className="px-3 py-1">
                  Free plan
                </Badge>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Pay-as-you-go — {status?.freeRemaining?.analyses ?? 0} free analyses left this month
            {status?.resetsOn && (
              <span className="ml-1">· resets {new Date(status.resetsOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Balance + Top-up */}
          <Card className="md:col-span-1">
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Current Balance</CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">${(usage?.balance || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Est. bill this month: <strong>${usage?.estimatedBill ?? '0.00'}</strong></p>
              <Separator className="my-4" />

              {/* Provider selector */}
              <div className="flex gap-2 mb-4">
                {(['flutterwave', 'paystack'] as const).map(p => (
                  <button key={p} onClick={() => setProvider(p)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      provider === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}>
                    {p === 'flutterwave' ? 'Card (FLW)' : 'Paystack'}
                  </button>
                ))}
              </div>

              {provider === 'flutterwave' ? (
                pendingCharge ? (
                  <PinForm onSubmit={handlePinSubmit} loading={charging} />
                ) : (
                  <CardForm onCharge={handleFlwCharge} loading={charging} />
                )
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input type="number" min="1" step="5" defaultValue="10" id="ps-amount" className="w-24" />
                    <Button onClick={() => {
                      const amt = parseFloat((document.getElementById('ps-amount') as HTMLInputElement).value)
                      handlePaystackTopup(amt)
                    }} disabled={charging} size="sm" className="flex-1">
                      {charging ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Top Up'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Redirects to Paystack checkout</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage this month */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <Zap className="h-4 w-4" /> Usage This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Analyses</span>
                  <span>{usage?.analysesThisMonth ?? 0} / {freeAnalyses} free
                    {(usage?.billableAnalyses ?? 0) > 0 && <span className="text-orange-500 ml-1">(+{usage.billableAnalyses} billable)</span>}
                  </span>
                </div>
                <Progress value={Math.min(100, ((usage?.analysesThisMonth ?? 0) / freeAnalyses) * 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-0.5">{usage?.freeRemaining?.analyses ?? freeAnalyses} free remaining</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>AI Queries</span>
                  <span>{usage?.aiQueriesThisMonth ?? 0} / {freeAiQueries} free
                    {(usage?.billableAiQueries ?? 0) > 0 && <span className="text-orange-500 ml-1">(+{usage.billableAiQueries} billable)</span>}
                  </span>
                </div>
                <Progress value={Math.min(100, ((usage?.aiQueriesThisMonth ?? 0) / freeAiQueries) * 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-0.5">{usage?.freeRemaining?.aiQueries ?? freeAiQueries} free remaining</p>
              </div>
              {(usage?.estimatedBill ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                  {usage.billableAnalyses} analyses × ${p.perAnalysis}
                  {usage.billableAiQueries > 0 && ` + ${usage.billableAiQueries} AI × $${p.perAiQuery}`}
                  {' = '}<strong>${usage.estimatedBill}</strong>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pricing table */}
        <Card className="mb-8">
          <CardHeader><CardTitle className="text-sm flex items-center gap-1"><Info className="h-4 w-4" /> Current Rates</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Per Analysis',       value: `$${p.perAnalysis ?? '0.10'}`,         sub: `First ${freeAnalyses}/mo free` },
                { label: 'Per AI Query',        value: `$${p.perAiQuery ?? '0.05'}`,          sub: `First ${freeAiQueries}/mo free` },
                { label: 'Contract Monitoring', value: `$${p.perContractMonth ?? '3.00'}/mo`, sub: `First ${p.freeContracts ?? 1} free` },
                { label: 'Alert Email',         value: `$${p.perAlertEmail ?? '0.01'}`,       sub: 'Per delivery' },
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
                  <div key={i} className="flex items-start sm:items-center justify-between gap-2 text-sm py-1 border-b last:border-0">
                    <div className="min-w-0">
                      <span className="font-medium capitalize">{tx.action.replace(/_/g, ' ')}</span>
                      {tx.quantity > 1 && <span className="text-muted-foreground ml-1">×{tx.quantity}</span>}
                      <span className="text-muted-foreground ml-2 text-xs">{new Date(tx.at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
