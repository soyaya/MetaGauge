import type React from "react"
import Link from "next/link"

interface AuthCardProps {
  children: React.ReactNode
  heading: string
  subheading: string
}

export function AuthCard({ children, heading, subheading }: AuthCardProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — brand (hidden on mobile, top strip on md, side panel on lg) */}
      <div className="hidden md:flex lg:w-[45%] gradient-brand flex-col justify-between p-8 lg:p-12 relative overflow-hidden lg:min-h-screen md:flex-row md:items-center md:gap-8 lg:flex-col lg:justify-between">
        {/* Background texture */}
        <div className="absolute inset-0 dot-grid opacity-10" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M3 13.5V21h4.5V13.5H3zm6.75-6V21H14.25V7.5H9.75zM16.5 3V21H21V3h-4.5z"/>
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">MetaGauge</span>
        </Link>

        {/* Center quote — hidden on md row layout */}
        <div className="relative space-y-6 hidden lg:block">
          <p className="text-white/90 text-2xl font-semibold leading-snug">
            "From raw transactions to investor-ready insights — in minutes."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">MG</div>
            <div>
              <p className="text-white text-sm font-medium">MetaGauge Platform</p>
              <p className="text-white/60 text-xs">Blockchain Analytics</p>
            </div>
          </div>
        </div>

        {/* Stats — hidden on md row layout */}
        <div className="relative grid grid-cols-3 gap-4 hidden lg:grid">
          {[['2+', 'Chains'], ['50+', 'Metrics'], ['Real-time', 'Indexing']].map(([v, l]) => (
            <div key={l} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-white font-bold text-lg">{v}</p>
              <p className="text-white/60 text-xs mt-0.5">{l}</p>
            </div>
          ))}
        </div>

        {/* md-only tagline */}
        <p className="text-white/80 text-sm lg:hidden">Blockchain analytics for serious builders</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-12 bg-background overflow-y-auto">
        {/* Mobile-only logo (< md) */}
        <Link href="/" className="flex items-center gap-2 mb-8 md:hidden">
          <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
              <path d="M3 13.5V21h4.5V13.5H3zm6.75-6V21H14.25V7.5H9.75zM16.5 3V21H21V3h-4.5z"/>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">MetaGauge</span>
        </Link>

        <div className="w-full max-w-[360px]">
          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{heading}</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">{subheading}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
