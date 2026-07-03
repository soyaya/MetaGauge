'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, Target, AlertTriangle, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const PERMISSION_LABELS: Record<string, string> = {
  regressionAlerts: 'Metric drop alerts',
  sendDigests:      'Daily & weekly digest',
  createTasks:      'Auto-create tasks',
  autoAnalyze:      'Weekly auto-analysis',
  checkCompetitors: 'Competitor spike alerts',
  postSocial:       'Auto social posts',
};

function TrendIcon({ direction }: { direction?: string }) {
  if (!direction) return null;
  if (['up','growing','improving'].includes(direction)) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (['down','declining'].includes(direction))         return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function AgentTab() {
  const { toast } = useToast();
  const [config, setConfig]           = useState<any>(null);
  const [predictions, setPredictions] = useState<any>(null);
  const [profile, setProfile]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  useEffect(() => {
    Promise.all([
      (api as any).agent.getConfig(),
      (api as any).agent.getPredictions(),
    ]).then(([cfg, pred]) => {
      setConfig(cfg);
      setPredictions(pred?.predictions);
      setProfile(pred?.profile);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const togglePermission = async (key: string, val: boolean) => {
    try {
      const updated = await (api as any).agent.updateConfig({ permissions: { [key]: val } });
      setConfig(updated);
    } catch { toast({ title: 'Failed to update', variant: 'destructive' }); }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await (api as any).agent.refreshPredictions();
      setPredictions(result?.predictions);
      toast({ title: 'Predictions refreshed' });
    } catch { toast({ title: 'Refresh failed', variant: 'destructive' }); }
    finally { setRefreshing(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const p = predictions;
  const churnColor = p?.churnRisk?.level === 'high' ? 'text-red-500' : p?.churnRisk?.level === 'medium' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="space-y-6 pt-4">

      {/* Agent status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Agent</span>
          {config && (
            <Badge variant={config.enabled ? 'default' : 'secondary'} className="text-xs">
              {config.enabled ? 'Active' : 'Paused'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Refresh
          </Button>
          <Link href="/agent">
            <Button size="sm" variant="ghost" className="text-xs">Full view →</Button>
          </Link>
        </div>
      </div>

      {/* Pattern summary */}
      {profile?.summary && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm">{profile.summary}</p>
            {profile.milestones?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {profile.milestones.map((m: string) => (
                  <Badge key={m} variant="secondary" className="text-xs">{m.replace(/_/g, ' ')}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Predictions */}
      {!p ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Run at least 2 analyses to generate predictions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{p.summary}</p>

          {/* Metric forecast grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Users',        data: p.next30Days?.users },
              { label: 'Transactions', data: p.next30Days?.transactions },
              { label: 'Retention',    data: p.next30Days?.retentionRate, suffix: '%' },
              { label: 'Churn',        data: p.next30Days?.churnRate,     suffix: '%' },
            ].map(({ label, data, suffix = '' }) => data && (
              <Card key={label}>
                <CardContent className="pt-3 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{label} (30d)</span>
                    <TrendIcon direction={data.trend} />
                  </div>
                  <div className="text-xl font-bold">{data.value}{suffix}</div>
                  <div className="text-xs text-muted-foreground">
                    from {data.current}{suffix} &nbsp;
                    <span className={data.changePct >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {data.changePct > 0 ? '+' : ''}{data.changePct}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Churn risk + growth score + milestones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />Churn Risk
                </div>
                <div className={`text-lg font-semibold capitalize ${churnColor}`}>{p.churnRisk?.level}</div>
                <div className="text-xs text-muted-foreground">score {p.churnRisk?.score}/100</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />Growth Score
                </div>
                <div className="text-lg font-semibold">{p.growthScore?.score}/100</div>
                <div className="text-xs text-muted-foreground capitalize">{p.growthScore?.label}</div>
              </CardContent>
            </Card>
            {Object.keys(p.timeToMilestone || {}).length > 0 && (
              <Card>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                    <Target className="h-3.5 w-3.5" />Next Milestone
                  </div>
                  {Object.entries(p.timeToMilestone).slice(0, 1).map(([key, val]: [string, any]) => (
                    <div key={key}>
                      <div className="text-sm font-semibold">{key.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-muted-foreground">~{val.days} days ({val.date})</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Automation toggles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Automation</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config ? Object.entries(PERMISSION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <Switch
                checked={!!config.permissions?.[key]}
                onCheckedChange={(val) => togglePermission(key, val)}
                disabled={!config.enabled}
              />
            </div>
          )) : <p className="text-sm text-muted-foreground col-span-2">Loading…</p>}
        </CardContent>
      </Card>

    </div>
  );
}
