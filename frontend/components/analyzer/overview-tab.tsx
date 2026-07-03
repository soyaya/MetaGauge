import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricInfo } from '@/components/ui/metric-info';

interface OverviewTabProps {
  analysisResults: any;
  analysisId?: string;
}

export function OverviewTab({ analysisResults }: OverviewTabProps) {
  const results      = analysisResults?.results?.target || {};
  const fullReport   = results.fullReport || {};
  const summary      = fullReport.summary      || {};
  const defiMetrics  = fullReport.defiMetrics  || {};
  const gasAnalysis  = fullReport.gasAnalysis  || {};
  const uxAnalysis   = fullReport.uxAnalysis   || {};
  const userLifecycle = fullReport.userLifecycle || {};
  const recommendations = fullReport.recommendations || [];
  const alerts          = fullReport.alerts          || [];

  const fmt = (v: any, fallback: any = 'N/A') =>
    v === null || v === undefined ? fallback : v;

  const fmtNum = (v: any) =>
    typeof v === 'number' ? v.toLocaleString() : '0';

  const fmtPct = (v: any) =>
    v === null || v === undefined ? 'N/A' : `${v}%`;

  // Transaction type distribution from raw transactions
  const txTypes: Record<string, number> = {};
  const METHOD_NAMES: Record<string, string> = {
    '0xa9059cbb': 'Transfer',
    '0x095ea7b3': 'Approve',
    '0x23b872dd': 'Transfer From',
    '0x40c10f19': 'Mint',
    '0x42966c68': 'Burn',
    '0x2e1a7d4d': 'Withdraw',
    '0xd0e30db0': 'Deposit',
  };
  (fullReport.transactions || []).forEach((tx: any) => {
    const sig = tx.input?.length >= 10 && tx.input !== '0x'
      ? tx.input.slice(0, 10) : '0x';
    const label = METHOD_NAMES[sig] || (sig === '0x' ? 'ETH Transfer' : 'Contract Call');
    txTypes[label] = (txTypes[label] || 0) + 1;
  });
  const txTypeEntries = Object.entries(txTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  const txTotal = (fullReport.transactions || []).length;

  const uxGrade = uxAnalysis.uxGrade || {};
  const uxGradeColor =
    uxGrade.grade === 'A' ? 'text-green-600 bg-green-100' :
    uxGrade.grade === 'B' ? 'text-blue-600 bg-blue-100'  :
    uxGrade.grade === 'C' ? 'text-yellow-600 bg-yellow-100' :
    uxGrade.grade === 'D' ? 'text-orange-600 bg-orange-100' :
    'text-red-600 bg-red-100';

  return (
    <div className="space-y-6">

      {/* ── Row 1: Core volume & users ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Total Transactions<MetricInfo text="Total number of on-chain interactions with this contract in the indexed sample." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmtNum(summary.totalTransactions)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.successRate != null ? `${summary.successRate}% success` : 'No data yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Unique Users<MetricInfo text="Number of distinct wallet addresses that have interacted with this contract." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmtNum(summary.uniqueUsers)}</p>
            <p className="text-xs text-muted-foreground mt-1">Distinct wallets</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Total Volume<MetricInfo text="Cumulative token value transferred through the contract. Decoded from ERC-20 transfer calls; shows interaction count for complex DEX contracts." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {(() => {
                const v = defiMetrics.totalVolumeEth;
                if (!v || v === 0) return fmtNum(summary.totalTransactions);
                if (v >= 1000) return `${v.toFixed(0)} ETH`;
                if (v >= 1)    return `${v.toFixed(3)} ETH`;
                return `${v.toFixed(6)} ETH`;
              })()}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {defiMetrics.totalVolumeEth > 0 ? `ETH sent across ${summary.totalTransactions} txs` : 'Total interactions (50 tx sample)'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Time to First Interaction<MetricInfo text="Average time between contract deployment and a wallet's very first transaction. Measures how quickly new users discover and use the contract." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(defiMetrics.avgTimeToFirstInteraction)}</p>
            <p className="text-xs text-blue-600 mt-1">Avg time for wallet to first use contract</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Engagement quality ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">UX Grade<MetricInfo text="Overall user experience score (A–F) based on transaction success rate, retry patterns, and interaction complexity." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className={`text-3xl font-bold px-2 py-1 rounded ${uxGradeColor}`}>
                {uxGrade.grade || 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">
                {uxGrade.completionRate != null
                  ? `${(uxGrade.completionRate * 100).toFixed(1)}% success`
                  : 'No data'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Session Duration<MetricInfo text="Median time between a wallet's first and last transaction with this contract. Uses median to avoid skew from wallets with years of history." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {fmt(defiMetrics.avgSessionDuration ?? uxAnalysis.sessionDurations?.averageDuration)}
            </p>
            <p className="text-xs text-cyan-600 mt-1">Median time between wallet's first & last tx</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Bounce Rate<MetricInfo text="Percentage of wallets that interacted with the contract only once and never returned. High bounce rate may indicate UX friction or low stickiness." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{fmtPct(defiMetrics.bounceRate)}</p>
            <p className="text-xs text-orange-600 mt-1">Users with only 1 interaction</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">User Retention<MetricInfo text="Percentage of wallets that made more than one transaction. Indicates how well the contract keeps users coming back." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {userLifecycle.summary?.retentionRate != null
                ? `${userLifecycle.summary.retentionRate}%`
                : 'N/A'}
            </p>
            <p className="text-xs text-emerald-600 mt-1">Returning users</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Activation & performance ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Daily Active Users<MetricInfo text="Number of unique wallets that transacted with this contract in the last 24 hours, based on block timestamps." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmtNum(defiMetrics.dau)}</p>
            <p className="text-xs text-orange-600 mt-1">Active in last 24h</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Activation Rate<MetricInfo text="Percentage of wallets that made a second transaction after their first. A key signal of whether users find enough value to return." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmtPct(defiMetrics.activationRate)}</p>
            <p className="text-xs text-purple-600 mt-1">Users who return after first tx</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Tx Success Rate<MetricInfo text="Percentage of transactions that completed successfully vs those that reverted or failed. Low rates indicate contract bugs or UX issues." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {defiMetrics.txSuccessRate != null ? `${defiMetrics.txSuccessRate}%` : (gasAnalysis.gasEfficiencyScore != null ? `${gasAnalysis.gasEfficiencyScore}%` : 'N/A')}
            </p>
            <p className="text-xs text-emerald-600 mt-1">Successful / total transactions</p>
          </CardContent>
        </Card>

        <Card className="border-teal-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">Time to Activation<MetricInfo text="Median time between a wallet's first and second transaction. Shorter times mean users quickly find value; longer times suggest friction or slow discovery." /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(defiMetrics.avgTimeToActivation)}</p>
            <p className="text-xs text-teal-600 mt-1">Median time: wallet connects → 2nd tx</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Transaction type distribution ──────────────────────────────── */}
      {txTypeEntries.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Transaction Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {txTypeEntries.map(([type, count]) => (
                <div key={type} className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{count}</p>
                  <p className="text-sm text-muted-foreground">{type}</p>
                  <p className="text-xs text-muted-foreground">
                    {txTotal > 0 ? `${((count / txTotal) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recommendations ────────────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.slice(0, 5).map((rec: string, i: number) => (
                <li key={i} className="text-sm">{rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 3).map((alert: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border text-sm ${
                  alert.severity === 'warning'
                    ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                {alert.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!summary.totalTransactions && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Waiting for data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Metrics will populate once indexing completes. Trigger indexing from the dashboard if it hasn't started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
