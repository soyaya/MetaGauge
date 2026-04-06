'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, CheckCheck } from 'lucide-react';

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

const SEVERITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  critical: 'destructive', high: 'destructive', medium: 'default', low: 'secondary'
};

export function AlertList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/alerts')
      .then(d => setAlerts(d.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const acknowledge = async (id: string) => {
    await api.patch(`/api/alerts/${id}/acknowledge`, {});
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true, acknowledged_at: new Date().toISOString() } : a));
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading alerts...</p>;
  if (!alerts.length) return <p className="text-sm text-muted-foreground">No alerts yet.</p>;

  return (
    <div className="space-y-3">
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
  );
}
