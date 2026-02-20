"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/ui/header"
import { Separator } from "@/components/ui/separator"
import { User, Mail, Shield, Activity, Save, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface UserProfile {
  id: string
  email: string
  name?: string
  roles: string[]
  is_verified: boolean
  onboarding_completed: boolean
  created_at: string
  last_login?: string
}

interface UserUsage {
  analysesThisMonth: number
  analysesLimit: number
  totalAnalyses: number
}

interface SubscriptionData {
  tier: number
  tierName: string
  isActive: boolean
  features: any
  limits: any
}

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [usage, setUsage] = useState<UserUsage | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (isAuthenticated) {
      loadProfileData()
    }
  }, [isAuthenticated])

  const loadProfileData = async () => {
    try {
      setLoading(true)
      const [profileResponse, metricsResponse] = await Promise.all([
        api.users.getProfile(),
        api.onboarding.getUserMetrics()
      ])
      
      setProfile(profileResponse)
      setUsage({
        analysesThisMonth: metricsResponse.usage?.monthlyAnalysisCount || 0,
        analysesLimit: metricsResponse.limits?.monthly || 10,
        totalAnalyses: metricsResponse.overview?.totalAnalyses || 0
      })
      setSubscription(metricsResponse.subscription)
      setName(profileResponse.name || "")
      setEmail(profileResponse.email || "")
    } catch (err) {
      console.error('Failed to load profile data:', err)
      setError('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      await api.users.updateProfile({
        name: name.trim(),
        email: email.trim()
      })
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      })
      
      // Reload profile data
      await loadProfileData()
    } catch (err) {
      console.error('Failed to update profile:', err)
      toast({
        title: "Update failed",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-600">{error}</p>
            <Button onClick={loadProfileData} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account information and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Email Verification</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {profile?.is_verified ? (
                        <Badge variant="default">Verified</Badge>
                      ) : (
                        <Badge variant="destructive">Not Verified</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Account Type</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={subscription?.isActive ? "default" : "outline"}>
                        {subscription?.tierName || user?.tier || 'Free'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Member Since</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {profile?.created_at ? formatDate(profile.created_at) : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Last Login</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {profile?.last_login ? formatDate(profile.last_login) : 'N/A'}
                    </p>
                  </div>
                </div>

                {!profile?.is_verified && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm text-yellow-800">
                      Please verify your email address to access all features.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Usage Statistics */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Usage Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">This Month</Label>
                    <span className="text-sm font-medium">
                      {usage?.analysesThisMonth || 0} / {usage?.analysesLimit || '∞'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ 
                        width: usage?.analysesLimit ? 
                          `${Math.min((usage.analysesThisMonth / usage.analysesLimit) * 100, 100)}%` : 
                          '0%' 
                      }}
                    ></div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Analyses</span>
                    <span className="text-sm font-medium">{usage?.totalAnalyses || 0}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Plan Type</span>
                    <Badge variant={subscription?.isActive ? "default" : "outline"}>
                      {subscription?.tierName || user?.tier || 'Free'}
                    </Badge>
                  </div>
                </div>

                {(!subscription?.isActive || subscription?.tier === 0) && (
                  <Button className="w-full" variant="outline" asChild>
                    <a href="/subscription">Upgrade Plan</a>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Verification
                </Button>
                
                <Button variant="outline" className="w-full">
                  Change Password
                </Button>
                
                <Separator />
                
                <Button variant="destructive" className="w-full">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}