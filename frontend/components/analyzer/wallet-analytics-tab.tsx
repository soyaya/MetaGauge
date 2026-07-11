'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, TrendingUp, Users, Zap } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface WalletAnalyticsTabProps {
  contractAddress: string;
  chain: string;
}

import { CHART_COLORS, CHART_PRIMARY, CHART_SECONDARY, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from '@/lib/chart-colors';
const COLORS = CHART_COLORS;
const NA_BADGE = <Badge variant="outline" className="text-xs text-muted-foreground">Requires external indexer</Badge>;

export function WalletAnalyticsTab({ contractAddress, chain }: WalletAnalyticsTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureTab, setFeatureTab] = useState('');

  useEffect(() => {
    if (!contractAddress || !chain) return;
    api.metrics.getWalletAnalytics(contractAddress, chain)
      .then(d => { setData(d); if (d.features?.[0]) setFeatureTab(d.features[0].name); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [contractAddress, chain]);

  // Auto-refresh while pipeline is running
  useEffect(() => {
    const pipeline = data?.crossAppInsights?.pipeline;
    if (!pipeline?.pending && !pipeline?.isRunning) return;
    const t = setTimeout(() => {
      api.metrics.getWalletAnalytics(contractAddress, chain)
        .then(d => setData(d))
        .catch(() => {});
    }, 5000);
    return () => clearTimeout(t);
  }, [data?.crossAppInsights?.pipeline?.pending, data?.crossAppInsights?.pipeline?.isRunning]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /><span>Loading wallet analytics...</span>
    </div>
  );

  if (error || !data) return (
    <Card><CardContent className="pt-6 text-center text-destructive">{error || 'No data'}</CardContent></Card>
  );

  const { summary, features, wallets, alerts } = data;
  const activeWallets  = wallets.filter((w: any) => w.status !== 'dormant');
  const dormantWallets = wallets.filter((w: any) => w.status === 'dormant');
  const selectedFeature = features.find((f: any) => f.name === featureTab) || features[0];

  const scoreColor = summary.productivityScore >= 70 ? 'text-green-600' :
                     summary.productivityScore >= 40 ? 'text-yellow-600' : 'text-red-600';

  const MetricCard = ({ label, value, sub, warn = false }: any) => (
    <Card className={warn ? 'border-red-200' : ''}>
      <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${warn ? 'text-red-600' : ''}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">

      {/* ── Productivity Score ────────────────────────────────────────── */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Productivity Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <p className={`text-5xl font-bold ${scoreColor}`}>{summary.productivityScore}<span className="text-xl text-muted-foreground">/100</span></p>
            <div className="flex-1">
              <Progress value={summary.productivityScore} className="h-3 mb-2" />
              <p className="text-xs text-muted-foreground">
                Based on success rate ({summary.successRate}%), active wallet rate ({summary.totalWallets > 0 ? ((activeWallets.length/summary.totalWallets)*100).toFixed(0) : 0}%), and feature adoption
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Alerts ───────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Suggested Productivity Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-card border border-amber-200 dark:border-amber-800 rounded-lg">
                <span className="text-red-500 font-bold text-sm mt-0.5">!</span>
                <div>
                  <p className="text-sm font-medium">{a.metric}: <span className="text-red-600">{a.value}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.action}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Wallet Summary ────────────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Wallet Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Wallets"   value={summary.totalWallets}   sub="Distinct addresses" />
          <MetricCard label="Active Wallets"  value={activeWallets.length}   sub="2+ interactions" warn={activeWallets.length < summary.totalWallets * 0.2} />
          <MetricCard label="Dormant Wallets" value={dormantWallets.length}  sub="1 interaction only" warn={dormantWallets.length > summary.totalWallets * 0.7} />
          <MetricCard label="Whale Wallets"   value={summary.whaleWallets}   sub="10+ transactions" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <MetricCard label="Total Volume"    value={`${summary.totalVolumeETH} ETH`} sub={`≈ $${summary.totalVolumeUSD}`} />
          <MetricCard label="Total Gas Cost"  value={`$${summary.totalGasUSD}`}       sub="USD (ETH @ $2500)" />
          <MetricCard label="Avg Gas / Wallet" value={`$${summary.avgGasUSD}`}        sub="Per wallet" />
          <MetricCard label="Success Rate"    value={`${summary.successRate}%`}       sub={`${summary.totalFailed} failed txs`} warn={summary.successRate < 90} />
        </div>
      </section>

      {/* ── Wallet Segments ───────────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Wallet Segments</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Wallet Status Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active', value: activeWallets.length },
                      { name: 'Dormant', value: dormantWallets.length },
                    ]}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    <Cell fill={CHART_PRIMARY} /><Cell fill={CHART_SECONDARY} />
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
                  </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top wallets table */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Wallets by Activity</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[420px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-muted-foreground">Address</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Txs</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Gas $</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Failed%</th>
                      <th className="text-center py-2 px-3 text-muted-foreground">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.slice(0, 8).map((w: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="py-1.5 px-3 font-mono">{w.address.slice(0,6)}…{w.address.slice(-4)}</td>
                        <td className="text-right py-1.5 px-3 tabular-nums font-semibold">{w.txCount}</td>
                        <td className="text-right py-1.5 px-3 tabular-nums">${w.gasSpentUSD}</td>
                        <td className={`text-right py-1.5 px-3 tabular-nums ${w.failedPct > 10 ? 'text-red-600' : ''}`}>{w.failedPct}%</td>
                        <td className="text-center py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                            w.status==='whale' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                            w.status==='active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                            'bg-muted text-muted-foreground'}`}>{w.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Cross-app data (from chain) ───────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Cross-App Wallet Activity (On-Chain)</h3>
        {data.crossAppInsights ? (
          <div className="space-y-4">
            {data.crossAppInsights.note && (
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded p-2">
                {data.crossAppInsights.note}
              </p>
            )}
            {data.crossAppInsights.enrichedWallets > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Avg Lifetime Txs" value={(data.crossAppInsights.avgTotalTxsEver||0).toLocaleString()} sub="Total txs ever on chain (nonce)" />
                <MetricCard label="Avg ETH Balance"  value={`${data.crossAppInsights.avgEthBalance||0} ETH`} sub="Current wallet balance" />
                <MetricCard label="Avg Recent Transfers Out" value={data.crossAppInsights.avgRecentTransferOut||0} sub="Last ~6h on other contracts" />
                <MetricCard label="Unique Contracts Used" value={data.crossAppInsights.totalContractsUsed||0} sub="Across all wallets (last 6h)" />
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="pt-4 text-center text-sm text-muted-foreground">
                  Enriching wallet data from chain... refresh in a few seconds.
                </CardContent>
              </Card>
            )}

            {/* Per-wallet on-chain data in table */}
            {wallets.some((w: any) => w.onChain && !w.onChain.error) && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Wallet Activity Elsewhere (On-Chain)</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[540px]">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 text-muted-foreground">Address</th>
                          <th className="text-right py-2 px-3 text-muted-foreground">Txs Here</th>
                          <th className="text-right py-2 px-3 text-muted-foreground">Lifetime Txs</th>
                          <th className="text-right py-2 px-3 text-muted-foreground">ETH Bal</th>
                          <th className="text-right py-2 px-3 text-muted-foreground">Contracts (6h)</th>
                          <th className="text-right py-2 px-3 text-muted-foreground">Transfers Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wallets.filter((w: any) => w.onChain && !w.onChain.error).slice(0, 15).map((w: any, i: number) => {
                          const oc = w.onChain;
                          const elsewhereRatio = oc.totalTxsEver && w.txCount
                            ? ((oc.totalTxsEver - w.txCount) / oc.totalTxsEver * 100).toFixed(0)
                            : null;
                          return (
                            <tr key={i} className="border-b hover:bg-muted/30">
                              <td className="py-1.5 px-3 font-mono">{w.address.slice(0,6)}…{w.address.slice(-4)}</td>
                              <td className="text-right py-1.5 px-3 tabular-nums font-semibold">{w.txCount}</td>
                              <td className="text-right py-1.5 px-3 tabular-nums">
                                {oc.totalTxsEver?.toLocaleString() || '—'}
                                {elsewhereRatio && <span className="text-muted-foreground ml-1">({elsewhereRatio}%↗)</span>}
                              </td>
                              <td className="text-right py-1.5 px-3 tabular-nums">{oc.ethBalance != null ? `${oc.ethBalance}` : '—'}</td>
                              <td className="text-right py-1.5 px-3 tabular-nums">{oc.contractsUsed?.length ?? '—'}</td>
                              <td className="text-right py-1.5 px-3 tabular-nums">{oc.recentTransferOut ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground px-3 py-2">
                    Lifetime Txs = nonce from chain. Contracts = ERC20 Transfer events in last ~6h.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Still unavailable items */}
            <Card className="border-dashed">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Still requires Etherscan/Alchemy API:</p>
                {['All txs sent by wallet to other contracts','Gas spent on other contracts','Failed txs on other contracts','Which dApps wallet used by name'].map(item => (
                  <div key={item} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <span className="text-muted-foreground">{item}</span>
                    {NA_BADGE}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="pt-4 text-center text-sm text-muted-foreground">No enrichment data yet.</CardContent>
          </Card>
        )}
      </section>

      {/* ── Feature Analytics ─────────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Feature Analytics</h3>

        {/* Feature overview bar chart */}
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-sm">Features by Use (All Time)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={features.slice(0, 8)} layout="vertical">
                <CartesianGrid {...GRID_STYLE} />
                <XAxis type="number" {...AXIS_STYLE} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="txCount" fill={CHART_PRIMARY} radius={[0,4,4,0]} name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Feature pie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Feature Distribution (Tx Count)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={features.slice(0,6)} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="txCount" paddingAngle={3} strokeWidth={0}>
                    {features.slice(0,6).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
                  </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Feature Adoption (% of Wallets)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {features.slice(0, 6).map((f: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{f.name}</span>
                      <span>{f.walletCount} wallets ({f.adoptionPct}%)</span>
                    </div>
                    <Progress value={f.adoptionPct} className="h-1.5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Per-feature drill-down */}
        {features.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Feature Deep Dive</CardTitle></CardHeader>
            <CardContent>
              <Tabs value={featureTab} onValueChange={setFeatureTab}>
                <div className="overflow-x-auto pb-1">
                  <TabsList className="inline-flex h-auto gap-1 mb-4 flex-wrap">
                    {features.slice(0, 8).map((f: any) => (
                      <TabsTrigger key={f.name} value={f.name} className="text-xs h-7">{f.name}</TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {features.slice(0, 8).map((f: any) => (
                  <TabsContent key={f.name} value={f.name}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      <MetricCard label="Transactions"   value={f.txCount}                    sub="Total calls" />
                      <MetricCard label="Unique Wallets" value={f.walletCount}                sub="Distinct users" />
                      <MetricCard label="Success Txs"    value={f.successTx}                  sub={`${f.failedPct}% failed`} warn={f.failedPct > 10} />
                      <MetricCard label="Avg Gas / Tx"   value={`$${f.avgGasUSD}`}            sub="USD (ETH @ $2500)" />
                      <MetricCard label="Volume (ETH)"   value={`${f.volumeETH} ETH`}         sub="Total inflow" />
                      <MetricCard label="Adoption"       value={`${f.adoptionPct}%`}          sub="Of all wallets" />
                      <MetricCard label="Failed Txs"     value={f.failedTx}                   sub="Needs investigation" warn={f.failedTx > 0} />
                      <MetricCard label="Churn Signal"   value={f.adoptionPct < 10 ? 'High' : f.adoptionPct < 30 ? 'Medium' : 'Low'} sub="Based on adoption %" />
                    </div>
                    {/* Cross-app for this feature */}
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium mb-2">Cross-app comparison for "{f.name}"</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        {['DAU / MAU / WAU by feature','TAM / SAM / SOM','Top countries','Drop-off rate'].map(item => (
                          <div key={item} className="flex items-center justify-between">
                            <span>{item}</span>
                            {NA_BADGE}
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Bridge tracking (unavailable) ────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Bridge Tracking</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['Funds coming into your chain and used in this app', 'Funds leaving your chain after using this app'].map(label => (
            <Card key={label} className="border-dashed">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {['Failed tx %','Successful tx','Gas','Fee','Inflow / Outflow','Time to first tx'].map(m => (
                  <div key={m} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <span className="text-muted-foreground">{m}</span>
                    {NA_BADGE}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

    </div>
  );
}
