'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Header } from '@/components/ui/header';
import { Footer } from '@/components/landing/footer';
import Link from 'next/link';

const iconProps = { className: "w-6 h-6 text-white", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 };

const BarChartIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V21h4.5V13.5H3zm6.75-6V21H14.25V7.5H9.75zM16.5 3V21H21V3h-4.5z"/></svg>;
const BrainIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75a6 6 0 0 1 6 6v.75a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-.75a6 6 0 0 1 6-6h.75zM9 12.75v3m3-3v3m3-9.75a3 3 0 0 1 3 3v.75M3.75 9a3 3 0 0 0-3 3v.75"/></svg>;
const BoltIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>;
const TrendingUpIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>;
const BellIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>;
const GlobeIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>;
const RocketIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/></svg>;
const CoinsIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const WrenchIcon = () => <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg>;

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return (
    <div className="page-shell flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-24 px-6 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 dot-grid opacity-60" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-8 fade-in-up">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live on Ethereum
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6 fade-in-up" style={{animationDelay:'80ms'}}>
            <span className="block text-foreground">Know your contract.</span>
            <span className="block gradient-brand-text">Grow your protocol.</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up" style={{animationDelay:'160ms'}}>
            MetaGauge transforms raw on-chain data into investor-ready insights — retention, activation, gas efficiency, and competitive intelligence. All in real time.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 fade-in-up" style={{animationDelay:'240ms'}}>
            <Link href="/signup"
              className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white gradient-brand shadow-glow hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-base">
              Start for free
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold border border-border bg-card hover:bg-secondary text-foreground transition-all duration-200 hover:-translate-y-0.5 text-base shadow-brand-sm">
              Sign in
            </Link>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-muted-foreground fade-in-up" style={{animationDelay:'320ms'}}>
            No credit card required · Free tier includes 3 analyses/month
          </p>
        </div>

        {/* Dashboard preview mockup */}
        <div className="relative max-w-5xl mx-auto mt-20 fade-in-up" style={{animationDelay:'400ms'}}>
          <div className="relative rounded-2xl border border-border bg-card shadow-brand-lg overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4 h-6 rounded-md bg-border/60 flex items-center px-3">
                <span className="text-xs text-muted-foreground">app.metagauge.io/dashboard</span>
              </div>
            </div>
            {/* Mock dashboard content */}
            <div className="p-6 bg-background/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[['Total Users','10','↑ 40%'],['DAU','9','↑ 12%'],['Retention','60%','↑ 5%'],['OPS Score','73/100','↑ 8']].map(([l,v,c])=>(
                  <div key={l} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">{l}</p>
                    <p className="text-2xl font-bold">{v}</p>
                    <p className="text-xs text-green-600 mt-1">{c}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-2 rounded-xl border border-border bg-card p-4 h-32 flex items-end gap-1">
                  {[40,55,48,62,58,70,65,80,75,90,85,100].map((h,i)=>(
                    <div key={i} className="flex-1 rounded-sm gradient-brand opacity-70" style={{height:`${h}%`}} />
                  ))}
                </div>
                <div className="rounded-xl border border-border bg-card p-4 h-32 flex flex-col justify-between">
                  {['D1: 20%','D7: 0%','D30: 0%'].map(t=>(
                    <div key={t} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t.split(':')[0]}</span>
                      <span className="font-semibold">{t.split(':')[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Glow under mockup */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/20 blur-2xl rounded-full" />
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <section className="py-12 border-y border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[['2','Chains supported'],['50+','Metrics tracked'],['Real-time','Live monitoring'],['Free','To get started']].map(([v,l])=>(
            <div key={l}>
              <p className="text-3xl font-black gradient-brand-text mb-1">{v}</p>
              <p className="text-sm text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Built for serious builders</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">From raw transactions to investor-ready traction reports — in minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger">
            {[
              { icon: <BarChartIcon />, title:'Real-time Analytics', desc:'Live indexing of your contract. DAU, WAU, MAU, retention, gas costs — all computed from actual on-chain data.' },
              { icon: <BrainIcon />, title:'AI-Powered Insights', desc:'Gemini AI generates SWOT analysis, growth recommendations, and competitive positioning automatically.' },
              { icon: <BoltIcon />, title:'Competitive Intelligence', desc:'Index competitor contracts and get side-by-side benchmarks with automated alerts when they overtake you.' },
              { icon: <TrendingUpIcon />, title:'Traction Reports', desc:'Generate investor-ready PDF reports with OPS scores, task lists, and growth metrics. Send directly by email.' },
              { icon: <BellIcon />, title:'Smart Alerts', desc:'Set custom thresholds on any metric. Get notified when churn spikes, retention drops, or a competitor surges.' },
              { icon: <GlobeIcon />, title:'Ethereum', desc:'Full Ethereum support with automatic chain detection and failover RPC providers.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card-premium border-gradient p-6 fade-in-up">
                <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center mb-4">{icon}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-muted/20 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Who uses MetaGauge?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <RocketIcon />, role:'Founders', desc:'Track user growth, retention, and activation. Know exactly what to fix to hit your next milestone.' },
              { icon: <CoinsIcon />, role:'Investors', desc:'Get traction reports with real on-chain data. No vanity metrics — just verified wallet activity.' },
              { icon: <WrenchIcon />, role:'Developers', desc:'Monitor gas efficiency, failure rates, and function adoption. Optimize before users notice.' },
            ].map(({ icon, role, desc }) => (
              <div key={role} className="rounded-2xl border border-border bg-card p-8 text-center shadow-brand-sm hover:shadow-brand-md transition-shadow">
                <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center mx-auto mb-4">{icon}</div>
                <h3 className="font-bold text-lg mb-3">{role}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl gradient-brand p-px shadow-glow">
            <div className="rounded-3xl bg-card px-8 py-16">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Start measuring today</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">Onboard your contract in 2 minutes. Get your first insights immediately.</p>
              <Link href="/signup"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white gradient-brand shadow-glow hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-lg">
                Get started free
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
