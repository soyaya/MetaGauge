'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Check, Zap, Crown, Building2, Sparkles } from 'lucide-react'
import { SubscriptionTier, BillingCycle, SUBSCRIPTION_PLANS } from '@/lib/web3-config'

interface PlanSelectorProps {
  onSelectPlan: (tier: SubscriptionTier, cycle: BillingCycle) => void
  currentTier?: SubscriptionTier
  loading?: boolean
  className?: string
}

export function PlanSelector({ 
  onSelectPlan, 
  currentTier, 
  loading = false,
  className = "" 
}: PlanSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.Monthly)

  const getPlanIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case SubscriptionTier.Free:
        return <Sparkles className="h-5 w-5" />
      case SubscriptionTier.Starter:
        return <Zap className="h-5 w-5" />
      case SubscriptionTier.Pro:
        return <Crown className="h-5 w-5" />
      case SubscriptionTier.Enterprise:
        return <Building2 className="h-5 w-5" />
    }
  }

  const getPlanColor = (tier: SubscriptionTier) => {
    switch (tier) {
      case SubscriptionTier.Free:
        return 'border-gray-200'
      case SubscriptionTier.Starter:
        return 'border-blue-200'
      case SubscriptionTier.Pro:
        return 'border-purple-200 ring-2 ring-purple-100'
      case SubscriptionTier.Enterprise:
        return 'border-orange-200'
    }
  }

  const getPrice = (tier: SubscriptionTier) => {
    const plan = SUBSCRIPTION_PLANS[tier]
    const price = billingCycle === BillingCycle.Monthly ? plan.monthlyPrice : plan.yearlyPrice
    return price
  }

  const getYearlySavings = (tier: SubscriptionTier) => {
    const plan = SUBSCRIPTION_PLANS[tier]
    const monthlyTotal = parseFloat(plan.monthlyPrice) * 12
    const yearlyPrice = parseFloat(plan.yearlyPrice)
    if (monthlyTotal > yearlyPrice) {
      const savings = ((monthlyTotal - yearlyPrice) / monthlyTotal * 100).toFixed(0)
      return `Save ${savings}%`
    }
    return null
  }

  return (
    <div className={className}>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Choose Your Plan</h2>
        <p className="text-muted-foreground">
          Select the perfect plan for your analytics needs
        </p>
      </div>

      <Tabs 
        value={billingCycle.toString()} 
        onValueChange={(value) => setBillingCycle(parseInt(value) as BillingCycle)}
        className="mb-8"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value={BillingCycle.Monthly.toString()}>Monthly</TabsTrigger>
          <TabsTrigger value={BillingCycle.Yearly.toString()}>
            Yearly
            <Badge variant="secondary" className="ml-2 text-xs">Save up to 17%</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(SUBSCRIPTION_PLANS).map(([tierKey, plan]) => {
          const tier = parseInt(tierKey) as SubscriptionTier
          const price = getPrice(tier)
          const savings = billingCycle === BillingCycle.Yearly ? getYearlySavings(tier) : null
          const isCurrentPlan = currentTier === tier
          const isFree = tier === SubscriptionTier.Free

          return (
            <Card 
              key={tier} 
              className={`relative ${getPlanColor(tier)} ${tier === SubscriptionTier.Pro ? 'scale-105' : ''}`}
            >
              {tier === SubscriptionTier.Pro && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center mb-2">
                  {getPlanIcon(tier)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="text-3xl font-bold text-foreground">
                    {isFree ? 'Free' : `${price} MGT`}
                  </div>
                  <div className="text-sm">
                    {isFree ? 'Forever' : `per ${billingCycle === BillingCycle.Monthly ? 'month' : 'year'}`}
                  </div>
                  {savings && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {savings}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{plan.features.apiCallsPerMonth.toLocaleString()} API calls/month</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{plan.features.maxProjects} project{plan.features.maxProjects > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{plan.features.maxAlerts} alert{plan.features.maxAlerts > 1 ? 's' : ''}</span>
                  </div>
                  
                  {plan.features.exportAccess && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Data export</span>
                    </div>
                  )}
                  
                  {plan.features.comparisonTool && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Comparison tool</span>
                    </div>
                  )}
                  
                  {plan.features.walletIntelligence && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Wallet intelligence</span>
                    </div>
                  )}
                  
                  {plan.features.apiAccess && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>API access</span>
                    </div>
                  )}
                  
                  {plan.features.prioritySupport && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Priority support</span>
                    </div>
                  )}
                  
                  {plan.features.customInsights && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Custom insights</span>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  variant={tier === SubscriptionTier.Pro ? "default" : "outline"}
                  onClick={() => onSelectPlan(tier, billingCycle)}
                  disabled={loading || isCurrentPlan}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : isFree ? (
                    'Get Started'
                  ) : (
                    'Subscribe'
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}