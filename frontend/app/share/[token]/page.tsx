'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, TrendingUp, Users, Zap } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const RISK_COLOR: Record<string, string> = {
  low: 'text-green-500', medium: 'text-yellow-500',
  high: 'text-red-500',  critical: 'text-red-700',
};

function Ring({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/20" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeDasharray={`${score} 100`} strokeLinecap="round" className={color} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold">{score}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/share/${token}/data`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error)))
      .then(setData)
      .catch(e => setError(e || 'Link expired or invalid'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-2xl font-bold">Link expired</p>
      <p className="text-muted-foreground">{error}</p>
      <Link href="/" className="text-primary underline text-sm">Visit MetaGauge</Link>
    </div>
  );

  const { contract, scores, metrics } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">MetaGauge</span>
            <Badge variant="secondary" className="text-xs">Intelligence Report</Badge>
          </div>
          <Link href="/signup" className="text-xs text-primary underline shrink-0">Get your own report →</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">

        {/* Contract header */}
        <div>
          <h1 className="text-2xl font-bold">{contract.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {contract.address?.slice(0, 10)}...{contract.address?.slice(-6)}
            </span>
            <Badge variant="outline">{contract.chain}</Badge>
            {contract.category && <Badge variant="outline">{contract.category}</Badge>}
          </div>
        </div>

        {/* Score rings */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-6 text-center">Verified on-chain intelligence scores</p>
            <div className="flex justify-around flex-wrap gap-4">
              <Ring score={scores.tractionScore}        label="Traction"      color="text-blue-500" />
              <Ring score={100 - scores.riskScore}      label="Safety"        color="text-green-500" />
              <Ring score={scores.sustainabilityScore}  label="Sustainability" color="text-purple-500" />
              <Ring score={scores.communityHealthScore} label="Community"     color="text-orange-500" />
              <Ring score={scores.growthProbability}    label="Growth"        color="text-cyan-500" />
            </div>
            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Risk Level:</span>
              <span className={`text-sm font-semibold capitalize ${RISK_COLOR[scores.riskLevel] || ''}`}>
                {scores.riskLevel}
              </span>
              <span className="text-xs text-muted-foreground">· {scores.confidenceInterval}% confidence</span>
            </div>
          </CardContent>
        </Card>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Zap,         label: 'Transactions',  value: metrics.transactions?.toLocaleString() },
            { icon: Users,       label: 'Unique Users',  value: metrics.uniqueUsers?.toLocaleString() },
            { icon: ShieldCheck, label: 'Success Rate',  value: `${metrics.successRate?.toFixed(1)}%` },
            { icon: TrendingUp,  label: 'Retention',     value: `${metrics.retentionRate?.toFixed(1)}%` },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <Icon className="h-4 w-4 text-muted-foreground mb-2" />
                <div className="text-xl font-bold">{value || '—'}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>Powered by <Link href="/" className="text-primary underline">MetaGauge</Link> · AI blockchain intelligence</p>
          <p className="mt-1">Generated {new Date(data.generatedAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}</p>
        </div>
      </div>
    </div>
  );
}
