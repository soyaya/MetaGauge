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
  const [loading, setLoading] = useState(true); // start true so spinner shows immediately
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

  useEffect(() => {
    let cancelled = false;
    if (!analysisId) return;
    setLoading(true);
    setError(null);
    api.analysis.getAISummary(analysisId)
      .then(result => { if (!cancelled) setData(result); })
      .catch((e: any) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [analysisId]);

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

  // interpretation.interpretation is the parsed Gemini JSON object
  const interp = interpretation?.interpretation || {};
  const interpText: string | null =
    typeof interp === 'string' ? interp :
    interp.summary?.overallHealth ? `Overall health: ${interp.summary.overallHealth}. Risk: ${interp.summary.riskLevel}. Score: ${interp.summary.performanceScore}/100` :
    null;
  const interpFindings: string[] = interp.summary?.keyFindings || [];
  const interpRecs: any[] = interp.recommendations || [];
  const interpAlerts: any[] = interp.alerts || alerts?.alerts || [];
  const interpStrengths: string[] = interp.insights?.strengths || [];
  const interpWeaknesses: string[] = interp.insights?.weaknesses || [];

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
              <div key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded text-foreground">
                <span className="text-yellow-500 mt-0.5 shrink-0">•</span>
                {typeof ins === 'string' ? ins : ins.text || ins.insight || ins.overall || ins.summary || JSON.stringify(ins)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Interpretation / Summary ──────────────────────────────────── */}
      {(interpText || interpFindings.length > 0 || interpStrengths.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-blue-500" />Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {interpText && <p className="text-sm text-foreground leading-relaxed">{interpText}</p>}
            {interpFindings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Findings</p>
                {interpFindings.map((f, i) => <div key={i} className="text-sm flex gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-foreground"><span className="text-blue-500">→</span>{f}</div>)}
              </div>
            )}
            {interpStrengths.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Strengths</p>
                {interpStrengths.map((s, i) => <div key={i} className="text-sm flex gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded text-foreground"><span className="text-green-500">✓</span>{s}</div>)}
              </div>
            )}
            {interpWeaknesses.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Weaknesses</p>
                {interpWeaknesses.map((w, i) => <div key={i} className="text-sm flex gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-foreground"><span className="text-red-500">✗</span>{w}</div>)}
              </div>
            )}
            {interpRecs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommendations</p>
                {interpRecs.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="text-sm flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-foreground">
                    <span className="text-blue-500 shrink-0">→</span>
                    {typeof r === 'string' ? r : r.description || r.title || JSON.stringify(r)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      {interpAlerts.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {interpAlerts.map((a: any, i: number) => (
              <div key={i} className={`text-sm p-2 rounded border ${
                a.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-100' :
                a.severity === 'warning'  ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100' :
                'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100'
              }`}>
                <span className="font-medium">{a.title || a.type || a.severity}: </span>{a.message || a.description || String(a)}
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
              <div key={i} className="text-sm p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100">
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

      {/* Fallback — data loaded but all sections empty */}
      {!interpText && !interpFindings.length && !interpStrengths.length && !interpRecs.length && !interpAlerts.length && !insights?.insights?.length && (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">
          AI insights loaded but no content was returned. Try clicking Refresh or run a new analysis.
        </CardContent></Card>
      )}
    </div>
  );
}
