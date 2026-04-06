'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, AlertTriangle, TrendingUp, Zap, Shield, RefreshCw } from 'lucide-react';

interface EnhancedAIInsightsProps {
  analysisId: string;
  analysisResults?: any;
}

export function EnhancedAIInsights({ analysisId, analysisResults }: EnhancedAIInsightsProps) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = async () => {
    if (!analysisId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.analysis.getAISummary(analysisId);
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [analysisId]);

  if (!analysisId) return (
    <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">
      No analysis available. Complete onboarding and trigger indexing first.
    </CardContent></Card>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      <span>Generating AI insights... (this may take 10-20s)</span>
    </div>
  );

  if (error) return (
    <Card className="border-red-200">
      <CardContent className="pt-6 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <Button size="sm" onClick={load}>Retry</Button>
      </CardContent>
    </Card>
  );

  if (!data) return (
    <Card><CardContent className="pt-6 text-center">
      <Button onClick={load} className="gap-2"><Brain className="h-4 w-4" />Generate AI Insights</Button>
    </CardContent></Card>
  );

  if (!data.enabled) return (
    <Card className="border-amber-200">
      <CardContent className="pt-6 text-center text-sm text-amber-700">
        {data.message}
      </CardContent>
    </Card>
  );

  const { insights, interpretation, alerts, sentiment, optimizations } = data;

  const sentimentColor =
    sentiment?.sentiment === 'bullish'  ? 'bg-green-100 text-green-800' :
    sentiment?.sentiment === 'bearish'  ? 'bg-red-100 text-red-800'    :
    'bg-gray-100 text-gray-800';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Analysis</span>
          {insights?.score != null && (
            <Badge variant={insights.score >= 70 ? 'default' : 'destructive'}>
              Score: {insights.score}/100
            </Badge>
          )}
          {sentiment?.sentiment && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColor}`}>
              {sentiment.sentiment}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-1">
          <RefreshCw className="h-3 w-3" />Refresh
        </Button>
      </div>

      {/* ── Quick Insights ────────────────────────────────────────────── */}
      {insights?.insights?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" />Key Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.insights.map((ins: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded">
                <span className="text-yellow-500 mt-0.5">•</span>
                {typeof ins === 'string' ? ins : ins.text || ins.insight || ins.overall || ins.summary || JSON.stringify(ins)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Interpretation / Summary ──────────────────────────────────── */}
      {interpretation?.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-blue-500" />Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{interpretation.summary}</p>
            {interpretation.recommendations?.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommendations</p>
                {interpretation.recommendations.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="text-sm flex items-start gap-2 p-2 bg-blue-50 rounded">
                    <span className="text-blue-500">→</span>
                    {typeof r === 'string' ? r : r.text || r.recommendation || r.suggestion || JSON.stringify(r)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      {alerts?.alerts?.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.alerts.map((a: any, i: number) => (
              <div key={i} className={`text-sm p-2 rounded border ${
                a.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                a.severity === 'warning'  ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <span className="font-medium">{a.type || a.severity}: </span>{a.message || a.description || String(a)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Optimizations ─────────────────────────────────────────────── */}
      {optimizations?.suggestions?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" />Optimizations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {optimizations.suggestions.slice(0, 5).map((s: any, i: number) => (
              <div key={i} className="text-sm p-2 bg-green-50 rounded border border-green-200 text-green-800">
                {typeof s === 'string' ? s : s.suggestion || s.description || JSON.stringify(s)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Sentiment ─────────────────────────────────────────────────── */}
      {sentiment && !sentiment.error && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-purple-500" />Market Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${sentimentColor}`}>
                {sentiment.sentiment || 'neutral'}
              </span>
              {sentiment.confidence != null && (
                <span className="text-xs text-muted-foreground">Confidence: {(sentiment.confidence * 100).toFixed(0)}%</span>
              )}
            </div>
            {sentiment.summary && <p className="text-sm text-muted-foreground">{sentiment.summary}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
