'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  User, 
  Bot,
  Copy,
  Check
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Legend,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    components: any[];
    createdAt: string;
    metadata?: any;
  };
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const [copiedComponent, setCopiedComponent] = useState<string | null>(null);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Enhanced color palette for charts
  const chartColors = {
    primary: '#3b82f6',      // Blue
    secondary: '#10b981',    // Green  
    tertiary: '#f59e0b',     // Amber
    quaternary: '#ef4444',   // Red
    quinary: '#8b5cf6',      // Purple
    senary: '#06b6d4',       // Cyan
    septenary: '#f97316',    // Orange
    octonary: '#84cc16',     // Lime
    nonary: '#ec4899',       // Pink
    denary: '#6366f1'        // Indigo
  };

  const getChartColor = (index: number) => {
    const colors = Object.values(chartColors);
    return colors[index % colors.length];
  };

  const gradientColors = {
    primary: 'url(#primaryGradient)',
    secondary: 'url(#secondaryGradient)',
    tertiary: 'url(#tertiaryGradient)'
  };

  const copyToClipboard = async (text: string, componentId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedComponent(componentId);
      setTimeout(() => setCopiedComponent(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderComponent = (component: any, index: number) => {
    const componentId = `${message.id}-${index}`;

    // Safety check for component structure
    if (!component || !component.type) {
      return (
        <div key={index} className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Invalid component data
          </p>
        </div>
      );
    }

    // Handle legacy chart types - convert direct chart types to proper chart components
    if (['line', 'bar', 'pie', 'area', 'donut', 'composed', 'scatter', 'radar'].includes(component.type)) {
      component = {
        type: 'chart',
        data: {
          type: component.type,
          title: component.data?.title || `${component.type.charAt(0).toUpperCase() + component.type.slice(1)} Chart`,
          data: component.data?.data || component.data || [],
          description: component.data?.description || '',
          xAxis: component.data?.xAxis || 'X Axis',
          yAxis: component.data?.yAxis || 'Y Axis'
        }
      };
    }

    // Ensure component has data property
    if (!component.data) {
      return (
        <div key={index} className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Invalid component data - missing data property
          </p>
        </div>
      );
    }

    switch (component.type) {
      case 'text':
        return (
          <div key={index} className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{component.data?.text || ''}</p>
          </div>
        );

      case 'metric_card':
        return (
          <Card key={index} className="w-full max-w-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {component.data?.title || 'Metric'}
                  </p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-2xl font-bold">
                      {component.data?.value || '0'}
                    </p>
                    {component.data?.unit && (
                      <span className="text-sm text-muted-foreground">
                        {component.data.unit}
                      </span>
                    )}
                  </div>
                  {component.data?.change && (
                    <p className={`text-sm ${
                      component.data.trend === 'up' ? 'text-green-600' : 
                      component.data.trend === 'down' ? 'text-red-600' : 
                      'text-muted-foreground'
                    }`}>
                      {component.data.change}
                    </p>
                  )}
                </div>
                {component.data?.trend && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    component.data.trend === 'up' ? 'bg-green-100 text-green-600' :
                    component.data.trend === 'down' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {component.data.trend === 'up' ? '↗' : 
                     component.data.trend === 'down' ? '↘' : '→'}
                  </div>
                )}
              </div>
              {component.data?.description && (
                <p className="text-xs text-muted-foreground mt-2">
                  {component.data.description}
                </p>
              )}
            </CardContent>
          </Card>
        );

      case 'chart':
        // Validate chart data
        if (!component.data?.data || !Array.isArray(component.data.data) || component.data.data.length === 0) {
          return (
            <Card key={index} className="w-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{component.data?.title || 'Chart'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full flex items-center justify-center bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">No chart data available</p>
                    <p className="text-xs text-muted-foreground">
                      The chart component was created but contains no data to display.
                    </p>
                  </div>
                </div>
                {component.data?.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {component.data.description}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={index} className="w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{component.data?.title || 'Chart'}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(component.data?.data || [], null, 2), componentId)}
                  className="h-6 w-6 p-0"
                >
                  {copiedComponent === componentId ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {component.data?.type === 'line' && (
                    <LineChart data={component.data?.data || []}>
                      <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      {/* Background area for visual appeal */}
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="transparent"
                        fill="url(#lineGradient)"
                      />
                      {/* Main line */}
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={chartColors.primary}
                        strokeWidth={3}
                        dot={{ fill: chartColors.primary, strokeWidth: 2, r: 5, stroke: '#ffffff' }}
                        activeDot={{ r: 7, stroke: chartColors.primary, strokeWidth: 2, fill: '#ffffff' }}
                      />
                      {/* Support for multiple series */}
                      {component.data?.series && component.data.series.map((seriesKey: string, index: number) => (
                        <Line
                          key={seriesKey}
                          type="monotone"
                          dataKey={seriesKey}
                          stroke={getChartColor(index + 1)}
                          strokeWidth={3}
                          dot={{ fill: getChartColor(index + 1), strokeWidth: 2, r: 4, stroke: '#ffffff' }}
                          activeDot={{ r: 6, stroke: getChartColor(index + 1), strokeWidth: 2, fill: '#ffffff' }}
                        />
                      ))}
                      {component.data?.series && <Legend wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />}
                    </LineChart>
                  )}
                  {component.data?.type === 'bar' && (
                    <BarChart data={component.data?.data || []}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.9}/>
                          <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0.6}/>
                        </linearGradient>
                        {/* Additional gradients for multiple series */}
                        {component.data?.series && component.data.series.map((seriesKey: string, index: number) => (
                          <linearGradient key={`barGradient${index}`} id={`barGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={getChartColor(index + 1)} stopOpacity={0.9}/>
                            <stop offset="95%" stopColor={getChartColor(index + 1)} stopOpacity={0.6}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="url(#barGradient)"
                        radius={[6, 6, 0, 0]}
                        stroke={chartColors.secondary}
                        strokeWidth={1}
                      />
                      {/* Support for multiple series */}
                      {component.data?.series && component.data.series.map((seriesKey: string, index: number) => (
                        <Bar
                          key={seriesKey}
                          dataKey={seriesKey}
                          fill={`url(#barGradient${index})`}
                          radius={[6, 6, 0, 0]}
                          stroke={getChartColor(index + 1)}
                          strokeWidth={1}
                        />
                      ))}
                      {component.data?.series && <Legend wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />}
                    </BarChart>
                  )}
                  {component.data?.type === 'area' && (
                    <AreaChart data={component.data?.data || []}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.tertiary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={chartColors.tertiary} stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={chartColors.tertiary}
                        fill="url(#areaGradient)"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  )}
                  {(component.data?.type === 'pie' || component.data?.type === 'donut') && (
                    <PieChart>
                      <defs>
                        {Object.entries(chartColors).map(([key, color], index) => (
                          <linearGradient key={key} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                            <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={component.data?.data || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={component.data?.type === 'donut' ? 45 : 0}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {(component.data?.data || []).map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#pieGradient${index % Object.keys(chartColors).length})`}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '12px', color: '#64748b' }}
                      />
                    </PieChart>
                  )}
                  {component.data?.type === 'composed' && (
                    <ComposedChart data={component.data?.data || []}>
                      <defs>
                        <linearGradient id="composedBarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.6}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
                      <Bar 
                        dataKey="volume" 
                        fill="url(#composedBarGradient)" 
                        name="Volume" 
                        radius={[4, 4, 0, 0]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke={chartColors.quaternary} 
                        strokeWidth={3}
                        name="Price"
                        dot={{ fill: chartColors.quaternary, strokeWidth: 2, r: 4 }}
                      />
                    </ComposedChart>
                  )}
                  {component.data?.type === 'scatter' && (
                    <ScatterChart data={component.data?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                      <XAxis 
                        dataKey="x" 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        dataKey="y"
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Scatter 
                        dataKey="value" 
                        fill={chartColors.quinary}
                        stroke={chartColors.quinary}
                        strokeWidth={2}
                        r={6}
                      />
                    </ScatterChart>
                  )}
                  {component.data?.type === 'radar' && (
                    <RadarChart data={component.data?.data || []}>
                      <defs>
                        <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={chartColors.senary} stopOpacity={0.6}/>
                          <stop offset="100%" stopColor={chartColors.senary} stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <PolarGrid stroke="#cbd5e1" />
                      <PolarAngleAxis 
                        dataKey="label" 
                        tick={{ fontSize: 12, fill: '#64748b' }} 
                      />
                      <PolarRadiusAxis 
                        tick={{ fontSize: 12, fill: '#64748b' }} 
                        tickCount={4}
                      />
                      <Radar
                        name="Metrics"
                        dataKey="value"
                        stroke={chartColors.senary}
                        fill="url(#radarGradient)"
                        strokeWidth={3}
                        dot={{ fill: chartColors.senary, strokeWidth: 2, r: 4 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                    </RadarChart>
                  )}
                  {!['line', 'bar', 'area', 'pie', 'donut', 'composed', 'scatter', 'radar'].includes(component.data?.type) && (
                    <div className="h-full flex items-center justify-center bg-muted rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Unsupported chart type: {component.data?.type || 'unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supported types: line, bar, area, pie, donut, composed, scatter, radar
                        </p>
                      </div>
                    </div>
                  )}
                </ResponsiveContainer>
              </div>
              {component.data?.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {component.data.description}
                </p>
              )}
            </CardContent>
          </Card>
        );

      case 'table':
        return (
          <Card key={index} className="w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{component.data?.title || 'Table'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {(component.data?.headers || []).map((header: string, i: number) => (
                        <th key={i} className="text-left p-2 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(component.data?.rows || []).map((row: string[], i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        {row.map((cell: string, j: number) => (
                          <td key={j} className="p-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );

      case 'alert':
        return (
          <Alert key={index} className={`
            ${component.data?.severity === 'error' ? 'border-red-200 bg-red-50' : ''}
            ${component.data?.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}
            ${component.data?.severity === 'success' ? 'border-green-200 bg-green-50' : ''}
            ${component.data?.severity === 'info' ? 'border-blue-200 bg-blue-50' : ''}
          `}>
            <AlertTitle>{component.data?.title || 'Alert'}</AlertTitle>
            <AlertDescription>{component.data?.message || 'No message provided'}</AlertDescription>
          </Alert>
        );

      case 'insight_card':
        return (
          <Card key={index} className="w-full max-w-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm">{component.data?.title || 'Insight'}</h4>
                <Badge variant="outline" className="text-xs">
                  {component.data?.confidence || 0}% confidence
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {component.data?.insight || 'No insight provided'}
              </p>
              <Badge variant="secondary" className="text-xs">
                {component.data?.category || 'general'}
              </Badge>
            </CardContent>
          </Card>
        );

      case 'recommendation':
        return (
          <Card key={index} className="w-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium">{component.data?.title || 'Recommendation'}</h4>
                <div className="flex gap-1">
                  <Badge 
                    variant={component.data?.priority === 'high' ? 'destructive' : 
                            component.data?.priority === 'medium' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {component.data?.priority || 'low'} priority
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {component.data?.effort || 'unknown'} effort
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {component.data?.description || 'No description provided'}
              </p>
              {component.data?.impact && (
                <p className="text-xs text-green-600 font-medium">
                  Expected impact: {component.data.impact}
                </p>
              )}
            </CardContent>
          </Card>
        );

      default:
        return (
          <div key={index} className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Unsupported component type: {component.type}
            </p>
          </div>
        );
    }
  };

  return (
    <div className={`flex mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-primary text-primary-foreground' : 
            isSystem ? 'bg-muted text-muted-foreground' :
            'bg-secondary text-secondary-foreground'
          }`}>
            {isUser ? (
              <User className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Message Content */}
        <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {/* Message Bubble */}
          {message.content && (
            <div className={`inline-block p-3 rounded-lg mb-2 ${
              isUser 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-foreground'
            }`}>
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
          )}

          {/* Components */}
          {message.components && Array.isArray(message.components) && message.components.length > 0 && (
            <div className="space-y-3">
              {message.components.map((component, index) => renderComponent(component, index))}
            </div>
          )}

          {/* Metadata */}
          <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
            isUser ? 'justify-end' : 'justify-start'
          }`}>
            <span>{formatDate(message.createdAt)}</span>
            {message.metadata?.model && (
              <span>• {message.metadata.model}</span>
            )}
            {!isUser && message.content && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(message.content, message.id)}
                className="h-4 w-4 p-0 ml-1"
              >
                {copiedComponent === message.id ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}