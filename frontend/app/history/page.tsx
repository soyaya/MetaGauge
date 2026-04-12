'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { Header } from '@/components/ui/header';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, BarChart3, Bell, Users, AlertTriangle } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  analysis:   { icon: BarChart3, color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/40' },
  alert:      { icon: Bell,      color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/40' },
  snapshot:   { icon: Activity,  color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40' },
  competitor: { icon: Users,     color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/40' },
};

const STATUS_BADGE: Record<string, string> = {
  completed:   'bg-green-100 text-green-700',
  failed:      'bg-red-100 text-red-700',
  running:     'bg-blue-100 text-blue-700',
  unread:      'bg-amber-100 text-amber-700',
  read:        'bg-muted text-muted-foreground',
  good:        'bg-green-100 text-green-700',
  moderate:    'bg-yellow-100 text-yellow-700',
  'needs-work':'bg-red-100 text-red-700',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HistoryPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/history');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      (api as any).traction.getActivity()
        .then((d: any) => setEvents(d.events || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  const types = ['all', 'analysis', 'alert', 'snapshot', 'competitor'];
  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  return (
    <div className="page-shell">
      <Header />
      <main className="page-container max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Activity History</h1>
          <p className="text-sm text-muted-foreground">All analyses, alerts, snapshots and competitor events</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 flex-wrap">
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}>
              {t} {t === 'all' ? `(${events.length})` : `(${events.filter(e=>e.type===t).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /><span>Loading activity...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-1">
              {filtered.map((event, i) => {
                const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.analysis;
                const Icon = cfg.icon;
                return (
                  <div key={event.id} className="flex gap-4 group">
                    {/* Icon dot */}
                    <div className={`relative z-10 w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-1 border border-border`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="bg-card border border-border rounded-xl p-4 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold">{event.title}</span>
                              {event.status && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[event.status] || 'bg-muted text-muted-foreground'}`}>
                                  {event.status}
                                </span>
                              )}
                              {event.severity && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.severity==='high'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>
                                  {event.severity}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{event.detail}</p>
                            {/* Snapshot mini metrics */}
                            {event.type === 'snapshot' && event.meta && (
                              <div className="flex gap-3 mt-2 flex-wrap">
                                {[['OPS',event.meta.ops+'/100'],['DAU',event.meta.dau],['Retention',event.meta.retentionRate+'%'],['Tasks',event.meta.openTasks]].map(([l,v])=>(
                                  <span key={l} className="text-xs bg-muted/50 rounded px-2 py-0.5">
                                    <span className="text-muted-foreground">{l}: </span><strong>{v}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Analysis mini metrics */}
                            {event.type === 'analysis' && event.meta && (
                              <div className="flex gap-3 mt-2">
                                {event.meta.txs != null && <span className="text-xs bg-muted/50 rounded px-2 py-0.5"><span className="text-muted-foreground">Txs: </span><strong>{event.meta.txs}</strong></span>}
                                {event.meta.users != null && <span className="text-xs bg-muted/50 rounded px-2 py-0.5"><span className="text-muted-foreground">Users: </span><strong>{event.meta.users}</strong></span>}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{timeAgo(event.ts)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
