import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { AlertTriangle, TrendingUp, Users, Clock, Target, Award } from 'lucide-react';

interface UxTabProps {
  analysisResults: any;
}

export function UxTab({ analysisResults }: UxTabProps) {
  const results = analysisResults?.results?.target || {};
  const fullReport = results.fullReport || {};
  const uxAnalysis = fullReport.uxAnalysis || {};
  const userJourneys = fullReport.userJourneys || {};
  const userLifecycle = fullReport.userLifecycle || {};
  
  // Format values safely
  const formatValue = (value: any, fallback: any = 'N/A') => {
    if (value === null || value === undefined) return fallback;
    return value;
  };

  const formatNumber = (value: any, fallback = 0) => {
    if (value === null || value === undefined) return fallback;
    return typeof value === 'number' ? value : fallback;
  };

  const formatPercentage = (value: any) => {
    const num = formatNumber(value);
    return `${num.toFixed(1)}%`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes.toFixed(1)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Get UX grade color
  const getUxGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100 border-green-300';
      case 'B': return 'text-blue-600 bg-blue-100 border-blue-300';
      case 'C': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'D': return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'F': return 'text-red-600 bg-red-100 border-red-300';
      default: return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  // Prepare bottleneck chart data
  const bottleneckData = (uxAnalysis.bottlenecks || []).slice(0, 5).map((bottleneck: any) => ({
    name: `${bottleneck.fromFunction} → ${bottleneck.toFunction}`,
    abandonmentRate: (bottleneck.abandonmentRate * 100).toFixed(1),
    affected: bottleneck.affectedUsers
  }));

  // Prepare journey length distribution
  const journeyDistribution = Object.entries(userJourneys.journeyDistribution || {}).map(([length, count]) => ({
    length: `${length} steps`,
    users: count
  }));

  // Prepare lifecycle distribution
  const lifecycleData = Object.entries(userLifecycle.lifecycleDistribution || {}).map(([stage, count]) => ({
    name: stage.charAt(0).toUpperCase() + stage.slice(1),
    value: count,
    fill: stage === 'active' ? '#10B981' : 
          stage === 'new' ? '#3B82F6' :
          stage === 'inactive' ? '#F59E0B' :
          stage === 'dormant' ? '#EF4444' :
          '#6B7280'
  }));

  // Prepare wallet classification data
const walletClassData = Object.entries(
  userLifecycle.walletClassification?.distribution || {}
).map(([type, data]: [string, any]) => {
  const raw = Number(data?.percentage);

  return {
    name: type.charAt(0).toUpperCase() + type.slice(1),
    count: Number(data?.count ?? 0),
    percentage: Number.isFinite(raw) ? Number(raw.toFixed(1)) : 0
  };
});


  return (
    <div className="space-y-6">
      {/* UX Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              UX Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`text-4xl font-bold px-3 py-1 rounded-lg border ${getUxGradeColor(uxAnalysis.uxGrade?.grade || 'F')}`}>
                {uxAnalysis.uxGrade?.grade || 'F'}
              </div>
              <div className="text-sm text-muted-foreground">
                <div>Completion: {formatPercentage(uxAnalysis.uxGrade?.completionRate * 100)}</div>
                <div>Failure: {formatPercentage(uxAnalysis.uxGrade?.failureRate * 100)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Session Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatDuration(uxAnalysis.sessionDurations?.averageDuration || 0)}
            </p>
            <p className="text-blue-600 text-xs mt-1">
              {formatValue(uxAnalysis.sessionDurations?.sessions?.length, 0)} sessions
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {formatValue(uxAnalysis.bottlenecks?.length, 0)}
            </p>
            <p className="text-orange-600 text-xs mt-1">
              Friction points detected
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Activation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {formatPercentage(userLifecycle.activationMetrics?.activationRate)}
            </p>
            <p className="text-green-600 text-xs mt-1">
              User activation success
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Journey Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Journey Length</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatNumber(userJourneys.averageJourneyLength, 0).toFixed(1)}
            </p>
            <p className="text-cyan-600 text-xs mt-1">Average steps</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-indigo-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entry Points</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatValue(userJourneys.entryPoints?.length, 0)}
            </p>
            <p className="text-indigo-600 text-xs mt-1">Unique entry functions</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retention Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatPercentage(userLifecycle.summary?.retentionRate)}
            </p>
            <p className="text-emerald-600 text-xs mt-1">User retention</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time to Success</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatDuration(uxAnalysis.timeToFirstSuccess?.averageTimeToSuccessMinutes || 0)}
            </p>
            <p className="text-rose-600 text-xs mt-1">First success time</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bottlenecks Chart */}
        {bottleneckData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Top UX Bottlenecks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bottleneckData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip 
                    formatter={(value: any, name?: string) => [
                      `${value}%`, 
                      name === 'abandonmentRate' ? 'Abandonment Rate' : (name || 'Value')
                    ]}
                  />
                  <Bar dataKey="abandonmentRate" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Journey Distribution and Wallet Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* User Lifecycle Distribution */}
        {lifecycleData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                User Lifecycle Stages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={lifecycleData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {lifecycleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        
        {/* Journey Length Distribution */}
        {journeyDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>User Journey Length Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={journeyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="length" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Wallet Classification */}
        {walletClassData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Wallet Classification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {walletClassData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{item.count}</div>
                      <div className="text-sm text-muted-foreground">{item.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Entry Points and Drop-off Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Entry Points */}
        {userJourneys.entryPoints && userJourneys.entryPoints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                Top Entry Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userJourneys.entryPoints.slice(0, 5).map((entry: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{entry.functionName}</div>
                      <div className="text-sm text-muted-foreground">{entry.userCount} users</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{entry.percentage.toFixed(1)}%</div>
                      <Progress value={entry.percentage} className="w-20 h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drop-off Points */}
        {userJourneys.dropoffPoints && userJourneys.dropoffPoints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Top Drop-off Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userJourneys.dropoffPoints.slice(0, 5).map((dropoff: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{dropoff.functionName}</div>
                      <div className="text-sm text-muted-foreground">{dropoff.dropoffCount} drop-offs</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">{dropoff.dropoffPercentage.toFixed(1)}%</div>
                      <Progress value={dropoff.dropoffPercentage} className="w-20 h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Common User Paths */}
      {userJourneys.commonPaths && userJourneys.commonPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Common User Paths</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userJourneys.commonPaths.slice(0, 5).map((path: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{path.userCount} users</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(path.averageCompletionTime / (1000 * 60))} avg time
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {path.sequence.map((step: string, stepIndex: number) => (
                      <div key={stepIndex} className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {step}
                        </span>
                        {stepIndex < path.sequence.length - 1 && (
                          <span className="text-muted-foreground">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* UX Recommendations */}
      {uxAnalysis.bottlenecks && uxAnalysis.bottlenecks.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💡 UX Improvement Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uxAnalysis.bottlenecks.slice(0, 3).map((bottleneck: any, index: number) => (
                <div key={index} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="font-medium text-amber-800">
                    Optimize {bottleneck.fromFunction} → {bottleneck.toFunction} transition
                  </div>
                  <div className="text-sm text-amber-700 mt-1">
                    {bottleneck.abandonmentRate > 0.5 ? 'Critical' : 'High'} abandonment rate of {(bottleneck.abandonmentRate * 100).toFixed(1)}% 
                    affecting {bottleneck.affectedUsers} users. Consider improving UX flow or reducing friction.
                  </div>
                </div>
              ))}
              
              {uxAnalysis.uxGrade?.grade === 'D' || uxAnalysis.uxGrade?.grade === 'F' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="font-medium text-red-800">
                    Overall UX Grade Needs Improvement
                  </div>
                  <div className="text-sm text-red-700 mt-1">
                    Current grade: {uxAnalysis.uxGrade.grade}. Focus on reducing failure rate 
                    ({(uxAnalysis.uxGrade.failureRate * 100).toFixed(1)}%) and improving completion times.
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show message if no UX data available */}
      {!uxAnalysis.uxGrade && !userJourneys.totalUsers && !userLifecycle.totalWallets && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 UX Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              UX metrics will be available once sufficient transaction data is collected. 
              Wait for more user interactions to generate comprehensive UX insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}