'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Award, Clock, AlertTriangle, TrendingUp, Target, Users } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface UxTabProps { analysisResults: any }

import { CHART_COLORS, CHART_PRIMARY, CHART_SECONDARY, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from '@/lib/chart-colors';
const COLORS = CHART_COLORS;

export function UxTab({ analysisResults }: UxTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.metrics.getDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fr  = data || analysisResults?.results?.target?.fullReport || {};
  const ux  = fr.uxAnalysis        || {};
  const act = fr.activationMetrics || {};
  const ret = fr.retentionMetrics  || {};
  const ul  = fr.userLifecycle     || {};
  const dm  = fr.defiMetrics       || {};
  const uj  = fr.userJourneys      || {};

  const grade     = ux.uxGrade || {};
  const gradeColor =
    grade.grade === 'A' ? 'text-green-600 bg-green-100 border-green-300' :
    grade.grade === 'B' ? 'text-blue-600 bg-blue-100 border-blue-300'   :
    grade.grade === 'C' ? 'text-yellow-600 bg-yellow-100 border-yellow-300' :
    grade.grade === 'D' ? 'text-orange-600 bg-orange-100 border-orange-300' :
    'text-red-600 bg-red-100 border-red-300';

  const pct = (v: any) => v != null ? `${v}%` : 'N/A';
  const val = (v: any, fb = 'N/A') => (v != null && v !== '') ? v : fb;

  const funnelData = (act.activationFunnel || []);
  const featureData = (act.featureFirstUse || []).slice(0, 6);

  const lifecycleData = [
    { name: 'New',       value: ul.summary?.newUsers       || 0, fill: CHART_PRIMARY },
    { name: 'Returning', value: ul.summary?.returningUsers || 0, fill: CHART_SECONDARY },
  ].filter(d => d.value > 0);

  const retentionBars = [
    { name: 'D1',  value: ret.d1Retention  || 0 },
    { name: 'D7',  value: ret.d7Retention  || 0 },
    { name: 'D30', value: ret.d30Retention || 0 },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /><span>Loading UX analysis...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
          ⚠ Using cached data. ({error})
        </p>
      )}

      {/* ── UX Grade + key metrics ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Award className="h-3 w-3" /> UX Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-bold px-3 py-1 rounded-lg border ${gradeColor}`}>
                {grade.grade || 'N/A'}
              </span>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Success: {grade.completionRate != null ? `${(grade.completionRate*100).toFixed(1)}%` : 'N/A'}</div>
                <div>Failure: {grade.failureRate != null ? `${(grade.failureRate*100).toFixed(1)}%` : 'N/A'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Session Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{val(ux.sessionDurations?.averageDuration)}</p>
            <p className="text-xs text-muted-foreground mt-1">First → last tx per wallet</p>
            {ux.sessionDurations?.averageDurationMinutes === 0 && (
              <p className="text-xs text-amber-600 mt-1">0m = no timestamps in dataset</p>
            )}
          </CardContent>
        </Card>

        <Card className={`border-orange-200 ${(dm.bounceRate||0) > 70 ? 'border-red-300' : ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Bounce Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(dm.bounceRate||0) > 70 ? 'text-red-600' : ''}`}>
              {pct(dm.bounceRate)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Users with 1 interaction only</p>
            {(dm.bounceRate||0) > 70 && <p className="text-xs text-red-600 mt-1">⚠ High — improve first experience</p>}
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Activation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(dm.activationRate||0) < 30 ? 'text-red-600' : 'text-green-600'}`}>
              {pct(dm.activationRate)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Users who return after first tx</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Journey metrics ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Journey Length', value: val(uj.averageJourneyLength, '0'), sub: 'Avg txs per user', icon: <Users className="h-3 w-3" /> },
          { label: 'Time to Activation',  value: val(act.avgTimeToActivation),     sub: 'First → second tx', icon: <Clock className="h-3 w-3" /> },
          { label: 'Retention Rate',      value: pct(ul.summary?.retentionRate),   sub: 'Returning users', icon: <TrendingUp className="h-3 w-3" /> },
          { label: 'Time to First Tx',    value: val(dm.avgTimeToFirstInteraction),sub: 'Avg onboarding time', icon: <Target className="h-3 w-3" /> },
        ].map(({ label, value, sub, icon }) => (
          <Card key={label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Activation Funnel ─────────────────────────────────────────── */}
      {funnelData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Activation Funnel — Drop-off Points</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {funnelData.map((s: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{s.step}</span>
                    <span className="font-semibold">{s.users} users ({s.pct}%)</span>
                  </div>
                  <Progress value={s.pct} className="h-2" />
                  {i > 0 && funnelData[i-1].pct - s.pct > 20 && (
                    <p className="text-xs text-red-600 mt-0.5">
                      ⚠ {(funnelData[i-1].pct - s.pct).toFixed(0)}% drop-off here — fix this step
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Feature First Use */}
          {featureData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Feature First Use — Entry Points</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={featureData} layout="vertical">
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis type="number" {...AXIS_STYLE} />
                    <YAxis dataKey="feature" type="category" width={90} {...AXIS_STYLE} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => `${v} users`} />
                    <Bar dataKey="count" fill={CHART_PRIMARY} radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground mt-2">Which feature users try first — optimize the top entry point</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Retention curve + lifecycle ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Retention Curve</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={retentionBars}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="name" {...AXIS_STYLE} />
                <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v:any)=>`${v}%`} />
                <Bar dataKey="value" fill={CHART_SECONDARY} radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
            {ret.d1Retention === 0 && ret.d7Retention === 0 && (
              <p className="text-xs text-amber-600 mt-2">0% = no block timestamps in dataset. Will populate with live monitoring.</p>
            )}
          </CardContent>
        </Card>

        {lifecycleData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">User Lifecycle Stages</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={lifecycleData} cx="50%" cy="50%" innerRadius={35} outerRadius={70} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {lifecycleData.map((e: any, i: number) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
                  </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Bottlenecks / recommendations ────────────────────────────── */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            UX Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            (dm.bounceRate||0) > 70  && { severity: 'high',   msg: `Bounce rate is ${dm.bounceRate}% — ${ul.summary?.newUsers} users never returned. Improve the first-interaction experience.` },
            (dm.activationRate||0) < 30 && { severity: 'high', msg: `Activation rate is ${dm.activationRate}% — only ${ul.summary?.returningUsers} of ${ul.summary?.totalUsers} users came back. Add re-engagement hooks.` },
            (ret.d7Retention||0) < 10 && { severity: 'medium', msg: `7-day retention is ${ret.d7Retention}% — users aren't forming habits. Consider notifications or incentives.` },
            (ux.bottlenecks||[]).length > 0 && { severity: 'medium', msg: `${ux.bottlenecks.length} transaction bottleneck(s) detected — investigate failed tx patterns.` },
            grade.grade === 'A' && { severity: 'good', msg: `UX Grade A — ${(grade.completionRate*100).toFixed(0)}% transaction success rate. Maintain this standard.` },
          ].filter(Boolean).map((r: any, i: number) => (
            <div key={i} className={`p-3 rounded-lg border text-sm ${
              r.severity === 'high'   ? 'bg-red-50 border-red-200 text-red-800' :
              r.severity === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-800' :
              'bg-green-50 border-green-200 text-green-800'
            }`}>
              {r.severity === 'high' ? '🔴' : r.severity === 'medium' ? '🟡' : '🟢'} {r.msg}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
