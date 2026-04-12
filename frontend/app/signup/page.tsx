"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, EyeOff, Eye, Loader2, User } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-provider"
import { OAuthButtons } from "@/components/auth/oauth-buttons"
import { AuthDivider } from "@/components/auth/divider"

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const redirectTo = searchParams.get('redirect')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    
    // Client-side validation with specific messages
    if (!name.trim()) {
      setError('Please enter your full name')
      setLoading(false)
      return
    }

    if (!email.trim()) {
      setError('Please enter your email address')
      setLoading(false)
      return
    }

    if (!password) {
      setError('Please enter a password')
      setLoading(false)
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    // Password strength validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (password.length > 128) {
      setError('Password is too long (maximum 128 characters)')
      setLoading(false)
      return
    }

    // Name validation
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters long')
      setLoading(false)
      return
    }

    if (name.length > 100) {
      setError('Name is too long (maximum 100 characters)')
      setLoading(false)
      return
    }

    try {
      const result = await api.auth.register({ 
        name: name.trim(), 
        email: email.toLowerCase().trim(), 
        password 
      })

      // Send OTP — use the registration token just for this call, don't persist it
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.token}`,
        },
      })

      // Store token temporarily so verify page can call resend — but don't login() yet
      // Full login happens after OTP is verified
      localStorage.setItem('pending_token', result.token)

      const params = new URLSearchParams({ email: email.toLowerCase().trim() })
      if (redirectTo) params.set('redirect', redirectTo)
      router.push(`/verify?${params.toString()}`)

    } catch (error: any) {
      console.error('Registration error:', error)
      
      // Handle specific error types from backend
      let errorMessage = 'Registration failed. Please try again.'
      
      if (error.message) {
        errorMessage = error.message
        
        // Add helpful suggestions for common errors
        if (error.message.includes('already exists')) {
          errorMessage += ' Try signing in instead.'
        } else if (error.message.includes('invalid email')) {
          errorMessage = 'Please enter a valid email address'
        } else if (error.message.includes('password')) {
          // Keep the specific password error message
          errorMessage = error.message
        }
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard heading="Create your account" subheading="Start analyzing your smart contracts for free">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <Input
              id="name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pr-10"
              disabled={loading}
            />
            <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pr-10"
              disabled={loading}
            />
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full gradient-brand text-white" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create account'}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By signing up you agree to our{' '}
          <span className="underline cursor-pointer hover:text-foreground">Terms</span> and{' '}
          <span className="underline cursor-pointer hover:text-foreground">Privacy Policy</span>
        </p>
      </form>

      <p className="text-center text-sm mt-6 text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={redirectTo ? `/login?redirect=${redirectTo}` : "/login"}
          className="font-semibold text-foreground hover:underline"
        >
          Sign in
        </Link>
      </p>

      <AuthDivider />
      <OAuthButtons mode="signup" redirectTo={redirectTo || undefined} />
    </AuthCard>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <AuthCard heading="Create your account" subheading="Start analyzing your smart contracts for free">
        <div className="h-48 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    }>
      <SignupForm />
    </Suspense>
  )
}