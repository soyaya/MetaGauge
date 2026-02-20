import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EnhancedAIInsights } from './enhanced-ai-insights';
import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface OverviewTabProps {
  analysisResults: any;
  analysisId?: string;
}

export function OverviewTab({ analysisResults, analysisId }: OverviewTabProps) {
  const router = useRouter();
  const results = analysisResults?.results?.target || {};
  const fullReport = results.fullReport || {};
  const summary = fullReport.summary || {};
  const defiMetrics = fullReport.defiMetrics || {};
  const recommendations = fullReport.recommendations || [];
  const alerts = fullReport.alerts || [];
  
  // Format values safely
  const formatValue = (value: any, fallback: any = 'N/A') => {
    if (value === null || value === undefined) return fallback;
    return value;
  };

  // Format numbers safely for display
  const formatNumber = (value: any, fallback = 0) => {
    if (value === null || value === undefined) return fallback;
    return typeof value === 'number' ? value : fallback;
  };

  const formatCurrency = (value: any) => {
    if (!value || value === 0) return '$0';
    if (typeof value === 'number') {
      return value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : 
             value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : 
             `$${value.toFixed(2)}`;
    }
    return value;
  };

  // Get transaction type overview
  const getTransactionTypeOverview = () => {
    const transactions = fullReport.transactions || [];
    const typeCount: { [key: string]: number } = {};
    
    transactions.forEach((tx: any) => {
      const type = tx.type || determineTransactionType(tx.methodId);
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    const total = transactions.length;
    return Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([type, count]) => ({
        name: formatTransactionType(type),
        count,
        percentage: ((count / total) * 100).toFixed(1)
      }));
  };

  // Helper functions for transaction types
  const determineTransactionType = (methodId: string) => {
    if (!methodId) return 'transfer';
    
    switch (methodId) {
      case '0xa9059cbb': return 'transfer';
      case '0x095ea7b3': return 'approval';
      case '0x23b872dd': return 'transferFrom';
      case '0x40c10f19': return 'mint';
      case '0x42966c68': return 'burn';
      default: return 'contract_call';
    }
  };

  const formatTransactionType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(summary.totalTransactions, 0).toLocaleString()}</p>
            <p className="text-green-600 text-xs mt-1">
              {summary.successRate ? `${summary.successRate}% success rate` : 'Analysis complete'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{formatNumber(summary.uniqueUsers, 0).toLocaleString()}</p>
            </div>
            <div className="mt-3 bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full w-3/4" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(defiMetrics.tvl)}</p>
            <p className="text-green-600 text-xs mt-1">
              {defiMetrics.liquidityUtilization ? `${defiMetrics.liquidityUtilization}% utilization` : 'TVL tracked'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transaction Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(defiMetrics.transactionVolume24h || summary.totalValue)}</p>
            <p className="text-blue-600 text-xs mt-1">24h volume</p>
          </CardContent>
        </Card>
      </div>

      {/* UX Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">UX Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className={`text-3xl font-bold px-2 py-1 rounded ${
                fullReport.uxAnalysis?.uxGrade?.grade === 'A' ? 'text-green-600 bg-green-100' :
                fullReport.uxAnalysis?.uxGrade?.grade === 'B' ? 'text-blue-600 bg-blue-100' :
                fullReport.uxAnalysis?.uxGrade?.grade === 'C' ? 'text-yellow-600 bg-yellow-100' :
                fullReport.uxAnalysis?.uxGrade?.grade === 'D' ? 'text-orange-600 bg-orange-100' :
                'text-red-600 bg-red-100'
              }`}>
                {fullReport.uxAnalysis?.uxGrade?.grade || 'N/A'}
              </p>
              <div className="text-xs text-muted-foreground">
                <div>{fullReport.uxAnalysis?.uxGrade?.completionRate ? 
                  `${(fullReport.uxAnalysis.uxGrade.completionRate * 100).toFixed(1)}% completion` : 
                  'No data'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Session Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {fullReport.uxAnalysis?.sessionDurations?.averageDuration ? 
                `${fullReport.uxAnalysis.sessionDurations.averageDuration.toFixed(1)}m` : 
                'N/A'}
            </p>
            <p className="text-cyan-600 text-xs mt-1">Average user session</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">UX Bottlenecks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {fullReport.uxAnalysis?.bottlenecks?.length || 0}
            </p>
            <p className="text-orange-600 text-xs mt-1">Friction points</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">User Retention</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {fullReport.userLifecycle?.summary?.retentionRate ? 
                `${fullReport.userLifecycle.summary.retentionRate.toFixed(1)}%` : 
                'N/A'}
            </p>
            <p className="text-emerald-600 text-xs mt-1">Retention rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(defiMetrics.dau, 0).toLocaleString()}</p>
            <p className="text-orange-600 text-xs mt-1">Active today</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Protocol Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(defiMetrics.protocolRevenue)}</p>
            <p className="text-purple-600 text-xs mt-1">Total fees collected</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gas Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(fullReport.gasAnalysis?.gasEfficiencyScore, 0)}%</p>
            <p className="text-emerald-600 text-xs mt-1">Efficiency score</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">User Loyalty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(fullReport.userBehavior?.loyaltyScore, 0)}%</p>
            <p className="text-cyan-600 text-xs mt-1">Loyalty score</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Function Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(defiMetrics.functionSuccessRate, 0)}%</p>
            <p className="text-amber-600 text-xs mt-1">Transaction reliability</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-teal-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Event Driven Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(defiMetrics.eventDrivenVolume)}</p>
            <p className="text-teal-600 text-xs mt-1">From contract events</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-indigo-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cross-Chain Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(fullReport.userBehavior?.crossChainUsers, 0)}</p>
            <p className="text-indigo-600 text-xs mt-1">Multi-chain activity</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MEV Exposure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(fullReport.userBehavior?.mevExposure, 0)}</p>
            <p className="text-rose-600 text-xs mt-1">MEV risk level</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Type Overview */}
      {fullReport.transactions && fullReport.transactions.length > 0 && (
        <Card className="hover:shadow-lg transition-shadow border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Transaction Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {getTransactionTypeOverview().map((type, i) => (
                <div key={i} className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{type.count}</p>
                  <p className="text-sm text-muted-foreground">{type.name}</p>
                  <p className="text-xs text-muted-foreground">{type.percentage}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(defiMetrics.dau, 0).toLocaleString()}</p>
            <p className="text-orange-600 text-xs mt-1">Active today</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Protocol Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(defiMetrics.protocolRevenue)}</p>
            <p className="text-purple-600 text-xs mt-1">Total fees collected</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gas Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(fullReport.gasAnalysis?.gasEfficiencyScore, 0)}%</p>
            <p className="text-emerald-600 text-xs mt-1">Efficiency score</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">User Loyalty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(fullReport.userBehavior?.loyaltyScore, 0)}%</p>
            <p className="text-cyan-600 text-xs mt-1">Loyalty score</p>
          </CardContent>
        </Card>
      </div>

      {recommendations.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💡 Recommendations
            </CardTitle>
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

      {alerts.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 3).map((alert: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
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

      {/* Enhanced AI Insights Section */}
      {analysisId && (
        <EnhancedAIInsights 
          analysisId={analysisId} 
          analysisResults={analysisResults} 
        />
      )}

      {/* Chat with AI Button */}
      {results.contract && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-2">Chat with AI about this contract</h3>
                <p className="text-muted-foreground text-sm">
                  Get personalized insights, ask questions, and explore this contract's data with our AI assistant.
                </p>
              </div>
              <Button 
                onClick={() => {
                  const contractData = results.contract || {};
                  const params = new URLSearchParams({
                    address: contractData.address || '',
                    chain: contractData.chain || '',
                    name: contractData.name || 'Unknown Contract'
                  });
                  
                  router.push(`/chat?${params.toString()}`);
                }}
                className="ml-4"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Start Chat
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show basic info if no detailed data available */}
      {!fullReport.summary && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Analysis completed for contract {results.contract?.address} on {results.contract?.chain}.
              {results.transactions > 0 ? 
                ` Found ${results.transactions} transactions with detailed metrics available.` :
                ' No transactions found in the analyzed block range.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}