"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/auth-provider"

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const redirectTo = searchParams.get('redirect')

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Validate OTP format
    if (otp.length !== 6) {
      alert('Please enter a 6-digit verification code')
      setLoading(false)
      return
    }

    try {
      // Call backend API to verify OTP
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp
        })
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.message || 'Verification failed')
        setLoading(false)
        return
      }

      const data = await response.json()
      
      // Login with real token from backend
      login(data.token, data.user)

      // Handle redirect based on user state
      if (redirectTo === 'analyzer') {
        router.push('/analyzer')
      } else if (!data.user.onboarding_completed) {
        router.push("/onboarding")
      } else {
        const roles = data.user.roles || []
        if (roles.includes('startup')) {
          router.push("/startup")
        } else {
          router.push("/dashboard")
        }
      }
    } catch (error) {
      console.error('Verification error:', error)
      alert('Failed to verify code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Verify Your Email</h1>
        <p className="text-muted-foreground mt-1">
          We sent a verification code to {email}
        </p>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Enter the 6-digit verification code sent to your email
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp">Verification Code</Label>
          <Input
            id="otp"
            type="text"
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            className="text-center text-lg tracking-widest"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
          {loading ? "Verifying..." : "Verify Email"}
        </Button>
      </form>

      <div className="text-center mt-6">
        <p className="text-sm text-muted-foreground">
          Didn't receive the code?{" "}
          <button 
            type="button"
            className="font-semibold hover:underline text-primary"
            onClick={() => {
              // Implement resend logic here
              alert("Resend functionality would be implemented here")
            }}
          >
            Resend
          </button>
        </p>
      </div>
    </AuthCard>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <AuthCard>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Verify Your Email</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </AuthCard>
    }>
      <VerifyForm />
    </Suspense>
  )
}