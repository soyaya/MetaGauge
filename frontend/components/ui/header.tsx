'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { BarChart3, Menu, X, Bell, User, LogOut, Zap, ChevronDown, Sun, Moon, Code2 } from 'lucide-react';
import { useTheme } from 'next-themes';

const NAV_AUTH = [
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/analyzer',   label: 'Analytics' },
  { href: '/chat',       label: 'AI Chat' },
  { href: '/alerts',     label: 'Alerts' },
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
  const [notifCount, setNotifCount] = useState(0);
  const [openTasks, setOpenTasks] = useState(0);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = () => Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/traction/productivity`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then(r => r.json()).catch(() => ({ open: 0 })),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/alerts`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then(r => r.json()).catch(() => ({ alerts: [] })),
    ]).then(([prod, alertData]) => {
      const unread = (alertData.alerts || []).filter((a: any) => !a.is_read).length;
      setOpenTasks(prod.open || 0);
      setNotifCount((prod.open || 0) + unread);
    });
    load();
    const interval = setInterval(load, 60000);
    window.addEventListener('notifications-refresh', load);

    // Real-time: bump count immediately when a new alert arrives via WebSocket
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'alert') setNotifCount(n => n + 1);
      } catch {}
    };

    return () => { clearInterval(interval); ws.close(); window.removeEventListener('notifications-refresh', load); };
  }, [isAuthenticated]);

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
                {/* Notifications icon with badge */}
                <Link href={openTasks > 0 ? '/agent' : '/alerts'}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all relative"
                  title={openTasks > 0 ? `${openTasks} open tasks` : 'Alerts'}>
                  <Bell className="w-4 h-4" />
                  {notifCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
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
                        <Link href="/developers" className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors">
                          <Code2 className="w-4 h-4 text-muted-foreground" />Developer API
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
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                  <User className="w-4 h-4" />Profile
                </Link>
                <Link href="/subscription" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                  <Zap className="w-4 h-4" />Billing
                </Link>
                <Link href="/developers" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                  <Code2 className="w-4 h-4" />Developer API
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
