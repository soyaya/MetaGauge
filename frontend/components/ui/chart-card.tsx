'use client';
/**
 * ChartCard — unified chart wrapper for all analytics tabs.
 * Provides consistent card shell, title, optional subtitle, and
 * a pre-wired CustomTooltip that works in light + dark mode.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProps } from 'recharts';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  height?: number;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, height = 220, children, className = '' }: ChartCardProps) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <div style={{ height }}>{children}</div>
      </CardContent>
    </Card>
  );
}

/** Drop-in custom tooltip — themed, clean, no white box in dark mode */
export function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: any[];
  label?: any;
  formatter?: (v: any, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      {label != null && <p className="text-muted-foreground font-semibold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-foreground font-medium">
            {formatter ? formatter(p.value, p.name) : `${p.name}: ${p.value}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Gradient defs reused across area charts */
export function AreaGradients() {
  return (
    <defs>
      <linearGradient id="grad-primary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="grad-secondary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}
