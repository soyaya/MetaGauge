'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, Target, TrendingUp, Mail } from 'lucide-react';
import { api } from '@/lib/api';

interface Assignment {
  id: string;
  title: string;
  description: string;
  category: 'optimization' | 'growth' | 'security' | 'engagement';
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
  timeToComplete: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
  onchainMetricTarget: string;
  currentValue: number;
  targetValue: number;
  contractId: string;
}

interface AIProductivityProps {
  contractId: string;
}

export function AIProductivity({ contractId }: AIProductivityProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    loadAssignments();
  }, [contractId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/ai/assignments/${contractId}`);
      setAssignments(response.data);
    } catch (error) {
      console.error('Failed to load assignments:', error);
      // Mock data for demo
      setAssignments([
        {
          id: '1',
          title: 'Improve User Retention',
          description: 'Implement user engagement features to increase D7 retention from 45% to 60%',
          category: 'engagement',
          priority: 'high',
          estimatedImpact: '+25% revenue',
          timeToComplete: '2 weeks',
          status: 'pending',
          onchainMetricTarget: 'd7Retention',
          currentValue: 45,
          targetValue: 60,
          contractId
        },
        {
          id: '2',
          title: 'Optimize Gas Costs',
          description: 'Reduce average transaction gas costs by optimizing smart contract functions',
          category: 'optimization',
          priority: 'medium',
          estimatedImpact: '+15% user satisfaction',
          timeToComplete: '1 week',
          status: 'in_progress',
          onchainMetricTarget: 'averageGasCost',
          currentValue: 0.025,
          targetValue: 0.018,
          contractId
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const completeAssignment = async (assignmentId: string) => {
    try {
      setCompletingId(assignmentId);
      
      // Mark as completed
      await api.post(`/ai/assignments/${assignmentId}/complete`);
      
      // Update local state
      setAssignments(prev => prev.map(assignment => 
        assignment.id === assignmentId 
          ? { ...assignment, status: 'completed', completedAt: new Date().toISOString() }
          : assignment
      ));

      // Send email notification
      await api.post(`/ai/assignments/${assignmentId}/notify-completion`);
      
    } catch (error) {
      console.error('Failed to complete assignment:', error);
    } finally {
      setCompletingId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'optimization': return <TrendingUp className="h-4 w-4" />;
      case 'growth': return <Target className="h-4 w-4" />;
      case 'security': return <CheckCircle className="h-4 w-4" />;
      case 'engagement': return <Mail className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min(100, (current / target) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Productivity Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            AI Productivity Assignments
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete these AI-generated tasks to improve your on-chain metrics
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {assignments.map((assignment) => (
          <Card key={assignment.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(assignment.category)}
                  <CardTitle className="text-lg">{assignment.title}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge className={getPriorityColor(assignment.priority)}>
                    {assignment.priority}
                  </Badge>
                  <Badge className={getStatusColor(assignment.status)}>
                    {assignment.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{assignment.description}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Estimated Impact:</span>
                  <p className="text-green-600">{assignment.estimatedImpact}</p>
                </div>
                <div>
                  <span className="font-medium">Time to Complete:</span>
                  <p>{assignment.timeToComplete}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress: {assignment.onchainMetricTarget}</span>
                  <span>{assignment.currentValue} → {assignment.targetValue}</span>
                </div>
                <Progress 
                  value={calculateProgress(assignment.currentValue, assignment.targetValue)} 
                  className="h-2"
                />
              </div>

              {assignment.status !== 'completed' && (
                <Button 
                  onClick={() => completeAssignment(assignment.id)}
                  disabled={completingId === assignment.id}
                  className="w-full"
                >
                  {completingId === assignment.id ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Completed
                    </>
                  )}
                </Button>
              )}

              {assignment.status === 'completed' && assignment.completedAt && (
                <div className="text-sm text-green-600 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Completed on {new Date(assignment.completedAt).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {assignments.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
            <p className="text-muted-foreground">
              AI will generate productivity assignments based on your contract's performance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
