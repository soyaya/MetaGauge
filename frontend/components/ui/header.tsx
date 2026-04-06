'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { BarChart3, Menu, X, Bell, User, LogOut, Zap, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

const NAV_AUTH = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/analyzer',  label: 'Traction' },
  { href: '/alerts',    label: 'Alerts' },
  { href: '/chat',      label: 'AI Chat' },
];
const NAV_PUBLIC = [
  { href: '/', label: 'Home' },
];

export function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close menus on route change
  useEffect(() => { setMobileOpen(false); setUserMenu(false); }, [pathname]);

  const links = isAuthenticated ? NAV_AUTH : NAV_PUBLIC;
  const active = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <>
      {/* ── Fixed header ──────────────────────────────────────────────────── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
        scrolled || mobileOpen
          ? 'bg-background/90 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4 relative">

          {/* Logo — always visible */}
          <Link href={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center shadow-sm group-hover:shadow-glow transition-shadow duration-200">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-base tracking-tight">MetaGauge</span>
          </Link>

          {/* Desktop nav — centered */}
          <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
            {links.map(({ href, label }) => (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                  active(href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}>
                {label}
              </Link>
            ))}
          </nav>

          {/* Spacer on mobile */}
          <div className="flex-1 md:hidden" />

          {/* Desktop spacer — pushes right actions to the right */}
          <div className="hidden md:flex flex-1" />

          {/* Spacer on desktop — pushes right actions to the right */}
          <div className="hidden md:block flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {isAuthenticated ? (
              <>
                {/* Alerts icon */}
                <Link href="/alerts"
                  className="w-9 h-9 rounded-lg hidden sm:flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                  <Bell className="w-4 h-4" />
                </Link>

                {/* User dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenu(v => !v)}
                    className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg hover:bg-muted/60 transition-all">
                    <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium hidden lg:block max-w-[90px] truncate">{user?.name}</span>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-150 ${userMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenu && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card shadow-lg py-1 z-50">
                        <div className="px-3 py-2.5 border-b border-border">
                          <p className="text-sm font-semibold truncate">{user?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                        <Link href="/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                          <User className="w-4 h-4 text-muted-foreground" />Profile
                        </Link>
                        <Link href="/subscription" className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                          <Zap className="w-4 h-4 text-muted-foreground" />Billing
                        </Link>
                        <div className="border-t border-border mt-1 pt-1">
                          <button
                            onClick={logout}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                            <LogOut className="w-4 h-4" />Sign out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login"
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                  Sign in
                </Link>
                <Link href="/signup"
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-semibold text-white gradient-brand shadow-sm hover:shadow-glow transition-all duration-200">
                  Get started
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              aria-label="Toggle menu">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3 space-y-1">
            {links.map(({ href, label }) => (
              <Link key={href} href={href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active(href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}>
                {label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link href="/alerts" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                  <Bell className="w-4 h-4" />Alerts
                </Link>
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                  <User className="w-4 h-4" />Profile
                </Link>
                <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                  <LogOut className="w-4 h-4" />Sign out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-1">
                <Link href="/login" className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted/60 transition-all">
                  Sign in
                </Link>
                <Link href="/signup" className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white gradient-brand">
                  Get started
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Spacer — pushes page content below fixed header ──────────────── */}
      <div className="h-16" />
    </>
  );
}
