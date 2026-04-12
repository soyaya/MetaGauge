'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, CheckCheck, AlertTriangle, TrendingDown } from 'lucide-react';
import Link from 'next/link';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  is_read: boolean;
  acknowledged_at: string | null;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  pillar: string;
  description: string;
  priority: string;
  status: string;
  current: number;
  target: number;
  pendingConfirmation: boolean;
}

const SEVERITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  critical: 'destructive', high: 'destructive', medium: 'default', low: 'secondary'
};

export function AlertList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      (api as any).alerts.getAlerts().catch(() => ({ alerts: [] })),
      (api as any).traction.getTasks().catch(() => ({ tasks: [] })),
    ]).then(([alertData, taskData]) => {
      setAlerts(alertData.alerts || []);
      setTasks((taskData.tasks || []).filter((t: Task) => t.status === 'open'));
    }).finally(() => setLoading(false));
  }, []);

  const acknowledge = async (id: string) => {
    await (api as any).alerts.acknowledge(id);
    setAlerts(prev => prev.map((a: Alert) => a.id === id ? { ...a, is_read: true, acknowledged_at: new Date().toISOString() } : a));
    // Tell the header to refresh its count immediately
    window.dispatchEvent(new Event('notifications-refresh'));
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading alerts...</p>;

  return (
    <div className="space-y-6">
      {/* Triggered system alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">System Alerts</p>
          {alerts.map(alert => (
            <Card key={alert.id} className={alert.is_read ? 'opacity-60' : ''}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 shrink-0" />
                  <CardTitle className="text-sm font-medium">{alert.title}</CardTitle>
                  <Badge variant={SEVERITY_VARIANT[alert.severity] || 'default'}>{alert.severity}</Badge>
                </div>
                {!alert.is_read && (
                  <Button size="sm" variant="ghost" onClick={() => acknowledge(alert.id)}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Open productivity tasks */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open Issues ({tasks.length})</p>
            <Link href="/analyzer" className="text-xs text-primary hover:underline">View & resolve →</Link>
          </div>
          {tasks.map(task => (
            <Card key={task.id} className={`border-l-4 ${task.priority === 'high' ? 'border-l-red-400' : 'border-l-yellow-400'}`}>
              <CardContent className="py-3 flex items-start gap-3">
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${task.priority === 'high' ? 'text-red-500' : 'text-yellow-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{task.title}</span>
                    <Badge variant="outline" className="text-xs">{task.pillar}</Badge>
                    {task.priority === 'high' && <Badge className="text-xs bg-red-50 text-red-700 border-red-200">High</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <TrendingDown className="h-3 w-3" />
                    <span>Now: <strong>{task.current}</strong> → Target: <strong>{task.target}</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {alerts.length === 0 && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No active alerts or open issues.</p>
      )}
    </div>
  );
}
