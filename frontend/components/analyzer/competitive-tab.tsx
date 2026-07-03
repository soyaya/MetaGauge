'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, TrendingUp, TrendingDown, Users, Activity, Zap, Target, Trash2, Brain, Bell } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from '@/lib/chart-colors';

// Vivid glowing colors for competitors (index 0 = your contract, 1+ = competitors)
const CONTRACT_COLORS = [
  { bg: 'bg-blue-600',   glow: 'shadow-blue-400/60',   border: 'border-blue-500',   text: 'text-blue-600',   hex: '#2563EB', light: 'bg-blue-50 dark:bg-blue-950/40',   badge: 'bg-blue-100 text-blue-800' },
  { bg: 'bg-yellow-500', glow: 'shadow-yellow-400/70',  border: 'border-yellow-400', text: 'text-yellow-600', hex: '#EAB308', light: 'bg-yellow-50 dark:bg-yellow-950/40', badge: 'bg-yellow-100 text-yellow-800' },
  { bg: 'bg-red-500',    glow: 'shadow-red-400/70',     border: 'border-red-400',    text: 'text-red-600',    hex: '#EF4444', light: 'bg-red-50 dark:bg-red-950/40',       badge: 'bg-red-100 text-red-800' },
  { bg: 'bg-emerald-500',glow: 'shadow-emerald-400/70', border: 'border-emerald-400',text: 'text-emerald-600',hex: '#10B981', light: 'bg-emerald-50 dark:bg-emerald-950/40',badge: 'bg-emerald-100 text-emerald-800' },
  { bg: 'bg-purple-500', glow: 'shadow-purple-400/70',  border: 'border-purple-400', text: 'text-purple-600', hex: '#8B5CF6', light: 'bg-purple-50 dark:bg-purple-950/40', badge: 'bg-purple-100 text-purple-800' },
  { bg: 'bg-orange-500', glow: 'shadow-orange-400/70',  border: 'border-orange-400', text: 'text-orange-600', hex: '#F97316', light: 'bg-orange-50 dark:bg-orange-950/40', badge: 'bg-orange-100 text-orange-800' },
];
const getColor = (i: number) => CONTRACT_COLORS[i % CONTRACT_COLORS.length];

interface CompetitiveTabProps { analysisResults: any }

