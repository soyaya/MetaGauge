'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, Target, Clock, TrendingUp } from 'lucide-react';

export function PlaybooksTab() {
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    (api as any).agent.getPlaybooks()
      .then((r: any) => setPlaybooks(r.playbooks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!playbooks.length) return (
    <div className="py-16 text-center">
      <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-3" />
      <p className="font-semibold">All metrics are on track</p>
      <p className="text-sm text-muted-foreground mt-1">No playbooks needed right now. Check back after your next analysis.</p>
    </div>
  );

  return (
    <div className="space-y-4 pt-4">
      <div>
        <h3 className="font-semibold">Growth Playbooks</h3>
        <p className="text-xs text-muted-foreground mt-1">Step-by-step guides for your underperforming metrics — prioritised by impact.</p>
      </div>

      {playbooks.map((pb: any) => (
        <Card key={pb.metric} className={pb.status === 'bad' ? 'border-red-200' : 'border-yellow-200'}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm">{pb.title}</CardTitle>
                  <Badge variant={pb.status === 'bad' ? 'destructive' : 'secondary'} className="text-xs">
                    {pb.status === 'bad' ? 'Needs attention' : 'Below average'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{pb.problem}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Target className="h-3 w-3" />{pb.target}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pb.timeframe}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === pb.metric ? null : pb.metric)}>
                {expanded === pb.metric ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          {expanded === pb.metric && (
            <CardContent className="pt-0">
              <div className="space-y-3 border-t pt-3">
                {pb.steps.map((s: any) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {s.step}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
