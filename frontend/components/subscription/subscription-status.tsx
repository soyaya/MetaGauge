'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Crown, Calendar, AlertTriangle, Zap, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionTier } from '@/lib/web3-config'

interface SubscriptionStatusProps {
  className?: string
}

const TIER_NAMES: Record<SubscriptionTier, string> = {
  [SubscriptionTier.Free]: 'Free',
  [SubscriptionTier.Starter]: 'Starter',
  [SubscriptionTier.Pro]: 'Pro',
  [SubscriptionTier.Enterprise]: 'Enterprise',
}

export function SubscriptionStatus({ className = "" }: SubscriptionStatusProps) {
  const { 
    isActive, 
    currentTier, 
    daysRemaining, 
    isInGracePeriod,
    isLoading,
    error,
    networkError
  } = useSubscription()

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

  if (networkError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Subscription Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm">{networkError}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isFreeTier = currentTier === SubscriptionTier.Free || !isActive
  const tierName = TIER_NAMES[currentTier]
  
  const getStatusBadge = () => {
    if (isFreeTier) {
      return <Badge variant="secondary">Free Plan</Badge>
    }
    
    if (isInGracePeriod) {
      return <Badge variant="destructive">Grace Period</Badge>
    }
    
    if (isActive) {
      return <Badge variant="default">Active</Badge>
    }
    
    return <Badge variant="outline">Inactive</Badge>
  }

  const getTimeProgress = () => {
    if (daysRemaining <= 0) return 100
    // Assume 30 days subscription period
    const totalDays = 30
    const elapsed = totalDays - daysRemaining
    return Math.min(100, Math.max(0, (elapsed / totalDays) * 100))
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
        {/* Time Remaining (for paid plans) */}
        {!isFreeTier && isActive && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Time Remaining</span>
              </div>
              <span className="font-medium">
                {daysRemaining} days
              </span>
            </div>
            
            <Progress value={100 - getTimeProgress()} className="h-2" />
          </div>
        )}

        {/* Grace Period Warning */}
        {isInGracePeriod && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-600">
              Your subscription has expired. Renew to continue accessing premium features.
            </p>
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
              {currentTier < SubscriptionTier.Enterprise && (
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

        {/* Info Note */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {isFreeTier 
              ? 'Upgrade to unlock advanced analytics, higher limits, and priority support.'
              : 'Subscription data is read directly from the blockchain smart contract.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
