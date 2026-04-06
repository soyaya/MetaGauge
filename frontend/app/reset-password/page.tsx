"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

function ResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Reset failed')
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <AuthCard heading="Invalid link" subheading="This reset link is missing or invalid.">
      <p className="text-center text-sm text-destructive">Please request a new password reset link.</p>
      <div className="mt-4 text-center">
        <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Request new link</Link>
      </div>
    </AuthCard>
  )

  return (
    <AuthCard heading="Set new password" subheading="Choose a strong password for your account">
      {done ? (
        <p className="text-center text-sm text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 p-3 rounded-lg border border-green-200 dark:border-green-800">
          Password updated! Redirecting to sign in…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required />
          </div>
          <Button type="submit" className="w-full gradient-brand text-white" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Reset Password'}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCard heading="Set new password" subheading="Choose a strong password"><p className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></p></AuthCard>}>
      <ResetForm />
    </Suspense>
  )
}
