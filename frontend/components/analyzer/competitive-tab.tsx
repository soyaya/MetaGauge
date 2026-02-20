import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadarChart, Radar, ResponsiveContainer, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

interface CompetitiveTabProps {
  analysisResults: any;
}

export function CompetitiveTab({ analysisResults }: CompetitiveTabProps) {
  const results = analysisResults?.results?.target || {};
  const fullReport = results.fullReport || {};
  const competitive = fullReport.competitive || {};
  const defiMetrics = fullReport.defiMetrics || {};
  const userBehavior = fullReport.userBehavior || {};
  
  // Create benchmark data from real metrics
  const benchmarks = [
    { 
      metric: 'Gas Efficiency', 
      you: Math.min(100, (userBehavior.gasOptimizationScore || 0)), 
      ethereum: 60 
    },
    { 
      metric: 'User Growth', 
      you: Math.min(100, (userBehavior.userGrowthRate || 0) * 5), 
      ethereum: 70 
    },
    { 
      metric: 'Retention', 
      you: Math.min(100, userBehavior.retentionRate7d || 0), 
      ethereum: 65 
    },
    { 
      metric: 'TVL Growth', 
      you: Math.min(100, (defiMetrics.liquidityUtilization || 0)), 
      ethereum: 75 
    },
    { 
      metric: 'Activity', 
      you: Math.min(100, (defiMetrics.dau || 0) / 100), 
      ethereum: 80 
    },
  ];

  const formatValue = (value: any, fallback = 'N/A') => {
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

  // Extract competitive data or create defaults
  const marketPosition = competitive.marketPosition || { rank: 'N/A', share: 0 };
  const advantages = competitive.advantages || [
    `Gas efficiency: ${defiMetrics.gasEfficiency || 'Unknown'}`,
    `Success rate: ${fullReport.summary?.successRate || 100}%`,
    `Active users: ${defiMetrics.dau || 0} DAU`,
    `Liquidity utilization: ${defiMetrics.liquidityUtilization || 0}%`
  ];
  
  const challenges = competitive.challenges || [
    `Limited transaction volume: ${fullReport.summary?.totalTransactions || 0} transactions`,
    `TVL growth needed: ${formatCurrency(defiMetrics.tvl)}`,
    `User retention: ${userBehavior.retentionRate30d || 0}% (30-day)`,
    `Cross-chain presence: ${userBehavior.crossChainUsers || 0} users`
  ];
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-gray-800/40 to-gray-700/40 border-gray-500/50">
          <CardHeader>
            <CardTitle className="text-white">Market Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-300 to-gray-200">
                #{formatValue(marketPosition.rank, '?')}
              </p>
              <p className="text-gray-400 mt-2">Market Ranking</p>
              <p className="text-2xl font-bold text-white mt-4">
                {formatNumber(marketPosition.share, 0)}%
              </p>
              <p className="text-gray-400">Market Share</p>
              
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <p className="text-gray-400">TVL</p>
                  <p className="text-white font-semibold">{formatCurrency(defiMetrics.tvl)}</p>
                </div>
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <p className="text-gray-400">24h Volume</p>
                  <p className="text-white font-semibold">{formatCurrency(defiMetrics.transactionVolume24h)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-600/30">
          <CardHeader>
            <CardTitle className="text-white">Competitive Benchmarks</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={benchmarks}>
                <PolarGrid stroke="#444" />
                <PolarAngleAxis dataKey="metric" stroke="#888" />
                <PolarRadiusAxis stroke="#888" domain={[0, 100]} />
                <Radar 
                  name="Your Protocol" 
                  dataKey="you" 
                  stroke="#6B7280" 
                  fill="#6B7280" 
                  fillOpacity={0.6} 
                />
                <Radar 
                  name="Market Average" 
                  dataKey="ethereum" 
                  stroke="#9CA3AF" 
                  fill="#9CA3AF" 
                  fillOpacity={0.3} 
                />
                <Legend />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #3B82F6' }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-green-500/30">
          <CardHeader>
            <CardTitle className="text-green-400">Competitive Advantages</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {advantages.slice(0, 6).map((adv: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-gray-300">
                  <span className="text-green-400 font-bold">✓</span>
                  <span>{adv}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400">Growth Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {challenges.slice(0, 6).map((challenge: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-gray-300">
                  <span className="text-red-400 font-bold">⚠</span>
                  <span>{challenge}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Performance metrics comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-400 text-sm">User Loyalty Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {formatNumber(userBehavior.loyaltyScore, 0).toFixed(1)}
            </p>
            <p className="text-blue-300 text-xs mt-1">vs 65.0 market avg</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-400 text-sm">MEV Exposure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {formatNumber(userBehavior.mevExposure, 0).toFixed(1)}%
            </p>
            <p className="text-green-300 text-xs mt-1">vs 12.5% market avg</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-400 text-sm">Bridge Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {formatNumber(defiMetrics.bridgeUtilization, 0).toFixed(1)}%
            </p>
            <p className="text-purple-300 text-xs mt-1">Cross-chain activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Competitor analysis if available */}
      {competitive.benchmarks?.vsCompetitors && (
        <Card className="bg-gray-800 border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-yellow-400">Direct Competitors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitive.benchmarks.vsCompetitors.map((competitor: any, i: number) => (
                <div key={i} className="p-4 bg-gray-700/50 rounded-lg">
                  <h4 className="font-semibold text-white mb-2">{competitor.name}</h4>
                  <p className="text-sm text-gray-300">Chain: {competitor.chain}</p>
                  <p className="text-sm text-gray-300">Market Share: {competitor.marketShare}%</p>
                  <p className="text-sm text-gray-300">User Overlap: {competitor.userOverlap}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}