export function CompetitiveTab({ analysisResults }: CompetitiveTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ address: '', chain: 'ethereum', name: '' });
  const [addMsg, setAddMsg] = useState('');

  const load = () => {
    setLoading(true);
    api.competitive.getDashboard()
      .then(d => { setData(d); setAddMsg(''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.address) return;
    setAdding(true);
    const prevCount = data?.competitors?.length || 0;
    try {
      await api.competitive.addCompetitor(form);
      setAddMsg(`Indexing ${form.name || form.address.slice(0,10)}... Refreshing every 10s`);
      setForm({ address: '', chain: 'ethereum', name: '' });
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const d = await api.competitive.getDashboard();
          // Stop only when count actually increased (new competitor appeared)
          if ((d.competitors?.length || 0) > prevCount) {
            setData(d); setAddMsg('Competitor loaded!'); clearInterval(poll);
          }
        } catch { /* keep polling */ }
        if (attempts >= 9) { clearInterval(poll); load(); }
      }, 10000);
    } catch (e: any) { setAddMsg(`Error: ${e.message}`); }
    finally { setAdding(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin mr-2" />Loading...</div>;

  const me = data?.myBenchmark || {};
  const competitors = data?.competitors || [];
  const insights = data?.insights || [];
  const strengths = data?.strengths || [];
  const weaknesses = data?.weaknesses || [];

  const myColor = getColor(0);

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className={`rounded-lg p-6 border-2 ${myColor.border} ${myColor.light} shadow-lg`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-3 h-3 rounded-full ${myColor.bg} shadow-lg`} />
              <h2 className="text-2xl font-bold">{me.name || 'Your Contract'}</h2>
              <Badge className={myColor.badge}>You</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Benchmarked against {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
              {data?.quota && <span className="ml-2 text-xs">· <span title="Competitor slots used (deleting doesn't reset this)">{data.quota.used}/{data.quota.limit} slots used ({data.quota.remaining} remaining on {data.quota.tier} plan)</span></span>}
            </p>
            <div className="flex flex-wrap gap-3">
              <StatBadge icon={<Activity className="h-4 w-4" />} label="Txs" value={(me.totalTxs||0).toLocaleString()} color={myColor} />
              <StatBadge icon={<Users className="h-4 w-4" />} label="Users" value={(me.uniqueUsers||0).toLocaleString()} color={myColor} />
              <StatBadge icon={<Target className="h-4 w-4" />} label="Success" value={`${me.successRate||0}%`} color={myColor} />
              <StatBadge icon={<Zap className="h-4 w-4" />} label="Gas" value={me.avgGasCostUSD?`$${me.avgGasCostUSD}`:'N/A'} color={myColor} />
            </div>
          </div>
          <AddCompetitorButton form={form} setForm={setForm} adding={adding} handleAdd={handleAdd} addMsg={addMsg} />
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins: any, i: number) => (
            <div key={i} className={`flex items-start gap-3 p-4 rounded-lg border ${
              ins.type === 'good'
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            }`}>
              {ins.type === 'good' ? <TrendingUp className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <TrendingDown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
              <p className={`text-sm font-medium ${ins.type === 'good' ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>{ins.msg}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RadarChartCard data={data} me={me} competitors={competitors} />
          <BarChartCard data={data} me={me} competitors={competitors} />
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20">
          <CardHeader><CardTitle className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2"><TrendingUp className="h-4 w-4" />Strengths</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {strengths.length ? strengths.map((s: string, i: number) => <p key={i} className="text-sm text-green-900 dark:text-green-100 bg-green-100/50 dark:bg-green-900/30 rounded p-2 border border-green-200 dark:border-green-800">{s}</p>) : <p className="text-xs text-muted-foreground">Add competitors to see strengths</p>}
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
          <CardHeader><CardTitle className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2"><Target className="h-4 w-4" />Growth Opportunities</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {weaknesses.length ? weaknesses.map((w: string, i: number) => <p key={i} className="text-sm text-amber-900 dark:text-amber-100 bg-amber-100/50 dark:bg-amber-900/30 rounded p-2 border border-amber-200 dark:border-amber-800">{w}</p>) : <p className="text-xs text-muted-foreground">Add competitors to see opportunities</p>}
          </CardContent>
        </Card>
      </div>

      {/* Full comparison table */}
      <FullComparisonTable me={me} competitors={competitors} featureBenchmark={data?.featureBenchmark || []} allNames={data?.allContractNames || [me.name || 'You']} />

      {/* Competitors list */}
      {competitors.length > 0 && <CompetitorsList competitors={competitors} onRemove={load} />}
    </div>
  );
}

function StatBadge({ icon, label, value, color }: any) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${color?.border || 'border-border'} ${color?.light || 'bg-background'}`}>
      {icon}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color?.text || ''}`}>{value}</span>
    </div>
  );
}

