"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, EyeOff, Eye, Loader2 } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { api } from "@/lib/api"
import { OAuthButtons } from "@/components/auth/oauth-buttons"
import { AuthDivider } from "@/components/auth/divider"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const redirectTo = searchParams.get('redirect')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Client-side validation
    if (!email.trim()) {
      setError('Please enter your email address')
      setIsLoading(false)
      return
    }

    if (!password) {
      setError('Please enter your password')
      setIsLoading(false)
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      setIsLoading(false)
      return
    }

    try {
      const result = await api.auth.login({ 
        email: email.toLowerCase().trim(), 
        password 
      })
      
      // If email not verified, send OTP and redirect to verify
      if (!result.user.emailVerified && !result.user.is_verified) {
        localStorage.setItem('pending_token', result.token)
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/send-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${result.token}` },
        })
        const params = new URLSearchParams({ email: email.toLowerCase().trim() })
        if (redirectTo) params.set('redirect', redirectTo)
        router.push(`/verify?${params.toString()}`)
        return
      }

      login(result.token, result.user)
      router.push(redirectTo ? decodeURIComponent(redirectTo) : '/dashboard')
      
    } catch (error: any) {
      console.error('Login error:', error)
      
      // Handle specific error types from backend
      let errorMessage = 'Login failed. Please try again.'
      
      if (error.message) {
        errorMessage = error.message
        
        // Add helpful suggestions for common errors
        if (error.message.includes('No account found')) {
          errorMessage += ' You may need to create an account first.'
        } else if (error.message.includes('Incorrect password')) {
          errorMessage += ' You can reset your password using the "Forgot Password" link.'
        } else if (error.message.includes('deactivated')) {
          errorMessage = error.message // Keep the full deactivation message
        }
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthCard heading="Welcome back" subheading="Sign in to your MetaGauge account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

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
              disabled={isLoading}
            />
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full gradient-brand text-white" disabled={isLoading}>
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm mt-6 text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-foreground hover:underline">
          Create one
        </Link>
      </p>

      <AuthDivider />
      <OAuthButtons mode="signin" redirectTo={redirectTo || undefined} />
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthCard heading="Welcome back" subheading="Sign in to your MetaGauge account">
        <div className="h-48 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    }>
      <LoginForm />
    </Suspense>
  )
}
