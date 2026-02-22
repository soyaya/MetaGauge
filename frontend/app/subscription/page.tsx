'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { Header } from '@/components/ui/header'
import { SubscriptionFlow } from '@/components/subscription/subscription-flow'
import { SubscriptionManagement } from '@/components/subscription/subscription-management'
import { NetworkSwitcher } from '@/components/web3/network-switcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function SubscriptionPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [userUUID, setUserUUID] = useState('')
  const [subscription, setSubscription] = useState<any>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/subscription')
      return
    }

    if (user?.id) {
      setUserUUID(user.id)
      loadSubscription()
    }
  }, [isAuthenticated, isLoading, user, router])

  const loadSubscription = async () => {
    try {
      const data = await api.onboarding.getUserMetrics()
      setSubscription(data.subscription)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoadingSubscription(false)
    }
  }

  const handleSubscriptionComplete = (subscriptionData: any) => {
    console.log('Subscription completed:', subscriptionData)
    
    // Store subscription data if needed
    if (subscriptionData.transactionHash) {
      localStorage.setItem('subscription_tx', subscriptionData.transactionHash)
    }

    // Reload subscription data
    loadSubscription()

    // Redirect to dashboard after a short delay
    setTimeout(() => {
      router.push('/dashboard')
    }, 3000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {subscription?.isActive && subscription?.tier > 0 
                  ? 'Manage Your Subscription' 
                  : 'Choose Your Subscription'}
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              {subscription?.isActive && subscription?.tier > 0
                ? 'Upgrade, downgrade, or cancel your plan'
                : 'Unlock the full power of MetaGauge analytics'}
            </p>
          </div>
        </div>

        {/* Network Status */}
        <div className="mb-8">
          <NetworkSwitcher />
        </div>

        {/* Show Management for Active Subscribers or Flow for New Subscribers */}
        {loadingSubscription ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : subscription?.isActive && subscription?.tier > 0 ? (
          <SubscriptionManagement
            currentTier={subscription.tier}
            currentCycle={0}
            isActive={subscription.isActive}
            onSuccess={loadSubscription}
          />
        ) : (
          <>
            {/* Subscription Flow */}
            <SubscriptionFlow
              onComplete={handleSubscriptionComplete}
              userUUID={userUUID}
              className="max-w-6xl mx-auto"
            />

            {/* Skip Option */}
            <div className="mt-12 text-center">
              <Card className="max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="text-lg">Want to explore first?</CardTitle>
                  <CardDescription>
                    You can always upgrade later from your dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/dashboard">
                    <Button variant="outline" className="w-full">
                      Continue with Free Plan
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Features Comparison */}
        {!subscription?.isActive && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Why Upgrade?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
              <CardHeader>
                <CardTitle className="text-lg">Advanced Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get deeper insights with advanced metrics, custom reports, and AI-powered analysis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Higher Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Analyze more contracts, get more API calls, and set up unlimited alerts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Priority Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get priority support, custom integrations, and dedicated account management
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}