function AddCompetitorButton({ form, setForm, adding, handleAdd, addMsg }: any) {
  const [open, setOpen] = useState(false);
  const LIMITS: Record<string, number> = { free: 3, starter: 5, pro: 10, enterprise: 25 };
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Competitor</Button>;
  return (
    <Card className="w-80">
      <CardHeader className="pb-3"><CardTitle className="text-sm">Add Competitor</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Input placeholder="0x..." value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} className="font-mono text-xs" />
        <div className="flex gap-2">
          <Input placeholder="Name" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="flex-1 text-xs" />
          <select value={form.chain} onChange={e => setForm((f: any) => ({ ...f, chain: e.target.value }))} className="border rounded px-2 text-xs bg-background">
            {['ethereum'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleAdd} disabled={adding || !form.address} className="flex-1">
            {adding ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Indexing</> : 'Start'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
        {addMsg && <p className="text-xs text-blue-600">{addMsg}</p>}
        <p className="text-xs text-muted-foreground border-t pt-2" title="Deleting a competitor does not restore your slot — the analysis count is permanent">
          Free: 2 · Starter: 4 · Pro: 9 · Enterprise: 24 · Slots are permanent (deleting doesn't reset)
        </p>
      </CardContent>
    </Card>
  );
}

function RadarChartCard({ data, me, competitors }: any) {
  const radarData = data?.radarData || [];
  if (!radarData.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Performance Radar</CardTitle><CardDescription className="text-xs">Multi-dimensional comparison</CardDescription></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis domain={[0,100]} tick={{ fontSize: 9 }} />
            <Radar name={me.name||'You'} dataKey="you" stroke={CONTRACT_COLORS[0].hex} fill={CONTRACT_COLORS[0].hex} fillOpacity={0.5} strokeWidth={2} />
            {competitors.map((c: any, i: number) => (
              <Radar key={c.name} name={c.name} dataKey={c.name} stroke={CONTRACT_COLORS[(i+1)%CONTRACT_COLORS.length].hex} fill={CONTRACT_COLORS[(i+1)%CONTRACT_COLORS.length].hex} fillOpacity={0.25} strokeWidth={2} />
            ))}
            <Legend /><Tooltip {...TOOLTIP_STYLE} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function BarChartCard({ data, me, competitors }: any) {
  const allNames = data?.allContractNames || [me.name || 'You'];
  const barData = [
    { metric: 'Success %', ...Object.fromEntries(allNames.map((n: string, i: number) => [n, i===0 ? me.successRate||0 : competitors[i-1]?.successRate||0])) },
    { metric: 'Activation %', ...Object.fromEntries(allNames.map((n: string, i: number) => [n, i===0 ? me.activationRate||0 : competitors[i-1]?.activationRate||0])) },
    { metric: 'Retention %', ...Object.fromEntries(allNames.map((n: string, i: number) => [n, i===0 ? me.retentionRate||0 : competitors[i-1]?.retentionRate||0])) },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Key Metrics</CardTitle><CardDescription className="text-xs">Side-by-side comparison</CardDescription></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="metric" {...AXIS_STYLE} />
            <YAxis domain={[0,100]} /><Tooltip {...TOOLTIP_STYLE} /><Legend />
            {allNames.map((n: string, i: number) => <Bar key={n} dataKey={n} fill={CONTRACT_COLORS[i%CONTRACT_COLORS.length].hex} radius={[4,4,0,0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function CompetitorsList({ competitors, onRemove }: any) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4" />Indexed Competitors ({competitors.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitors.map((c: any, i: number) => <CompetitorCard key={c.address || c.id || i} competitor={c} colorIndex={i + 1} onRemove={onRemove} />)}
      </div>
    </div>
  );
}

function CompetitorCard({ competitor, colorIndex, onRemove }: any) {
  const color = getColor(colorIndex);
  const compId = `${competitor.address?.toLowerCase()}_${competitor.chain}`;
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    api.competitive.getAlerts()
      .then((d: any) => setAlerts((d.alerts || []).filter((a: any) => a.competitorId === compId)))
      .catch(() => {});
  }, [compId]);

  const fetchInsight = async () => {
    setInsightLoading(true);
    try {
      const d = await api.competitive.getInsight(compId);
      setInsight(d.insight?.text || 'No insight available.');
    } catch (e: any) { setInsight('Failed: ' + e.message); }
    finally { setInsightLoading(false); }
  };

  return (
    <Card className={`border-2 ${color.border} shadow-lg hover:shadow-xl transition-shadow`}>
      <CardHeader className={`pb-3 ${color.light} rounded-t-lg`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-3 h-3 rounded-full ${color.bg} shadow-md`} />
              <CardTitle className="text-base">{competitor.name}</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{competitor.address?.slice(0,16)}...</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${color.badge}`}>{competitor.chain}</Badge>
            <button onClick={async () => {
              if (!confirmRemove) { setConfirmRemove(true); return; }
              try { await api.competitive.removeCompetitor(compId); onRemove(); }
              catch (e: any) { alert('Failed: ' + e.message); }
            }} onBlur={() => setConfirmRemove(false)} className={`text-xs px-2 py-0.5 rounded ${confirmRemove ? 'bg-red-500 text-white' : 'text-red-500 hover:text-red-700'}`} title="Remove">
              {confirmRemove ? 'Confirm?' : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {([
            ['Txs', (competitor.totalTxs||0).toLocaleString(), 'Total transactions indexed from this contract'],
            ['Users', (competitor.uniqueUsers||0).toLocaleString(), 'Unique wallet addresses that interacted'],
            ['Success', `${competitor.successRate||0}%`, 'Percentage of transactions that succeeded'],
            ['Activation', `${competitor.activationRate||0}%`, 'Users who made a 2nd transaction (returned)'],
            ['Bounce', `${competitor.bounceRate||0}%`, 'Users who only interacted once and never returned'],
            ['Quality', `${competitor.walletQuality||0}/100`, 'Composite score: tx count + return rate + success rate'],
          ] as [string,string,string][]).map(([l, v, tip]) => (
            <div key={l} className={`flex justify-between p-2 rounded border ${color.border} ${color.light}`} title={tip}>
              <span className="text-muted-foreground">{l} ℹ</span>
              <span className={`font-semibold ${color.text}`}>{v}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-3">
          {!insight ? (
            <Button size="sm" variant="outline" onClick={fetchInsight} disabled={insightLoading} className={`w-full border ${color.border} ${color.text}`}>
              {insightLoading ? <><Loader2 className="h-3 w-3 animate-spin mr-2" />Loading</> : <><Brain className="h-3 w-3 mr-2" />AI Insight</>}
            </Button>
          ) : (
            <div className={`${color.light} border ${color.border} rounded p-3 text-xs space-y-2`}>
              <p className="whitespace-pre-line text-muted-foreground">{insight}</p>
              <button onClick={() => setInsight(null)} className={`${color.text} hover:underline text-xs`}>Refresh</button>
            </div>
          )}
        </div>

        <div className="border-t pt-3 space-y-2">
          {alerts.length > 0 && (
            <div className="space-y-1 mb-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Bell className="h-3 w-3" /> Active Alerts ({alerts.length})
              </p>
              {alerts.map((a: any) => (
                <div key={a.id} className={`flex items-center justify-between p-2 rounded text-xs ${color.light} border ${color.border}`}>
                  <span className={color.text}>{a.name || `${a.metric} ${a.condition} ${a.threshold}`}</span>
                  <button onClick={async () => {
                    await api.competitive.deleteAlert(a.id);
                    setAlerts(prev => prev.filter((x: any) => x.id !== a.id));
                  }} className="text-red-500 hover:text-red-700 ml-2" title="Delete alert">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!alertOpen ? (
            <Button size="sm" variant="outline" onClick={() => setAlertOpen(true)} className={`w-full border ${color.border} ${color.text}`}>
              <Bell className="h-3 w-3 mr-2" />{alerts.length > 0 ? 'Add Another Alert' : 'Create Alert'}
            </Button>
          ) : (
            <AlertForm competitorId={compId} competitorName={competitor.name} color={color}
              onClose={() => setAlertOpen(false)}
              onCreated={(a: any) => { setAlerts(prev => [...prev, a]); setAlertOpen(false); }} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FullComparisonTable({ me, competitors, featureBenchmark, allNames }: any) {
  const [view, setView] = useState<'overview' | 'features'>('overview');

  // Overview rows — key metrics for every contract
  const overviewMetrics = [
    // Activity
    { label: 'Total Transactions',  key: 'totalTxs',       fmt: (v: any) => (v||0).toLocaleString(),          group: 'Activity' },
    { label: 'Unique Users',        key: 'uniqueUsers',    fmt: (v: any) => (v||0).toLocaleString(),          group: 'Activity' },
    { label: 'DAU',                 key: 'dau',            fmt: (v: any) => (v||0).toLocaleString(),          group: 'Activity', higherBetter: true, tip: 'Daily Active Users — unique wallets in last 24h' },
    { label: 'WAU',                 key: 'wau',            fmt: (v: any) => (v||0).toLocaleString(),          group: 'Activity', higherBetter: true, tip: 'Weekly Active Users — unique wallets in last 7 days' },
    { label: 'MAU',                 key: 'mau',            fmt: (v: any) => (v||0).toLocaleString(),          group: 'Activity', higherBetter: true, tip: 'Monthly Active Users — unique wallets in last 30 days' },
    // Retention
    { label: 'Retention Rate',      key: 'retentionRate',  fmt: (v: any) => `${v||0}%`,                       group: 'Retention', higherBetter: true, tip: 'Overall % of wallets that made more than one transaction' },
    { label: 'D1 Retention',        key: 'd1Retention',    fmt: (v: any) => `${v||0}%`,                       group: 'Retention', higherBetter: true, tip: 'Users who returned within 24h of first interaction' },
    { label: 'D7 Retention',        key: 'd7Retention',    fmt: (v: any) => `${v||0}%`,                       group: 'Retention', higherBetter: true, tip: 'Users still active 7 days after first interaction' },
    { label: 'D30 Retention',       key: 'd30Retention',   fmt: (v: any) => `${v||0}%`,                       group: 'Retention', higherBetter: true, tip: 'Users still active 30 days after first interaction' },
    { label: 'Churn Rate',          key: 'churnRate',      fmt: (v: any) => `${v||0}%`,                       group: 'Retention', higherBetter: false, tip: 'Users with no activity in last 30 days' },
    // Activation
    { label: 'Activation Rate',     key: 'activationRate', fmt: (v: any) => `${v||0}%`,                       group: 'Activation', higherBetter: true, tip: 'Users who made a 2nd transaction after their first' },
    { label: 'Bounce Rate',         key: 'bounceRate',     fmt: (v: any) => `${v||0}%`,                       group: 'Activation', higherBetter: false, tip: 'Users who only interacted once and never returned' },
    // Gas
    { label: 'Avg Gas Cost (USD)',  key: 'avgGasCostUSD',  fmt: (v: any) => v ? `$${v}` : 'N/A',             group: 'Gas', higherBetter: false, tip: 'Average USD cost per transaction' },
    { label: 'Avg Gas Used',        key: 'avgGasUsed',     fmt: (v: any) => (v||0).toLocaleString(),          group: 'Gas', higherBetter: false, tip: 'Average gas units consumed per transaction' },
    // Quality
    { label: 'Success Rate',        key: 'successRate',    fmt: (v: any) => `${v||0}%`,                       group: 'Quality', higherBetter: true },
    { label: 'Wallet Quality',      key: 'walletQuality',  fmt: (v: any) => `${v||0}/100`,                    group: 'Quality', higherBetter: true, tip: 'Composite score: tx count + return rate + success rate' },
    { label: 'Bot %',               key: 'botPct',         fmt: (v: any) => `${v||0}%`,                       group: 'Quality', higherBetter: false, tip: 'Estimated % of bot/sybil activity' },
  ];

  const allContracts = [{ ...me, _isMe: true }, ...competitors];
  const myVal = (key: string) => me[key] ?? 0;

  const cellColor = (key: string, val: any, higherBetter?: boolean) => {
    if (higherBetter == null || val == null) return '';
    const mv = myVal(key);
    if (val === mv) return '';
    const better = higherBetter ? val > mv : val < mv;
    return better ? 'text-green-600 font-semibold' : 'text-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Full Comparison Table</CardTitle>
            <CardDescription className="text-xs mt-1">
              {me.name || 'Your contract'} vs {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
              {competitors.length === 0 && ' — add competitors to compare'}
            </CardDescription>
          </div>
          <div className="flex gap-1 border rounded-lg p-1">
            <button onClick={() => setView('overview')} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view==='overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Overview</button>
            <button onClick={() => setView('features')} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view==='features' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Features</button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {view === 'overview' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Metric</th>
                  {allContracts.map((c: any, i: number) => {
                    const col = getColor(i);
                    return (
                      <th key={i} className={`text-right py-3 px-4 font-medium min-w-[120px] ${col.light}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${col.bg} shadow`} />
                          <span className={col.text}>{c.name || `Competitor ${i}`}</span>
                        </div>
                        {c._isMe && <div className="text-xs font-normal text-muted-foreground">You</div>}
                        {!c._isMe && <div className="text-xs font-normal text-muted-foreground">{c.chain}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lastGroup = '';
                  return overviewMetrics.map(({ label, key, fmt, higherBetter, group, tip }: any) => {
                    const groupHeader = group !== lastGroup ? (lastGroup = group, group) : null;
                    return (
                      <React.Fragment key={key}>
                        {groupHeader && (
                          <tr className="bg-muted/60">
                            <td colSpan={allContracts.length + 1} className="py-1.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group}</td>
                          </tr>
                        )}
                        <tr key={key} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-4 text-xs text-muted-foreground" title={tip}>{label}{tip && ' ℹ'}</td>
                          {allContracts.map((c: any, i: number) => {
                            const col = getColor(i);
                            return (
                              <td key={i} className={`text-right py-2.5 px-4 ${col.light} ${c._isMe ? `font-semibold ${col.text}` : cellColor(key, c[key], higherBetter)}`}>
                                {fmt(c[key])}
                              </td>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          ) : (
            // Features view
            featureBenchmark.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No feature data yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-48">Function</th>
                    {allNames.map((n: string, i: number) => {
                      const col = getColor(i);
                      return (
                        <th key={n} colSpan={3} className={`text-center py-3 px-2 font-medium border-l ${col.light}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${col.bg}`} />
                            <span className={col.text}>{n}{i===0 && ' (You)'}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="py-2 px-4"></th>
                    {allNames.map((n: string) => (
                      <>
                        <th key={`${n}-u`} className="py-2 px-2 text-right border-l">Users</th>
                        <th key={`${n}-f`} className="py-2 px-2 text-right">Fail%</th>
                        <th key={`${n}-g`} className="py-2 px-2 text-right">Gas$</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureBenchmark.map((row: any) => (
                    <tr key={row.feature} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-4 text-xs font-mono text-muted-foreground max-w-[180px] truncate" title={row.feature}>{row.feature}</td>
                      {allNames.map((n: string, i: number) => {
                        const cell = row[n];
                        const col = getColor(i);
                        return (
                          <>
                            <td key={`${n}-u`} className={`text-right py-2 px-2 text-xs border-l ${col.light} ${i===0 ? `font-medium ${col.text}` : ''}`}>{cell?.adoption ?? '—'}</td>
                            <td key={`${n}-f`} className={`text-right py-2 px-2 text-xs ${col.light} ${cell?.failRate > 5 ? 'text-red-500' : ''}`}>{cell?.failRate != null ? `${cell.failRate}%` : '—'}</td>
                            <td key={`${n}-g`} className={`text-right py-2 px-2 text-xs ${col.light}`}>{cell?.avgGasUSD != null ? `$${cell.avgGasUSD}` : '—'}</td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Better than you</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Worse than you</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Your contract</span>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertForm({ competitorId, competitorName, onClose, onCreated, color }: any) {
  const [form, setForm] = useState({ metric: 'uniqueUsers', condition: 'above', threshold: '', name: '' });
  const [msg, setMsg] = useState('');
  const METRICS = [
    { value: 'uniqueUsers', label: 'Users', tip: 'Number of unique wallets' },
    { value: 'transactions', label: 'Transactions', tip: 'Total transaction count' },
    { value: 'successRate', label: 'Success Rate %', tip: 'Transaction success percentage' },
    { value: 'avgGasUsed', label: 'Avg Gas Used', tip: 'Average gas units per transaction' },
  ];
  const CONDITIONS = [
    { value: 'above', label: 'goes above', tip: 'Alert when metric exceeds your threshold' },
    { value: 'below', label: 'drops below', tip: 'Alert when metric falls under your threshold' },
    { value: 'overtakes_me', label: 'overtakes mine', tip: 'Alert when competitor surpasses your own value' },
  ];

  const submit = async () => {
    if (!form.threshold && form.condition !== 'overtakes_me') { setMsg('Enter a threshold value'); return; }
    try {
      const d = await api.competitive.createAlert({
        competitorId, metric: form.metric, condition: form.condition,
        threshold: Number(form.threshold) || 0,
        name: form.name || `${competitorName}: ${form.metric} ${form.condition} ${form.threshold}`,
      });
      onCreated?.(d.config);
      setMsg('Alert created');
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  return (
    <div className={`space-y-3 p-3 rounded border ${color?.border || 'border-border'} ${color?.light || ''}`}>
      <p className="text-xs font-semibold">Alert when <span className={color?.text}>{competitorName}</span>:</p>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Metric <span title="Which number to watch">ℹ</span></label>
          <select value={form.metric} onChange={e => setForm(f=>({...f,metric:e.target.value}))} className="border rounded px-2 py-1.5 text-xs bg-background w-full">
            {METRICS.map(m => <option key={m.value} value={m.value} title={m.tip}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Condition <span title="When to fire the alert">ℹ</span></label>
          <select value={form.condition} onChange={e => setForm(f=>({...f,condition:e.target.value}))} className="border rounded px-2 py-1.5 text-xs bg-background w-full">
            {CONDITIONS.map(c => <option key={c.value} value={c.value} title={c.tip}>{c.label}</option>)}
          </select>
        </div>
        {form.condition !== 'overtakes_me' && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Threshold value</label>
            <input type="number" placeholder="e.g. 100" value={form.threshold} onChange={e => setForm(f=>({...f,threshold:e.target.value}))} className="border rounded px-2 py-1.5 text-xs bg-background w-full" />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Alert name (optional)</label>
          <input placeholder={`${competitorName} ${form.metric} alert`} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="border rounded px-2 py-1.5 text-xs bg-background w-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} className="flex-1">Save Alert</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
      {msg && <p className={`text-xs ${msg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
    </div>
  );
}
