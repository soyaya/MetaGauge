import type React from "react"
import { MetaGaugeLogo } from "@/components/icons/metagauge-logo"
import Link from "next/link"

interface AuthCardProps {
  children: React.ReactNode
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50/50 via-background to-blue-50/30 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-lg border p-8">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <MetaGaugeLogo className="h-6 w-8" />
          <span className="font-semibold text-lg">MetaGauge</span>
        </Link>
        {children}
      </div>
    </div>
  )
}
