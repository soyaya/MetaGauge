'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LabelList, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface UsersTabProps { analysisResults: any }

import { CHART_COLORS, CHART_PRIMARY, CHART_SECONDARY, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from '@/lib/chart-colors';
const COLORS = CHART_COLORS;

export function UsersTab({ analysisResults }: UsersTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.metrics.getDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Fallback to prop data
  const fr  = data || analysisResults?.results?.target?.fullReport || {};
  const ub  = fr.userBehavior   || {};
  const ul  = fr.userLifecycle  || {};
  const uj  = fr.userJourneys   || {};
  const ret = fr.retentionMetrics || {};
  const uq  = fr.userQualityMetrics || {};
  const users: any[] = fr.users || [];

  const pct = (v: any) => v != null ? `${v}%` : 'N/A';
  const num = (v: any) => typeof v === 'number' ? v.toLocaleString() : '0';
  const fmt = (v: any, fb = 'N/A') => v != null ? v : fb;

  const classData = Object.entries(ub.userClassifications || {}).map(([k, v]) => ({
    name: k.replace('_', ' '), value: Number(v) || 0,
  }));

  const engagementData = [
    { metric: 'Loyalty',      score: ub.loyaltyScore    || 0 },
    { metric: 'Retention 7d', score: ret.d7Retention    || 0 },
    { metric: 'Retention 30d',score: ret.d30Retention   || 0 },
    { metric: 'Activation',   score: fr.activationMetrics?.activationRate || 0 },
  ];

  const formatAddr = (a: string) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : 'N/A';
  const formatEth  = (v: number) => v > 0 ? `${v.toFixed(6)} ETH` : '0 ETH';

  // Top 10 users sorted by tx count for the bar chart
  const topUsersChart = [...users]
    .sort((a, b) => (b.transactionCount || 0) - (a.transactionCount || 0))
    .slice(0, 10)
    .map(u => ({
      address: formatAddr(u.address),
      txs: u.transactionCount || 0,
      userType: u.userType || 'regular',
      fill:
        u.userType === 'whale'   ? 'hsl(270 60% 60%)' :
        u.userType === 'power'   ? 'hsl(215 70% 55%)' :
        u.userType === 'regular' ? 'hsl(142 55% 45%)' :
        'hsl(220 10% 60%)',
    }))
    .reverse(); // recharts horizontal layout renders bottom-to-top, reverse gives rank 1 at top

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /><span>Loading users...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
          Using cached data. ({error})
        </p>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',      value: num(ul.summary?.totalUsers),     sub: 'Distinct wallets' },
          { label: 'New Users',        value: num(ul.summary?.newUsers),        sub: 'Single interaction' },
          { label: 'Returning Users',  value: num(ul.summary?.returningUsers),  sub: '2+ interactions' },
          { label: 'Active Users',     value: num(ul.summary?.activeUsers),     sub: 'Last 24 h' },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground mt-1">{sub}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* ── Retention & quality ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Retention Rate',    value: pct(ul.summary?.retentionRate),  sub: 'Returning users',       warn: (ul.summary?.retentionRate||0) < 20 },
          { label: 'Churn Rate',        value: pct(ret.churnRate),              sub: 'Users lost',            warn: (ret.churnRate||0) > 50 },
          { label: 'Avg Journey Length',value: fmt(uj.averageJourneyLength,'0'),sub: 'Avg txs per user' },
          { label: 'Wallet Quality',    value: `${fmt(uq.avgWalletQuality,'0')}/100`, sub: 'Composite score' },
        ].map(({ label, value, sub, warn = false }) => (
          <Card key={label} className={warn ? 'border-red-200' : ''}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${warn ? 'text-red-600' : ''}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {classData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">User Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={classData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {classData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
                  </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">Engagement Scores</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={engagementData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="metric" {...AXIS_STYLE} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => `${v}%`} />
                <Bar dataKey="score" fill={CHART_PRIMARY} radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── User quality metrics ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Power User Rate',     value: pct(uq.powerUserRate),       sub: 'Users with >10 txs' },
          { label: 'Bot %',               value: pct(uq.botPct),              sub: 'Sybil risk', warn: (uq.botPct||0) > 10 },
          { label: 'User Sophistication', value: fmt(uq.avgSophistication,'0'), sub: 'Avg distinct functions/user' },
          { label: 'Whale Ratio',         value: pct(ub.whaleRatio),          sub: 'Users with ≥10 txs' },
        ].map(({ label, value, sub, warn = false }) => (
          <Card key={label} className={warn ? 'border-red-200' : ''}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${warn ? 'text-red-600' : ''}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Top users bar chart ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top Users by Activity</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Transaction count per wallet — colored by user type</p>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No user data available.</p>
          ) : (
            <>
              {/* Bar chart — top 10 */}
              <ResponsiveContainer width="100%" height={topUsersChart.length * 36 + 16}>
                <BarChart
                  data={topUsersChart}
                  layout="vertical"
                  margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                >
                  <CartesianGrid {...GRID_STYLE} horizontal={false} />
                  <XAxis type="number" {...AXIS_STYLE} tickFormatter={(v: number) => v.toLocaleString()} />
                  <YAxis
                    type="category"
                    dataKey="address"
                    width={96}
                    {...AXIS_STYLE}
                    tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: any, _: any, props: any) => [
                      `${Number(v).toLocaleString()} txs`,
                      props.payload?.userType ?? 'user',
                    ]}
                  />
                  <Bar dataKey="txs" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {topUsersChart.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="txs"
                      position="right"
                      style={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 600 }}
                      formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : v)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 mb-5 flex-wrap">
                {[
                  { type: 'whale',   color: 'bg-purple-400', label: 'Whale' },
                  { type: 'power',   color: 'bg-blue-500',   label: 'Power' },
                  { type: 'regular', color: 'bg-green-500',  label: 'Regular' },
                  { type: 'other',   color: 'bg-gray-400',   label: 'Other' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                    {label}
                  </span>
                ))}
              </div>

              {/* Full detail table */}
              <div className="overflow-x-auto border-t pt-4">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">#</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Address</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Txs</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium hidden sm:table-cell">Total Value</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium hidden sm:table-cell">Gas Spent</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...users]
                      .sort((a, b) => (b.transactionCount || 0) - (a.transactionCount || 0))
                      .map((u: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="py-2 px-3 font-mono text-xs">{formatAddr(u.address)}</td>
                          <td className="text-right py-2 px-3 font-semibold">{u.transactionCount}</td>
                          <td className="text-right py-2 px-3 text-muted-foreground hidden sm:table-cell">{formatEth(u.totalValue)}</td>
                          <td className="text-right py-2 px-3 text-muted-foreground hidden sm:table-cell">{formatEth(u.totalGasSpent)}</td>
                          <td className="text-center py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.userType === 'whale'   ? 'bg-purple-100 text-purple-700' :
                              u.userType === 'power'   ? 'bg-blue-100 text-blue-700'    :
                              u.userType === 'regular' ? 'bg-green-100 text-green-700'  :
                              'bg-gray-100 text-gray-600'
                            }`}>{u.userType}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
