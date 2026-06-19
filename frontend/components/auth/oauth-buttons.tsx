"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { api } from "@/lib/api"

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export function OAuthButtons({ mode = "signin", redirectTo }: { mode?: "signin" | "signup"; redirectTo?: string }) {
  const { login } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const label = mode === "signin" ? "Sign in" : "Sign up"

  const handleGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID missing)")
      return
    }
    setLoading(true)
    setError("")

    const initAndRequest = () => {
      // @ts-ignore
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) { setLoading(false); return }
          try {
            const result = await api.users.verifyWithGoogle(tokenResponse.access_token)
            login(result.token, result.user)
            router.push(redirectTo ? decodeURIComponent(redirectTo) : (result.user.onboarding?.completed ? '/dashboard' : '/onboarding'))
          } catch (err: any) {
            setError(err.message || "Google sign-in failed")
          } finally {
            setLoading(false)
          }
        },
      }).requestAccessToken()
    }

    // Wait up to 3s for the preloaded GSI script to be ready
    let attempts = 0
    const tryInit = () => {
      // @ts-ignore
      if (window.google?.accounts) {
        initAndRequest()
      } else if (attempts < 30) {
        attempts++
        setTimeout(tryInit, 100)
      } else {
        setError("Failed to load Google sign-in. Please try again.")
        setLoading(false)
      }
    }
    tryInit()
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <Button
        variant="outline"
        className="w-full justify-center gap-3 bg-transparent"
        type="button"
        onClick={handleGoogle}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        {label} with Google
      </Button>
    </div>
  )
}
