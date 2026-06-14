'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, ShieldAlert, GitBranch, MessageCircle, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface IntelligenceTabProps {
  contractAddress: string;
  chain: string;
  githubUrl?: string;
  twitterHandle?: string;
}

const RISK_COLOR: Record<string, string> = {
  low:      'text-green-500',
  medium:   'text-yellow-500',
  high:     'text-red-500',
  critical: 'text-red-700',
};

const RISK_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  low:      'default',
  medium:   'secondary',
  high:     'destructive',
  critical: 'destructive',
};

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/20" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeDasharray={`${score} 100`} strokeLinecap="round" className={color} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{score}</span>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export function IntelligenceTab({ contractAddress, chain, githubUrl, twitterHandle }: IntelligenceTabProps) {
  const { toast } = useToast();
  const [scores, setScores]       = useState<any>(null);
  const [onChain, setOnChain]     = useState<any>(null);
  const [github, setGithub]       = useState<any>(null);
  const [sentiment, setSentiment] = useState<any>(null);
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [position, setPosition]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [s, oc, sent, bench, pos] = await Promise.allSettled([
        (api as any).agent.getIntelligenceScores(),
        (api as any).agent.getOnchainRisk(contractAddress, chain),
        (api as any).agent.getSentiment(contractAddress, chain, twitterHandle),
        (api as any).agent.getBenchmarks(),
        (api as any).agent.getMarketPosition(),
      ]);
      if (s.status === 'fulfilled')     setScores(s.value);
      if (oc.status === 'fulfilled')    setOnChain(oc.value);
      if (sent.status === 'fulfilled')  setSentiment(sent.value);
      if (bench.status === 'fulfilled') setBenchmarks(bench.value);
      if (pos.status === 'fulfilled')   setPosition(pos.value);

      if (githubUrl) {
        const g = await (api as any).agent.getGithubIntelligence(githubUrl).catch(() => null);
        if (g) setGithub(g);
      }
    } catch {
      toast({ title: 'Failed to load intelligence data', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [contractAddress]);

  const refresh = () => { setRefreshing(true); load(); };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const riskSignals = onChain?.signals || [];

  return (
    <div className="space-y-6 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Intelligence Scores</h3>
          <p className="text-xs text-muted-foreground">On-chain risk · Developer health · Community sentiment</p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Score rings */}
      {scores && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-around flex-wrap gap-4">
              <ScoreRing score={scores.tractionScore}        label="Traction"     color="text-blue-500" />
              <ScoreRing score={100 - scores.riskScore}      label="Safety"       color="text-green-500" />
              <ScoreRing score={scores.sustainabilityScore}  label="Sustainability" color="text-purple-500" />
              <ScoreRing score={scores.communityHealthScore} label="Community"    color="text-orange-500" />
              <ScoreRing score={scores.growthProbability}    label="Growth"       color="text-cyan-500" />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Risk Level: <span className={`font-semibold ${RISK_COLOR[scores.riskLevel] || ''}`}>{scores.riskLevel}</span></span>
              <span>Confidence: {scores.confidenceInterval}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* On-chain risk */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> On-Chain Risk
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {onChain?.details?.ownership && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ownership renounced</span>
              {onChain.details.ownership.isRenounced
                ? <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                : <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="h-3.5 w-3.5" /> No</span>}
            </div>
          )}
          {onChain?.details?.code && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Upgradeable proxy</span>
              {onChain.details.code.isProxy
                ? <span className="text-yellow-500">Yes — logic can change</span>
                : <span className="text-green-500">No</span>}
            </div>
          )}
          {onChain?.details?.concentration && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Top holder</span>
                <span>{onChain.details.concentration.top1Pct?.toFixed(2)}% of supply</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Top 10 concentration</span>
                  <span>{onChain.details.concentration.top10Pct?.toFixed(1)}%</span>
                </div>
                <Progress value={onChain.details.concentration.top10Pct} className="h-1.5" />
              </div>
            </>
          )}
          {riskSignals.length > 0 ? (
            <div className="space-y-1 pt-1">
              {riskSignals.map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> No risk signals detected
            </p>
          )}
        </CardContent>
      </Card>

      {/* GitHub + Sentiment side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* GitHub */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Developer Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!github ? (
              <p className="text-xs text-muted-foreground">No GitHub URL provided during onboarding.</p>
            ) : github.error ? (
              <p className="text-xs text-muted-foreground">{github.error}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{github.owner}/{github.repo}</span>
                  <Badge variant={github.devHealthScore >= 60 ? 'default' : github.devHealthScore >= 30 ? 'secondary' : 'destructive'}>
                    {github.devHealthScore}/100
                  </Badge>
                </div>
                <Progress value={github.devHealthScore} className="h-1.5" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                  <span>Commits (30d): <strong className="text-foreground">{github.commits30d}</strong></span>
                  <span>Contributors: <strong className="text-foreground">{github.contributorCount}</strong></span>
                  <span>Last commit: <strong className="text-foreground">{github.lastCommitDaysAgo}d ago</strong></span>
                  <span>Stars: <strong className="text-foreground">{github.stars?.toLocaleString()}</strong></span>
                </div>
                {github.isAbandoned && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Repository appears abandoned
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Community Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!sentiment || sentiment.error ? (
              <p className="text-xs text-muted-foreground">Sentiment data unavailable.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{sentiment.coinName || contractAddress.slice(0, 8) + '...'}</span>
                  <Badge variant={sentiment.direction === 'positive' ? 'default' : sentiment.direction === 'negative' ? 'destructive' : 'secondary'}>
                    {sentiment.direction}
                  </Badge>
                </div>
                <Progress value={sentiment.sentimentScore} className="h-1.5" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                  <span>Score: <strong className="text-foreground">{sentiment.sentimentScore}/100</strong></span>
                  <span>Up votes: <strong className="text-foreground">{sentiment.upVotesPct?.toFixed(0)}%</strong></span>
                  <span>24h price: <strong className={sentiment.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}>{sentiment.priceChange24h?.toFixed(2)}%</strong></span>
                  <span>Velocity: <strong className="text-foreground">{sentiment.narrativeVelocity}</strong></span>
                </div>
                {sentiment.twitterFollowers > 0 && (
                  <p className="text-xs text-muted-foreground">Twitter: {sentiment.twitterFollowers?.toLocaleString()} followers</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Market Position */}
      {position && !position.error && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Market Position
              <span className="text-xs font-normal text-muted-foreground capitalize">
                {position.category} category
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-lg font-bold ${
                  position.positionLabel === 'Top Performer' ? 'text-green-500' :
                  position.positionLabel === 'Above Average' ? 'text-blue-500' :
                  position.positionLabel === 'Average' ? 'text-yellow-500' : 'text-red-500'
                }`}>{position.positionLabel}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  #{position.rank} of {position.totalProtocols} tracked protocols
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{position.positionScore}%</div>
                <div className="text-xs text-muted-foreground">metrics above avg</div>
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-green-500">✓ {position.benchmarkSummary?.good} good</span>
              <span className="text-yellow-500">→ {position.benchmarkSummary?.warn} average</span>
              <span className="text-red-500">↓ {position.benchmarkSummary?.bad} below avg</span>
            </div>
            {position.protocols?.length > 1 && (
              <div className="border-t pt-3 space-y-1.5">
                {position.protocols.map((p: any, i: number) => (
                  <div key={p.address || i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4">#{i + 1}</span>
                      <span className={p.isYou ? 'font-semibold text-primary' : ''}>{p.name}</span>
                      {p.isYou && <Badge variant="default" className="text-xs py-0">You</Badge>}
                    </div>
                    <span className="text-muted-foreground">{p.users?.toLocaleString()} users</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benchmarks */}
      {benchmarks?.benchmarks && Object.keys(benchmarks.benchmarks).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Peer Benchmarks
              <span className="text-xs font-normal text-muted-foreground capitalize">
                vs {benchmarks.category} category
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(benchmarks.benchmarks).map(([key, data]: [string, any]) => {
              const label: Record<string, string> = {
                retentionRate7d: 'D7 Retention', retentionRate: 'Retention Rate',
                successRate: 'Success Rate', churnRate: 'Churn Rate',
                botRatio: 'Bot Activity', uniqueUsers: 'Unique Users',
              };
              const statusColor = data.status === 'good' ? 'text-green-500'
                : data.status === 'bad' ? 'text-red-500' : 'text-yellow-500';
              const statusIcon = data.status === 'good' ? '↑' : data.status === 'bad' ? '↓' : '→';
              const unit = ['successRate','retentionRate7d','retentionRate','churnRate','botRatio'].includes(key) ? '%' : '';

              return (
                <div key={key} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <span className="font-medium">{label[key] || key}</span>
                    {data.context && <p className="text-xs text-muted-foreground mt-0.5">{data.context}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-semibold ${statusColor}`}>
                      {statusIcon} {data.value?.toFixed ? data.value.toFixed(1) : data.value}{unit}
                    </span>
                    {data.avg != null && (
                      <p className="text-xs text-muted-foreground">avg {data.avg}{unit}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
