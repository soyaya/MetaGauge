'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, Zap } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface SubscriptionStatusProps {
  className?: string
}

export function SubscriptionStatus({ className = "" }: SubscriptionStatusProps) {
  const [usage, setUsage] = useState<any>(null)

  useEffect(() => {
    // Use the proper API method
    const fetchUsage = async () => {
      try {
        const data = await api.billing.getUsage();
        setUsage(data);
      } catch (error) {
        console.warn('Failed to fetch billing usage:', error);
        // Set default values to prevent UI errors
        setUsage({
          balance: 0,
          analysesThisMonth: 0,
          aiQueriesThisMonth: 0,
          freeRemaining: {
            analyses: 10,
            aiQueries: 50
          }
        });
      }
    };
    
    fetchUsage();
  }, [])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4" /> Billing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Balance: </span>
          <strong>${(usage?.balance || 0).toFixed(2)}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">Analyses this month: </span>
          {usage?.analysesThisMonth ?? '—'}
          <span className="text-muted-foreground"> ({usage?.freeRemaining?.analyses ?? '—'} free left)</span>
        </p>
        <p>
          <span className="text-muted-foreground">AI queries this month: </span>
          {usage?.aiQueriesThisMonth ?? '—'}
          <span className="text-muted-foreground"> ({usage?.freeRemaining?.aiQueries ?? '—'} free left)</span>
        </p>
        <Link href="/subscription">
          <Button size="sm" variant="outline" className="w-full mt-2">
            <Zap className="mr-2 h-3 w-3" /> Manage Billing
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
