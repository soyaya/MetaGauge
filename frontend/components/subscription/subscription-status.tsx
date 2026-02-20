'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/components/auth/auth-provider'
import { Crown, Calendar, AlertTriangle, Zap, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface SubscriptionStatusProps {
  className?: string
}

interface SubscriptionData {
  tier: number
  tierName: string
  isActive: boolean
  endTime: number
  features: {
    apiCallsPerMonth: number
    maxProjects: number
    maxAlerts: number
    exportAccess: boolean
    comparisonTool: boolean
    walletIntelligence: boolean
    apiAccess: boolean
    prioritySupport: boolean
    customInsights: boolean
  }
  limits: {
    historicalData: number
    teamMembers: number
    dataRefreshRate: number
  }
}

export function SubscriptionStatus({ className = "" }: SubscriptionStatusProps) {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSubscription()
  }, [user])

  const loadSubscription = async () => {
    // Don't load if user not authenticated
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true)
      const data = await api.onboarding.getUserMetrics()
      setSubscription(data.subscription)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Subscription Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const isFreeTier = !subscription || subscription.tier === 0 || !subscription.isActive
  const tierName = subscription?.tierName || user?.tier || 'Free'
  
  const getStatusBadge = () => {
    if (isFreeTier) {
      return <Badge variant="secondary">Free Plan</Badge>
    }
    
    if (subscription?.isActive) {
      return <Badge variant="default">Active</Badge>
    }
    
    return <Badge variant="outline">Inactive</Badge>
  }

  const getDaysRemaining = () => {
    if (!subscription?.endTime) return 0
    const now = Math.floor(Date.now() / 1000)
    const remaining = subscription.endTime - now
    return Math.max(0, Math.floor(remaining / (24 * 60 * 60)))
  }

  const getTimeProgress = () => {
    if (!subscription || isFreeTier) return 0
    const now = Math.floor(Date.now() / 1000)
    const totalDuration = subscription.endTime - (subscription.endTime - 2592000) // Assume 30 days
    const elapsed = now - (subscription.endTime - 2592000)
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Subscription Status
          </div>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          Current plan: {tierName}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Plan Details */}
        {subscription?.features && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>API Calls/Month:</span>
              <span className="font-medium">
                {subscription.features.apiCallsPerMonth?.toLocaleString() || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Max Projects:</span>
              <span className="font-medium">{subscription.features.maxProjects || 1}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Max Alerts:</span>
              <span className="font-medium">{subscription.features.maxAlerts || 3}</span>
            </div>
          </div>
        )}

        {/* Time Remaining (for paid plans) */}
        {!isFreeTier && subscription && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Time Remaining</span>
              </div>
              <span className="font-medium">
                {getDaysRemaining()} days
              </span>
            </div>
            
            <Progress value={100 - getTimeProgress()} className="h-2" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {isFreeTier ? (
            <Link href="/subscription" className="flex-1">
              <Button className="w-full">
                <Zap className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            </Link>
          ) : (
            <>
              {subscription && subscription.tier < 3 && (
                <Link href="/subscription" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Upgrade
                  </Button>
                </Link>
              )}
              
              <Link href="/subscription" className="flex-1">
                <Button variant="outline" className="w-full">
                  Manage Plan
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Feature Highlights */}
        {subscription?.features && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Current plan includes:</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {subscription.features.exportAccess && (
                <span className="text-green-600">✓ Data Export</span>
              )}
              {subscription.features.comparisonTool && (
                <span className="text-green-600">✓ Comparison Tool</span>
              )}
              {subscription.features.walletIntelligence && (
                <span className="text-green-600">✓ Wallet Intelligence</span>
              )}
              {subscription.features.apiAccess && (
                <span className="text-green-600">✓ API Access</span>
              )}
              {subscription.features.prioritySupport && (
                <span className="text-green-600">✓ Priority Support</span>
              )}
              {subscription.features.customInsights && (
                <span className="text-green-600">✓ Custom Insights</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}