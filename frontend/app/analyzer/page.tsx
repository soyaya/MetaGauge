'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { Header } from '@/components/ui/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, Circle, AlertTriangle, Download, Brain, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { CHART_PRIMARY, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from '@/lib/chart-colors';

export default function TractionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [productivityScore, setProductivityScore] = useState<number>(0);
  const [agentTasks, setAgentTasks] = useState<any[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/analyzer');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      (api as any).traction.getDashboard()
        .then((d: any) => { setData(d); setProductivityScore(d.productivityScore ?? 0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && data?.contract) {
      setAgentLoading(true);
      (api as any).agent.analyze({ contractAddress: data.contract.address, chain: data.contract.chain })
        .then((r: any) => setAgentTasks(r.tasks || []))
        .catch(() => {})
        .finally(() => setAgentLoading(false));
    }
  }, [isAuthenticated, data?.contract?.address]);

  const exportCSV = () => {
    if (!data) return;
    const { ops, tasks, growth, retentionMetrics: r, activationMetrics: a, gasAnalysis: g, userQuality: q, contract } = data;
    const date = new Date().toISOString().slice(0,10);

    const sections: string[][] = [
      ['MetaGauge Traction Report'],
      [`Contract,${contract.name}`],
      [`Address,${contract.address}`],
      [`Chain,${contract.chain}`],
      [`Exported,${date}`],
      [''],
      ['=== OPS SCORE ==='],
      ['Metric,Value'],
      [`Overall OPS Score,${ops.total}/100`],
      [`Grade,${ops.label}`],
      [`Feature Stability,${ops.pillars.featureStability}/100`],
      [`Alert Response,${ops.pillars.responseToAlerts}/100`],
      [`Resolution Efficiency,${ops.pillars.resolutionEfficiency}/100`],
      [`Task Completion,${ops.pillars.taskCompletion}/100`],
      [`Hygiene,${ops.pillars.hygiene}/100`],
      [''],
      ['=== GROWTH METRICS ==='],
      ['Metric,Value'],
      [`Total Users,${growth.totalUsers}`],
      [`New Users,${growth.newUsers}`],
      [`Returning Users,${growth.returningUsers}`],
      [`DAU (Daily Active Users),${growth.dau}`],
      [`WAU (Weekly Active Users),${growth.wau}`],
      [`MAU (Monthly Active Users),${growth.mau}`],
      [`Total Transactions,${growth.txGrowth}`],
      [''],
      ['=== RETENTION ==='],
      ['Metric,Value,Target,Status'],
      [`D1 Retention,${r.d1Retention}%,20%,${r.d1Retention>=20?'Good':'Below target'}`],
      [`D7 Retention,${r.d7Retention}%,15%,${r.d7Retention>=15?'Good':'Below target'}`],
      [`D30 Retention,${r.d30Retention}%,10%,${r.d30Retention>=10?'Good':'Below target'}`],
      [`Churn Rate,${r.churnRate}%,<25%,${r.churnRate<=25?'Good':'High'}`],
      [`Resurrection Rate,${r.resurrectionRate}%,10%,${r.resurrectionRate>=10?'Good':'Below target'}`],
      [`Overall Retention,${r.retentionRate}%,40%,${r.retentionRate>=40?'Good':'Below target'}`],
      [''],
      ['=== ACTIVATION & ADOPTION ==='],
      ['Metric,Value,Target,Status'],
      [`Activation Rate,${a.activationRate}%,50%,${a.activationRate>=50?'Good':'Below target'}`],
      [`Bounce Rate,${data.defiMetrics?.bounceRate||0}%,<30%,${(data.defiMetrics?.bounceRate||0)<=30?'Good':'High'}`],
      [`Time to Activation,${a.avgTimeToActivation||'N/A'},,`],
      [`Avg Session Duration,${data.defiMetrics?.avgSessionDuration||'N/A'},,`],
      [''],
      ['=== GAS & COST ==='],
      ['Metric,Value,Target,Status'],
      [`Avg Gas Cost (USD),$${g?.averageGasCostUSD||0},$0.50,${(g?.averageGasCostUSD||0)<=0.5?'Good':'High'}`],
      [`Total Gas Cost (USD),$${g?.totalGasCostUSD||0},,`],
      [`Failed Transactions,${g?.failedTransactions||0},0,${(g?.failedTransactions||0)===0?'Good':'Has failures'}`],
      [`Gas Efficiency Score,${g?.gasEfficiencyScore||0}%,90%,${(g?.gasEfficiencyScore||0)>=90?'Good':'Below target'}`],
      [''],
      ['=== USER QUALITY ==='],
      ['Metric,Value,Target,Status'],
      [`Wallet Quality Score,${q?.avgWalletQuality||0}/100,65/100,${(q?.avgWalletQuality||0)>=65?'Good':'Below target'}`],
      [`Power User Rate,${q?.powerUserRate||0}%,15%,${(q?.powerUserRate||0)>=15?'Good':'Below target'}`],
      [`Bot Activity,${q?.botPct||0}%,<5%,${(q?.botPct||0)<=5?'Good':'High'}`],
      [`Unique Users,${growth.totalUsers},,`],
      [''],
      ['=== OPEN TASKS (Fix to improve score) ==='],
      ['Priority,Pillar,Task,Current,Target,Action'],
      ...tasks.map((t: any) => [`${t.priority.toUpperCase()},${t.pillar},"${t.title}",${t.current},${t.target},"${t.action}"`]),
    ];

    const csv = sections.map(r => Array.isArray(r) ? r.join(',') : r).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `traction-${contract.name}-${date}.csv`;
    el.click();
  };

  if (authLoading || loading) return (
    <div className="page-shell"><Header />
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin mr-3" /><span>Loading...</span>
      </div>
    </div>
  );

  if (!data) return (
    <div className="page-shell"><Header />
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">No analysis data yet. Complete onboarding first.</p>
        <Button onClick={() => router.push('/onboarding')}>Go to Onboarding</Button>
      </div>
    </div>
  );

  const {
    ops: rawOps,
    tasks = [],
    growth = {},
    featureInsights = [],
    recommendations = [],
    retentionMetrics: ret = {},
    activationMetrics: act = {},
    contract,
    labels = [],
  } = data;
  const ops = { total: 0, label: 'N/A', pillars: {}, ...rawOps };

  const opsRing = ops.total >= 75 ? '#22c55e' : ops.total >= 50 ? '#eab308' : '#ef4444';

  const pillarLabels: Record<string,string> = {
    featureStability: 'Feature Stability',
    responseToAlerts: 'Alert Response',
    resolutionEfficiency: 'Resolution',
    taskCompletion: 'Task Completion',
    hygiene: 'Hygiene',
  };
  const pillarWeights: Record<string,string> = {
    featureStability:'25%', responseToAlerts:'25%', resolutionEfficiency:'20%', taskCompletion:'15%', hygiene:'15%'
  };
  const pillarDescriptions: Record<string,string> = {
    featureStability:     'Measures how reliably your contract executes. Calculated from transaction success rate (70%) and absence of bot activity (30%). 100 = all txs succeed with no bots.',
    responseToAlerts:     'Measures how quickly you act on system alerts. Starts at 100 and drops by 15 points per unresolved alert. Keep your Alerts tab clear to maintain a high score.',
    resolutionEfficiency: 'Measures how well you retain users and reduce friction. Penalised by churn rate (×0.5) and bounce rate (×0.3). Lower churn and bounce = higher score.',
    taskCompletion:       'Measures weekly habit formation — the % of users who return within 7 days of their first transaction (D7 retention). Target: 10%+.',
    hygiene:              'Measures the quality of your user base. Combines activation rate (50%) and wallet quality score (50%). High-value, returning wallets push this score up.',
  };

  return (
    <div className="page-shell">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{contract.name} — Traction & Insights</h1>
            <p className="text-sm text-muted-foreground mt-1">{contract.chain} · <span className="font-mono">{contract.address?.slice(0,14)}...</span></p>
            <div className="flex flex-wrap gap-2 mt-2">
              {labels.map((l: any) => (
                <Badge key={l.label} variant="outline" className="text-xs">{l.label}</Badge>
              ))}
            </div>
          </div>
          <SendReportButton contractName={contract.name} />
        </div>

        {/* OPS Score */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-8 flex-wrap">              {/* Circle */}
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={opsRing} strokeWidth="10"
                    strokeDasharray={`${ops.total * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black" style={{color:opsRing}}>{ops.total}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              {/* Pillars */}
              <div className="flex-1 space-y-2 min-w-[220px]">
                <p className="text-sm font-semibold mb-3">Operational Productivity Score — <span style={{color:opsRing}}>{ops.label}</span></p>
                {Object.entries(ops.pillars).map(([key, val]: any) => (
                  <div key={key} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs text-muted-foreground w-28 sm:w-36 shrink-0 flex items-center gap-1 truncate">
                      {pillarLabels[key]} <span className="text-muted-foreground/60 hidden sm:inline">({pillarWeights[key]})</span>
                      <span className="relative group cursor-help shrink-0">
                        <svg className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeWidth="2" d="M12 16v-4M12 8h.01"/></svg>
                        <span className="absolute left-4 top-0 z-50 hidden group-hover:block w-56 rounded bg-popover border text-xs text-popover-foreground shadow-lg p-2 leading-relaxed">
                          {pillarDescriptions[key]}
                        </span>
                      </span>
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${val}%`, backgroundColor: val>=75?'#22c55e':val>=50?'#eab308':'#ef4444'}} />
                    </div>
                    <span className="text-xs font-semibold w-8 text-right shrink-0">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History trend */}
        <HistoryChart />

        {/* Growth snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'New Users',       value: growth.newUsers },
            { label:'Returning Users', value: growth.returningUsers },
            { label:'Total Txs',       value: growth.txGrowth },
            { label:'Activation Rate', value: `${act.activationRate}%` },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Retention */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Retention</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label:'D1', value: ret.d1Retention, good: ret.d1Retention >= 20 },
                { label:'D7', value: ret.d7Retention, good: ret.d7Retention >= 10 },
                { label:'D30', value: ret.d30Retention, good: ret.d30Retention >= 5 },
                { label:'Churn', value: ret.churnRate, good: ret.churnRate <= 30, lower: true },
                { label:'Overall', value: ret.retentionRate, good: ret.retentionRate >= 40 },
              ].map(({ label, value, good }) => (
                <div key={label} className={`rounded-lg border p-3 text-center ${good ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <p className={`text-xl font-bold ${good ? 'text-green-700' : 'text-red-600'}`}>{value}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  {good ? <TrendingUp className="h-3 w-3 text-green-500 mx-auto mt-1" /> : <TrendingDown className="h-3 w-3 text-red-500 mx-auto mt-1" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activation funnel */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Activation Funnel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(growth.activationFunnel || []).map((step: any) => (
              <div key={step.step}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{step.step}</span>
                  <span className="font-medium">{step.users} users · {step.pct}%</span>
                </div>
                <Progress value={step.pct} className="h-2" />
              </div>
            ))}
            <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
              <span>Time to activation: <strong>{act.avgTimeToActivation || 'N/A'}</strong></span>
              <span>Avg session: <strong>{data.defiMetrics?.avgSessionDuration || 'N/A'}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Feature adoption */}
        {featureInsights.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Feature Adoption</CardTitle><CardDescription className="text-xs">First interactions by users</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {featureInsights.map((f: any) => (
                <div key={f.feature} className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-32 sm:w-44 truncate" title={f.feature}>{f.feature}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-foreground/30 rounded-full" style={{width:`${f.adoption}%`}} />
                  </div>
                  <span className="text-xs font-medium w-10 text-right">{f.adoption}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold">Productivity Tasks</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Productivity Score</span>
              <span className="text-sm font-bold" style={{color: productivityScore>=75?'#22c55e':productivityScore>=40?'#eab308':'#ef4444'}}>
                {productivityScore}/100
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Fix issues in your project — each resolved task raises your productivity score.</p>
          <div className="space-y-2">
            {tasks.map((task: any) => (
              <TaskCard key={task.id} task={task} onResolved={setProductivityScore} />
            ))}
          </div>

          {/* AI Enhanced Tasks */}
          {(agentLoading || agentTasks.length > 0) && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Brain className="h-3 w-3" /> AI Enhanced Tasks
                {agentLoading && <span className="ml-1 animate-pulse">generating...</span>}
              </p>
              <div className="space-y-2">
                {agentTasks.map((task: any, i: number) => (
                  <div key={task.id || i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{task.goal || task.title}</span>
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">AI Enhanced</Badge>
                        {task.priority && (
                          <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                        )}
                      </div>
                      {task.rationale && <p className="text-xs text-muted-foreground mt-1">{task.rationale}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" />Recommendations</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {recommendations.map((r: string, i: number) => (
                <p key={i} className="text-sm text-muted-foreground border-l-2 border-muted pl-3">{r}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Generate Content */}

      </main>
    </div>
  );
}

// ── Task Card with live check ─────────────────────────────────────────────────

// ── Send Report Button with email + section picker ───────────────────────────
const REPORT_SECTIONS = [
  { id:'productivity', label:'Productivity (OPS Score)' },
  { id:'growth',       label:'Growth & Activity' },
  { id:'retention',    label:'Retention & Churn' },
  { id:'transactions', label:'Transactions & Gas' },
  { id:'activation',   label:'Activation & Onboarding' },
  { id:'quality',      label:'User Quality & Behaviour' },
  { id:'features',     label:'Feature Adoption' },
  { id:'topusers',     label:'Top Wallets' },
  { id:'tasks',        label:'Open Tasks' },
];

function SendReportButton({ contractName }: { contractName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>(REPORT_SECTIONS.map(s => s.id));
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const toggle = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const send = async () => {
    if (!email || !selected.length) return;
    setSending(true);
    try {
      await (api as any).traction.sendReport({ email, sections: selected });
      setMsg(`Report sent to ${email}`);
      setTimeout(() => { setOpen(false); setMsg(''); }, 2000);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    finally { setSending(false); }
  };

  if (!open) return (
    <Button variant="outline" onClick={() => setOpen(true)}>
      <Download className="h-4 w-4 mr-2" />Send Report
    </Button>
  );

  return (
    <Card className="w-80 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Send Traction Report</CardTitle>
        <CardDescription className="text-xs">Choose sections and enter email</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {REPORT_SECTIONS.map(s => (
            <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)}
                className="rounded" />
              {s.label}
            </label>
          ))}
        </div>
        <input type="email" placeholder="recipient@email.com" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded px-2 py-1.5 text-xs bg-background" />
        <div className="flex gap-2">
          <Button size="sm" onClick={send} disabled={sending || !email || !selected.length} className="flex-1">
            {sending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending...</> : 'Send PDF'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
        {msg && <p className={`text-xs ${msg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
      </CardContent>
    </Card>
  );
}

// ── History trend chart ───────────────────────────────────────────────────────
function HistoryChart() {
  const [history, setHistory] = useState<any[]>([]);
  const [metric, setMetric] = useState('ops');

  useEffect(() => {
    (api as any).traction.getHistory()
      .then((d: any) => setHistory(d.history || []))
      .catch(() => {});
  }, []);

  const METRICS = [
    { id:'ops', label:'OPS Score' }, { id:'retentionRate', label:'Retention %' },
    { id:'activationRate', label:'Activation %' }, { id:'d7Retention', label:'D7 Retention %' },
    { id:'churnRate', label:'Churn %' }, { id:'dau', label:'DAU' },
    { id:'totalTxs', label:'Total Txs' }, { id:'avgGasCostUSD', label:'Avg Gas $' },
    { id:'openTasks', label:'Open Tasks' },
  ];

  if (history.length < 2) return (
    <Card>
      <CardContent className="py-5 text-center text-xs text-muted-foreground">
        <p className="font-medium mb-1">Progress Over Time</p>
        <p>Tracking starts today. Come back tomorrow to see your first trend line.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm">Progress Over Time</CardTitle>
          <select value={metric} onChange={e => setMetric(e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
            {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <CardDescription className="text-xs">{history.length} day{history.length!==1?'s':''} tracked</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={(d:string) => d.slice(5)} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(d: any) => `Date: ${d}`} />
            <Line type="monotone" dataKey={metric} stroke={CHART_PRIMARY} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task, onResolved }: { task: any; onResolved?: (score: number) => void }) {
  const isResolved = task.status === 'resolved';
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [rec, setRec] = useState<string | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(isResolved);
  const [pending, setPending] = useState(task.pendingConfirmation ?? false);

  const borderColor = resolved && !pending ? 'border-l-green-400' : pending ? 'border-l-yellow-400' : task.priority === 'high' ? 'border-l-red-400' : 'border-l-orange-300';

  const check = async () => {
    setChecking(true);
    try {
      const d = await (api as any).traction.checkTask(task.id);
      setCheckResult(d);
      if (d.resolved) { setResolved(true); setPending(false); onResolved?.(d.productivityScore); }
    } catch (e: any) {
      setCheckResult({ resolved: false, aiGuidance: 'Check failed: ' + e.message });
    } finally { setChecking(false); }
  };

  const submitResolve = async () => {
    if (!feedback.trim()) return;
    setResolving(true);
    try {
      const d = await (api as any).traction.resolveTask(task.id, feedback);
      setResolved(true);
      setPending(true);
      setShowFeedback(false);
      onResolved?.(d.productivityScore);
      window.dispatchEvent(new Event('notifications-refresh'));
    } catch (e: any) {
      setCheckResult({ resolved: false, aiGuidance: 'Failed: ' + e.message });
    } finally { setResolving(false); }
  };

  const getRecommendation = async () => {
    setRecLoading(true);
    try {
      const d = await (api as any).traction.getRecommendation(task.id);
      setRec(d.recommendation);
    } catch (e: any) { setRec('Failed: ' + e.message); }
    finally { setRecLoading(false); }
  };

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="py-3 flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {resolved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-sm font-medium ${resolved ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
            <Badge variant="outline" className="text-xs">{task.pillar}</Badge>
            {task.priority === 'high' && !resolved && <Badge className="text-xs bg-red-50 text-red-700 border-red-200">High</Badge>}
            {resolved && !pending && <Badge className="text-xs bg-green-50 text-green-700 border-green-200">Confirmed</Badge>}
            {resolved && pending && <Badge className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Pending confirmation</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mb-1.5">{task.description}</p>
          <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">{task.action}</p>

          {task.target != null && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>Now: <strong className={task.lowerBetter ? (task.current<=task.target?'text-green-600':'text-red-500') : (task.current>=task.target?'text-green-600':'text-red-500')}>{task.current}</strong></span>
              <span>→ Target: <strong>{task.target}</strong></span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${resolved ? 'bg-green-500' : 'bg-red-400'}`}
                  style={{width:`${Math.min(100, task.lowerBetter ? Math.max(0,(1-task.current/Math.max(task.target,1))*100) : Math.min(100,(task.current/Math.max(task.target,1))*100))}%`}} />
              </div>
            </div>
          )}

          {checkResult && (
            <div className={`mt-2 rounded px-2 py-1.5 text-xs ${checkResult.resolved ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
              <strong>{checkResult.resolved ? 'On track!' : 'AI:'}</strong> {checkResult.aiGuidance}
            </div>
          )}

          {rec && (
            <div className="mt-2 rounded px-2 py-1.5 text-xs bg-muted/50 whitespace-pre-line">
              <strong className="text-foreground block mb-1">Recommendation:</strong>
              <span className="text-muted-foreground">{rec}</span>
            </div>
          )}

          {showFeedback && !resolved && (
            <div className="mt-2 space-y-2">
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="How did you fix this? (e.g. 'Added weekly email digest, churn dropped from 45% to 22%')"
                className="w-full border rounded px-2 py-1.5 text-xs bg-background resize-none h-16"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submitResolve} disabled={resolving || !feedback.trim()} className="text-xs">
                  {resolving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving...</> : 'Submit & Mark Resolved'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowFeedback(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {!resolved && !showFeedback && (
            <div className="flex gap-3 mt-2">
              <button onClick={check} disabled={checking}
                className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                {checking ? <><Loader2 className="h-3 w-3 animate-spin" />Checking...</> : '↻ Check live data'}
              </button>
              <button onClick={() => setShowFeedback(true)}
                className="text-xs text-green-600 hover:underline flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />Mark resolved
              </button>
              <button onClick={getRecommendation} disabled={recLoading}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1 disabled:opacity-50">
                {recLoading ? <><Loader2 className="h-3 w-3 animate-spin" />Loading...</> : <><Brain className="h-3 w-3" />Get recommendation</>}
              </button>
            </div>
          )}
          {pending && !showFeedback && (
            <div className="flex gap-3 mt-2">
              <button onClick={check} disabled={checking}
                className="text-xs text-yellow-600 hover:underline flex items-center gap-1 disabled:opacity-50">
                {checking ? <><Loader2 className="h-3 w-3 animate-spin" />Checking...</> : '↻ Verify fix in live data'}
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
