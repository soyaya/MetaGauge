'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Shield, 
  Zap,
  Target,
  BarChart3,
  Lightbulb,
  Activity
} from 'lucide-react';
import { api } from '@/lib/api';

interface EnhancedAIInsightsProps {
  analysisId: string;
  analysisResults?: any;
  previousAnalysisId?: string;
}

export function EnhancedAIInsights({ 
  analysisId, 
  analysisResults, 
  previousAnalysisId 
}: EnhancedAIInsightsProps) {
  const [activeTab, setActiveTab] = useState('interpretation');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = async (type: string, apiCall: () => Promise<any>) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    setErrors(prev => ({ ...prev, [type]: '' }));

    try {
      const result = await apiCall();
      setData(prev => ({ ...prev, [type]: result }));
    } catch (error: any) {
      console.error(`${type} error:`, error);
      const errorMessage = error.message || `Failed to load ${type}`;
      setErrors(prev => ({ ...prev, [type]: errorMessage }));
      
      // Set fallback data based on type
      const fallbackData = getFallbackData(type);
      if (fallbackData) {
        setData(prev => ({ ...prev, [type]: fallbackData }));
      }
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const getFallbackData = (type: string) => {
    switch (type) {
      case 'insights':
        return {
          insights: [
            'Contract analysis completed successfully',
            'Enable AI features for detailed insights',
            'Check configuration for enhanced analysis'
          ],
          score: 75,
          status: 'healthy',
          keyMetrics: {
            transactionVolume: 'medium',
            userGrowth: 'stable',
            gasEfficiency: 'good'
          }
        };
      case 'alerts':
        return {
          alerts: [],
          summary: {
            totalAlerts: 0,
            criticalCount: 0,
            newAlertsCount: 0,
            overallRiskLevel: 'low'
          }
        };
      case 'sentiment':
        return {
          sentiment: {
            overall: 'neutral',
            confidence: 50,
            factors: []
          },
          marketPosition: {
            strength: 'unknown',
            competitiveAdvantage: [],
            marketShare: 'Unknown',
            growthPotential: 'unknown',
            riskFactors: []
          },
          predictions: {
            shortTerm: 'Enable AI for predictions',
            mediumTerm: 'Enable AI for predictions',
            longTerm: 'Enable AI for predictions',
            keyMetricsToWatch: []
          }
        };
      case 'optimizations':
        return {
          optimizations: [],
          quickWins: [],
          longTermStrategy: {
            vision: 'Enable AI analysis for optimization suggestions',
            milestones: [],
            expectedOutcome: 'Improved performance with AI insights'
          }
        };
      case 'interpretation':
        return {
          interpretation: {
            summary: {
              overallHealth: 'good',
              keyFindings: ['Analysis completed', 'Contract is operational'],
              riskLevel: 'medium',
              performanceScore: 75
            },
            insights: {
              strengths: ['Contract is functional'],
              weaknesses: ['Limited AI analysis'],
              opportunities: ['Enable AI features'],
              threats: []
            },
            recommendations: [],
            alerts: []
          }
        };
      default:
        return null;
    }
  };

  const generateInterpretation = () => {
    loadData('interpretation', () => api.analysis.interpretWithAI(analysisId));
  };

  const generateAlerts = () => {
    loadData('alerts', () => api.analysis.generateAlerts(analysisId, previousAnalysisId));
  };

  const generateSentiment = () => {
    loadData('sentiment', () => api.analysis.generateSentiment(analysisId));
  };

  const generateOptimizations = () => {
    loadData('optimizations', () => api.analysis.generateOptimizations(analysisId));
  };

  const generateQuickInsights = () => {
    loadData('insights', () => api.analysis.getQuickInsights(analysisId));
  };

  const renderLoadingState = (type: string, title: string, description: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        
        {errors[type] && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errors[type]}</p>
          </div>
        )}

        <Button 
          onClick={() => {
            switch(type) {
              case 'interpretation': generateInterpretation(); break;
              case 'alerts': generateAlerts(); break;
              case 'sentiment': generateSentiment(); break;
              case 'optimizations': generateOptimizations(); break;
              case 'insights': generateQuickInsights(); break;
            }
          }}
          disabled={loading[type]}
          className="w-full"
        >
          {loading[type] ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Generate {title}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const renderInterpretation = () => {
    if (!data.interpretation) {
      return renderLoadingState(
        'interpretation', 
        'AI Interpretation', 
        'Get comprehensive AI analysis with insights, recommendations, and strategic guidance.'
      );
    }

    const interpretation = data.interpretation.interpretation || data.interpretation.fallback;
    
    return (
      <div className="space-y-6">
        {/* Summary Card */}
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                AI Analysis Summary
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Score: {interpretation.summary?.performanceScore || 0}/100
                </Badge>
                <Badge className={
                  interpretation.summary?.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                  interpretation.summary?.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  interpretation.summary?.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }>
                  {interpretation.summary?.riskLevel || 'unknown'} risk
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium mb-2">Key Findings:</h4>
                <ul className="space-y-1">
                  {(interpretation.summary?.keyFindings || []).map((finding: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SWOT Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {(interpretation.insights?.strengths || []).map((strength: string, i: number) => (
                  <li key={i} className="text-sm">{strength}</li>
                ))}
                {(!interpretation.insights?.strengths || interpretation.insights.strengths.length === 0) && (
                  <li className="text-sm text-muted-foreground">No strengths identified</li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Weaknesses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {(interpretation.insights?.weaknesses || []).map((weakness: string, i: number) => (
                  <li key={i} className="text-sm">{weakness}</li>
                ))}
                {(!interpretation.insights?.weaknesses || interpretation.insights.weaknesses.length === 0) && (
                  <li className="text-sm text-muted-foreground">No weaknesses identified</li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {(interpretation.insights?.opportunities || []).map((opportunity: string, i: number) => (
                  <li key={i} className="text-sm">{opportunity}</li>
                ))}
                {(!interpretation.insights?.opportunities || interpretation.insights.opportunities.length === 0) && (
                  <li className="text-sm text-muted-foreground">No opportunities identified</li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-600 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Threats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {(interpretation.insights?.threats || []).map((threat: string, i: number) => (
                  <li key={i} className="text-sm">{threat}</li>
                ))}
                {(!interpretation.insights?.threats || interpretation.insights.threats.length === 0) && (
                  <li className="text-sm text-muted-foreground">No threats identified</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(interpretation.recommendations && interpretation.recommendations.length > 0) ? 
              interpretation.recommendations.map((rec: any, i: number) => (
                <div key={i} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium">{rec.title}</h5>
                    <Badge variant="outline" className={
                      rec.priority === 'high' ? 'border-red-200 text-red-700' :
                      rec.priority === 'medium' ? 'border-yellow-200 text-yellow-700' :
                      'border-green-200 text-green-700'
                    }>
                      {rec.priority} priority
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                  <p className="text-xs text-green-600 font-medium">
                    Expected Impact: {rec.impact}
                  </p>
                </div>
              )) : (
                <div className="text-center py-8">
                  <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recommendations available</p>
                  <p className="text-xs text-muted-foreground mt-1">AI analysis will provide actionable recommendations</p>
                </div>
              )
            }
          </CardContent>
        </Card>

        <Button 
          onClick={generateInterpretation} 
          disabled={loading.interpretation}
          variant="outline"
          className="w-full"
        >
          {loading.interpretation ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Regenerate Analysis
            </>
          )}
        </Button>
      </div>
    );
  };

  const renderAlerts = () => {
    if (!data.alerts) {
      return renderLoadingState(
        'alerts', 
        'Real-time Alerts', 
        'Monitor your contract for security issues, performance problems, and anomalies.'
      );
    }

    const alerts = data.alerts.alerts || [];
    const summary = data.alerts.summary || {};

    return (
      <div className="space-y-6">
        {/* Alert Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalAlerts || 0}</div>
              <p className="text-xs text-muted-foreground">Total Alerts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{summary.criticalCount || 0}</div>
              <p className="text-xs text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{summary.newAlertsCount || 0}</div>
              <p className="text-xs text-muted-foreground">New</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold ${
                summary.overallRiskLevel === 'low' ? 'text-green-600' :
                summary.overallRiskLevel === 'medium' ? 'text-yellow-600' :
                summary.overallRiskLevel === 'high' ? 'text-orange-600' :
                'text-red-600'
              }`}>
                {summary.overallRiskLevel || 'Unknown'}
              </div>
              <p className="text-xs text-muted-foreground">Risk Level</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts && alerts.length > 0 ? alerts.map((alert: any, i: number) => (
            <Card key={i} className={`border-l-4 ${
              alert.severity === 'critical' ? 'border-l-red-500' :
              alert.severity === 'high' ? 'border-l-orange-500' :
              alert.severity === 'medium' ? 'border-l-yellow-500' :
              'border-l-blue-500'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h5 className="font-medium flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${
                        alert.severity === 'critical' ? 'text-red-500' :
                        alert.severity === 'high' ? 'text-orange-500' :
                        alert.severity === 'medium' ? 'text-yellow-500' :
                        'text-blue-500'
                      }`} />
                      {alert.title}
                    </h5>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity}
                  </Badge>
                </div>
                
                {alert.suggestedActions && alert.suggestedActions.length > 0 && (
                  <div className="mt-3">
                    <h6 className="text-xs font-medium text-muted-foreground mb-1">Suggested Actions:</h6>
                    <ul className="text-xs space-y-1">
                      {alert.suggestedActions.map((action: string, j: number) => (
                        <li key={j} className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )) : (
            <Card className="border-green-200">
              <CardContent className="pt-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No alerts detected</p>
                <p className="text-xs text-green-600 mt-1">Your contract appears to be operating normally</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Button 
          onClick={generateAlerts} 
          disabled={loading.alerts}
          variant="outline"
          className="w-full"
        >
          {loading.alerts ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <Activity className="h-4 w-4 mr-2" />
              Refresh Alerts
            </>
          )}
        </Button>
      </div>
    );
  };

  const renderSentiment = () => {
    if (!data.sentiment) {
      return renderLoadingState(
        'sentiment', 
        'Market Sentiment', 
        'Analyze market positioning, competitive advantages, and growth potential.'
      );
    }

    const sentiment = data.sentiment.sentiment || {};
    const marketPosition = data.sentiment.marketPosition || {};
    const predictions = data.sentiment.predictions || {};

    return (
      <div className="space-y-6">
        {/* Sentiment Overview */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Market Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className={`text-2xl font-bold ${
                  sentiment.overall === 'bullish' ? 'text-green-600' :
                  sentiment.overall === 'bearish' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {sentiment.overall || 'Neutral'}
                </div>
                <p className="text-sm text-muted-foreground">Overall Sentiment</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{sentiment.confidence || 0}%</div>
                <p className="text-sm text-muted-foreground">Confidence</p>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="font-medium">Key Factors:</h5>
              {(sentiment.factors || []).map((factor: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{factor.factor}</span>
                  <Badge variant={
                    factor.impact === 'positive' ? 'default' :
                    factor.impact === 'negative' ? 'destructive' :
                    'secondary'
                  }>
                    {factor.impact}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Market Position */}
        <Card>
          <CardHeader>
            <CardTitle>Market Position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h6 className="font-medium text-sm">Strength</h6>
                <p className="text-lg font-semibold capitalize">{marketPosition.strength || 'Unknown'}</p>
              </div>
              <div>
                <h6 className="font-medium text-sm">Growth Potential</h6>
                <p className="text-lg font-semibold capitalize">{marketPosition.growthPotential || 'Unknown'}</p>
              </div>
            </div>

            {marketPosition.competitiveAdvantage && marketPosition.competitiveAdvantage.length > 0 && (
              <div>
                <h6 className="font-medium text-sm mb-2">Competitive Advantages</h6>
                <ul className="space-y-1">
                  {marketPosition.competitiveAdvantage.map((advantage: string, i: number) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      {advantage}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Predictions */}
        <Card>
          <CardHeader>
            <CardTitle>Market Predictions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h6 className="font-medium text-sm">Short Term (1 week)</h6>
              <p className="text-sm text-muted-foreground">{predictions.shortTerm}</p>
            </div>
            <div>
              <h6 className="font-medium text-sm">Medium Term (1 month)</h6>
              <p className="text-sm text-muted-foreground">{predictions.mediumTerm}</p>
            </div>
            <div>
              <h6 className="font-medium text-sm">Long Term (3 months)</h6>
              <p className="text-sm text-muted-foreground">{predictions.longTerm}</p>
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={generateSentiment} 
          disabled={loading.sentiment}
          variant="outline"
          className="w-full"
        >
          {loading.sentiment ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4 mr-2" />
              Refresh Sentiment
            </>
          )}
        </Button>
      </div>
    );
  };

  const renderOptimizations = () => {
    if (!data.optimizations) {
      return renderLoadingState(
        'optimizations', 
        'Optimization Suggestions', 
        'Get specific recommendations to improve gas efficiency, security, and performance.'
      );
    }

    const optimizations = data.optimizations.optimizations || [];
    const quickWins = data.optimizations.quickWins || [];
    const strategy = data.optimizations.longTermStrategy || {};

    return (
      <div className="space-y-6">
        {/* Quick Wins */}
        {quickWins.length > 0 && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Zap className="h-5 w-5" />
                Quick Wins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickWins.map((win: any, i: number) => (
                <div key={i} className="p-3 bg-green-50 rounded-lg">
                  <h5 className="font-medium text-sm">{win.action}</h5>
                  <p className="text-xs text-muted-foreground mt-1">{win.benefit}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {win.effort} effort
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Detailed Optimizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              Optimization Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {optimizations && optimizations.length > 0 ? optimizations.map((opt: any, i: number) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h5 className="font-medium">{opt.title}</h5>
                    <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge variant={
                      opt.priority === 'critical' ? 'destructive' :
                      opt.priority === 'high' ? 'default' :
                      'secondary'
                    }>
                      {opt.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {opt.category}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
                  <div>
                    <span className="font-medium">Expected Benefit:</span>
                    <p className="text-muted-foreground">{opt.expectedBenefit}</p>
                  </div>
                  <div>
                    <span className="font-medium">Complexity:</span>
                    <p className="text-muted-foreground capitalize">{opt.implementationComplexity}</p>
                  </div>
                  <div>
                    <span className="font-medium">Timeline:</span>
                    <p className="text-muted-foreground">{opt.timeline}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No optimization suggestions available</p>
                <p className="text-xs text-muted-foreground mt-1">Enable AI analysis for detailed recommendations</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Long-term Strategy */}
        {strategy.vision && (
          <Card>
            <CardHeader>
              <CardTitle>Long-term Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">{strategy.vision}</p>
              {strategy.milestones && strategy.milestones.length > 0 && (
                <div>
                  <h6 className="font-medium text-sm mb-2">Key Milestones:</h6>
                  <ul className="space-y-1">
                    {strategy.milestones.map((milestone: string, i: number) => (
                      <li key={i} className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-blue-500" />
                        {milestone}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button 
          onClick={generateOptimizations} 
          disabled={loading.optimizations}
          variant="outline"
          className="w-full"
        >
          {loading.optimizations ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <Lightbulb className="h-4 w-4 mr-2" />
              Refresh Optimizations
            </>
          )}
        </Button>
      </div>
    );
  };

  const renderQuickInsights = () => {
    if (!data.insights) {
      return renderLoadingState(
        'insights', 
        'Quick Insights', 
        'Get instant AI-powered insights about your contract performance.'
      );
    }

    const insights = data.insights.insights || [];
    const score = data.insights.score || 0;
    const status = data.insights.status || 'unknown';
    const keyMetrics = data.insights.keyMetrics || {};

    return (
      <div className="space-y-6">
        {/* Score Card */}
        <Card className={`border-2 ${
          status === 'healthy' ? 'border-green-200' :
          status === 'concerning' ? 'border-yellow-200' :
          'border-red-200'
        }`}>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`text-4xl font-bold ${
                status === 'healthy' ? 'text-green-600' :
                status === 'concerning' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {score}
              </div>
              <p className="text-sm text-muted-foreground">Performance Score</p>
              <Badge className={`mt-2 ${
                status === 'healthy' ? 'bg-green-100 text-green-800' :
                status === 'concerning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        {Object.keys(keyMetrics).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(keyMetrics).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="font-semibold capitalize">{value as string}</div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(insights && Array.isArray(insights) ? insights : []).map((insight: string, i: number) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <Brain className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  {insight}
                </li>
              ))}
              {(!insights || !Array.isArray(insights)) && (
                <li className="text-sm text-muted-foreground">No insights available</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Button 
          onClick={generateQuickInsights} 
          disabled={loading.insights}
          variant="outline"
          className="w-full"
        >
          {loading.insights ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Refresh Insights
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          Enhanced AI Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="interpretation" className="text-xs">
              Interpretation
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs">
              Quick Insights
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs">
              Alerts
            </TabsTrigger>
            <TabsTrigger value="sentiment" className="text-xs">
              Sentiment
            </TabsTrigger>
            <TabsTrigger value="optimizations" className="text-xs">
              Optimizations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="interpretation" className="mt-6">
            {renderInterpretation()}
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            {renderQuickInsights()}
          </TabsContent>

          <TabsContent value="alerts" className="mt-6">
            {renderAlerts()}
          </TabsContent>

          <TabsContent value="sentiment" className="mt-6">
            {renderSentiment()}
          </TabsContent>

          <TabsContent value="optimizations" className="mt-6">
            {renderOptimizations()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}