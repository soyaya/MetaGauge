import Link from "next/link"
import { MetaGaugeLogo } from "@/components/icons/metagauge-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Send } from "lucide-react"

export function Footer() {
  return (
    <footer className="px-6 py-12 md:py-16 max-w-7xl mx-auto">
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="flex items-center gap-2 mb-4">
          <MetaGaugeLogo className="h-6 w-8" />
          <span className="font-semibold text-lg">MetaGauge</span>
        </Link>

        <p className="text-muted-foreground max-w-md mb-8">
          Meta Gauge: Measure, Optimize, and Scale Your Web3 Project
        </p>

        <div className="flex items-center gap-2 w-full max-w-md mb-8">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="email" placeholder="Enter your email" className="pl-10" />
          </div>
          <Button className="gap-2">
            Try Now
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/docs" className="hover:text-foreground">
            Documentation
          </Link>
          <Link href="/api" className="hover:text-foreground">
            API
          </Link>
        </nav>
      </div>
    </footer>
  )
}
