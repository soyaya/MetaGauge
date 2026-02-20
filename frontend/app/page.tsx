"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { Header } from "@/components/ui/header"
import { HeroSection } from "@/components/landing/hero-section"
import { RolesSection } from "@/components/landing/roles-section"
// import { CTASection } from "@/components/landing/cta-section"
import { Footer } from "@/components/landing/footer"

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-background to-blue-50/30">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  // Show landing page for non-authenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-background to-blue-50/30">
        <Header />
        <main>
          <HeroSection />
          <RolesSection />
          {/* <CTASection /> */}
        </main>
        <Footer />
      </div>
    )
  }

  // This shouldn't render due to the redirect, but just in case
  return null
}
