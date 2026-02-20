"use client"

import Link from "next/link"
import { useState } from "react"
import { MetaGaugeLogo } from "@/components/icons/metagauge-logo"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/auth-provider"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { WalletConnect } from "@/components/web3/wallet-connect"
import { User, LogOut, BarChart3, History, MessageCircle, Menu, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-7xl mx-auto w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link href="/" className="flex items-center gap-2">
        <MetaGaugeLogo className="h-6 w-6 sm:h-8 sm:w-8" />
        <span className="font-semibold text-base sm:text-lg">MetaGauge</span>
      </Link>

      {isAuthenticated && (
        <>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/analyzer" className="text-sm font-medium hover:text-primary transition-colors">
              Analyzer
            </Link>
            <Link href="/chat" className="text-sm font-medium hover:text-primary transition-colors">
              Chat
            </Link>
            <Link href="/history" className="text-sm font-medium hover:text-primary transition-colors">
              History
            </Link>
          </nav>

          {/* Mobile Navigation */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <nav className="flex flex-col gap-4 mt-8">
                <Link 
                  href="/dashboard" 
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors p-2 rounded-md hover:bg-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link 
                  href="/analyzer" 
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors p-2 rounded-md hover:bg-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <BarChart3 className="h-4 w-4" />
                  Analyzer
                </Link>
                <Link 
                  href="/chat" 
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors p-2 rounded-md hover:bg-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </Link>
                <Link 
                  href="/history" 
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors p-2 rounded-md hover:bg-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <History className="h-4 w-4" />
                  History
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </>
      )}

      <div className="flex items-center gap-2 sm:gap-3">
        
        
        {/* Wallet Connection - Show for authenticated users */}
        {isAuthenticated && (
          <WalletConnect 
            enforceNetwork={false}
            className="hidden sm:block"
          />
        )}
        
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user?.email?.split('@')[0] || 'User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-red-600">
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </>
        )}

        <ThemeToggle />
      </div>
    </header>
  )
}
