// Shared chart color palette — white, black, blue theme
export const CHART_COLORS = [
  '#6366f1', // indigo-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#ec4899', // pink-500
]

export const CHART_PRIMARY   = '#6366f1'
export const CHART_SECONDARY = '#3b82f6'
export const CHART_ACCENT    = '#8b5cf6'
export const CHART_MUTED     = '#e0e7ff'

// Shared tooltip style — dark background, white text always
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#18181b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#ffffff',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
  },
  labelStyle: { color: 'rgba(255,255,255,0.6)', fontWeight: 600 },
  cursor: { fill: 'rgba(255,255,255,0.05)' },
  itemStyle: { color: '#ffffff' },
}

export const AXIS_STYLE = {
  tick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
  axisLine: { stroke: 'hsl(var(--border))' },
  tickLine: { stroke: 'hsl(var(--border))' },
}

export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border))',
  opacity: 0.6,
}
