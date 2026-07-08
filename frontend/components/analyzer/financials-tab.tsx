'use client'

import { useState, useEffect, useRef } from 'react'
import { financialApi } from '@/lib/api'
import { researchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle2,
  Send, Download, RefreshCw, ChevronDown, Bot, Loader2, FileText
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface FinancialTabProps {
  contractAddress: string
  chain: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: any, decimals = 0) => {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
const usd = (n: any) => {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `($${str})` : `$${str}`
}
const pct = (n: any) => n != null && !isNaN(n) ? `${Number(n).toFixed(1)}%` : '—'

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${positive === true ? 'text-green-700' : positive === false ? 'text-red-700' : ''}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function TableRow({ label, value, indent = 0, subtotal = false }: {
  label: string; value: string; indent?: number; subtotal?: boolean
}) {
  const isNeg = value.startsWith('(')
  return (
    <tr className={subtotal ? 'bg-muted/30 font-semibold' : ''}>
      <td className={`py-1.5 px-3 text-sm ${subtotal ? 'font-semibold' : 'text-muted-foreground'}`}
          style={{ paddingLeft: `${12 + indent * 16}px` }}>
        {label}
      </td>
      <td className={`py-1.5 px-3 text-sm text-right font-mono ${isNeg ? 'text-red-600' : subtotal ? '' : ''}`}>
        {value}
      </td>
    </tr>
  )
}

function FinancialTable({ title, rows }: { title?: string; rows: { label: string; value: string; indent?: number; subtotal?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border mb-4">
      {title && <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>}
      <table className="w-full">
        <tbody>
          {rows.map((r, i) => <TableRow key={i} {...r} />)}
        </tbody>
      </table>
    </div>
  )
}

function CFOCommentary({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-4 w-4 text-blue-600" />
        <span className="text-xs font-semibold text-blue-700">CFO Commentary</span>
      </div>
      <p className="text-sm text-blue-900 leading-relaxed">{text}</p>
    </div>
  )
}
// ── Document sub-tab components ────────────────────────────────────────────

function PLTab({ docs }: { docs: any }) {
  const pl = docs?.income_statement
  if (!pl) return <div className="p-4 text-sm text-muted-foreground">Income statement not available.</div>
  return (
    <div className="space-y-2">
      <FinancialTable title="Revenue" rows={[
        { label: 'Protocol Revenue', value: usd(pl.revenue?.protocol_revenue), indent: 1 },
        { label: 'Token Revenue', value: usd(pl.revenue?.token_revenue), indent: 1 },
        { label: 'Off-chain Revenue', value: usd(pl.revenue?.off_chain_revenue), indent: 1 },
        { label: 'Total Revenue', value: usd(pl.revenue?.total_revenue), subtotal: true },
      ]} />
      <FinancialTable title="Cost of Revenue" rows={[
        { label: 'Gas Subsidies', value: usd(pl.cost_of_revenue?.gas_subsidies), indent: 1 },
        { label: 'Infrastructure', value: usd(pl.cost_of_revenue?.infrastructure), indent: 1 },
        { label: 'Total COGS', value: usd(pl.cost_of_revenue?.total_cogs), subtotal: true },
        { label: 'Gross Profit', value: usd(pl.gross_profit), subtotal: true },
        { label: 'Gross Margin %', value: pct(pl.gross_margin_pct) },
      ]} />
      <FinancialTable title="Operating Expenses" rows={[
        { label: 'Marketing & Advertising', value: usd(pl.operating_expenses?.marketing), indent: 1 },
        { label: 'Payroll', value: usd(pl.operating_expenses?.payroll), indent: 1 },
        { label: 'Legal & Audit', value: usd(pl.operating_expenses?.legal_audit), indent: 1 },
        { label: 'Other Operating', value: usd(pl.operating_expenses?.other), indent: 1 },
        { label: 'Total OpEx', value: usd(pl.operating_expenses?.total_opex), subtotal: true },
      ]} />
      <FinancialTable title="Profitability" rows={[
        { label: 'EBITDA', value: usd(pl.ebitda), subtotal: true },
        { label: 'Net Profit / Loss', value: usd(pl.net_profit), subtotal: true },
        { label: 'Net Margin %', value: pct(pl.net_margin_pct) },
      ]} />
      <FinancialTable title="Per-Transaction Economics" rows={[
        { label: 'Total Transactions', value: fmt(pl.per_transaction?.total_transactions), indent: 1 },
        { label: 'Revenue per Tx', value: usd(pl.per_transaction?.revenue_per_tx), indent: 1 },
        { label: 'Cost per Tx', value: usd(pl.per_transaction?.cost_per_tx), indent: 1 },
        { label: 'Profit per Tx', value: usd(pl.per_transaction?.profit_per_tx), indent: 1 },
      ]} />
      <CFOCommentary text={docs?.cfo_commentary?.pl} />
    </div>
  )
}

function CashFlowTab({ docs }: { docs: any }) {
  const cf = docs?.cash_flow_statement
  if (!cf) return <div className="p-4 text-sm text-muted-foreground">Cash flow statement not available.</div>
  return (
    <div className="space-y-2">
      <FinancialTable title="Operating Activities" rows={[
        { label: 'Cash from Protocol Fees', value: usd(cf.operating?.cash_from_protocol), indent: 1 },
        { label: 'Cash from Off-chain Revenue', value: usd(cf.operating?.cash_from_off_chain), indent: 1 },
        { label: 'Total Cash Inflows', value: usd(cf.operating?.total_cash_inflows), subtotal: true },
        { label: 'Cash Paid — Payroll', value: usd(-(cf.operating?.cash_paid_payroll || 0)), indent: 1 },
        { label: 'Cash Paid — Marketing', value: usd(-(cf.operating?.cash_paid_marketing || 0)), indent: 1 },
        { label: 'Cash Paid — Infrastructure', value: usd(-(cf.operating?.cash_paid_infra || 0)), indent: 1 },
        { label: 'Cash Paid — Legal/Audit', value: usd(-(cf.operating?.cash_paid_legal || 0)), indent: 1 },
        { label: 'Cash Paid — Gas Subsidy', value: usd(-(cf.operating?.cash_paid_gas_subsidy || 0)), indent: 1 },
        { label: 'Total Cash Outflows', value: usd(-(cf.operating?.total_cash_outflows || 0)), subtotal: true },
        { label: 'Net Operating Cash Flow', value: usd(cf.operating?.net_operating_cash_flow), subtotal: true },
      ]} />
      <FinancialTable title="Investing Activities" rows={[
        { label: 'Token Treasury Movement', value: usd(cf.investing?.token_treasury_movement), indent: 1 },
        { label: 'Net Investing Cash Flow', value: usd(cf.investing?.net_investing_cash_flow), subtotal: true },
      ]} />
      <FinancialTable title="Financing Activities" rows={[
        { label: 'Funding Received', value: usd(cf.financing?.funding_received), indent: 1 },
        { label: 'Net Financing Cash Flow', value: usd(cf.financing?.net_financing_cash_flow), subtotal: true },
      ]} />
      <FinancialTable title="Summary" rows={[
        { label: 'Opening Cash Balance', value: usd(cf.summary?.opening_cash_balance), indent: 1 },
        { label: 'Net Change in Cash', value: usd(cf.summary?.net_cash_change), indent: 1 },
        { label: 'Closing Cash Balance', value: usd(cf.summary?.closing_cash_balance), subtotal: true },
        { label: 'Monthly Burn Rate', value: usd(cf.summary?.monthly_burn_rate), indent: 1 },
        { label: 'Treasury Runway', value: cf.summary?.runway_months ? `${Math.floor(cf.summary.runway_months)} months` : '—', indent: 1 },
      ]} />
      <CFOCommentary text={docs?.cfo_commentary?.cf} />
    </div>
  )
}

function BalanceSheetTab({ docs }: { docs: any }) {
  const bs = docs?.balance_sheet
  if (!bs) return <div className="p-4 text-sm text-muted-foreground">Balance sheet not available.</div>
  return (
    <div className="space-y-2">
      <FinancialTable title="Assets" rows={[
        { label: 'Cash & Stablecoins', value: usd(bs.assets?.current?.cash_and_stablecoins), indent: 2 },
        { label: 'Accounts Receivable', value: usd(bs.assets?.current?.accounts_receivable), indent: 2 },
        { label: 'Total Current Assets', value: usd(bs.assets?.current?.total_current_assets), subtotal: true, indent: 1 },
        { label: 'Token Treasury Value', value: usd(bs.assets?.non_current?.token_treasury_value), indent: 2 },
        { label: 'Total Non-Current Assets', value: usd(bs.assets?.non_current?.total_non_current_assets), subtotal: true, indent: 1 },
        { label: 'TOTAL ASSETS', value: usd(bs.assets?.total_assets), subtotal: true },
      ]} />
      <FinancialTable title="Liabilities" rows={[
        { label: 'Accrued Expenses', value: usd(bs.liabilities?.current?.accrued_expenses), indent: 2 },
        { label: 'Total Current Liabilities', value: usd(bs.liabilities?.current?.total_current_liab), subtotal: true, indent: 1 },
        { label: 'Vesting Obligations', value: usd(bs.liabilities?.non_current?.vesting_obligations), indent: 2 },
        { label: 'Total Non-Current Liabilities', value: usd(bs.liabilities?.non_current?.total_non_current_liab), subtotal: true, indent: 1 },
        { label: 'TOTAL LIABILITIES', value: usd(bs.liabilities?.total_liabilities), subtotal: true },
      ]} />
      <FinancialTable title="Equity" rows={[
        { label: 'Total Funding Raised', value: usd(bs.equity?.total_funding_raised), indent: 2 },
        { label: 'Retained Earnings / (Deficit)', value: usd(bs.equity?.retained_earnings), indent: 2 },
        { label: 'TOTAL EQUITY', value: usd(bs.equity?.total_equity), subtotal: true },
      ]} />
      <CFOCommentary text={docs?.cfo_commentary?.bs} />
    </div>
  )
}

function UnitEconomicsTab({ docs }: { docs: any }) {
  const ue = docs?.unit_economics
  if (!ue) return <div className="p-4 text-sm text-muted-foreground">Unit economics not available.</div>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="CAC" value={ue.acquisition?.cac_label || '—'} />
        <MetricCard label="LTV" value={usd(ue.lifetime_value?.ltv)} />
        <MetricCard label="LTV:CAC" value={ue.ratios?.ltv_cac_label || '—'} positive={(ue.ratios?.ltv_cac_ratio || 0) >= 3} />
        <MetricCard label="Payback Period" value={ue.ratios?.payback_label || '—'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Monthly Burn" value={usd(ue.burn_and_runway?.total_monthly_burn)} positive={false} />
        <MetricCard label="Cash Balance" value={usd(ue.burn_and_runway?.cash_balance)} />
        <MetricCard label="Runway" value={ue.burn_and_runway?.runway_label || '—'} positive={(ue.burn_and_runway?.runway_months || 0) >= 12} />
      </div>
      <FinancialTable title="Transaction Economics" rows={[
        { label: 'Total Transactions', value: fmt(ue.transactions?.total_transactions) },
        { label: 'Revenue per Transaction', value: usd(ue.transactions?.revenue_per_tx) },
        { label: 'Cost per Transaction', value: usd(ue.transactions?.cost_per_tx) },
        { label: 'Profit per Transaction', value: usd(ue.transactions?.profit_per_tx) },
      ]} />
      <CFOCommentary text={docs?.cfo_commentary?.ue} />
    </div>
  )
}

function ForwardModelTab({ docs }: { docs: any }) {
  const fm = docs?.forward_model
  if (!fm) return <div className="p-4 text-sm text-muted-foreground">Forward model not available.</div>
  const [scenario, setScenario] = useState<'base' | 'bull' | 'bear'>('base')
  const s = fm[scenario]
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['base', 'bull', 'bear'] as const).map(k => (
          <Button key={k} variant={scenario === k ? 'default' : 'outline'} size="sm" onClick={() => setScenario(k)}>
            {k.charAt(0).toUpperCase() + k.slice(1)} Case
          </Button>
        ))}
      </div>
      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Revenue Growth/mo" value={s.assumptions?.monthly_revenue_growth || '—'} />
            <MetricCard label="Cost Growth/mo" value={s.assumptions?.monthly_cost_growth || '—'} />
            <MetricCard label="Break-even" value={typeof s.break_even_month === 'number' ? `Month ${s.break_even_month}` : s.break_even_month || '—'} />
            <MetricCard label="Month 12 Revenue" value={usd(s.month_12_revenue)} />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Month</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Revenue</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Costs</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Profit/Loss</th>
                </tr>
              </thead>
              <tbody>
                {(s.months || []).map((m: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                    <td className="px-3 py-1.5">Month {m.month}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{usd(m.projected_revenue)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{usd(m.projected_costs)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${(m.projected_profit || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {usd(m.projected_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fm.notes && (
            <div className="text-xs text-muted-foreground space-y-1">
              {fm.notes.map((n: string, i: number) => <div key={i}>• {n}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ── AI Chat panel ──────────────────────────────────────────────────────────

function FinancialChat({ contractAddress, chain, onDocumentsReady }: {
  contractAddress: string; chain: string; onDocumentsReady: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await (financialApi as any).getChatHistory(contractAddress, chain)
        if (res.messages?.length > 0) {
          setMessages(res.messages)
          setMode(res.mode)
        } else {
          // First visit — trigger opening message
          await send('Hello, I would like to set up my financial profile and generate documents.')
        }
      } catch { /* silent */ }
    }
    if (contractAddress) load()
  }, [contractAddress, chain])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (overrideMsg?: string) => {
    const msg = overrideMsg || input.trim()
    if (!msg) return
    setInput('')
    setSending(true)

    const userMsg: ChatMessage = { role: 'user', content: msg }
    if (!overrideMsg) setMessages(prev => [...prev, userMsg])

    try {
      const res = await (financialApi as any).chat(contractAddress, chain, msg)
      setMode(res.mode)
      const aiMsg: ChatMessage = { role: 'assistant', content: res.response }
      setMessages(prev => [...prev, aiMsg])

      if (res.complete && res.mode === 'analysis') {
        // All inputs collected — auto-generate documents
        try {
          await (financialApi as any).generateDocuments(contractAddress, chain)
          onDocumentsReady()
        } catch { /* silent — user can regenerate manually */ }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setSending(false)
    }
  }

  const modeLabel: Record<string, string> = {
    input_collection: 'Collecting one-time project details',
    monthly_collection: 'Collecting monthly costs',
    analysis: 'Analysis mode — documents ready',
  }

  return (
    <div className="flex flex-col h-full min-h-[480px]">
      {mode && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-lg border-b
          ${mode === 'analysis' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
          <Bot className="h-3 w-3" />
          {modeLabel[mode] || mode}
        </div>
      )}
      <ScrollArea className="flex-1 p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${m.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
              }`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start mb-3">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>
      <div className="border-t p-3 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Type your message..."
          disabled={sending}
          className="flex-1"
        />
        <Button size="icon" onClick={() => send()} disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
// ── Main FinancialsTab component ───────────────────────────────────────────

export function FinancialsTab({ contractAddress, chain }: FinancialTabProps) {
  const [docs, setDocs] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [periods, setPeriods] = useState<any[]>([])
  const [activePeriod, setActivePeriod] = useState<string>('')
  const [missingInfo, setMissingInfo] = useState<any>(null)
  const [activeDocTab, setActiveDocTab] = useState('pl')
  const [showChat, setShowChat] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [research, setResearch] = useState<any>(null)
  const [runningResearch, setRunningResearch] = useState(false)

  const loadDocuments = async (period?: string) => {
    try {
      const res = period
        ? await (financialApi as any).getDocuments(contractAddress, chain, period)
        : await (financialApi as any).getLatestDocuments(contractAddress, chain)
      setDocs(res.documents || null)
      if (res.documents?.period) setActivePeriod(res.documents.period)
    } catch { /* silent */ }
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        loadDocuments(),
        (async () => {
          const m = await (financialApi as any).getMissing(contractAddress, chain)
          setMissingInfo(m)
          if (!m.complete) setShowChat(true)
        })(),
        (async () => {
          const p = await (financialApi as any).getPeriods(contractAddress, chain)
          setPeriods(p.periods || [])
        })(),
        (async () => {
          try {
            const r = await (researchApi as any).get(contractAddress, chain)
            setResearch(r.data || null)
          } catch { /* research is optional */ }
        })(),
      ])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (contractAddress) loadAll() }, [contractAddress, chain])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await (financialApi as any).generateDocuments(contractAddress, chain)
      setDocs(res.documents)
      await loadAll()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await (financialApi as any).exportPDF(contractAddress, chain, activePeriod || undefined)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const missingCount = (missingInfo?.missingOneTime?.length || 0) + (missingInfo?.missingMonthly?.length || 0)

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Financial Intelligence</h2>
          <p className="text-sm text-muted-foreground">Investor-grade financial documents generated from on-chain data</p>
        </div>
        <div className="flex items-center gap-2">
          {periods.length > 0 && (
            <select
              value={activePeriod}
              onChange={e => { setActivePeriod(e.target.value); loadDocuments(e.target.value) }}
              className="text-xs border rounded-md px-2 py-1.5 bg-background"
            >
              {periods.map((p: any) => (
                <option key={p.period} value={p.period}>{p.period}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
            <Bot className="h-4 w-4 mr-1" /> {showChat ? 'Hide' : 'AI'} Chat
          </Button>
          {docs && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Export PDF
            </Button>
          )}
          <Button variant="outline" size="sm"
            onClick={async () => {
              setRunningResearch(true)
              try {
                const r = await (researchApi as any).run(contractAddress, chain)
                setResearch(r.data || null)
              } catch (e: any) { setError(e.message) }
              finally { setRunningResearch(false) }
            }}
            disabled={runningResearch}
            title="Fetch DeFiLlama, CoinGecko & GitHub data"
          >
            {runningResearch ? <Loader2 className="h-4 w-4 animate-spin" /> : '🔬'}
            Research
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating || (missingInfo && !missingInfo.complete)}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {docs ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Missing fields banner */}
      {missingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-amber-800 text-sm">
                {missingCount} input{missingCount !== 1 ? 's' : ''} needed to generate financial documents
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                The AI Financial Advisor will ask for these conversationally in the chat below.
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => setShowChat(true)}>
              Open Chat
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {/* Sector Benchmarks strip — shown when research data is available */}
      {research?.summary && (
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-700">Sector Benchmarks</span>
                <span className="text-xs text-blue-500">
                  {research.summary.protocol_category || 'DeFi'} ·{' '}
                  {research.fetched_at ? new Date(research.fetched_at).toLocaleDateString() : ''}
                  {!research.fresh && <span className="ml-1 text-amber-500">(expired)</span>}
                </span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {research.summary.tvl_usd != null && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Protocol TVL </span>
                    <span className="font-semibold">${Math.round(research.summary.tvl_usd).toLocaleString()}</span>
                    {research.summary.tvl_30d_change_pct != null && (
                      <span className={`ml-1 ${research.summary.tvl_30d_change_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ({research.summary.tvl_30d_change_pct > 0 ? '+' : ''}{research.summary.tvl_30d_change_pct}% 30d)
                      </span>
                    )}
                  </div>
                )}
                {research.summary.price_usd != null && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Token </span>
                    <span className="font-semibold">${research.summary.price_usd}</span>
                    {research.summary.price_change_7d != null && (
                      <span className={`ml-1 ${research.summary.price_change_7d >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ({research.summary.price_change_7d > 0 ? '+' : ''}{research.summary.price_change_7d?.toFixed(1)}% 7d)
                      </span>
                    )}
                  </div>
                )}
                {research.summary.sector_median_tvl != null && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Sector median TVL </span>
                    <span className="font-semibold">${Math.round(research.summary.sector_median_tvl).toLocaleString()}</span>
                  </div>
                )}
                {research.summary.github_stars != null && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">GitHub </span>
                    <span className="font-semibold">{research.summary.github_stars} ⭐</span>
                    {research.summary.github_commits_4w != null && (
                      <span className="ml-1 text-muted-foreground">· {research.summary.github_commits_4w} commits/4w</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-6 ${showChat ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1'}`}>
        {/* Documents panel */}
        <div className={showChat ? 'lg:col-span-3' : 'col-span-1'}>
          {docs ? (
            <div className="space-y-4">
              {/* Executive Summary */}
              {docs.executive_summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{docs.executive_summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Key metrics strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  label="Revenue"
                  value={usd(docs.income_statement?.revenue?.total_revenue)}
                  sub={`Margin: ${pct(docs.income_statement?.gross_margin_pct)}`}
                />
                <MetricCard
                  label="Net Profit/Loss"
                  value={usd(docs.income_statement?.net_profit)}
                  positive={(docs.income_statement?.net_profit || 0) >= 0}
                />
                <MetricCard
                  label="Burn Rate"
                  value={usd(docs.cash_flow_statement?.summary?.monthly_burn_rate)}
                  sub="per month"
                  positive={false}
                />
                <MetricCard
                  label="Runway"
                  value={docs.cash_flow_statement?.summary?.runway_months
                    ? `${Math.floor(docs.cash_flow_statement.summary.runway_months)} mo`
                    : '—'}
                  positive={(docs.cash_flow_statement?.summary?.runway_months || 0) >= 12}
                />
              </div>

              {/* Document tabs */}
              <Card>
                <CardContent className="p-0">
                  <Tabs value={activeDocTab} onValueChange={setActiveDocTab}>
                    <div className="overflow-x-auto border-b">
                      <TabsList className="flex w-max h-auto p-1 gap-1 bg-transparent">
                        {[
                          ['pl', 'P&L'],
                          ['cf', 'Cash Flow'],
                          ['bs', 'Balance Sheet'],
                          ['ue', 'Unit Economics'],
                          ['fm', '12-Month Model'],
                        ].map(([v, l]) => (
                          <TabsTrigger key={v} value={v} className="text-xs px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            {l}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    <div className="p-4">
                      <TabsContent value="pl"><PLTab docs={docs} /></TabsContent>
                      <TabsContent value="cf"><CashFlowTab docs={docs} /></TabsContent>
                      <TabsContent value="bs"><BalanceSheetTab docs={docs} /></TabsContent>
                      <TabsContent value="ue"><UnitEconomicsTab docs={docs} /></TabsContent>
                      <TabsContent value="fm"><ForwardModelTab docs={docs} /></TabsContent>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Red Flags & Opportunities */}
              {((docs.red_flags?.length > 0) || (docs.opportunities?.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {docs.red_flags?.length > 0 && (
                    <Card className="border-red-100">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-red-700 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> Red Flags
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {docs.red_flags.map((f: string, i: number) => (
                          <div key={i} className="text-xs text-red-700 flex gap-2"><span>•</span><span>{f}</span></div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {docs.opportunities?.length > 0 && (
                    <Card className="border-green-100">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Opportunities
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {docs.opportunities.map((o: string, i: number) => (
                          <div key={i} className="text-xs text-green-700 flex gap-2"><span>•</span><span>{o}</span></div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Investor Q&A */}
              {docs.investor_qa?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Investor Q&A Preparation</CardTitle>
                    <CardDescription className="text-xs">Likely questions from Series A/B investors</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {docs.investor_qa.map((qa: any, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground">Q: {qa.question}</div>
                        <div className="text-sm leading-relaxed">{qa.answer}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <DollarSign className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <h3 className="font-semibold mb-1">No Financial Documents Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {missingCount > 0
                      ? 'Chat with the AI Financial Advisor to provide your cost inputs, then generate your investor-grade documents.'
                      : 'Click Generate to create your financial documents from on-chain data.'}
                  </p>
                </div>
                {missingCount === 0 && (
                  <Button onClick={handleGenerate} disabled={generating}>
                    {generating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Generate Documents
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  AI Financial Advisor
                </CardTitle>
                <CardDescription className="text-xs">
                  Collects your business inputs and answers questions about your financial data
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 h-[600px] flex flex-col">
                <FinancialChat
                  contractAddress={contractAddress}
                  chain={chain}
                  onDocumentsReady={loadAll}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
