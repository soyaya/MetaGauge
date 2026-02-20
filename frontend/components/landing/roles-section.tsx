"use client"

import { ArrowUpRight, TrendingUp, DollarSign } from "lucide-react"
import { useRouter } from "next/navigation"

const roles = [
  {
    icon: ArrowUpRight,
    title: "Startups & Builders",
    features: ["Monitor feature performance", "Optimize retention", "Benchmark Competitors"],
    rotation: "-rotate-6",
  },
  {
    icon: TrendingUp,
    title: "Researcher & Analysts",
    features: ["Monitor feature performance", "Optimize retention", "Benchmark Competitors"],
    rotation: "rotate-0",
  },
  {
    icon: DollarSign,
    title: "Investors & Funds",
    features: ["Monitor feature performance", "Optimize retention", "Benchmark Competitors"],
    rotation: "rotate-6",
  },
]

export function RolesSection() {
  const router = useRouter()

  const handleRoleClick = () => {
    // Check if user is logged in
    const token = localStorage.getItem("token")
    if (token) {
      router.push("/dashboard")
    } else {
      router.push("/login")
    }
  }

  return (
    <section className="px-6 py-16 md:py-24 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-12 justify-center">
        <div className="h-px bg-primary flex-1 max-w-24" />
        <h2 className="text-xl md:text-2xl font-semibold text-center">Data-Driven Decisions for Every Role</h2>
        <div className="h-px bg-primary flex-1 max-w-24" />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4">
        {roles.map((role, index) => (
          <div
            key={index}
            onClick={handleRoleClick}
            className={`bg-card border-2 border-primary/20 rounded-2xl p-6 w-full max-w-xs ${role.rotation} hover:rotate-0 transition-transform duration-300 cursor-pointer hover:border-primary`}
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <role.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-4">{role.title}</h3>
            <ul className="space-y-2">
              {role.features.map((feature, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-foreground">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
