"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MetaGaugeLogo } from "@/components/icons/metagauge-logo"
import { Input } from "@/components/ui/input"
import { Search, LayoutDashboard, User, Users, Gauge, Building2, Bell, Lightbulb, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/startup", label: "Dashboard", icon: LayoutDashboard },
  { href: "/startup/users", label: "User & Wallet", icon: User },
  { href: "/startup/benchmark", label: "Competitive Benchmark", icon: Users },
  { href: "/startup/productivity", label: "Productivity Score", icon: Gauge },
  { href: "/startup/transactions", label: "Transactional Insight", icon: Building2 },
  { href: "/startup/notifications", label: "Notification", icon: Bell },
  { href: "/startup/insights", label: "Insight Centre", icon: Lightbulb },
  { href: "/startup/settings", label: "Setting", icon: Settings },
]

export function StartupSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r bg-card h-screen flex flex-col">
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <MetaGaugeLogo className="h-5 w-7" />
          <span className="font-semibold">MetaGauge</span>
        </Link>
      </div>

      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Type a command or search..." className="pl-9 text-sm" />
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  pathname === item.href || (item.href !== "/startup" && pathname.startsWith(item.href))
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
