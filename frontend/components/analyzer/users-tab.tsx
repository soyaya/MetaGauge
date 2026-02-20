import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

interface UsersTabProps {
  analysisResults: any;
}

export function UsersTab({ analysisResults }: UsersTabProps) {
  const results = analysisResults?.results?.target || {};
  const fullReport = results.fullReport || {};
  const userBehavior = fullReport.userBehavior || {};
  const users = fullReport.users || [];
  const userLifecycle = fullReport.userLifecycle || {};
  const userJourneys = fullReport.userJourneys || {};
  
  // Create behavior chart data from real metrics
  const behaviorData = [
    { name: 'Whale', value: Math.round(userBehavior.whaleRatio || 0), fill: '#6B7280' },
    { name: 'Bot', value: Math.round(userBehavior.botActivity || 0), fill: '#4B5563' },
    { name: 'Power User', value: Math.round(userBehavior.powerUserRatio || 0), fill: '#9CA3AF' },
    { name: 'New User', value: Math.round(userBehavior.newUserRatio || 0), fill: '#D1D5DB' },
  ];

  // Create engagement scores from real metrics
  const scoresData = [
    { metric: 'Loyalty', score: Math.round((userBehavior.loyaltyScore || 0) / 10) },
    { metric: 'Retention 7d', score: Math.round((userBehavior.retentionRate7d || 0) / 10) },
    { metric: 'Retention 30d', score: Math.round((userBehavior.retentionRate30d || 0) / 10) },
    { metric: 'Growth', score: Math.round((userBehavior.userGrowthRate || 0) / 10) },
  ];

  const formatValue = (value: any, fallback = 'N/A') => {
    if (value === null || value === undefined) return fallback;
    return value;
  };

  const formatCurrency = (value: any) => {
    if (!value || value === 0) return '$0';
    if (typeof value === 'number') {
      return value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : 
             value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : 
             `$${value.toFixed(6)}`;
    }
    return value;
  };

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-600/30">
          <CardHeader>
            <CardTitle className="text-white">User Behavior Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={behaviorData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {behaviorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-600/30">
          <CardHeader>
            <CardTitle className="text-white">User Engagement Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={scoresData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="metric" stroke="#888" />
                <YAxis stroke="#888" domain={[0, 10]} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #3B82F6' }} />
                <Bar dataKey="score" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* User behavior metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-400 text-sm">Avg Session Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {Math.round((userBehavior.averageSessionDuration || 0) / 60)}m
            </p>
            <p className="text-blue-300 text-xs mt-1">Minutes per session</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-400 text-sm">Transactions/User</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {(userBehavior.transactionsPerUser || 0).toFixed(1)}
            </p>
            <p className="text-green-300 text-xs mt-1">Average activity</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-400 text-sm">Cross-Chain Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userBehavior.crossChainUsers ?? 0}
            </p>
            <p className="text-purple-300 text-xs mt-1">Multi-chain active</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/20 to-orange-800/20 border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-400 text-sm">Churn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userBehavior.churRate ?? 0}%
            </p>
            <p className="text-orange-300 text-xs mt-1">User attrition</p>
          </CardContent>
        </Card>
      </div>

      {/* User Lifecycle Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-900/20 to-violet-800/20 border-violet-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-violet-400 text-sm">Activation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userLifecycle.activationMetrics?.activationRate ? 
                `${userLifecycle.activationMetrics.activationRate.toFixed(1)}%` : 
                'N/A'}
            </p>
            <p className="text-violet-300 text-xs mt-1">User activation success</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-900/20 to-teal-800/20 border-teal-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-teal-400 text-sm">Retention Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userLifecycle.summary?.retentionRate ? 
                `${userLifecycle.summary.retentionRate.toFixed(1)}%` : 
                'N/A'}
            </p>
            <p className="text-teal-300 text-xs mt-1">User retention</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/20 to-amber-800/20 border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-400 text-sm">Journey Length</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userJourneys.averageJourneyLength ? 
                userJourneys.averageJourneyLength.toFixed(1) : 
                'N/A'}
            </p>
            <p className="text-amber-300 text-xs mt-1">Avg steps per user</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-900/20 to-pink-800/20 border-pink-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-pink-400 text-sm">Lifecycle Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userLifecycle.summary?.activeUsers || 0}
            </p>
            <p className="text-pink-300 text-xs mt-1">Active users</p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced User Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-900/20 to-cyan-800/20 border-cyan-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-cyan-400 text-sm">Multi-Protocol Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userBehavior.multiProtocolUsers ?? 0}
            </p>
            <p className="text-cyan-300 text-xs mt-1">Using multiple protocols</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-emerald-400 text-sm">Early Adopter Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userBehavior.earlyAdopterPotential || 'Medium'}
            </p>
            <p className="text-emerald-300 text-xs mt-1">Innovation adoption</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-900/20 to-rose-800/20 border-rose-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-rose-400 text-sm">User Growth Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userBehavior.growthRate ?? 0}%
            </p>
            <p className="text-rose-300 text-xs mt-1">Monthly growth</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-900/20 to-indigo-800/20 border-indigo-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-indigo-400 text-sm">Risk Tolerance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {userBehavior.riskToleranceLevel ?? 0}
            </p>
            <p className="text-indigo-300 text-xs mt-1">Risk appetite score</p>
          </CardContent>
        </Card>
      </div>

      {/* Top users table */}
      <Card className="bg-gray-800 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-white">Top Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-4 text-gray-400 font-semibold">Address</th>
                  <th className="text-right py-2 px-4 text-gray-400 font-semibold">Transactions</th>
                  <th className="text-right py-2 px-4 text-gray-400 font-semibold">Total Value</th>
                  <th className="text-right py-2 px-4 text-gray-400 font-semibold">Gas Spent</th>
                  <th className="text-center py-2 px-4 text-gray-400 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map((user: any, i: number) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4 text-white font-mono">
                      {formatAddress(user.address)}
                    </td>
                    <td className="text-right py-3 px-4 text-white">
                      {user.transactionCount ?? 0}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      {formatCurrency(user.totalValue)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      {formatCurrency(user.totalGasSpent)}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.userType === 'whale' ? 'bg-purple-500/20 text-purple-400' :
                        user.userType === 'power' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {user.userType || 'casual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {users.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p>No user data available for this analysis period.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}