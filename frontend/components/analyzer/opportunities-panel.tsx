'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Zap } from 'lucide-react';

interface FeatureGap { feature: string; competitors_count: number; adoption_rate: number; score: number }
interface UserOverlap { available_wallets: number; overlap_wallets: number; score: number }
interface RetentionPlay { competitorId: string; d1_rate: number; d30_rate: number; score: number }

interface Opportunities {
  featureGaps: FeatureGap[];
  userOverlap: UserOverlap;
  retentionPlays: RetentionPlay[];
}

export function OpportunitiesPanel({ contractId }: { contractId: string }) {
  const [data, setData] = useState<Opportunities | null>(null);

  useEffect(() => {
    if (!contractId) return;
    api.get(`/api/analysis/${contractId}/opportunities`).then(setData).catch(() => {});
  }, [contractId]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading opportunities...</p>;

  return (
    <div className="space-y-4">
      {/* Feature Gaps */}
      {data.featureGaps?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Feature Gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.featureGaps.slice(0, 5).map(gap => (
              <div key={gap.feature} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{gap.feature}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{gap.competitors_count} competitors</span>
                  <Badge variant="secondary">Score {gap.score}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* User Overlap */}
      {data.userOverlap && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> User Overlap Opportunity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold">{data.userOverlap.available_wallets}</p><p className="text-xs text-muted-foreground">Available</p></div>
            <div><p className="text-2xl font-bold">{data.userOverlap.overlap_wallets}</p><p className="text-xs text-muted-foreground">Overlap</p></div>
            <div><p className="text-2xl font-bold text-primary">{data.userOverlap.score}</p><p className="text-xs text-muted-foreground">Score</p></div>
          </CardContent>
        </Card>
      )}

      {/* Retention Plays */}
      {data.retentionPlays?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Retention Plays</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.retentionPlays.map(play => (
              <div key={play.competitorId} className="flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">{play.competitorId}</span>
                <span>D1 {play.d1_rate}% → D30 {play.d30_rate}%</span>
                <Badge variant="secondary">Score {play.score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!data.featureGaps?.length && !data.retentionPlays?.length && (
        <p className="text-sm text-muted-foreground">No opportunities detected yet. Add competitors to get started.</p>
      )}
    </div>
  );
}
