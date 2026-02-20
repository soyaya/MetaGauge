import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar
} from 'recharts';

interface MetricsTabProps {
  analysisResults: any;
}

export function MetricsTab({ analysisResults }: MetricsTabProps) {
  const results = analysisResults?.results?.target || {};
  const fullReport = results.fullReport || {};
  const defiMetrics = fullReport.defiMetrics || {};
  const userBehavior = fullReport.userBehavior || {};
  const gasAnalysis = fullReport.gasAnalysis || {};
  const summary = fullReport.summary || {};
  
  // Create chart data from real metrics
  const tvlData = [
    { name: 'Current', value: defiMetrics.tvl || 0 }
  ];

  const ratesData = [
    { 
      name: 'Current', 
      borrowing: defiMetrics.borrowingRate || 0, 
      lending: defiMetrics.lendingRate || 0 
    }
  ];

  const ratiosData = [
    { name: 'Volume/TVL', value: Math.round((defiMetrics.volumeToTvlRatio || 0) * 100) },
    { name: 'Fee/Volume', value: Math.round((defiMetrics.feeToVolumeRatio || 0) * 100) },
    { name: 'Impermanent Loss', value: Math.round((defiMetrics.impermanentLoss || 0) * 100) },
    { name: 'Slippage', value: Math.round((defiMetrics.slippageTolerance || 0) * 100) },
  ];

  // User behavior chart data
  const behaviorData = [
    { name: 'Loyalty', value: userBehavior.loyaltyScore || 0 },
    { name: 'Risk Tolerance', value: userBehavior.riskToleranceLevel || 0 },
    { name: 'Bot Activity', value: userBehavior.botActivity || 0 },
    { name: 'Whale Ratio', value: userBehavior.whaleRatio || 0 },
  ];

  // User classification data
  const userClassifications = fullReport.userBehavior?.userClassifications || {};
  const classificationData = Object.entries(userClassifications).map(([key, value]) => ({
    name: key.replace('_', ' ').toUpperCase(),
    value: value || 0
  }));

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
      return value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : 
             value >= 1000 ? `${(value / 1000).toFixed(1)}K` : 
             `${value.toFixed(2)}`;
    }
    return value;
  };

  const formatPercentage = (value: any) => {
    if (!value || value === 0) return '0%';
    return `${parseFloat(value).toFixed(1)}%`;
  };

  // Helper function to get peak interaction hours
  const getPeakHours = () => {
    const peakTimes = fullReport.interactions?.peakInteractionTimes || [];
    if (peakTimes.length === 0) return 'N/A';
    
    return peakTimes
      .slice(0, 2)
      .map((peak: any) => `${peak.hour}:00`)
      .join(', ');
  };
  
  return (
    <div className="space-y-6">
      {/* DeFi Metrics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-600/30">
          <CardHeader>
            <CardTitle className="text-white">TVL & Liquidity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-white mb-2">
                {formatCurrency(defiMetrics.tvl)}
              </p>
              <p className="text-gray-400">Total Value Locked</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Utilization</p>
                  <p className="text-white font-semibold">{formatPercentage(defiMetrics.liquidityUtilization)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Active Pools</p>
                  <p className="text-white font-semibold">{formatNumber(defiMetrics.activePoolsCount, 0)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Net Flow</p>
                  <p className="text-white font-semibold">{formatCurrency(defiMetrics.netFlow)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Cross-Chain Volume</p>
                  <p className="text-white font-semibold">{formatCurrency(defiMetrics.crossChainVolume)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-600/30">
          <CardHeader>
            <CardTitle className="text-white">User Activity Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Daily Active Users</span>
                <span className="text-white font-bold">{formatNumber(defiMetrics.dau, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Weekly Active Users</span>
                <span className="text-white font-bold">{formatNumber(defiMetrics.wau, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Monthly Active Users</span>
                <span className="text-white font-bold">{formatNumber(defiMetrics.mau, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Avg Transaction Size</span>
                <span className="text-white font-bold">{formatCurrency(defiMetrics.averageTransactionSize)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Behavior Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-white">User Behavior Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={behaviorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #3B82F6' }} />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-green-500/30">
          <CardHeader>
            <CardTitle className="text-white">User Classifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={classificationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {classificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16'][index % 8]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-400 text-sm">Protocol Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatCurrency(defiMetrics.protocolRevenue)}</p>
            <p className="text-blue-300 text-xs mt-1">Total collected</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-400 text-sm">Revenue Per User</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatCurrency(defiMetrics.revenuePerUser)}</p>
            <p className="text-green-300 text-xs mt-1">Average</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-400 text-sm">Yield Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatCurrency(defiMetrics.yieldGenerated)}</p>
            <p className="text-purple-300 text-xs mt-1">For users</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/20 to-orange-800/20 border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-400 text-sm">Staking Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatCurrency(defiMetrics.stakingRewards)}</p>
            <p className="text-orange-300 text-xs mt-1">Distributed</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-white">Gas Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Average Gas Price</span>
              <span className="text-white font-bold">{gasAnalysis.averageGasPrice || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Average Gas Used</span>
              <span className="text-white font-bold">{formatNumber(gasAnalysis.averageGasUsed, 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Total Gas Cost (USD)</span>
              <span className="text-white font-bold">${formatNumber(gasAnalysis.totalGasCostUSD, 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Average Gas Cost (USD)</span>
              <span className="text-white font-bold">${formatNumber(gasAnalysis.averageGasCostUSD, 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Gas Efficiency Score</span>
              <span className="text-white font-bold">{formatPercentage(gasAnalysis.gasEfficiencyScore)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Failed Transactions</span>
              <span className="text-white font-bold">{formatNumber(gasAnalysis.failedTransactions, 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-white">Risk & Security Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">MEV Exposure</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.mevExposure, 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Front Running Detection</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.frontRunningDetection, 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Sandwich Attacks</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.sandwichAttacks, 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Arbitrage Opportunities</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.arbitrageOpportunities, 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Liquidation Events</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.liquidationEvents, 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced DeFi Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-emerald-400 text-sm">Impermanent Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatPercentage(defiMetrics.impermanentLoss)}</p>
            <p className="text-emerald-300 text-xs mt-1">Current IL exposure</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/20 to-amber-800/20 border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-400 text-sm">Slippage Tolerance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatPercentage(defiMetrics.slippageTolerance)}</p>
            <p className="text-amber-300 text-xs mt-1">Average slippage</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-900/20 to-teal-800/20 border-teal-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-teal-400 text-sm">Bridge Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatPercentage(defiMetrics.bridgeUtilization)}</p>
            <p className="text-teal-300 text-xs mt-1">Cross-chain activity</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-900/20 to-rose-800/20 border-rose-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-rose-400 text-sm">Governance Participation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatPercentage(defiMetrics.governanceParticipation)}</p>
            <p className="text-rose-300 text-xs mt-1">Voting participation</p>
          </CardContent>
        </Card>
      </div>

      {/* Interaction Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-white">Contract Interaction Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Event Driven Volume</span>
              <span className="text-white font-bold">{formatCurrency(defiMetrics.eventDrivenVolume)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Interaction Complexity</span>
              <span className="text-white font-bold">{defiMetrics.interactionComplexity || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Contract Utilization</span>
              <span className="text-white font-bold">{formatNumber(defiMetrics.contractUtilization, 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Peak Interaction Times</span>
              <span className="text-white font-bold">{getPeakHours()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-indigo-500/30">
          <CardHeader>
            <CardTitle className="text-white">Advanced Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Function Success Rate</span>
              <span className="text-white font-bold">{formatPercentage(defiMetrics.functionSuccessRate)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Protocol Stickiness</span>
              <span className="text-white font-bold">{formatPercentage(defiMetrics.protocolStickiness)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Cross-Chain Volume</span>
              <span className="text-white font-bold">{formatCurrency(defiMetrics.crossChainVolume)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Active Pools Count</span>
              <span className="text-white font-bold">{formatNumber(defiMetrics.activePoolsCount, 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-white">Gas Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Average Gas Price</span>
              <span className="text-white font-bold">{gasAnalysis.averageGasPrice || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Average Gas Used</span>
              <span className="text-white font-bold">{formatNumber(gasAnalysis.averageGasUsed, 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Total Gas Cost (USD)</span>
              <span className="text-white font-bold">${formatNumber(gasAnalysis.totalGasCostUSD, 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Average Gas Cost (USD)</span>
              <span className="text-white font-bold">${formatNumber(gasAnalysis.averageGasCostUSD, 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Gas Efficiency Score</span>
              <span className="text-white font-bold">{formatPercentage(gasAnalysis.gasEfficiencyScore)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Failed Transactions</span>
              <span className="text-white font-bold">{formatNumber(gasAnalysis.failedTransactions, 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-white">Risk & Security Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">MEV Exposure</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.mevExposure, 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Front Running Detection</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.frontRunningDetection, 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Sandwich Attacks</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.sandwichAttacks, 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Arbitrage Opportunities</span>
              <span className="text-white font-bold">{formatNumber(userBehavior.arbitrageOpportunities, 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-cyan-900/20 to-cyan-800/20 border-cyan-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-cyan-400 text-sm">Function Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatPercentage(defiMetrics.functionSuccessRate)}</p>
            <p className="text-cyan-300 text-xs mt-1">Transaction reliability</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-900/20 to-indigo-800/20 border-indigo-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-indigo-400 text-sm">Protocol Stickiness</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatPercentage(defiMetrics.protocolStickiness)}</p>
            <p className="text-indigo-300 text-xs mt-1">Repeat users</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-900/20 to-pink-800/20 border-pink-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-pink-400 text-sm">Cross-Chain Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatNumber(userBehavior.crossChainUsers, 0)}</p>
            <p className="text-pink-300 text-xs mt-1">Multi-chain activity</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}