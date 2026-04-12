'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { MetricInfo } from '@/components/ui/metric-info';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface MetricsTabProps { analysisResults: any }

import { CHART_COLORS, CHART_PRIMARY, CHART_SECONDARY } from '@/lib/chart-colors';
const COLORS = CHART_COLORS;
const NA = <span className="text-muted-foreground text-sm italic">Requires protocol-specific data</span>;

export function MetricsTab({ analysisResults }: MetricsTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    api.metrics.getDashboard()
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch + real-time polling every 15s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fallback to prop data if endpoint fails
  const fr = data || analysisResults?.results?.target?.fullReport || {};
  const act = fr.activationMetrics   || {};
  const ret = fr.retentionMetrics    || {};
  const uq  = fr.userQualityMetrics  || {};
  const gas = fr.gasAnalysis         || {};
  const dm  = fr.defiMetrics         || {};
  const ub  = fr.userBehavior        || {};
  const intr = fr.interactions       || {};

  const pct = (v: any) => v != null ? `${v}%` : 'N/A';
  const val = (v: any, fb = 'N/A') => (v != null && v !== '') ? v : fb;
  const num = (v: any) => typeof v === 'number' ? v.toLocaleString() : '0';

  const funnelData  = (act.activationFunnel || []).map((s: any) => ({ name: s.step, pct: s.pct, users: s.users }));
  const featureData = (act.featureFirstUse  || []).slice(0,5).map((f: any) => ({ name: f.feature, value: f.count }));
  const classData   = Object.entries(ub.userClassifications || {}).map(([k,v]) => ({ name: k.replace('_',' '), value: Number(v)||0 }));
  const retBars     = [
    { name:'D1',  value: ret.d1Retention  || 0 },
    { name:'D7',  value: ret.d7Retention  || 0 },
    { name:'D30', value: ret.d30Retention || 0 },
  ];
  const behaviorData = [
    { name:'Loyalty',     value: ub.loyaltyScore   || 0 },
    { name:'Whale Ratio', value: ub.whaleRatio      || 0 },
    { name:'Power Users', value: uq.powerUserRate   || 0 },
    { name:'Bot %',       value: uq.botPct          || 0 },
  ];
  const peakHours = (intr.peakInteractionTimes || []).slice(0,3);

  const SectionTitle = ({ children }: { children: string }) => (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 pt-4 border-t">{children}</h3>
  );

  const MetricCard = ({ label, value, sub, warn = false, info }: any) => (
    <Card className={warn ? 'border-red-200' : ''}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground flex items-center">
          {label}{info && <MetricInfo text={info} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${warn ? 'text-red-600' : ''}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /><span>Loading metrics...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
          ⚠ Live endpoint unavailable — showing cached data. ({error})
        </p>
      )}

      {/* ── TVL & LIQUIDITY ──────────────────────────────────────────── */}
      <section>
        <SectionTitle>TVL &amp; Liquidity</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard label="Total Value Locked"
            value={dm.tvl != null
              ? (dm.tvl >= 1e9 ? `$${(dm.tvl/1e9).toFixed(2)}B` : dm.tvl >= 1e6 ? `$${(dm.tvl/1e6).toFixed(2)}M` : dm.tvl >= 1e3 ? `$${(dm.tvl/1e3).toFixed(1)}K` : `$${dm.tvl.toFixed(2)}`)
              : 'Loading…'}
            sub={dm.tvlLabel === 'USD' ? 'Total supply (stablecoin)' : 'Total supply × ETH price'}
            info="Total token supply fetched live via eth_call totalSupply(). For stablecoins this equals TVL in USD." />
          <MetricCard label="Liquidity Utilization" value={NA} sub="Needs pool reserve state" info="Ratio of active to total liquidity. Requires getReserves() calls. Planned for batch enrichment." />
          <MetricCard label="Active Pools"          value={NA} sub="Needs pool factory events" info="Requires indexing PairCreated events from the factory contract." />
          <MetricCard label="Net Token Flow"
            value={dm.totalVolumeEth != null && dm.totalVolumeEth > 0
              ? (dm.totalVolumeEth >= 1e6 ? `$${(dm.totalVolumeEth/1e6).toFixed(2)}M` : dm.totalVolumeEth >= 1e3 ? `$${(dm.totalVolumeEth/1e3).toFixed(1)}K` : `$${dm.totalVolumeEth.toFixed(2)}`)
              : 'N/A'}
            sub="Token value transferred" info="Cumulative token value decoded from transfer() calls in the indexed sample." />
          <MetricCard label="Gas Revenue"
            value={gas.totalGasCostUSD != null ? `$${gas.totalGasCostUSD}` : 'N/A'}
            sub="Total gas spent by users" info="Total USD value users spent on gas. Approximates network demand for this contract." />
        </div>
      </section>

      {/* ── USER ACTIVITY ────────────────────────────────────────────── */}
      <section>
        <SectionTitle>User Activity</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="DAU" value={num(dm.dau)} sub="Last 24 h" info="Daily Active Users — unique wallets that transacted in the last 24 hours." />
          <MetricCard label="WAU" value={num(dm.wau)} sub="Last 7 days" info="Weekly Active Users — unique wallets active in the last 7 days." />
          <MetricCard label="MAU" value={num(dm.mau)} sub="Last 30 days" info="Monthly Active Users — unique wallets active in the last 30 days." />
          <MetricCard label="Avg Tx Size" value={dm.averageTransactionSize != null ? `${dm.averageTransactionSize} ETH` : 'N/A'} sub="Per transaction" info="Average value transferred per transaction. Low values on token contracts are normal as ETH value field is 0 for ERC-20 transfers." />
        </div>
      </section>

      {/* ── USER BEHAVIOR ────────────────────────────────────────────── */}
      <section>
        <SectionTitle>User Behavior</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Behavior Scores</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={behaviorData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize:11 }} />
                  <YAxis />
                  <Tooltip formatter={(v:any) => `${v}%`} />
                  <Bar dataKey="value" fill={CHART_PRIMARY} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-1">Risk Tolerance &amp; Bot Activity require mempool data</p>
            </CardContent>
          </Card>
          {classData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">User Classifications</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={classData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                      {classData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ── FINANCIAL ────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Financial Metrics</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Protocol Revenue"
            value={dm.protocolRevenue != null
              ? (dm.protocolRevenue > 0 ? `$${dm.protocolRevenue.toLocaleString()}` : '$0 (0 bps fee)')
              : NA}
            sub={dm.recentBlockRange ? `Last ${dm.recentBlockRange} blocks` : 'Fee × transfer volume'}
            info="Protocol revenue = fee rate × transfer volume from recent Transfer events. USDT currently charges 0 bps." />
          <MetricCard label="Recent Transfer Vol"
            value={dm.recentTransferVolume != null
              ? (dm.recentTransferVolume >= 1e6 ? `$${(dm.recentTransferVolume/1e6).toFixed(2)}M` : dm.recentTransferVolume >= 1e3 ? `$${(dm.recentTransferVolume/1e3).toFixed(1)}K` : `$${dm.recentTransferVolume.toFixed(2)}`)
              : NA}
            sub={dm.recentTransferCount ? `${dm.recentTransferCount} transfers` : 'From Transfer events'}
            info="Total token volume from Transfer events in the last 500 blocks. Decoded directly from event logs." />
          <MetricCard label="Revenue Per User"
            value={gas.totalGasCostUSD != null && dm.mau > 0
              ? `$${(gas.totalGasCostUSD / dm.mau).toFixed(4)}`
              : 'N/A'}
            sub="Gas cost per active user" info="Total gas cost ÷ monthly active users. Proxy for cost-to-serve." />
          <MetricCard label="Protocol Fee Rate"
            value={dm.feeRateBps != null ? `${dm.feeRateBps} bps` : NA}
            sub={dm.feeRateBps != null ? `${(dm.feeRateBps/100).toFixed(2)}% per transfer` : 'Fetched via eth_call'}
            info="Fee per transfer in basis points. Fetched live from basisPointsRate() on-chain." />
        </div>
      </section>

      {/* ── ACTIVATION ───────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Activation Metrics</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <MetricCard label="Activation Rate"      value={pct(act.activationRate)}      sub="Users who return after first tx" warn={(act.activationRate||0)<30} info="% of wallets that made a 2nd transaction. Below 30% suggests friction or low perceived value." />
          <MetricCard label="Time to Activation"   value={val(act.avgTimeToActivation)} sub="First tx → second tx (median)" info="Median time between a wallet's 1st and 2nd transaction. Shorter = faster value realisation." />
          <MetricCard label="Gas Cost to Activate" value={act.avgGasToActivateETH != null ? `${act.avgGasToActivateETH} ETH` : 'N/A'} sub={`≈ $${val(act.avgGasToActivateUSD,'0')} USD`} info="Average gas cost a wallet spends on its first two transactions. High cost may deter new users." />
        </div>
        {funnelData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Activation Funnel</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {funnelData.map((s:any) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{s.step}</span><span className="font-semibold">{s.users} users ({s.pct}%)</span>
                    </div>
                    <Progress value={s.pct} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
            {featureData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Feature First Use</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={featureData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize:11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill={CHART_SECONDARY} radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ── RETENTION ────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Retention Metrics</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <MetricCard label="D1 Retention"   value={pct(ret.d1Retention)}      sub="Day 1 stickiness"   warn={(ret.d1Retention||0)<20}  info="% of users who transacted again within 24h of their first interaction." />
          <MetricCard label="D7 Retention"   value={pct(ret.d7Retention)}      sub="Week 1 habit"       warn={(ret.d7Retention||0)<10}  info="% of users still active 7 days after first interaction. Key habit-formation signal." />
          <MetricCard label="D30 Retention"  value={pct(ret.d30Retention)}     sub="Long-term value"    warn={(ret.d30Retention||0)<5}   info="% of users still active 30 days after first interaction. Indicates long-term product value." />
          <MetricCard label="Churn Rate"     value={pct(ret.churnRate)}        sub="Users lost"         warn={(ret.churnRate||0)>50}    info="% of users with no activity in the last 30 days. High churn signals retention problems." />
          <MetricCard label="Resurrection"   value={pct(ret.resurrectionRate)} sub="Churned who return"                                 info="% of previously churned users who came back. Shows re-engagement effectiveness." />
          <MetricCard label="Retention Rate" value={pct(ret.retentionRate)}    sub="Returning users"    warn={(ret.retentionRate||0)<20} info="Overall % of wallets that made more than one transaction with this contract." />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-sm">Day Retention Curve</CardTitle></CardHeader>
          <CardContent>
            {retBars.every(b => b.value === 0) ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No timestamp data yet — retention will populate after block timestamps are enriched.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={retBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} />
                  <Tooltip formatter={(v:any)=>`${v}%`} />
                  <Bar dataKey="value" fill={CHART_PRIMARY} radius={[4,4,0,0]} minPointSize={3} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── GAS ──────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Gas Analysis</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="Avg Gas Price"     value={val(gas.averageGasPrice)}                                         sub="Network cost"        info="Average gas price paid across all transactions. Reflects network congestion at time of interaction." />
          <MetricCard label="Median Gas Used" value={num(gas.averageGasUsed)} sub="Typical gas per tx" info="Median gas units per transaction. ~46k is normal for ERC-20 transfers. Higher values (150k+) indicate complex DEX/router interactions. Median avoids skew from outlier transactions." />
          <MetricCard label="Total Gas Cost"    value={gas.totalGasCostUSD    != null ? `$${gas.totalGasCostUSD}`    : 'N/A'} sub="USD estimate"    info="Total USD value spent on gas across all indexed transactions. Calculated using live ETH price." />
          <MetricCard label="Avg Gas Cost / Tx" value={gas.averageGasCostUSD  != null ? `$${gas.averageGasCostUSD}`  : 'N/A'} sub="Per transaction" info="Average USD cost per transaction. High values may deter users from interacting." />
          <MetricCard label="Tx Success Rate"   value={pct(gas.gasEfficiencyScore)}                                      sub="Successful / total"  info="% of transactions that completed without reverting. Low rates indicate contract bugs or UX issues." />
          <MetricCard label="Failed Txs"        value={num(gas.failedTransactions)}                                      sub={`${pct(gas.failureRate)} failure rate`} warn={(gas.failureRate||0)>10} info="Number of reverted transactions. Above 10% is a red flag for contract reliability." />
        </div>
      </section>

      {/* ── RISK & SECURITY ──────────────────────────────────────────── */}
      <section>
        <SectionTitle>Risk &amp; Security</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard label="MEV Exposure"       value={NA} sub="Requires mempool analysis" />
          <MetricCard label="Front Running"      value={NA} sub="Requires mempool analysis" />
          <MetricCard label="Sandwich Attacks"   value={NA} sub="Requires mempool analysis" />
          <MetricCard label="Arbitrage Opps"     value={NA} sub="Requires price oracle" />
          <MetricCard label="Liquidation Events" value={NA} sub="Requires liquidation events" />
        </div>
      </section>

      {/* ── ENHANCED DEFI ────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Enhanced DeFi</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Impermanent Loss"        value={NA} sub="Requires LP position tracking" />
          <MetricCard label="Slippage Tolerance"      value={NA} sub="Requires swap event parsing" />
          <MetricCard label="Bridge Utilization"      value={NA} sub="Requires bridge events" />
          <MetricCard label="Governance Participation" value={NA} sub="Requires governance events" />
        </div>
      </section>

      {/* ── CONTRACT INTERACTION ─────────────────────────────────────── */}
      <section>
        <SectionTitle>Contract Interaction</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Interaction Complexity" value={val(dm.interactionComplexity)}  sub="Based on distinct function calls" info="Low/Medium/High based on how many distinct contract functions are being called. High = diverse usage." />
          <MetricCard label="Contract Utilization"   value={num(dm.contractUtilization)}    sub="Total interactions"               info="Total number of transactions in the indexed sample. Proxy for overall contract activity." />
          <MetricCard label="Event Driven Volume"    value={NA}                              sub="Requires event log parsing"       info="Volume derived from on-chain events (Transfer, Swap, etc.). Requires full event log indexing." />
          <MetricCard label="Peak Interaction Hour"  value={peakHours.length ? `${peakHours[0].hour}:00 UTC` : 'N/A'} sub={peakHours.length ? `${peakHours[0].count} txs` : 'No timestamp data'} info="UTC hour with the most transactions. Useful for scheduling maintenance or marketing campaigns." />
        </div>
      </section>

      {/* ── ADVANCED PERFORMANCE ─────────────────────────────────────── */}
      <section>
        <SectionTitle>Advanced Performance</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="Function Success Rate" value={pct(dm.functionSuccessRate)} sub="Tx reliability"    info="% of transactions that succeeded. Equivalent to Tx Success Rate — measures contract reliability." />
          <MetricCard label="Protocol Stickiness"   value={pct(dm.protocolStickiness)}  sub="Repeat user rate"  info="% of users who returned after their first interaction. High stickiness = strong product-market fit." />
          <MetricCard label="Cross-Chain Volume"    value={NA}                           sub="Requires bridge events"          info="Volume flowing in from other chains. Requires bridge contract event indexing." />
          <MetricCard label="Active Pools"          value={NA}                           sub="Requires pool events"            info="Number of active liquidity pools. Requires pool factory event parsing." />
          <MetricCard label="Cross-Chain Users"     value={NA}                           sub="Requires cross-chain matching"   info="Users active on multiple chains. Requires wallet address matching across chain data." />
        </div>
      </section>

      {/* ── USER QUALITY ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle>User Quality</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Power User Rate"      value={pct(uq.powerUserRate)}              sub="Users with >10 txs"          info="% of wallets with more than 10 transactions. High power user rate indicates strong product-market fit." />
          <MetricCard label="Bot %"                value={pct(uq.botPct)}                     sub="Sybil risk"                  warn={(uq.botPct||0)>10} info="% of wallets showing bot-like behaviour (multiple txs within 60 seconds). Above 10% is concerning." />
          <MetricCard label="User Sophistication"  value={val(uq.avgSophistication,'0')}      sub="Avg distinct functions/user" info="Average number of distinct contract functions a wallet calls. Higher = more engaged, technical users." />
          <MetricCard label="Wallet Quality Score" value={`${val(uq.avgWalletQuality,'0')}/100`} sub="Composite user value"     info="0–100 score combining tx count, return rate, and success rate. Higher = more valuable user base." />
        </div>
      </section>

    </div>
  );
}
