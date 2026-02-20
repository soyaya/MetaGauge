"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, Wallet, Search } from "lucide-react"
import Image from "next/image"
import { Input } from "../ui/input"
import { useAuth } from "@/components/auth/auth-provider"

export function HeroSection() {
  const [contractAddress, setContractAddress] = useState("")
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  const handleAnalyze = () => {
    if (!contractAddress.trim()) {
      alert("Please enter a contract address")
      return
    }

    // Store the address for later use
    localStorage.setItem('pendingAnalysisAddress', contractAddress)

    if (isAuthenticated) {
      // User is logged in, go directly to analyzer
      router.push('/analyzer')
    } else {
      // User needs to login first
      router.push('/login?redirect=analyzer')
    }
  }

  return (
    <section className="px-6 py-12 md:py-20 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-balance">
          Meta Gauge: Measure,{" "}
          <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-full text-2xl md:text-4xl">
            Optimize
            <ArrowUpRight className="h-5 w-5 md:h-7 md:w-7" />
          </span>{" "}
          and Scale Your Web3 Project
        </h1>
        <p className="text-muted-foreground text-base md:text-lg mt-6">
          Track feature adoption, wallet behavior, and financial health across Ethereum, Polygon, and Starknet
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl mx-auto mt-8">
          <div className="relative flex-1 w-full">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Enter contract address (0x...)" 
              className="pl-10 font-mono text-sm"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleAnalyze}
            className="gap-2 w-full sm:w-auto"
            size="lg"
          >
            <Search className="h-4 w-4" />
            Analyze Contract
          </Button>
        </div>
        
      </div>

      <div className="relative mt-12">
        <div className="bg-gradient-to-b from-muted/50 to-background rounded-2xl p-4 shadow-xl border">
          <Image
            src="/images/home-page.jpg"
            alt="MetaGauge Dashboard Preview"
            width={1200}
            height={600}
            className="rounded-xl w-full object-cover object-top"
            style={{ maxHeight: "500px" }}
          />
        </div>
      </div>
    </section>
  )
}