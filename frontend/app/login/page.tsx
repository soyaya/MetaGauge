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

    if (!email || !password) {
      setError('Please enter both email and password')
      setIsLoading(false)
      return
    }

    try {
      // Use real API login
      const result = await api.auth.login({ email, password })
      
      // Update Global Auth State
      login(result.token, result.user)

      // Handle redirect logic
      if (redirectTo === 'analyzer') {
        router.push("/analyzer")
        return
      }

      // Default redirect to analyzer for first-time users, dashboard for returning users
      router.push("/analyzer")
      
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message || 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-muted-foreground mt-1">Welcome back to MetaGauge</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pr-10"
              disabled={isLoading}
            />
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••"
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

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      <p className="text-center text-sm mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthCard>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </AuthCard>
    }>
      <LoginForm />
    </Suspense>
  )
}
