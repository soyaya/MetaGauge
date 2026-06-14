'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, Users, Zap, ArrowUpRight } from 'lucide-react';

const URGENCY_COLOR: Record<string, string> = {
  high:   'border-red-200 bg-red-50/30 dark:bg-red-950/10',
  medium: 'border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/10',
  low:    'border-border',
};
const URGENCY_BADGE: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive', medium: 'secondary', low: 'outline',
};
const EFFORT_COLOR: Record<string, string> = {
  low: 'text-green-500', medium: 'text-yellow-500', high: 'text-red-500',
};

export function LifecycleCampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  useEffect(() => {
    (api as any).agent.getLifecycleCampaigns()
      .then((r: any) => setCampaigns(r.campaigns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!campaigns.length) return (
    <div className="py-16 text-center">
      <Users className="h-8 w-8 text-green-500 mx-auto mb-3" />
      <p className="font-semibold">No campaigns needed right now</p>
      <p className="text-sm text-muted-foreground mt-1">Run more analyses to unlock lifecycle insights.</p>
    </div>
  );

  return (
    <div className="space-y-4 pt-4">
      <div>
        <h3 className="font-semibold">Lifecycle Campaigns</h3>
        <p className="text-xs text-muted-foreground mt-1">
          On-chain campaign suggestions based on your wallet lifecycle data — sorted by urgency.
        </p>
      </div>

      {campaigns.map((stage: any) => (
        <Card key={stage.stage} className={URGENCY_COLOR[stage.urgency]}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm">{stage.stage}</CardTitle>
                  <Badge variant={URGENCY_BADGE[stage.urgency]} className="text-xs capitalize">
                    {stage.urgency} priority
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" />{stage.dataSignal}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === stage.stage ? null : stage.stage)}>
                {expanded === stage.stage ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          {expanded === stage.stage && (
            <CardContent className="pt-0 space-y-3 border-t">
              {stage.campaigns?.map((c: any) => {
                const key = `${stage.stage}-${c.name}`;
                return (
                  <div key={c.name} className="pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{c.name}</p>
                          <span className={`text-xs ${EFFORT_COLOR[c.effort]}`}>
                            {c.effort} effort
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{c.mechanic}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="shrink-0"
                        onClick={() => setExpandedCampaign(expandedCampaign === key ? null : key)}>
                        {expandedCampaign === key ? <ChevronDown className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </Button>
                    </div>

                    {expandedCampaign === key && (
                      <div className="mt-3 space-y-2 pl-3 border-l-2 border-primary/20">
                        <div>
                          <p className="text-xs font-medium text-primary">On-chain implementation</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.onChainAction}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-green-600">Expected impact</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.estimatedImpact}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
