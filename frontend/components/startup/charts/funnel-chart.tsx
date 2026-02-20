"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"

const data = [
    { name: "Signups", value: 12500, fill: "#0ea5e9" },
    { name: "Activation", value: 4357, fill: "#38bdf8" },
    { name: "Retention", value: 3112, fill: "#7dd3fc" },
    { name: "Monetization", value: 2162, fill: "#bae6fd" },
]

interface FunnelChartProps {
    data?: any[]
}

export function FunnelChart({ data: propData }: FunnelChartProps) {
    const chartData = propData || data

    return (
        <div className="w-full space-y-4">
            {chartData.map((item) => (
                <div key={item.name} className="flex items-center gap-4">
                    <div className="w-32 font-medium text-sm">{item.name}</div>
                    <div className="relative flex-1 h-8 bg-muted/20 rounded-full overflow-hidden">
                        {/* Using a simple div for bar to control rounded corners and layout easily for funnel look */}
                        <div
                            className="h-full rounded-full flex items-center justify-end px-4 text-xs font-medium text-white transition-all duration-500"
                            style={{ width: `${(item.value / chartData[0].value) * 100}%`, backgroundColor: item.fill }}
                        >
                            {item.value.toLocaleString()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
