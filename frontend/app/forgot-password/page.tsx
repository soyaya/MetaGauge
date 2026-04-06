"use client"

import { useState } from "react"
import Link from "next/link"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Request failed')
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard heading="Reset your password" subheading="Enter your email and we'll send a reset link">
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 p-3 rounded-lg border border-green-200 dark:border-green-800">
            If an account exists for <strong>{email}</strong>, a reset link has been sent.
          </p>
          <Link href="/login" className="block text-center text-sm font-semibold text-primary hover:underline">
            Back to Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
          </div>
          <Button type="submit" className="w-full gradient-brand text-white" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Send Reset Link'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-semibold text-foreground hover:underline">Back to Sign in</Link>
          </p>
        </form>
      )}
    </AuthCard>
  )
}
