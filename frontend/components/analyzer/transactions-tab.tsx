'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface TransactionsTabProps { analysisResults: any }

import { CHART_COLORS, CHART_PRIMARY, CHART_SECONDARY } from '@/lib/chart-colors';
const COLORS = CHART_COLORS;

const METHOD_NAMES: Record<string, string> = {
  '0xa9059cbb': 'Transfer',    '0x095ea7b3': 'Approve',
  '0x23b872dd': 'TransferFrom','0x40c10f19': 'Mint',
  '0x42966c68': 'Burn',        '0x2e1a7d4d': 'Withdraw',
  '0xd0e30db0': 'Deposit',     '0x09c5eabe': 'Execute',
  '0x3593564c': 'Execute V2',
};

const hexToNum = (v: any) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.startsWith('0x')) return parseInt(v, 16);
  return Number(v) || 0;
};

const formatHash = (h: string) => h ? `${h.slice(0,8)}...${h.slice(-6)}` : 'N/A';
const formatAddr = (a: string) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : 'N/A';
const formatEth  = (wei: any) => {
  const n = hexToNum(wei);
  if (!n) return '0 ETH';
  return `${(n / 1e18).toFixed(6)} ETH`;
};
const methodLabel = (input: string) => {
  if (!input || input === '0x') return 'ETH Transfer';
  const sig = input.slice(0, 10);
  return METHOD_NAMES[sig] || sig;
};

export function TransactionsTab({ analysisResults }: TransactionsTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE = 10;

  useEffect(() => {
    api.metrics.getDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fr  = data || analysisResults?.results?.target?.fullReport || {};
  const gas = fr.gasAnalysis || {};
  const txs: any[] = fr.transactions || [];
  const sum = fr.summary || {};

  // Type distribution
  const typeCounts: Record<string, number> = {};
  txs.forEach(tx => {
    const label = methodLabel(tx.input);
    typeCounts[label] = (typeCounts[label] || 0) + 1;
  });
  const typeData = Object.entries(typeCounts)
    .sort(([,a],[,b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  // Volume by block range (group into 7 buckets)
  const volumeData = (() => {
    if (!txs.length) return [];
    const blocks = txs.map(t => t.blockNumber).filter(Boolean).sort((a,b)=>a-b);
    const min = blocks[0], max = blocks[blocks.length-1];
    const bucketSize = Math.max(1, Math.ceil((max - min + 1) / 7));
    const buckets: Record<number, number> = {};
    txs.forEach(tx => {
      if (!tx.blockNumber) return;
      const b = Math.floor((tx.blockNumber - min) / bucketSize);
      buckets[b] = (buckets[b] || 0) + hexToNum(tx.value) / 1e18;
    });
    return Array.from({ length: 7 }, (_, i) => ({
      block: `${min + i * bucketSize}`,
      volume: Number((buckets[i] || 0).toFixed(6)),
    }));
  })();

  const paginated = txs.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(txs.length / PAGE);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /><span>Loading transactions...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
          ⚠ Using cached data. ({error})
        </p>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Transactions', value: (sum.totalTransactions || txs.length).toLocaleString(), sub: 'All indexed txs' },
          { label: 'Success Rate',       value: sum.successRate != null ? `${sum.successRate}%` : '100%', sub: 'Successful / total' },
          { label: 'Total Volume',       value: sum.totalValueEth != null ? `${sum.totalValueEth} ETH` : '0 ETH', sub: 'Total inflow' },
          { label: 'Failed Txs',         value: (gas.failedTransactions || 0).toLocaleString(), sub: `${gas.failureRate || 0}% failure rate`, warn: (gas.failureRate||0) > 10 },
        ].map(({ label, value, sub, warn = false }) => (
          <Card key={label} className={warn ? 'border-red-200' : ''}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${warn ? 'text-red-600' : ''}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Gas summary ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Gas Price',     value: gas.averageGasPrice     || 'N/A', sub: 'Network cost' },
          { label: 'Avg Gas Used',      value: (gas.averageGasUsed||0).toLocaleString(), sub: 'Gas units per tx' },
          { label: 'Total Gas Cost',    value: gas.totalGasCostUSD != null ? `$${gas.totalGasCostUSD}` : 'N/A', sub: 'USD (ETH @ $2500)' },
          { label: 'Avg Gas Cost / Tx', value: gas.averageGasCostUSD != null ? `$${gas.averageGasCostUSD}` : 'N/A', sub: 'Per transaction' },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground mt-1">{sub}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {volumeData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Volume by Block Range (ETH)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={volumeData}>
                  <defs>
                    <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="block" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="volume" stroke={CHART_PRIMARY} fill="url(#vol)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {typeData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Transaction Type Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {typeData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Transaction table ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Transactions
            <span className="text-muted-foreground font-normal ml-2 text-xs">({txs.length} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions indexed yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {['Hash','From','To','Value','Gas Used','Gas Cost','Method','Status'].map(h => (
                        <th key={h} className={`py-2 px-2 text-muted-foreground font-medium ${h==='Value'||h==='Gas Used'||h==='Gas Cost'?'text-right':'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((tx: any, i: number) => {
                      const gasUsed  = hexToNum(tx.gasUsed);
                      const gasPrice = hexToNum(tx.gasPrice);
                      const gasCostUSD = (gasUsed * gasPrice / 1e18 * 2500).toFixed(4);
                      return (
                        <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-2 font-mono">{formatHash(tx.hash)}</td>
                          <td className="py-2 px-2 font-mono">{formatAddr(tx.from)}</td>
                          <td className="py-2 px-2 font-mono">{formatAddr(tx.to)}</td>
                          <td className="py-2 px-2 text-right">{formatEth(tx.value)}</td>
                          <td className="py-2 px-2 text-right">{gasUsed.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right">${gasCostUSD}</td>
                          <td className="py-2 px-2">{methodLabel(tx.input)}</td>
                          <td className="py-2 px-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${tx.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {tx.status ? 'success' : 'failed'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">Page {page+1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}>Prev</Button>
                    <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page>=totalPages-1}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
