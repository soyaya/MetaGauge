"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/ui/header"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { User, Mail, Shield, Activity, Save, CheckCircle, AlertCircle, Loader2, KeyRound, Twitter, Linkedin } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

function ChangePasswordForm() {
  const { toast } = useToast()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (next.length < 6) { setError("New password must be at least 6 characters"); return }
    setSaving(true)
    try {
      await api.post('/api/users/change-password', { currentPassword: current, newPassword: next })
      toast({ title: "Password changed successfully" })
      setCurrent(""); setNext(""); setOpen(false)
    } catch (err: any) {
      setError(err.message || "Failed to change password")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return (
    <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
      <KeyRound className="h-4 w-4 mr-2" />
      Change Password
    </Button>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div className="space-y-1">
        <Label htmlFor="current-pw" className="text-xs">Current Password</Label>
        <Input id="current-pw" type="password" value={current}
          onChange={e => setCurrent(e.target.value)} required disabled={saving} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-pw" className="text-xs">New Password</Label>
        <Input id="new-pw" type="password" value={next}
          onChange={e => setNext(e.target.value)} required disabled={saving} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(false); setError("") }}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function SocialAccountsCard() {
  const { toast } = useToast()
  const [connected, setConnected] = useState<any>({ twitter: { connected: false }, linkedin: { connected: false } })
  const [open, setOpen] = useState<'twitter' | 'linkedin' | null>(null)
  const [fields, setFields] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/users/social-credentials').then(setConnected).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/users/social-credentials', fields)
      const updated = await api.get('/api/users/social-credentials')
      setConnected(updated)
      setOpen(null); setFields({})
      toast({ title: 'Social account connected' })
    } catch { toast({ title: 'Failed to save', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const disconnect = async (platform: string) => {
    await api.delete(`/api/users/social-credentials/${platform}`).catch(() => {})
    setConnected((p: any) => ({ ...p, [platform]: { connected: false } }))
    toast({ title: `${platform} disconnected` })
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Twitter className="h-5 w-5" />Social Accounts</CardTitle>
        <CardDescription>Connect your accounts so the agent posts to your pages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Twitter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Twitter className="h-4 w-4" />
            <span className="text-sm font-medium">Twitter / X</span>
            {connected.twitter?.connected && <Badge className="text-xs bg-green-100 text-green-700">Connected</Badge>}
          </div>
          {connected.twitter?.connected
            ? <Button size="sm" variant="outline" onClick={() => disconnect('twitter')}>Disconnect</Button>
            : <Button size="sm" variant="outline" onClick={() => setOpen('twitter')}>Connect</Button>}
        </div>
        {open === 'twitter' && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/40">
            {[['twitterApiKey','API Key'],['twitterApiSecret','API Secret'],['twitterAccessToken','Access Token'],['twitterAccessSecret','Access Secret']].map(([k,l]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{l}</Label>
                <Input type="password" value={fields[k]||''} onChange={e => setFields((p:any)=>({...p,[k]:e.target.value}))} />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Save'}</Button>
              <Button size="sm" variant="outline" onClick={() => { setOpen(null); setFields({}) }}>Cancel</Button>
            </div>
          </div>
        )}

        <Separator />

        {/* LinkedIn */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Linkedin className="h-4 w-4" />
            <span className="text-sm font-medium">LinkedIn</span>
            {connected.linkedin?.connected && <Badge className="text-xs bg-green-100 text-green-700">Connected</Badge>}
          </div>
          {connected.linkedin?.connected
            ? <Button size="sm" variant="outline" onClick={() => disconnect('linkedin')}>Disconnect</Button>
            : <Button size="sm" variant="outline" onClick={() => setOpen('linkedin')}>Connect</Button>}
        </div>
        {open === 'linkedin' && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/40">
            {[['linkedinAccessToken','Access Token'],['linkedinPersonUrn','Person URN']].map(([k,l]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{l}</Label>
                <Input type="password" value={fields[k]||''} onChange={e => setFields((p:any)=>({...p,[k]:e.target.value}))} />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Save'}</Button>
              <Button size="sm" variant="outline" onClick={() => { setOpen(null); setFields({}) }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const { user, login, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/profile')
  }, [authLoading, isAuthenticated, router])

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      const profileRes = await api.users.getProfile()
      setProfile(profileRes)
      setName(profileRes.name || "")
      setEmail(profileRes.email || "")
      const subRes = await api.get('/api/subscription/status').catch(() => null)
      setUsage({
        thisMonth: profileRes.usage?.monthlyAnalysisCount || 0,
        limit: subRes?.limits?.monthly ?? 10,
        total: profileRes.usage?.analysisCount || 0,
        tier: String(profileRes.tier || user?.tier || 'free'),
      })
    } catch {
      toast({ title: "Failed to load profile", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.users.updateProfile({ name: name.trim(), email: email.trim() })
      toast({ title: "Profile updated" })
      await loadProfile()
    } catch {
      toast({ title: "Update failed", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleGoogleVerify = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) { toast({ title: 'Google Client ID not configured', variant: 'destructive' }); return }
    setVerifying(true)
    const run = () => {
      // @ts-ignore
      window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: 'email profile',
        callback: async (tr: any) => {
          if (tr.error) { setVerifying(false); return }
          try {
            const result = await api.users.verifyWithGoogle(tr.access_token)
            login(result.token, { ...user, ...result.user })
            toast({ title: '✅ Email verified via Google!' })
            await loadProfile()
          } catch (err: any) {
            toast({ title: err.message || 'Google verification failed', variant: 'destructive' })
          } finally { setVerifying(false) }
        },
      }).requestAccessToken()
    }
    // @ts-ignore
    if (window.google?.accounts) { run() } else {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.onload = run
      s.onerror = () => { toast({ title: 'Failed to load Google', variant: 'destructive' }); setVerifying(false) }
      document.head.appendChild(s)
    }
  }

  const handleSendOtp = async () => {
    setVerifying(true)
    try {
      const result = await api.post('/api/auth/send-verification')
      setOtpSent(true)
      if (result.devOtp) {
        // Dev mode — auto-fill the OTP and show it in toast
        setOtp(result.devOtp)
        toast({ title: `Dev mode OTP: ${result.devOtp}`, description: 'Auto-filled for you' })
      } else {
        toast({ title: 'Verification code sent to your email' })
      }
    } catch (err: any) {
      toast({ title: err.message || 'Failed to send code', variant: 'destructive' })
    } finally {
      setVerifying(false)
    }
  }

  const handleVerifyOtp = async () => {
    setVerifying(true)
    try {
      const result = await api.post('/api/auth/verify-otp', { email: profile.email, otp })
      login(result.token, { ...user, ...result.user })
      toast({ title: '✅ Email verified!' })
      setOtpSent(false)
      setOtp('')
      await loadProfile()
    } catch (err: any) {
      toast({ title: err.message || 'Verification failed', variant: 'destructive' })
    } finally {
      setVerifying(false)
    }
  }

  const isVerified = profile?.is_verified || profile?.emailVerified

  if (loading) return (
    <div className="page-shell">
      <Header />
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )

  return (
    <div className="page-shell">
      <Header />
      <div className="page-container max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account information and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Profile + Status */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Profile Information</CardTitle>
                <CardDescription>Update your name and email address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => !isVerified && setEmail(e.target.value)}
                        placeholder="Your email"
                        disabled={isVerified}
                        className={isVerified ? 'pr-10 opacity-70 cursor-not-allowed' : ''}
                      />
                      {isVerified && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
                    </div>
                    {isVerified && <p className="text-xs text-muted-foreground">Email cannot be changed after verification.</p>}
                  </div>
                </div>
                <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Email Verification</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {isVerified
                        ? <Badge className="gap-1"><CheckCircle className="h-3 w-3" />Verified</Badge>
                        : <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Not Verified</Badge>
                      }
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Plan</Label>
                    <div className="mt-1">
                      <Badge variant="outline">{usage?.tier || user?.tier || 'Free'}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Member Since</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(profile?.createdAt || profile?.created_at)
                        ? new Date(profile.createdAt || profile.created_at).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Last Login</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(profile?.lastLogin || profile?.last_login || profile?.updatedAt)
                        ? new Date(profile.lastLogin || profile.last_login || profile.updatedAt).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {!isVerified && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Verify your email to unlock all features.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={handleSendOtp} disabled={verifying || otpSent} variant="outline" size="sm">
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                        {otpSent ? 'Code sent — check email' : 'Send Code to Email'}
                      </Button>
                      <Button onClick={handleGoogleVerify} disabled={verifying} variant="outline" size="sm">
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (
                          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                        )}
                        Verify with Google
                      </Button>
                    </div>
                    {otpSent && (
                      <div className="flex gap-2">
                        <Input placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} className="text-center tracking-widest w-40" />
                        <Button size="sm" onClick={handleVerifyOtp} disabled={otp.length !== 6 || verifying}>
                          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}              </CardContent>
            </Card>
          </div>

          {/* Right: Usage + Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {usage && (
                  <>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>This month</span>
                        <span className="font-medium">{usage.thisMonth} / {usage.limit === -1 ? '∞' : usage.limit}</span>
                      </div>
                      <Progress value={usage.limit > 0 ? Math.min((usage.thisMonth / usage.limit) * 100, 100) : 0} className="h-2" />
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total analyses</span>
                      <span className="font-medium">{usage.total}</span>
                    </div>
                  </>
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/subscription">Manage Plan</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Security</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ChangePasswordForm />
              </CardContent>
            </Card>

            <SocialAccountsCard />
          </div>
        </div>
      </div>
    </div>
  )
}
