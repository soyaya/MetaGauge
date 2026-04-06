"use client"

import React, { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/auth-provider"
import { Loader2, Mail } from "lucide-react"

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token: authToken, login } = useAuth()

  // Use verified token if available, otherwise fall back to pending registration token
  const getToken = () => authToken || (typeof window !== 'undefined' ? localStorage.getItem('pending_token') : null)
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  const [resendMsg, setResendMsg] = useState("")
  const [countdown, setCountdown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const email = searchParams.get('email') || ''
  const redirectTo = searchParams.get('redirect')

  // Auto-focus OTP input
  useEffect(() => { inputRef.current?.focus() }, [])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const sendOtp = async (isResend = false) => {
    const token = getToken()
    if (!token) return
    isResend ? setResending(true) : null
    setResendMsg("")
    setError("")
    try {
      const res = await fetch(`${API}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (isResend) {
        setResendMsg('New code sent!')
        setCountdown(60)
        // Dev mode: show OTP in message
        if (data.devOtp) setResendMsg(`Dev mode — code: ${data.devOtp}`)
      }
    } catch {
      if (isResend) setError('Failed to resend code. Try again.')
    } finally {
      if (isResend) setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return }
    if (loading) return  // prevent double-fire
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Verification failed'); return }
      localStorage.removeItem('pending_token')
      login(data.token, data.user)
      router.push(redirectTo ? decodeURIComponent(redirectTo) : '/onboarding')
    } catch {
      setError('Failed to verify. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      handleSubmit({ preventDefault: () => {} } as any)
    }
  }, [otp]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthCard heading="Check your email" subheading={`We sent a 6-digit code to ${email}`}>
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center">
          <Mail className="w-7 h-7 text-white" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
        {resendMsg && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{resendMsg}</p>}

        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            ref={inputRef}
            id="otp"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full gradient-brand text-white" disabled={loading || otp.length !== 6}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Verify Email'}
        </Button>
      </form>

      <div className="text-center mt-4">
        <p className="text-sm text-muted-foreground">
          Didn't get it?{' '}
          {countdown > 0 ? (
            <span className="text-muted-foreground">Resend in {countdown}s</span>
          ) : (
            <button
              onClick={() => sendOtp(true)}
              disabled={resending}
              className="font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </p>
      </div>
    </AuthCard>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <AuthCard heading="Check your email" subheading="Enter the code we sent you">
        <div className="h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AuthCard>
    }>
      <VerifyForm />
    </Suspense>
  )
}
