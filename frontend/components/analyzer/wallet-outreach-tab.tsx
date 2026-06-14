'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Users, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function WalletOutreachTab() {
  const { toast } = useToast();
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (api as any).agent.getAtRiskWallets()
      .then((r: any) => { setWallets(r.wallets || []); setMessage(r.message || ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    const header = 'Address,Days Inactive,TX Count,LTV (USD),Segment';
    const rows = wallets.map(w =>
      `${w.address},${w.daysSinceLast},${w.txCount},$${w.ltv?.toFixed(2)},${w.segment}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `at-risk-wallets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${wallets.length} wallets` });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Wallet Outreach Intelligence</h3>
          <p className="text-xs text-muted-foreground mt-1">
            High-value wallets that have gone inactive — your best re-engagement targets.
          </p>
        </div>
        {wallets.length > 0 && (
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      {!wallets.length ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {message || 'No at-risk high-value wallets detected yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
            {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} at risk — sorted by lifetime value
          </div>

          <div className="space-y-2">
            {wallets.map((w: any) => (
              <Card key={w.address}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${w.segment === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {w.address?.slice(0, 8)}...{w.address?.slice(-6)}
                      </span>
                      <Badge variant={w.segment === 'high' ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                        {w.segment === 'high' ? 'High Value' : 'Mid Value'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <div className="text-right">
                        <div className="font-semibold">${w.ltv?.toFixed(2)}</div>
                        <div className="text-muted-foreground">LTV</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{w.daysSinceLast}d</div>
                        <div className="text-muted-foreground">inactive</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{w.txCount}</div>
                        <div className="text-muted-foreground">txs</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
