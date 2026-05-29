'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Zap } from 'lucide-react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/use-subscription'

interface SubscriptionStatusProps {
  className?: string
}

export function SubscriptionStatus({ className = "" }: SubscriptionStatusProps) {
  const sub = useSubscription()

  const analysesUsed  = sub.usage.monthlyAnalysisCount
  const aiUsed        = sub.usage.monthlyAiQueryCount
  const freeAnalyses  = sub.freeQuota.analyses
  const freeAiQueries = sub.freeQuota.aiQueries
  const resetsOn      = sub.resetsOn
    ? new Date(sub.resetsOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Billing</span>
          {sub.state === 'paid' ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-0 text-xs">Paid</Badge>
          ) : !sub.canContinue ? (
            <Badge variant="destructive" className="text-xs">Quota exhausted</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Free</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">Balance</span>
          <strong>${sub.balance.toFixed(2)}</strong>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-muted-foreground">Analyses</span>
            <span>{analysesUsed} / {freeAnalyses} free
              {sub.freeRemaining.analyses === 0 && sub.balance > 0 && (
                <span className="text-green-600 ml-1">(paid)</span>
              )}
            </span>
          </div>
          <Progress value={Math.min(100, (analysesUsed / freeAnalyses) * 100)} className="h-1.5" />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-muted-foreground">AI Queries</span>
            <span>{aiUsed} / {freeAiQueries} free
              {sub.freeRemaining.aiQueries === 0 && sub.balance > 0 && (
                <span className="text-green-600 ml-1">(paid)</span>
              )}
            </span>
          </div>
          <Progress value={Math.min(100, (aiUsed / freeAiQueries) * 100)} className="h-1.5" />
        </div>

        {resetsOn && (
          <p className="text-xs text-muted-foreground">Free quota resets {resetsOn}</p>
        )}

        <Link href="/subscription">
          <Button size="sm" variant={!sub.canContinue ? 'default' : 'outline'} className="w-full mt-1">
            <Zap className="mr-2 h-3 w-3" />
            {!sub.canContinue ? 'Top Up to Continue' : 'Manage Billing'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
