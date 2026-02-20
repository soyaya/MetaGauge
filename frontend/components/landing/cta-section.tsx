import { Button } from "@/components/ui/button"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="px-6 py-16 md:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Left placeholder image */}
            <div className="hidden md:block w-64 h-48 bg-gradient-to-br from-muted to-muted/50 rounded-xl" />

            {/* Center content */}
            <div className="text-center py-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Ready to see full Details</h2>
              <p className="text-muted-foreground mb-6">Sign up unlock full access</p>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>

            {/* Right placeholder image */}
            <div className="hidden md:block w-64 h-48 bg-gradient-to-br from-muted to-muted/50 rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  )
}
