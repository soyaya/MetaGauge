'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, AlertTriangle, CheckCircle, TrendingUp, Shield, Zap } from 'lucide-react';
import { api } from '@/lib/api';

interface AIInsightsProps {
  analysisId: string;
  analysisResults?: any;
}

interface AIInterpretation {
  summary: {
    overallHealth: string;
    keyFindings: string[];
    riskLevel: string;
    performanceScore: number;
  };
  insights: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  recommendations: Array<{
    priority: string;
    category: string;
    title: string;
    description: string;
    impact: string;
    effort: string;
  }>;
  alerts: Array<{
    severity: string;
    category: string;
    title: string;
    message: string;
    actionRequired: boolean;
    suggestedAction: string;
  }>;
  marketPosition: {
    competitiveRanking: string;
    marketShare: string;
    differentiators: string[];
    competitiveAdvantages: string[];
  };
  technicalAnalysis: {
    gasEfficiency: string;
    codeQuality: string;
    securityPosture: string;
    scalabilityAssessment: string;
  };
  actionItems: Array<{
    timeframe: string;
    action: string;
    expectedOutcome: string;
    priority: string;
  }>;
}

export function AIInsights({ analysisId, analysisResults }: AIInsightsProps) {
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);

  const generateInterpretation = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.analysis.interpretWithAI(analysisId);
      setInterpretation(response.interpretation);
      setAiEnabled(response.aiEnabled);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI interpretation');
      setAiEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium': return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return <Shield className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      case 'growth': return <TrendingUp className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  if (!interpretation) {
    return (
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI-Powered Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Get intelligent analysis, recommendations, and alerts powered by Gemini AI.
          </p>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
              {!aiEnabled && (
                <p className="text-xs text-red-500 mt-1">
                  AI features require GEMINI_API_KEY configuration
                </p>
              )}
            </div>
          )}

          <Button 
            onClick={generateInterpretation} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Generate AI Interpretation
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className={`border-2 ${getHealthColor(interpretation.summary.overallHealth)}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Analysis Summary
            </span>
            <div className="flex items-center gap-2">
              <Badge className={getRiskColor(interpretation.summary.riskLevel)}>
                {interpretation.summary.riskLevel} risk
              </Badge>
              <Badge variant="outline">
                Score: {interpretation.summary.performanceScore}/100
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium mb-2">Key Findings:</h4>
              <ul className="space-y-1">
                {interpretation.summary.keyFindings.map((finding, i) => (
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

      {/* Alerts */}
      {interpretation.alerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {interpretation.alerts.map((alert, i) => (
              <div key={i} className={`p-3 rounded-lg border ${
                alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-medium">{alert.title}</h5>
                    <p className="text-sm mt-1">{alert.message}</p>
                    {alert.suggestedAction && (
                      <p className="text-xs mt-2 font-medium">
                        Action: {alert.suggestedAction}
                      </p>
                    )}
                  </div>
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {interpretation.recommendations.map((rec, i) => (
            <div key={i} className="p-4 border rounded-lg hover:bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(rec.category)}
                  <h5 className="font-medium">{rec.title}</h5>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityIcon(rec.priority)}
                  <Badge variant="outline" className="text-xs">
                    {rec.effort} effort
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
              <p className="text-xs text-green-600 font-medium">
                Expected Impact: {rec.impact}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SWOT Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-600">Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {interpretation.insights.strengths.map((strength, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Weaknesses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {interpretation.insights.weaknesses.map((weakness, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  {weakness}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-600">Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {interpretation.insights.opportunities.map((opportunity, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  {opportunity}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-600">Threats</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {interpretation.insights.threats.map((threat, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <Shield className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  {threat}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Action Items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {interpretation.actionItems.map((item, i) => (
            <div key={i} className="p-3 border rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-medium">{item.action}</h5>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {item.timeframe}
                  </Badge>
                  {getPriorityIcon(item.priority)}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {item.expectedOutcome}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Regenerate Button */}
      <Button 
        onClick={generateInterpretation} 
        disabled={loading}
        variant="outline"
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Regenerating...
          </>
        ) : (
          <>
            <Brain className="h-4 w-4 mr-2" />
            Regenerate AI Analysis
          </>
        )}
      </Button>
    </div>
  );
}