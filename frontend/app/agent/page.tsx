'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { Header } from '@/components/ui/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, Bot, Target, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PERMISSION_LABELS: Record<string, string> = {
  regressionAlerts:  'Metric drop alerts',
  sendDigests:       'Daily & weekly email digest',
  createTasks:       'Auto-create improvement tasks',
  autoAnalyze:       'Weekly auto-analysis',
  checkCompetitors:  'Competitor spike alerts',
  postSocial:        'Auto social media posts',
};

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'up' || direction === 'growing' || direction === 'improving')
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (direction === 'down' || direction === 'declining')
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function AgentPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [config, setConfig]           = useState<any>(null);
  const [predictions, setPredictions] = useState<any>(null);
  const [profile, setProfile]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/agent');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      (api as any).agent.getConfig(),
      (api as any).agent.getPredictions(),
    ]).then(([cfg, pred]) => {
      setConfig(cfg);
      setPredictions(pred?.predictions);
      setProfile(pred?.profile);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated]);

  const togglePermission = async (key: string, val: boolean) => {
    try {
      const updated = await (api as any).agent.updateConfig({ permissions: { [key]: val } });
      setConfig(updated);
    } catch {
      toast({ title: 'Failed to update setting', variant: 'destructive' });
    }
  };

  const toggleEnabled = async (val: boolean) => {
    try {
      const updated = await (api as any).agent.updateConfig({ enabled: val });
      setConfig(updated);
    } catch {
      toast({ title: 'Failed to update setting', variant: 'destructive' });
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await (api as any).agent.refreshPredictions();
      setPredictions(result?.predictions);
      toast({ title: 'Predictions refreshed' });
    } catch {
      toast({ title: 'Refresh failed', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  if (authLoading || loading) return (
    <div className="page-shell flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const p = predictions;
  const churnColor = p?.churnRisk?.level === 'high' ? 'text-red-500' : p?.churnRisk?.level === 'medium' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="page-shell">
      <Header />
      <div className="page-container max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" /> AI Agent</h1>
            <p className="text-muted-foreground text-sm mt-1">Predictions, patterns, and automation settings</p>
          </div>
          {config && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Agent {config.enabled ? 'active' : 'paused'}</span>
              <Switch checked={!!config.enabled} onCheckedChange={toggleEnabled} />
            </div>
          )}
        </div>

        {/* Pattern summary */}
        {profile?.summary && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pattern Summary</CardTitle></CardHeader>
            <CardContent>
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
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">30-Day Predictions</CardTitle>
            <div className="flex items-center gap-2">
              {p && <span className="text-xs text-muted-foreground">Confidence: {p.confidence}</span>}
              <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!p ? (
              <p className="text-sm text-muted-foreground">Run at least 2 analyses to generate predictions.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{p.summary}</p>

                {/* Metric forecasts */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Users', data: p.next30Days?.users },
                    { label: 'Transactions', data: p.next30Days?.transactions },
                    { label: 'Retention', data: p.next30Days?.retentionRate, suffix: '%' },
                    { label: 'Churn', data: p.next30Days?.churnRate, suffix: '%' },
                  ].map(({ label, data, suffix = '' }) => data && (
                    <div key={label} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <TrendIcon direction={data.trend} />
                      </div>
                      <div className="text-lg font-semibold">{data.value}{suffix}</div>
                      <div className="text-xs text-muted-foreground">
                        from {data.current}{suffix} ({data.changePct > 0 ? '+' : ''}{data.changePct}%)
                      </div>
                      <div className="text-xs text-muted-foreground">range: {data.low}–{data.high}{suffix}</div>
                    </div>
                  ))}
                </div>

                {/* Churn risk + growth score */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Churn Risk</span>
                    </div>
                    <div className={`text-lg font-semibold ${churnColor}`}>{p.churnRisk?.level}</div>
                    <div className="text-xs text-muted-foreground">score {p.churnRisk?.score}/100</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Growth Score</span>
                    </div>
                    <div className="text-lg font-semibold">{p.growthScore?.score}/100</div>
                    <div className="text-xs text-muted-foreground">{p.growthScore?.label}</div>
                  </div>
                </div>

                {/* Milestones */}
                {Object.keys(p.timeToMilestone || {}).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Upcoming milestones</p>
                    <div className="space-y-1">
                      {Object.entries(p.timeToMilestone).map(([key, val]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <Target className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{key.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">~{val.days} days ({val.date})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Automation toggles */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Automation Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {config ? Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={!!config.permissions?.[key]}
                  onCheckedChange={(val) => togglePermission(key, val)}
                  disabled={!config.enabled}
                />
              </div>
            )) : <p className="text-sm text-muted-foreground">Loading settings…</p>}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
